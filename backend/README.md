# Backend – FGTD

This module is the **computational engine** of FGTD (From GEO to Dataset): a desktop tool designed to integrate GEO DataSets with related PubMed literature.

---

## Main Files

### `scraper.py`
- Core logic of the system.
- Performs advanced scraping from **GEO DataSets** and **PubMed**.
- Supports two modes:
  - `normal`: fast metadata extraction
  - `ultra`: deeper analysis of abstracts, MeSH terms, and keywords
- Allows **customizable filters** for:
  - Organism, Study Type, Subset Variable, Supplementary Files, Date Range

### `app.py`
- Flask app exposing API endpoints for the frontend:
  - `/api/search`: run the complete scraping and export process
  - `/api/check_query`: retrieve and customize filters from GEO
- Interfaces with the Electron+React desktop frontend.

### `backend.spec`
- Configuration file for **PyInstaller**
- Defines:
  - the main script (`app.py`)
  - dependencies to bundle
  - output executable name (`backend.exe`)
- Used to generate the **standalone backend executable** for Windows.

---

## ▶Running Locally (Development)

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # or venv\Scripts\activate on Windows
