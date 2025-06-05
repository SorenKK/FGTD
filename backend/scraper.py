from bs4 import BeautifulSoup
from selenium import webdriver
from webdriver_manager.chrome import ChromeDriverManager
import time
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.service import Service
from selenium.webdriver import ActionChains
import re
import pandas as pd
from Bio import Entrez,Medline
from io import StringIO
import random
import string
import os
import sys
import functools
import logging
import io
import numpy as np
from openpyxl import load_workbook
from openpyxl.styles import Font
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', handlers=[logging.StreamHandler(sys.stdout)])

####################################################FUNZIONI PER I FILTRI
def _expand_filters(driver):
    try:
        driver.find_element(By.ID, "more_filter_groups_link").click()
        time.sleep(0.3)
        for gid in ["fg_subVarTypeGds", "fg_sampleCountGds",
                    "fg_suppFileGds", "fg_field_search"]:
            cb = driver.find_element(By.ID, gid)
            if not cb.is_selected():
                cb.click()
        driver.find_element(By.ID, "filter_groups_apply").click()
        time.sleep(0.3)
    except Exception as e:
        logging.warning(f"Expand filters failed: {e}")

def autocomplete_filter(driver, filter_id, values, apply_btn_id):
    wait = WebDriverWait(driver, 12)
    values = [v.strip() for v in values if v.strip()]
    if not values:
        logging.debug(f"[{filter_id}] No values")
        return

    group_label = filter_id[:-3].capitalize()
    for v in values:
        logging.debug(f"[{filter_id}] Apro popup per «{v}»")
        wait.until(EC.element_to_be_clickable(
            (By.CSS_SELECTOR, f"a[href='#{filter_id}_more']"))
        ).click()

        inp = wait.until(EC.visibility_of_element_located(
            (By.CSS_SELECTOR, "div.facets_dialog input.of_sel_inp")))
        driver.execute_script("arguments[0].value = '';", inp)
        inp.send_keys(v)
        wait.until(lambda d: inp.get_attribute("value").strip() != "")
        inp.send_keys(Keys.RETURN)


        try:
            sidebar_ul = driver.find_element(
                By.XPATH,
                f"//li[contains(@class,'filter_grp') and .//h3[normalize-space()='{group_label}']]//ul"
            )
            link = sidebar_ul.find_element(
                By.CSS_SELECTOR,
                f"a[data-value_id='{v.lower()}']"
            )
            ActionChains(driver).move_to_element(link).click().perform()
            WebDriverWait(driver, 5).until(EC.staleness_of(link))  # opzionale
        except Exception as e:
            logging.warning(f"[{filter_id}] : {e}")

    try:
        btn = WebDriverWait(driver, 2).until(EC.element_to_be_clickable((By.ID, apply_btn_id)))
        driver.execute_script("""
            arguments[0].scrollIntoView({block:'center'});
            arguments[0].click();
        """, btn)
        WebDriverWait(driver, 5).until(EC.invisibility_of_element_located((By.ID, apply_btn_id)))
    except TimeoutException:
        logging.info(f"[{filter_id}] Apply ({apply_btn_id}) continue")


def apply_study_type_filter(driver, labels):
    wait = WebDriverWait(driver, 12)

    # 1) Attendi che qualsiasi dialog precedente sia sparito
    wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, "div.facets_dialog")))

    # 2) Trova e clicca il link Customize… di Study type
    customize = wait.until(EC.element_to_be_clickable((
        By.XPATH, "//a[@href='#studyTypeGds_more' and contains(.,'Customize')]"
    )))
    ActionChains(driver).move_to_element(customize).click().perform()
    logging.debug("[Study type] Customize…")
    #time.sleep(0.3)

    # 3) Attendi il popup e prendi l'HTML
    popup = wait.until(EC.visibility_of_element_located((
        By.CSS_SELECTOR, "#studyTypeGds_more .facets_dialog"
    )))
    html = popup.get_attribute("innerHTML")
    soup = BeautifulSoup(html, "html.parser")

    # 4) Costruisci mapping label → data-value_id
    all_items = soup.select("ul.facet_more[data-filter_id='studyTypeGds'] li")
    mapping = {
        li.find("label").get_text(strip=True): li.find("input")["data-value_id"]
        for li in all_items if li.find("input") and li.find("label")
    }

    # 5) Deseleziona tutti i checkbox selezionati
    for li in all_items:
        chk = li.find("input")
        if chk and chk.has_attr("checked"):
            dv = chk["data-value_id"]
            try:
                cb = wait.until(EC.element_to_be_clickable((
                    By.CSS_SELECTOR, f"#studyTypeGds_more input[data-value_id='{dv}']"
                )))
                if cb.is_selected():
                    cb.click()
            except Exception as e:
                logging.warning(f"[Study type] {dv}: {e}")

    # 6) Seleziona le checkbox richieste
    selected_dv_ids = []
    for label in labels:
        dv = mapping.get(label)
        if not dv:
            logging.warning(f"[Study type] `{label}` not found")
            continue
        chk = wait.until(EC.element_to_be_clickable((
            By.CSS_SELECTOR, f"#studyTypeGds_more input[data-value_id='{dv}']"
        )))
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", chk)
        if not chk.is_selected():
            chk.click()
            logging.debug(f"[Study type] Selection of `{label}`")
        selected_dv_ids.append(dv)
        #time.sleep(0.3)

    # 7) Click su Show e attendi chiusura del dialog
    show_btn = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "#studyTypeGds_apply")))
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", show_btn)
    driver.execute_script("arguments[0].click();", show_btn)
    logging.debug("[Study type] Show")
    wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, "#studyTypeGds_more .facets_dialog")))
    time.sleep(0.2)

    # 8) Clicca nella sidebar le stesse voci
    group_label = "Study type"
    for dv in selected_dv_ids:
        try:
            sidebar_ul = driver.find_element(
                By.XPATH,
                f"//li[contains(@class,'filter_grp') and .//h3[normalize-space()='{group_label}']]//ul"
            )
            link = sidebar_ul.find_element(
                By.CSS_SELECTOR,
                f"a[data-value_id='{dv}']"
            )
            logging.debug(f"[Study type] found «{dv}» in sidebar")
            ActionChains(driver).move_to_element(link).click().perform()
            time.sleep(0.5)
        except Exception as e:
            logging.warning(f"[Study type] «{dv}»: {e}")

