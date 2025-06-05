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
- To run the backend server locally for development:

```bash
python app.py
```

The server will be available at `http://localhost:5000`.
- 
| Endpoint            | Method | Description                           |
|---------------------|--------|---------------------------------------|
| `/api/search`       | POST   | Executes the scraping and generates output files. |
| `/api/check_query`  | POST   | Fetches filterable options from GEO based on the query. |
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
   pip install -r requirements.txt

   To compile the backend into a standalone executable using PyInstaller:


## Build the Executable

To compile the backend into a standalone executable using PyInstaller:

```bash
pyinstaller backend.spec
```

## Notes

- Outputs structured metadata in `.xlsx` or `.csv`.
- Handles both standard and advanced search modes.
- GEO filters supported: organism, study type, subset variables, date range, supplementary files.
- Built-in logging system provides live feedback for each scraping step.

---

## License

This backend is distributed under the MIT License. See `LICENSE` file for details.
