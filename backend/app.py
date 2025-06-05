from flask import Flask, request, jsonify
from scraper import search_total_pages_and_series_count, process_data
from flask_cors import CORS
import logging
import queue
import sys
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import re
# Disabilita i log di Flask e Werkzeug (questo è sufficiente senza importare werkzeug)
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)  # Imposta il livello a ERROR per nascondere INFO e WARNING
# Funzione per ottenere il percorso base
def get_base_path():
    if getattr(sys, 'frozen', False):
        # Se l'app è "frozen" (impacchettata con PyInstaller)
        return sys._MEIPASS
    else:
        # Se l'app è in modalità sviluppo
        return os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
CORS(app)

# Configurazione logging
log_queue = queue.Queue()
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(os.path.expanduser('~'), 'app_logs.txt')),
        logging.StreamHandler(sys.stdout)
    ]
)

class QueueHandler(logging.Handler):
    def emit(self, record):
        log_queue.put(self.format(record))

queue_handler = QueueHandler()
logging.getLogger().addHandler(queue_handler)

# Le tue route esistenti rimangono le stesse
@app.route('/log', methods=['GET'])
def get_logs():
    logs = []
    while not log_queue.empty():
        logs.append(log_queue.get())
    return jsonify(logs)

@app.route('/log', methods=['GET'])
def stream_logs():
    def generate_logs():
        while True:
            try:
                log_message = log_queue.get(timeout=1)  # Attendi un nuovo log
                yield f"data: {log_message}\n\n"
            except queue.Empty:
                break  # Se la coda è vuota, interrompi lo streaming

    return app.response_class(generate_logs(), mimetype='text/event-stream')

@app.route('/api/check_query', methods=['POST'])
def check_query():
    try:
        data = request.get_json()
        query = data.get('query')
        apply_filters = data.get('apply_filters', False)
        filters = data.get('filters', {}) if apply_filters else None
        if filters:
            print("✅ filters ricevuti:", type(filters), filters)
            if not isinstance(filters, dict):
                raise ValueError(f"`filters` deve essere un dizionario, ma è {type(filters)}")
        if not query:
            logging.error("Query is required")
            return jsonify({"status": "error", "message": "Query is required"}), 400

        logging.info(f"📊 Checking query: {query} (Filters applied: {apply_filters})")


        # Setup Selenium
        options = webdriver.ChromeOptions()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        driver = webdriver.Chrome(options=options)

        # Passa i filtri a search_total_pages_and_series_count
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
        generate_file = data.get('generate_file', True)  # Default: True
        remove=data.get('remove',True)
        apply_filters= data.get('apply_filters', False)
        filters = data.get('filters', {}) if apply_filters else None
        if not query or not email:
            logging.error("Query and email are required")
            return jsonify({"status": "error", "message": "Query and email are required"}), 400   

        logging.info(f"Starting search for query: {query} with email: {email}")
        num_pages = int(num_pages) if num_pages else 2
        
        result = process_data(query, email, num_pages, keywords, m_s, file_type,mode,generate_file=generate_file,remove=remove,filters=filters)
        
        logging.info("Search completed successfully") 
        return jsonify({
            "status": "success",
            "pmid_list": result['pmid_list'],
            "gse_codes": result['gse_codes'],
            "dataframe": result["dataframe"],
            "file_path": result['file_path'] ,
            "json_data": result["json_data"]
        })
    except Exception as e:
        logging.error(f"An error occurred: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    try:
        port = 5000
        logging.info(f"Ready to Run version 2.0")
        app.run(port=port, host='127.0.0.1', debug=False)
    except Exception as e:
        logging.error("An error occurred: %s", str(e), exc_info=True)  # aggiungi exc_info per stack trace