def click_filter_links(driver, group_label,labels):
    logging.info("[Subset variable type]")
    wait = WebDriverWait(driver, 12)

    # 1) Attendi che qualsiasi dialog precedente sia sparito
    wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, "div.facets_dialog")))

    # 2) Trova e clicca il link Customize… di Subset variable type
    customize = wait.until(EC.element_to_be_clickable((
        By.XPATH, "//a[@href='#subVarTypeGds_more' and contains(.,'Customize')]"
    )))
    ActionChains(driver).move_to_element(customize).click().perform()
    logging.debug("[Subset variable] Customize…")
    time.sleep(0.2)

    # 3) Attendi il popup e prendi l'HTML
    popup = wait.until(EC.visibility_of_element_located((
        By.CSS_SELECTOR, "#subVarTypeGds_more .facets_dialog"
    )))
    html = popup.get_attribute("innerHTML")
    soup = BeautifulSoup(html, "html.parser")

    # 4) Costruisci mapping label → data-value_id
    all_items = soup.select("ul.facet_more[data-filter_id='subVarTypeGds'] li")
    mapping = {
        li.find("label").get_text(strip=True): li.find("input")["data-value_id"]
        for li in all_items if li.find("input") and li.find("label")
    }

    # 5) Deseleziona tutti i checkbox selezionati
    for li in all_items:
        chk = li.find("input")
        if chk and chk.has_attr("checked"):
            dv = chk["data-value_id"]
            try:
                cb = wait.until(EC.element_to_be_clickable((
                    By.CSS_SELECTOR, f"#subVarTypeGds_more input[data-value_id='{dv}']"
                )))
                if cb.is_selected():
                    cb.click()
                    logging.debug(f"[Subset variable] Deselezionato {dv}")
            except Exception as e:
                logging.warning(f"[Subset variable] Impossibile deselezionare {dv}: {e}")

    # 6) Seleziona le checkbox richieste
    selected_dv_ids = []
    for label in labels:
        dv = mapping.get(label)
        if not dv:
            logging.warning(f"[Subset variable] Voce `{label}` non trovata")
            continue
        chk = wait.until(EC.element_to_be_clickable((
            By.CSS_SELECTOR, f"#subVarTypeGds_more input[data-value_id='{dv}']"
        )))
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", chk)
        if not chk.is_selected():
            chk.click()
            logging.debug(f"[Subset variable] Selezionato `{label}`")
        selected_dv_ids.append(dv)
        #time.sleep(0.2)

    # 7) Click su Show e attendi chiusura del dialog
    show_btn = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "#subVarTypeGds_apply")))
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", show_btn)
    driver.execute_script("arguments[0].click();", show_btn)
    logging.debug("[Subset variable]")
    wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, "#subVarTypeGds_more .facets_dialog")))
    time.sleep(0.2)

    # 8) Clicca nella sidebar le stesse voci
    group_label = "Subset variable type"
    for dv in selected_dv_ids:
        try:
            sidebar_ul = driver.find_element(
                By.XPATH,
                f"//li[contains(@class,'filter_grp') and .//h3[normalize-space()='{group_label}']]//ul"
            )
            link = sidebar_ul.find_element(
                By.CSS_SELECTOR,
                f"a[data-value_id='{dv}']"
            )
            logging.debug(f"[Subset variable] «{dv}» in sidebar")
            ActionChains(driver).move_to_element(link).click().perform()
            time.sleep(0.3)
        except Exception as e:
            logging.warning(f"[Subset variable] Non ho potuto cliccare «{dv}»: {e}")

    logging.info("finished [Subset variable type]")



def apply_publication_date_range(driver, start_date, end_date):
    wait = WebDriverWait(driver, 10)

    # Apri il popup
    driver.find_element(By.ID, "facet_date_rangepubDatesGds").click()

    def set_field(field_id, val):
        logging.info(f"📝 Set {field_id} = {val}")
        field = wait.until(EC.presence_of_element_located((By.ID, field_id)))
        field.click()
        field.clear()
        field.send_keys(str(val))

    # START DATE
    set_field("facet_date_st_yearpubDatesGds", f"{start_date[0]:04d}")   # YYYY
    set_field("facet_date_st_monthpubDatesGds", f"{start_date[1]:02d}")  # MM
    set_field("facet_date_st_daypubDatesGds", f"{start_date[2]:02d}")    # DD

    # END DATE
    set_field("facet_date_end_yearpubDatesGds", f"{end_date[0]:04d}")    # YYYY
    set_field("facet_date_end_monthpubDatesGds", f"{end_date[1]:02d}")   # MM
    set_field("facet_date_end_daypubDatesGds", f"{end_date[2]:02d}")     # DD

    # Clicca su Apply
    time.sleep(0.3)
    apply_btn = wait.until(EC.element_to_be_clickable((By.ID, "facet_date_range_applypubDatesGds")))
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", apply_btn)
    driver.execute_script("arguments[0].click();", apply_btn)
    logging.info("[Date range] Filtro applicato")

def apply_supplementary_file_filter(driver, values):
    logging.info("Supplementary file")
    wait = WebDriverWait(driver, 12)

    values = [v.strip().upper() for v in values if v.strip()]
    print(values)
    if not values:
        logging.info("No supplementary files.")
        return

    default_ids = ["celGds", "gprGds", "wigGds", "bedGds"]
    added_ids = []

    for idx, val in enumerate(values):
        # Riapre sempre il Customize...
        wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, "div.facets_dialog")))
        customize = wait.until(EC.element_to_be_clickable((
            By.XPATH, "//a[@href='#suppFileGds_more' and contains(.,'Customize')]"
        )))
        ActionChains(driver).move_to_element(customize).click().perform()
        logging.info("[Supplementary file] Customize...")
        time.sleep(0.3)

        # Attendi popup e prendi HTML
        popup = wait.until(EC.visibility_of_element_located((
            By.CSS_SELECTOR, "#suppFileGds_more .facets_dialog"
        )))
        html = popup.get_attribute("innerHTML")
        soup = BeautifulSoup(html, "html.parser")

        # 1° ciclo: deflagga i 4 default se è la prima iterazione
        if idx == 0:
            for dv in default_ids:
                try:
                    cb = wait.until(EC.element_to_be_clickable((
                        By.CSS_SELECTOR, f"#suppFileGds_more input[data-value_id='{dv}']"
                    )))
                    if cb.is_selected():
                        cb.click()
                        logging.debug(f"[Supplementary file] Deselezionato default: {dv}")
                except Exception as e:
                    logging.warning(f"[Supplementary file] Errore nel deselezionare {dv}: {e}")

        # Inserisce il nuovo valore via autocomplete
        try:
            inp = wait.until(EC.visibility_of_element_located((
                By.CSS_SELECTOR, "div.facets_dialog input.of_sel_inp"
            )))
            driver.execute_script("arguments[0].value = '';", inp)
            #time.sleep(0.3)
            inp.send_keys(val)
            time.sleep(0.2)
            inp.send_keys(Keys.RETURN)
            logging.debug(f"[Supplementary file] Inserito {val}")
            added_ids.append(val)
            #time.sleep(0.3)
        except Exception as e:
            logging.warning(f"[Supplementary file] Errore durante inserimento {val}: {e}")

    # Seleziona tutte le checkbox corrispondenti
    wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, "div.facets_dialog")))
    customize = wait.until(EC.element_to_be_clickable((
        By.XPATH, "//a[@href='#suppFileGds_more' and contains(.,'Customize')]"
    )))
    ActionChains(driver).move_to_element(customize).click().perform()
    time.sleep(0.3)

    popup = wait.until(EC.visibility_of_element_located((
        By.CSS_SELECTOR, "#suppFileGds_more .facets_dialog"
    )))
    for val in added_ids:
        try:
            cb = wait.until(EC.element_to_be_clickable((
                By.CSS_SELECTOR, f"#suppFileGds_more input[data-value_id='{val}']"
            )))
            if not cb.is_selected():
                cb.click()
                logging.debug(f"[Supplementary file] Selezionato {val}")
        except Exception as e:
            logging.warning(f"[Supplementary file] Impossibile selezionare {val}: {e}")
        time.sleep(0.3)

    # Click finale su Show
    try:
        show_btn = wait.until(EC.element_to_be_clickable((By.ID, "suppFileGds_apply")))
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", show_btn)
        driver.execute_script("arguments[0].click();", show_btn)
        logging.debug("[Supplementary file] Show")
        wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, "#suppFileGds_more .facets_dialog")))
    except Exception as e:
        logging.warning(f"[Supplementary file] Show non cliccabile: {e}")

    # Clicca nella sidebar
    group_label = "Supplementary file"
    for val in added_ids:
        try:
            sidebar_ul = driver.find_element(
                By.XPATH,
                f"//li[contains(@class,'filter_grp') and .//h3[normalize-space()='{group_label}']]//ul"
            )
            link = sidebar_ul.find_element(
                By.CSS_SELECTOR,
                f"a[data-value_id='{val}']"
            )
            logging.debug(f"[Supplementary file] {val} ")
            ActionChains(driver).move_to_element(link).click().perform()
            time.sleep(0.3)
        except Exception as e:
            logging.warning(f"[Supplementary file]  {val} : {e}")

    logging.info("Finished [Supplementary file]")

