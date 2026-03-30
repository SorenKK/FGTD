from flask import Flask, request, jsonify
# Aggiungi questi import in cima ad app.py
# Assicurati che lo scraper importi correttamente le sue dipendenze
from scraper import search_total_pages_and_series_count, process_data
from flask_cors import CORS
import logging
import queue
import sys
import os
import multiprocessing  # <--- IMPORT NECESSARIO PER WINDOWS

# --- IMPORT PER SELENIUM CORRETTO ---
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
# ------------------------------------

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import re

# Disabilita i log di Flask e Werkzeug
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

def get_base_path():
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    else:
        return os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
CORS(app)

# Configurazione logging
log_queue = queue.Queue()
# Modifica il percorso del log per scriverlo in una cartella scrivibile dall'utente
# (sys._MEIPASS è spesso sola lettura, meglio usare la home utente o la cartella temp)
log_path = os.path.join(os.path.expanduser('~'), 'app_logs.txt')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_path),
        logging.StreamHandler(sys.stdout)
    ]
)

class QueueHandler(logging.Handler):
    def emit(self, record):
        log_queue.put(self.format(record))

queue_handler = QueueHandler()
logging.getLogger().addHandler(queue_handler)

@app.route('/log', methods=['GET'])
def get_logs():
    """Polling endpoint used by ProcessingPage.js every second."""
    logs = []
    while not log_queue.empty():
        logs.append(log_queue.get())
    return jsonify(logs)

@app.route('/log/stream', methods=['GET'])
def stream_logs():
    """SSE endpoint — available for future use, not called by the current frontend."""
    def generate_logs():
        while True:
            try:
                log_message = log_queue.get(timeout=1)
                yield f"data: {log_message}\n\n"
            except queue.Empty:
                break
    return app.response_class(generate_logs(), mimetype='text/event-stream')

def _build_chrome_driver() -> webdriver.Chrome:
    """Factory centralizzata per il WebDriver.
    Usa ChromeDriverManager per trovare/scaricare automaticamente il driver
    compatibile sia in sviluppo che nell'AppImage PyInstaller.
    Centralizzare qui evita duplicazioni e garantisce che tutte le route
    usino esattamente le stesse opzioni Chrome.
    """
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--log-level=3')
    options.add_argument('--incognito')
    options.add_argument('--start-maximized')
    prefs = {
        "profile.default_content_setting_values.geolocation": 2,
        "profile.default_content_setting_values.notifications": 2,
    }
    options.add_experimental_option("prefs", prefs)
    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=options)


@app.route('/api/check_query', methods=['POST'])
def check_query():
    try:
        data = request.get_json()
        query = data.get('query')
        apply_filters = data.get('apply_filters', False)
        filters = data.get('filters', {}) if apply_filters else None
        
        if not query:
            logging.error("Query is required")
            return jsonify({"status": "error", "message": "Query is required"}), 400

        logging.info(f"📊 Checking query: {query} (Filters applied: {apply_filters})")

        # --- SETUP SELENIUM CORRETTO PER EXE ---
        options = webdriver.ChromeOptions()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        
        # Nascondi i log di console di Selenium/Chromedriver (opzionale ma pulito)
        options.add_argument("--log-level=3") 
        
        # IMPORTANTE: Usa ChromeDriverManager anche qui!
        # Altrimenti l'EXE non trova il driver sul computer dell'utente
        driver = webdriver.Chrome(options=options)
        # ---------------------------------------

        total_pages, series_count = search_total_pages_and_series_count(query, driver, filters)

        driver.quit()

        return jsonify({
            "status": "success",
            "total_pages": total_pages,
            "series_count": series_count
        })

    except Exception as e:
        logging.error(f"❌ Error in check_query: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/search', methods=['POST'])
def search():
    try:
        data = request.get_json()
        query = data.get('query')
        email = data.get('email')
        num_pages = data.get('num_pages', 2)
        keywords = data.get('keywords', 'tumor,bladder')
        m_s = data.get('m_s', 'Human,Mice')
        file_type = data.get('file_type', 'excel')   
        mode = data.get('mode', 'normal')
        generate_file = data.get('generate_file', True)
        remove = data.get('remove', True)
        apply_filters = data.get('apply_filters', False)
        filters = data.get('filters', {}) if apply_filters else None
        
        if not query or not email:
            logging.error("Query and email are required")
            return jsonify({"status": "error", "message": "Query and email are required"}), 400   

        logging.info(f"Starting search for query: {query} with email: {email}")
        num_pages = int(num_pages) if num_pages else 2
        
        result = process_data(query, email, num_pages, keywords, m_s, file_type, mode, generate_file=generate_file, remove=remove, filters=filters)
        
        logging.info("Search completed successfully") 
        return jsonify({
            "status": "success",
            "df_scores": result.get("df_scores", result.get("df_scores_dict")),
            "pmid_list": result['pmid_list'],
            "gse_codes": result['gse_codes'],
            "dataframe": result["dataframe"],
            "file_path": result['file_path'],
            "json_data": result["json_data"]
        })
    except Exception as e:
        logging.error(f"An error occurred: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    # --- FIX PER WINDOWS + PYINSTALLER + FLASK ---
    multiprocessing.freeze_support() 
    # ---------------------------------------------
    
    try:
        port = 5000
        logging.info(f"Ready to Run version 3.1.1")
        # debug=False è OBBLIGATORIO per PyInstaller (il reloader rompe l'app congelata)
        app.run(port=port, host='127.0.0.1', debug=False)
    except Exception as e:
        logging.error("An error occurred: %s", str(e), exc_info=True)