def apply_all_filters(driver, filters):

    _expand_filters(driver)

    if filters.get("organism"):
        autocomplete_filter(driver, "organismGds", filters["organism"], "organismGds_apply")

    if filters.get("study_type"):
        apply_study_type_filter(driver, filters["study_type"])

    if filters.get("subset_type"):
        click_filter_links(driver, "Subset variable type", filters["subset_type"])

    if filters.get("supp_file"):
        apply_supplementary_file_filter(driver, filters["supp_file"])
    if filters.get("date_range"):
        date_range = filters.get("date_range")

        if (
            isinstance(date_range, list) and
            len(date_range) == 2 and
            all(isinstance(d, list) and len(d) == 3 and all(isinstance(x, int) for x in d) for d in date_range)
        ):
            start_date, end_date = date_range
            logging.info(f"📆 date range: {start_date} -> {end_date}")
            apply_publication_date_range(driver, start_date, end_date)
        else:
            logging.warning("⚠️ Skipping date range filter: invalid or missing format")


################################################################

def get_resource_path(relative_path):
    """Ottiene il percorso assoluto per le risorse, funziona sia in development che quando impacchettato"""
    if getattr(sys, 'frozen', False):
        # Se l'applicazione è "frozen" (impacchettata con PyInstaller)
        application_path = sys._MEIPASS
    else:
        # Se siamo in modalità development
        application_path = os.path.dirname(os.path.abspath(__file__))
    
    return os.path.join(application_path, relative_path)


def fetch_mesh_terms(pmid, max_retries=3):
    for attempt in range(max_retries):
        try:
            handle = Entrez.efetch(db="pubmed", id=pmid, rettype="medline", retmode="text")
            records = Medline.parse(handle)
            mesh_terms = []
            for record in records:
                if "MH" in record:
                    cleaned_terms = [term.strip() for term in record["MH"]]
                    mesh_terms.extend(cleaned_terms)
            handle.close()
            
            if not mesh_terms:
                return "No MeSH terms found"
            else:
                return mesh_terms
        
        except Exception as e:
            if attempt < max_retries - 1:  # se non è l'ultimo tentativo
                wait_time = (2 ** attempt) + random.uniform(0, 1) - random.uniform(0.005,0.010)  # backoff esponenziale con jitter
                logging.warning(f"Error retrieving MeSH terms for PMID {pmid}. Retrying in {wait_time:.2f} seconds.")
                logging.error(f"Details error: {str(e)}")
                time.sleep(wait_time)
            else:
                logging.error("Failed to retrieve MeSH terms for PMID {pmid} after {max_retries} attempts.")
                return f"Error fetching MeSH terms for PMID {pmid}: {str(e)}"

    return f"Failed to fetch MeSH terms for PMID {pmid} after {max_retries} attempts"
def extract_summary(page_source):
    try:
        soup = BeautifulSoup(page_source, 'html.parser')
        # Trova il <td> contenente il testo "Summary"
        summary_row = soup.find('td', string='Summary')
        if summary_row:
            # Trova il prossimo <td> con il testo della Summary
            summary_text = summary_row.find_next('td').get_text(strip=True)
            return summary_text
        else:
            return None
    except Exception as e:
        logging.error(f"Error extracting Summary: {e}")
        return None

def fetch_abstract(pmid):
  time.sleep(0.10)
  handle = Entrez.efetch(db="pubmed", id=pmid, rettype="Medline", retmode="text")
  rec = handle.read()
  handle.close()
  
  rec_file = StringIO(rec)
  medline_rec = Medline.read(rec_file)
  
  if "AB" in medline_rec:
    return medline_rec["AB"]
  else:
    return None

def search_total_pages_and_series_count(query, driver, filters=None):
    base_url = "https://www.ncbi.nlm.nih.gov/gds"
    
    try:
        driver.get(base_url)
        # Esegui la ricerca della query
        search_box = WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.NAME, "term"))
        )
        search_box.clear()
        search_box.send_keys(query)
        search_box.submit()
        
        logging.info(f"✅ Successfully typed and submitted search query: {query}")
        series_button=WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.CSS_SELECTOR, "a[data-value_id='seriesGds']"))).click
        series_button()
        time.sleep(0.2)  # per sicurezza
        # Seleziona la categoria 'Series'
        if filters:
            apply_all_filters(driver, filters)
        # Get the series count - fix the find_next_sibling issue
        # Instead of using find_next_sibling, use an appropriate XPath or CSS selector
        series_count_element = driver.find_element(By.CSS_SELECTOR, "a[data-value_id='seriesGds'] + span")
        series_count_text = series_count_element.text
        
        # Estrai il numero totale di pagine
        total_pages_element = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input#pageno2"))
        )
        total_pages = total_pages_element.get_attribute("last")
        
        # Estrai il numero di series accanto alla categoria
        series_count = int(re.sub(r'[(),]', '', series_count_text))
        logging.info(f"Total pages found: {total_pages}")
        logging.info(f"Total series count: {series_count}")
        
        return int(total_pages), series_count
        
    except Exception as e:
        logging.error(f"❌ Failed to retrieve total pages or series count: {e}")
        return 0, 0

def search_geo_datasets(query, driver, num_pages=3, max_retries=5,filters=None):
    gse_codes = set()
    base_url = "https://www.ncbi.nlm.nih.gov/gds"

    # Vai alla pagina iniziale di GEO DataSets
    driver.get(base_url)

    # Controlla se la pagina mostra un errore 500 e gestisci il retry
    page_html = driver.page_source.lower()
    if "500" in page_html and "internal server error" in page_html:
        logging.info("🔄 NCBI internal error detected, retrying...")

        retries = 0
        wait_time = 2  # Secondi di attesa iniziali

        while retries < max_retries:
            driver.get(base_url)  # 🚀 Ricarica la pagina
            page_html = driver.page_source

            # Verifica se il pulsante "Log in" è presente
            soup = BeautifulSoup(page_html, "html.parser")
            login_button = soup.find("a", {"id": "account_login"})

            if login_button:
                logging.info("🔹 'Log in' button detected, waiting 1 second before continuing...")
                time.sleep(0.3)  # Aspetta 1 secondo prima di fare la ricerca

            # Controlla se l'errore 500 è ancora presente
            if "500" not in page_html.lower() and "internal server error" not in page_html.lower():
                logging.info("✅ Successfully reloaded NCBI GEO DataSets page.")
                break  # Esci dal ciclo se la pagina è stata ricaricata con successo

            logging.warning(f"⚠️ Error 500 persists. Retrying in {wait_time} seconds...")
            time.sleep(wait_time)
            wait_time *= 2  # Exponential backoff
            retries += 1

        if retries == max_retries:
            logging.error("❌ Max retries reached. Could not bypass NCBI Internal Server Error.")
            return []  # Interrompi se non possiamo recuperare dalla pagina di errore

    # **Esegui la ricerca della query dopo il retry**
    search_attempts = 0
    while search_attempts < 3:  # Prova fino a 3 volte
        try:
            search_box = WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.NAME, "term"))
            )
            search_box.clear()
            search_box.send_keys(query)
            search_box.submit()
            logging.info(f"✅ Successfully typed and submitted search query: {query}")
            break  # Esci dal loop se la ricerca è riuscita
        except Exception as e:
            logging.warning(f"⚠️ Search box not found on attempt {search_attempts + 1}. Retrying...")
            search_attempts += 1
            time.sleep(2)  # Aspetta un po' e riprova
    else:
        logging.error("❌ Failed to find search box after multiple attempts.")
        return []
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.CSS_SELECTOR, "a[data-value_id='seriesGds']"))).click()
    time.sleep(0.2)  # per sicurezza
    if filters:
        apply_all_filters(driver, filters)
    # Scorri le pagine dei risultati e raccogli i codici GSE
    for page in range(num_pages):
        try:
            # Attendi il caricamento dei risultati
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, "rprt"))
            )

            # Estrarre il contenuto della pagina
            search_soup = BeautifulSoup(driver.page_source, "html.parser")
            dataset_titles = search_soup.find_all("div", class_="rprt")

            for title in dataset_titles:
                title_text = title.get_text().strip()
                gse_matches = re.findall(r"GSE\d+", title_text)
                for gse_code in gse_matches:
                    gse_codes.add(gse_code)

            # Navigazione tra pagine
            next_buttons = driver.find_elements(By.CSS_SELECTOR, "a.next")

            if next_buttons:
                if page == num_pages-1:
                    logging.info("⏳ Final page reached, waiting briefly...")
                    time.sleep(0.5)
                first_gse = None
                if dataset_titles:
                    first_gse_match = re.search(r"GSE\d+", dataset_titles[0].get_text())
                    if first_gse_match:
                        first_gse = first_gse_match.group()

                next_buttons[0].click()
                logging.info(f"➡️ Clicked 'Next' to go to page {page + 2}")
                time.sleep(0.5)  # Lascia un attimo per iniziare il rendering

                # Aspetta che il primo GSE della nuova pagina sia diverso da quello precedente
                WebDriverWait(driver, 10).until(lambda d: (
                    first_gse not in d.page_source if first_gse else True
                ))

            else:
                logging.info(f"🔹 No 'Next' button found - Page {page + 1}")
                break

        except Exception as e:
            logging.error(f"❌ Error in search - Page {page + 1}: {e}")

            # Se c'è un problema, prova a ricaricare la ricerca
            try:
                search_box = WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.NAME, "term"))
                )
                search_box.clear()
                search_box.send_keys(query)
                search_box.submit()
            except Exception as e:
                logging.error(f"❌ Failed to restart search: {e}")
                break  # Esci dal loop se la ricerca non può essere ripetuta

    return list(gse_codes)

def extract_samples(driver):
    try:
        samples_table_xpath = "//td[starts-with(text(), 'Samples')]/following-sibling::td//table"
        sample_table = WebDriverWait(driver, 16).until(
            EC.presence_of_element_located((By.XPATH, samples_table_xpath))
        )

        sample_rows_xpath = ".//tr"
        sample_rows = sample_table.find_elements(By.XPATH, sample_rows_xpath)

        if not sample_rows:
            logging.warning("Sample rows not found.")
            return "Not found"
        
        samples = []
        for row in sample_rows:
            cells = row.find_elements(By.TAG_NAME, "td")
            if len(cells) > 1:
                sample_id = cells[0].text.strip()  # Estrai il GSM
                sample_description = cells[1].text.strip()  # Estrai la descrizione
                samples.append(sample_id)  # Combina link e descrizione

        return "; ".join(samples)  # Ritorna i campioni formattati
    except TimeoutException:
        logging.warning("Timeout: Sample rows not found.")
        return "Not found"
    except Exception as e:
        logging.error(f'Error extracting Samples with links: {e}')
        return "Not found"
    
def extract_organisms(page_source):
    try:
        # Parsing dell'HTML
        soup = BeautifulSoup(page_source, 'html.parser')
        
        # Cerca la riga che contiene "Organisms"
        organisms_row = soup.find('td', string=lambda x: x and ('Organisms' in x or 'Organism' in x))
        if organisms_row:
            # Trova la cella accanto a quella con "Organisms"
            organisms_cell = organisms_row.find_next('td')
            if organisms_cell:
                # Trova tutti gli elementi <a> nella cella
                links = organisms_cell.find_all('a')
                organism_texts = []
                
                for link in links:
                    # Estrai il nome dell'organismo
                    organism_name = link.text.strip()
                    organism_texts.append(organism_name)
                
                # Unisci gli organismi trovati con una virgola
                return ', '.join(organism_texts)
        
        return "Not found"
    except Exception as e:
        logging.error(f'Errore extracting Organisms: {e}')
        return "Not found"
def extract_platform(page_source):
    try:
        # Parsing dell'HTML
        soup = BeautifulSoup(page_source, 'html.parser')

        # Cerca la riga che contiene "Platforms" o "Platform"
        platform_row = soup.find('td', string=lambda x: x and ('Platforms' in x or "Platform" in x))

        if platform_row:
            # Trova la tabella successiva alla riga Platforms
            table = platform_row.find_next('table')
            if table:
                # Trova tutte le righe nella tabella
                rows = table.find_all('tr')
                platform_data = []

                for row in rows:
                    # Estrai il codice GPL e la descrizione
                    gpl_cell = row.find('a')  # Prima cella: codice GPL
                    description_cell = row.find_all('td')[1]  # Seconda cella: descrizione della piattaforma

                    if gpl_cell and description_cell:
                        gpl_code = gpl_cell.text.strip()
                        description = description_cell.text.strip()
                        platform_data.append((gpl_code, description))  # Salva i dati come tuple

                return platform_data  # Ritorna una lista di tuple (GPL_code, Platform_description)

        return "Not found"
    
    except Exception as e:
        logging.error(f'Error extracting Platform: {e}')
        return "Not found"
    
def extract_sample_count(driver):
    try:
        # XPath per trovare la cella contenente il testo "Samples"
        samples_td_xpath = '//td[contains(text(), "Samples")]'
        samples_td_element = WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.XPATH, samples_td_xpath))
        )
        # Estrai il testo dalla cella
        samples_td_text = samples_td_element.text.strip()
        # Trova il numero tra parentesi
        sample_count = re.search(r'\((\d+)\)', samples_td_text).group(1)
        return int(sample_count)
    except TimeoutException:
        logging.error('Timeout: Unable to find Sample Count')
        return "Not found"
    except Exception as e:
        logging.error(f'Error extracting Sample Count {e}')
        return "Not found"

def extract_date(status): #accetta status per estrarre data
    # Estrarre la data usando una regex
    match = re.search(r'(\w+) (\d{2}), (\d{4})', status) # cerca una parola con spazio e poi due cifre , segue la virgola e poi 4 numeri
    if match:
        # Convertire il mese da nome a numero
        month_str = match.group(1) #il mese è la stringa
        day = match.group(2) #il giorno i due giorni
        year = match.group(3) #l'anno i 4 numeri
        # Dizionario per convertire il mese in numero
        months = {"Jan" :"01",
            "January": "01",
            "February": "02","Feb":"02",
            "March": "03", "Mar": "03",
            "April": "04", "Apr" : "04",
            "May": "05",
            "June": "06", "Jun" : "06",
            "July": "07", "Jul" : "07",
            "August": "08", "Aug" : "08",
            "September": "09", "Sep" :"09", "Sept" : "09",
            "October": "10", "Oct" :"10",
            "November": "11", "Nov" :"11",
            "December": "12" , "Dec" : "12"
        }
        #usa un dizionario per convertire le parole in numeri
        month = months[month_str] # utilizza il mese in stringa ed associa un numero
        # Restituire la data nel formato desiderato
        return f"{day}/{month}/{year}"
    return None

def create_output_file(dataframe, query, file_type):
    random_number = random.randint(1, 10000)
    random_letter = random.choice(string.ascii_letters)
    
    if file_type.lower() == 'excel':
        file_name = f"{query}_analysis_{random_number}{random_letter}.xlsx"

        # Scrivi il file Excel
        dataframe.to_excel(file_name, index=False)
        
        # Carica il file appena creato
        workbook = load_workbook(file_name)
        sheet = workbook.active
        
        # Colonne da rendere ipertestuali
        link_columns = [
            "Series Matrix Link", 
            "SOFT formatted family file(s) Link", 
            "MINiML formatted family file(s) Link",
            "Title/PMID", "Geo2R", "BioProject link", "Other link and GDV","SRA Run Selector","GSE", "Samples_1","Samples_2","Samples_3","Instrument_1","Instrument_2","Instrument_3"
        ]
        
        # Aggiungi i collegamenti ipertestuali
        for column_name in link_columns:
            if column_name in dataframe.columns:
                link_col_idx = dataframe.columns.get_loc(column_name) + 1  # Colonne in Excel iniziano da 1
                
                for row_idx in range(2, len(dataframe) + 2):  # Dalla seconda riga (dopo l'intestazione)
                    cell = sheet.cell(row=row_idx, column=link_col_idx)
                    cell_value = cell.value
                    
                    # Verifica se il valore inizia con "https:"
                    if isinstance(cell_value, str) and cell_value.startswith("https:"):
                        cell.hyperlink = cell_value  # Imposta il valore della cella come hyperlink
                        cell.font = Font(color="0000FF", underline="single")  # Stile ipertestuale
        
        # Salva il file aggiornato
        workbook.save(file_name)
        logging.info(f"Excel file saved as {file_name}")
    
    elif file_type.lower() == 'csv':
        file_name = f"{query}_analysis_{random_number}{random_letter}.csv"
        dataframe.to_csv(file_name, index=False)
        logging.info(f"CSV file saved as {file_name}")
    else:
        raise ValueError("File type must be either 'excel' or 'csv'")
    
    return file_name



def extract_title(page_source):

    try:
        soup = BeautifulSoup(page_source, 'html.parser')
        title_row = soup.find('td', string='Title')  # Trova la cella con il testo "Title"
        if title_row:
            title_cell = title_row.find_next_sibling('td')  # La cella successiva contiene il titolo
            if title_cell:
                title_text = title_cell.get_text(strip=True)  # Pulisce il testo
                return title_text
        return "Not found"
    except Exception as e:
        logging.error(f"Error extracting title: {e}")
        return "Not found"
    
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def extract_geo2r(page_source, gse):
    try:
        # Parsing dell'HTML
        soup = BeautifulSoup(page_source, 'html.parser')

        # Trova lo span con ID geo2r
        geo2r_span = soup.find('span', id='geo2r')
        if geo2r_span:
            # Verifica se il bottone "Analyze with GEO2R" è presente nello span
            button = geo2r_span.find('button', id='geo2r_button')
            if button and 'Analyze with GEO2R' in button.get_text(strip=True):
                # Costruisci il link solo se il bottone è effettivamente presente
                geo2r_link = f"https://www.ncbi.nlm.nih.gov/geo/geo2r/?acc={gse}"
                return geo2r_link
        return "Not found"
    except Exception as e:
        logging.error(f"Error extracting Geo2R for GSE {gse}: {e}")
        return "Not found"
    
def extract_bioproject(page_source):
    try:
        # Parsing dell'HTML
        soup = BeautifulSoup(page_source, 'html.parser')
        
        # Cerca la riga che contiene 'BioProject'
        bioproject_row = soup.find('td', string=lambda x: x and 'BioProject' in x)
        if bioproject_row:
            # Trova la cella successiva con il link al BioProject
            bioproject_cell = bioproject_row.find_next_sibling('td')
            if bioproject_cell:
                bioproject_link = bioproject_cell.find('a')  # Cerca il primo tag <a>
                if bioproject_link:
                    bioproject_url = bioproject_link['href'].strip()  # Ottieni il valore di href
                    
                    # Controlla se l'URL è relativo e aggiungi il prefisso
                    if bioproject_url.startswith("/bioproject"):
                        bioproject_url = f"https://www.ncbi.nlm.nih.gov{bioproject_url}"
                    
                    return bioproject_url
        
        # Caso alternativo: controllo per span con classe specifica
        bioproject_span = soup.find('span', class_='gp_id')
        if bioproject_span:
            bioproject_link = bioproject_span.find('a')  # Cerca il primo tag <a>
            if bioproject_link:
                bioproject_url = bioproject_link['href'].strip()
                
                # Controlla se l'URL è relativo
                if bioproject_url.startswith("/bioproject"):
                    bioproject_url = f"https://www.ncbi.nlm.nih.gov{bioproject_url}"
                
                return bioproject_url

        # Se il BioProject non viene trovato
        return "Not found"
    except Exception as e:
        logging.error(f"Error extracting BioProject: {e}")
        return "Not found"

    
def extract_download_and_gdv(page_source, gse):
    try:
        # Parsing dell'HTML
        soup = BeautifulSoup(page_source, 'html.parser')
        links = []

        # Controlla la presenza del bottone Genome Data Viewer
        gdv_button = soup.find('button', id='gdv_button')
        if gdv_button and 'See on Genome Data Viewer' in gdv_button.get_text(strip=True):
            gdv_link = f"https://www.ncbi.nlm.nih.gov/gdv/browser/?context=GEO&acc={gse}"
            links.append(gdv_link)
        
        # Controlla la presenza del bottone Download RNA-seq counts
        download_button = soup.find('button', id='download_button')
        if download_button and 'Download RNA-seq counts' in download_button.get_text(strip=True):
            download_link = f"https://www.ncbi.nlm.nih.gov/geo/download/?acc={gse}"
            links.append(download_link)

        # Se ci sono entrambi i link, unirli con '_'
        if links:
            return " _ ".join(links)
        
        return "Not found"
    except Exception as e:
        logging.error(f"Error extracting Download & GDV for GSE {gse}: {e}")
        return "Not found"
    
def extract_pmid_bs4(page_source):
    try:
        soup = BeautifulSoup(page_source, 'html.parser')
        citation_td = soup.find('td', string='Citation(s)')
        if citation_td:
            span = citation_td.find_next_sibling('td').find('span', class_='pubmed_id')
            if span:
                a_tag = span.find('a')
                if a_tag:
                    return a_tag.text.strip()
        return None
    except Exception as e:
        logging.error(f"BS4 PMID extraction failed: {e}")
        return None

def extract_sra_run_selector_link(page_source):
    soup = BeautifulSoup(page_source, "html.parser")
    link_tag = soup.find("a", string="SRA Run Selector")
    if link_tag and link_tag.get("href"):
        return f"https://www.ncbi.nlm.nih.gov{link_tag['href']}"
    return "Not found"


def process_data(query, email, num_pages1=2, keyword1="tumor,bladder", m_s="Red,Brown", file_type="excel", mode="normal", generate_file=True,remove=True,filters=None):
    # Stampa i parametri ricevuti per debug
    print(f"query: {query}")
    print(f"email: {email}")
    print(f"num_pages1: {num_pages1}")
    print(f"keyword1: {keyword1}")
    print(f"m_s: {m_s}")
    print(f"file_type: {file_type}")
    print(f"mode: {mode}")
    print(f"generate_file: {generate_file}")
    print(f"remove: {remove}")

    # Controlliamo se keyword1 è None
    if keyword1 is None:
        print("ERRORE: keyword1 è None!")
        keyword1 = ""

    # Controlliamo se m_s è None
    if m_s is None:
        print("ERRORE: m_s è None!")
        m_s = ""

    gse_counter = 0
    logging.info(f"Starting processing for the query: {query}")
    driver=ChromeDriverManager().install()
    try:
        # Configura Chrome options
        options = webdriver.ChromeOptions()
        options.add_argument('--headless')
        options.add_argument('--log-level=3')
        options.add_argument('--incognito')
        #driver = webdriver.Chrome(ChromeDriverManager().install(), options=options)
        # Aggiungi ulteriori opzioni per la stabilità
        options.add_argument('--start-maximized')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        #options.add_argument('--disable-gpu')
        #options.add_experimental_option('excludeSwitches', ['enable-logging'])
        prefs = {"profile.default_content_setting_values.geolocation": 2,"profile.default_content_setting_values.notifications": 2}
        options.add_experimental_option("prefs", prefs)

        driver = webdriver.Chrome(options=options)
        logging.info("WebDriver initialized successfully; no geolocation or notification will be used")
        
    except Exception as e:
        logging.error(f"Error initializing WebDriver: {str(e)}")
        raise Exception(f"Error initializing Chrome: {str(e)}")
    
    columns = ["Title/PMID", "GSE", "Date", "Instrument_1","Instrument_2","Instrument_3", "Platform", "Organisms", "Samples_Count", "Samples_1","Samples_2","Samples_3", "Summary", "Series Matrix Link", "SOFT formatted family file(s) Link","MINiML formatted family file(s) Link","BioProject link","Geo2R", "Other link and GDV","SRA Run Selector"]
    Entrez.email = email
    keywords = []
    M_S = []
    
    user_keywords = keyword1.split(",")
    for i in range(len(user_keywords)):
        user_keywords[i] = user_keywords[i].lower()
    duplicates = [kw for kw in user_keywords if kw in keywords]
    if duplicates:
        logging.info(f"Duplicated keyword founded: {', '.join(duplicates)}")
    else: 
        logging.info("No duplicated keywords")
    
    keywords.extend(user_keywords)
    columns.extend(user_keywords)
    
    user_MS = [MS.strip() for MS in m_s.split(',')]
    columns.extend(user_MS)
    
    gse_codes = search_geo_datasets(query, driver, num_pages1,filters=filters)  # avvia la funzione
    logging.info(f"GSE codes founded: {gse_codes}")
    logging.info(f"Total GSE: {len(gse_codes)}")
    logging.info("_________________________________________________________________________________________________")

    # Creazione del DataFrame vuoto con le colonne specificate
    df = pd.DataFrame(columns=columns)  # crea un dataframe con quelle colonne

    # Lista per memorizzare i PMDI trovati
    pmdi_list = []

    # Copia della lista GSE per iterare ed eventualmente rimuovere elementi
    gse_codes_copy = gse_codes.copy()
    total_gse = len(gse_codes_copy)
    
    pubmed_base = "https://pubmed.ncbi.nlm.nih.gov/"
    gse_counter = 0
    
    for gse in gse_codes_copy:
        logging.info(f"Processing GSE: {gse}")
        gse_counter += 1
        
        logging.info(f"Processing GSE: {gse_counter}")
        url = f'https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc={gse}' 
        driver.get(url)  # accedi all'url
        
        try:
    # Verifica comunque che l'elemento in fondo sia presente
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.ID, 'vdp'))
            )
            time.sleep(0.1)
        except TimeoutException:
            try:
                logging.info("Due to a slow internet connection or high site traffic, the long wait function has been activated to prevent data loss.")
                time.sleep(3)
            except TimeoutException:
                continue
        
        html = driver.page_source  # estraiamo codice html
        pattern_id = r'id="([^"]+)"'  # regex (espressione regolare,pattern) per trovare ID
        id_trovati = re.findall(pattern_id, html)  # trova tutte le corrispondenze con quel pattern_id nel codice html della pagina
        
        # crea nuova lista espressione per ogni elemento in iterabile se condizione vera
        my_id = [string for string in id_trovati if string.isdigit()]  # stringa per ogni elemento all'interno degli ID se questo è un numero, aggiungi alla lista
    
        found_pmdi = False  # inizializza variabile, falsa all'inizio 
        pmdi_already_checked = False
        pmdi1 = None
        for i in my_id:
            logging.info(f"GSE {gse_counter} of {total_gse} - Processing for GSE: {gse}")
            try:
                time.sleep(0.01)

                if not pmdi_already_checked:
                    pmdi = extract_pmid_bs4(driver.page_source)
                    pmdi_already_checked = True

                    if pmdi:
                        pmdi1 = pmdi
                        pmdi_list.append(pmdi1)
                        found_pmdi = True
                        logging.info(f"✅ PMID found in Citation box: {pmdi1}")
                        link_pubmed = pubmed_base + pmdi1
                        logging.info(f"Link to Pubmed: {link_pubmed}")
                    else:
                        logging.info("❌ No PMID found via BS4")

                if not found_pmdi:
                    continue  # Salta il blocco successivo se non trovato
                
                # Estrai la data dalla sezione "Status"
                try:
                    status_xpath = '//td[normalize-space(text())="Status"]/following-sibling::td'
                    status_element = WebDriverWait(driver, 6).until(
                        EC.presence_of_element_located((By.XPATH, status_xpath))
                    )  # aspettiamo finchè non troviamo
                    status_text = status_element.text  # trasformiamolo in testo
                    logging.info(f'Status found: {status_text}')
                    
                    # Format the extracted status text
                    status_text = extract_date(status_text)  # applichiamo la funzione delle date
                    
                except Exception as e:
                    status_text = "Not found"
                    logging.error(f'Errore extracting status for {gse}: {e}')
                    
                # Dopo aver caricato la pagina e assicurato che sia completamente caricata
                page_source = driver.page_source
                try:
                    platform_text = extract_platform(page_source)
                    if platform_text != "Not found":
                        gpl_links = [f"https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc={gpl}" for gpl, _ in platform_text]
                        gpl_codes = ";".join(gpl_links)
                        platform_descriptions = ", ".join([desc for _, desc in platform_text])
                        logging.info(f"GPL Codes : {gpl_codes} , Platform description : {platform_descriptions}")
                    else:
                        gpl_codes = "Not found"
                        platform_descriptions = "Not found"
                except Exception:
                    gpl_codes = "Not found"
                    platform_descriptions = "Not found"
                    logging.error(f"Error extracting platform for {gse}; {e}")

                try:
                    # Ottieni il contenuto HTML della pagina
                    page_source = driver.page_source
                    # Estrai gli organismi usando la funzione BeautifulSoup
                    organism_text = extract_organisms(page_source)
                    logging.info(f"Organism {organism_text} found")
                except Exception as e:
                    organism_text = "Not found"
                    logging.error(f'Error extracting organism for {gse}: {e}')
                
                try:
                    samples_text = extract_samples(driver)
                    if samples_text != "Not found":
                        base_url = "https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc="
                        samples_links = "; ".join([f"{base_url}{gsm}" for gsm in samples_text.split("; ")])
                    else:
                        samples_links = "Not found"
                except Exception as e:
                    samples_text = "Not found"
                    logging.error(f'Error extracting samples for {gse}: {e}')
                
                try:
                    count = extract_sample_count(driver)
                    logging.info(f"Sample count {count} for {gse}")
                except Exception as e:
                    count = "Not found"
                    logging.error(f'Error extracting Sample count for {gse}: {e}')

                try:

                    summary_text = extract_summary(page_source)
                    if summary_text:
                        logging.info(f"Summary extracted for GSE {gse}: {summary_text}")
                    else:
                        logging.info(f"No Summary found for GSE {gse}")
                except Exception as e:
                    summary_text = "NaN"  # Assicurati di assegnare NaN se fallisce
                    logging.error(f"Error extracting Summary for GSE {gse}: {e}")
                
                pmid_link=f"https://pubmed.ncbi.nlm.nih.gov/{pmdi1}"
                series_matrix_link= f"https://ftp.ncbi.nlm.nih.gov/geo/series/GSE{gse[3:6]}nnn/{gse}/matrix/"
                SOFT_link= f"https://ftp.ncbi.nlm.nih.gov/geo/series/GSE{gse[3:6]}nnn/{gse}/soft/"
                mini_link = f"https://ftp.ncbi.nlm.nih.gov/geo/series/GSE{gse[3:6]}nnn/{gse}/miniml/"
                try:
    # Ottieni il contenuto HTML della pagina
                    page_source = driver.page_source
                    geo2r_link = extract_geo2r(page_source, gse)
                    if geo2r_link != "Not found":
                        logging.info(f"GEO2R link for GSE {gse}: {geo2r_link}")
                    else:
                        logging.info(f"Geo2R Not found in {gse}")
                except Exception as e:
                    geo2r_link = "Not found"
                    logging.error(f"Error extracting GEO2R for GSE {gse}: {e}")
                try:
                    page_source = driver.page_source
                    sra_selector_link = extract_sra_run_selector_link(page_source)
                    if sra_selector_link != "Not found":
                        logging.info(f"SRA Run Selector link for GSE {gse}: {sra_selector_link}")
                    else:
                        logging.info(f"SRA Run Selector NOT found for {gse}")
                except Exception as e:
                    sra_selector_link = "Not found"
                    logging.error(f"Error extracting SRA Run Selector for GSE {gse}: {e}")
                try:
                    page_source = driver.page_source
                    bioproject_link = extract_bioproject(page_source)
                    if bioproject_link != "Not found":
                        logging.info(f"Bioproject link {bioproject_link} found")
                    else:
                        continue
                except Exception as e:
                    logging.info(f"error on bioproject for {gse}")
                try:
    # Estrai il link Download & GDV usando la funzione dedicata
                    download_and_gdv_link = extract_download_and_gdv(page_source, gse)
                except Exception as e:
                    download_and_gdv_link = "Not found"
                 # Splittiamo "Samples" e "Instrument" in colonne separate
                # Aggiungi una nuova riga al DataFrame
                samples_list = samples_links.split('; ') if samples_links != "Not found" else []
                instruments_list = gpl_codes.split(';') if gpl_codes != "Not found" else []
                new_row = {'Title/PMID': pmid_link, 'GSE': url, 'Date': status_text, "Platform": platform_descriptions, "Organisms": organism_text, "Samples_Count": count, "Summary": summary_text, "Series Matrix Link": series_matrix_link, "SOFT formatted family file(s) Link": SOFT_link, "MINiML formatted family file(s) Link": mini_link, "BioProject link": bioproject_link, "Geo2R":geo2r_link, "Other link and GDV": download_and_gdv_link,"SRA Run Selector":sra_selector_link}  # aggiungi alla colonna  queste cose
                for i in range(3):  # Supponiamo un massimo di 3 campioni (Sample_1, Sample_2, Sample_3)
                    col_name = f'Samples_{i+1}'
                    new_row[col_name] = samples_list[i] if i < len(samples_list) else 0
                for i in range(3):  # Supponiamo un massimo di 3 strumenti (Instrument_1, Instrument_2, Instrument_3)
                    col_name = f'Instrument_{i+1}'
                    new_row[col_name] = instruments_list[i].strip() if i < len(instruments_list) else 0
                for col in columns[20:]:  # a partire dalla sesta colonna di columns
                    new_row[col] = 0  # Inizializza con 0 la riga corrispondente alla colonna
                df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)  # concatena a df un nuovo dataframe contenente la nuova riga

                abstract = fetch_abstract(pmdi1)
                abstract = abstract.lower()
                if abstract:
                    for keyword in keywords:  # scorri le keyword
                        if keyword in abstract:  # se trovi la keyword
                            df.loc[df['Title/PMID'] == pmid_link, keyword] = 1
                            logging.info(f'Keyword "{keyword}" found in abstract for PMID{pmdi1}')
                
                mesh_terms = fetch_mesh_terms(pmdi1, max_retries=3)
                if isinstance(mesh_terms, str) and mesh_terms.startswith("Error"):
                    logging.warning(f"Unable to retrieve MeSH terms for PMID {pmdi1}: {mesh_terms}")
                else:
                    #logging.info(f"MeSH terms successfully retrieved for PMID {pmdi1}")
                    logging.info(f"MeSH terms for PMID {pmdi1}: {mesh_terms}")

                    for mesh_term in mesh_terms:
                        if mesh_term in df.columns:
                            matching_rows = df.loc[df['Title/PMID'].str.contains(pmdi1)]
                            if not matching_rows.empty:
                                df.loc[df['Title/PMID'].str.contains(pmdi1), mesh_term] = 1
                            else:
                                logging.warning(f"No row found")

                    logging.info("_________________________________________________________________________________________________")


            except Exception as e:
                logging.error(f'Error with ID {i} for {gse}: {e}')
        
        if not found_pmdi and mode=="normal":
            logging.warning(f"No PMID found for: {gse} ")
            gse_codes.remove(gse)
            logging.info("_________________________________________________________________________________________________")  # se non abbiamo trovato nessun id pmdi


###################ULTRAMODE

        elif not found_pmdi and mode == "ultra":
            try:
                logging.info("No PMID found - GSE Analysis in ultra mode")
                # Estrazione dettagli della pagina
                page_source = driver.page_source
                title_text = extract_title(page_source)
                logging.info(f"Title extracted for GSE {gse}: {title_text}")

                # Estrai gli altri dettagli come nella modalità normale
                try:
                    status_xpath = '//td[normalize-space(text())="Status"]/following-sibling::td'
                    status_element = WebDriverWait(driver, 6).until(
                        EC.presence_of_element_located((By.XPATH, status_xpath))
                    )
                    status_text = extract_date(status_element.text.strip())
                except Exception:
                    status_text = "Not found"

                try:
                    platform_text = extract_platform(page_source)
                    if platform_text != "Not found":
                        gpl_links = [f"https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc={gpl}" for gpl, _ in platform_text]
                        gpl_codes = ";".join(gpl_links)
                        platform_descriptions = ", ".join([desc for _, desc in platform_text])
                        logging.info(f"GPL Codes : {gpl_codes} , Platform description : {platform_descriptions}")
                    else:
                        gpl_codes = "Not found"
                        platform_descriptions = "Not found"
                except Exception:
                    gpl_codes = "Not found"
                    platform_descriptions = "Not found"
                    logging.error(f"Error extracting platform for {gse}; {e}")
                try:
                    organism_text = extract_organisms(page_source)
                    logging.info(f"Organism {organism_text} found")
                except Exception as e:
                    organism_text = "Not found"
                    logging.error(f'Error extracting organism for {gse}: {e}')
                try:
                    samples_text = extract_samples(driver)
                    if samples_text != "Not found":
                        base_url = "https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc="
                        samples_links = "; ".join([f"{base_url}{gsm}" for gsm in samples_text.split("; ")])
                    else:
                        samples_links = "Not found"
                except Exception as e:
                    samples_text = "Not found"
                    logging.error(f'Error extracting samples for {gse}: {e}')
                try:
                    count = extract_sample_count(driver)
                    logging.info(f"Sample count {count} for {gse}")
                except Exception as e:
                    count = "Not found"
                    logging.error(f'Error extracting Sample count for {gse}: {e}')
                try:
                    summary_text = extract_summary(page_source)
                    if summary_text:
                        logging.info(f"Summary extracted for GSE {gse}: {summary_text}")
                    else:
                        logging.info(f"No Summary found for GSE {gse}")
                except Exception as e:
                    summary_text = "NaN"  # Assicurati di assegnare NaN se fallisce
                    logging.error(f"Error extracting Summary for GSE {gse}: {e}")
                try:
                    page_source = driver.page_source
                    geo2r_link = extract_geo2r(page_source, gse)
                    if geo2r_link != "Not found":
                        logging.info(f"Geo2R link found for {gse}")
                    else:
                        logging.info(f"GEO2R link NOT found for {gse}")
                except Exception as e:
                    geo2r_link = "Not found"
                    logging.error(f"Error extracting GEO2R for GSE {gse}")
                series_matrix_link = f"https://ftp.ncbi.nlm.nih.gov/geo/series/GSE{gse[3:6]}nnn/{gse}/matrix/"
                soft_link = f"https://ftp.ncbi.nlm.nih.gov/geo/series/GSE{gse[3:6]}nnn/{gse}/soft/"
                mini_link = f"https://ftp.ncbi.nlm.nih.gov/geo/series/GSE{gse[3:6]}nnn/{gse}/miniml/"
                base_url = "https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc="
                try:
                    page_source = driver.page_source
                    sra_selector_link = extract_sra_run_selector_link(page_source)
                    if sra_selector_link != "Not found":
                        logging.info(f"SRA Run Selector link for GSE {gse}: {sra_selector_link}")
                    else:
                        logging.info(f"SRA Run Selector NOT found for {gse}")
                except Exception as e:
                    sra_selector_link = "Not found"
                    logging.error(f"Error extracting SRA Run Selector for GSE {gse}: {e}")
                try:
                    page_source = driver.page_source
                    bioproject_link = extract_bioproject(page_source)
                    if bioproject_link != "Not found":
                        logging.info(f"Bioproject link {bioproject_link} found")
                    else:
                        continue
                except Exception as e:
                    logging.info(f"error on bioproject for {gse}")
                title_pmid_value = title_text if not found_pmdi else pmid_link
                try:
    # Estrai il link Download & GDV usando la funzione dedicata
                    download_and_gdv_link = extract_download_and_gdv(page_source, gse)
                    logging.info(f"Download & GDV link for GSE {gse}: {download_and_gdv_link}")
                except Exception as e:
                    download_and_gdv_link = "Not found"
                    logging.error(f"Error extracting Download & GDV for GSE {gse}: {e}")

            # Aggiunta della nuova riga al DataFrame
                samples_list = samples_links.split('; ') if samples_links != "Not found" else []
                instruments_list = gpl_codes.split(';') if gpl_codes != "Not found" else []
                new_row = {'Title/PMID': title_pmid_value, 'GSE': url, 'Date': status_text, "Platform": platform_descriptions, "Organisms": organism_text, "Samples_Count": count, "Summary": summary_text, "Series Matrix Link": series_matrix_link, "SOFT formatted family file(s) Link": soft_link, "MINiML formatted family file(s) Link": mini_link, "BioProject link": bioproject_link, "Geo2R":geo2r_link, "Other link and GDV": download_and_gdv_link,"SRA Run Selector":sra_selector_link}  # aggiungi alla colonna  queste cose
                for i in range(3):  # Supponiamo un massimo di 3 campioni (Sample_1, Sample_2, Sample_3)
                    col_name = f'Samples_{i+1}'
                    new_row[col_name] = samples_list[i] if i < len(samples_list) else 0
                for i in range(3):  # Supponiamo un massimo di 3 strumenti (Instrument_1, Instrument_2, Instrument_3)
                    col_name = f'Instrument_{i+1}'
                    new_row[col_name] = instruments_list[i].strip() if i < len(instruments_list) else 0
                for col in columns[20:]:  # a partire dalla sesta colonna di columns
                    new_row[col] = 0  # Inizializza con 0 la riga corrispondente alla colonna
                df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)  # concatena a df un nuovo dataframe contenente la nuova riga

            # Ricerca delle keyword nella Summary
                if summary_text:
                    summary_text_lower = summary_text.lower()
                    keyword_found=False
                    for keyword in keywords:
                        if keyword in summary_text_lower:
                            df.loc[df['Title/PMID'] == title_text, keyword] = 1
                            logging.info(f'Keyword "{keyword}" found in Summary for Title "{title_text}"')
                            keyword_found=True
                    if not keyword_found:
                        logging.info(f"No keywords found in Summary for Title : {title_text}")
                logging.info("_________________________________________________________________________________________________")

            except Exception as e:
                logging.error(f"Error processing Title for GSE {gse}: {e}")
    #df.drop(columns=['Samples', 'Instrument'], inplace=True)
    driver.quit()
    if remove:
        df = df.loc[:, (df != 0).any(axis=0)]  # Rimuove le colonne con tutti zeri
    else:
        pass

    #df['sum_score'] = df.iloc[:, 7:].sum(axis=1)
    #print('List of found PMID:', pmdi_list)
    #print('List of linked GSE:', gse_codes)
    #pd.set_option('display.max_columns', None)
    #print('DataFrame:', df)
    
    # Creare il file di output e ottenere il percorso completo e il nome del file
    if generate_file:
        f= create_output_file(df, query, file_type)
        file_path=f
    else:
        file_path= "No file generated"
    df.replace({np.nan: None}, inplace=True)
    json_data=df.to_json(orient="records")
    df_dict= df.to_dict(orient="records")
    #print("file created:",f)
    return {
        "pmid_list": pmdi_list,
        "gse_codes": gse_codes,
        "dataframe": df_dict,
        "file_path": file_path,
        "json_data": json_data
    }

    
if __name__ == "__main__":
    query = "breast cancer"
    email= "francesco98.orilio@gmail.com"
    num_pages1 = 2
    keyword1 = "breast,tumor,immunotherapy,chemioterapy,rna,dna,protein"
    m_s = "Human, Mice"
    file_type = "excel"
    mode="ultra"
    generate_file=True
    remove=False
    result = process_data(query, email, num_pages1, keyword1, m_s, file_type,mode,generate_file,remove)
    print(result)
    
    