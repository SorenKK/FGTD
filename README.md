## FGTD - From GEO To Dataset
FGTD (From GEO to Dataset) is a cross-platform desktop tool that integrates web scraping from the GEO DataSets portal with literature mining from PubMed. The app is built for researchers needing to retrieve, filter, and correlate experimental datasets and scientific publications quickly and interactively.

Architecture Overview
FGTD is structured in two main layers:

Frontend (React + Tailwind + Electron):
The user interface, built with React and styled with TailwindCSS, is packaged as a desktop app using Electron. It provides real-time interaction with the scraping engine and displays results and statistics.

Backend (Python + Flask + Selenium + BeautifulSoup):
The backend is a Python service responsible for scraping and parsing data from GEO and PubMed. It supports advanced filtering (e.g., organism, study type, supplementary files) and outputs tabular results (Excel/CSV).

# Communication Flow
The frontend and backend communicate through Electron’s ipcMain and ipcRenderer events:

Electron acts as a bridge, launching and stopping the Python backend (backend.exe) from the main.js file.

The preload.js file uses Electron's contextBridge to securely expose API methods (startBackend, stopBackend, openFileDialog, etc.) to the React app.

React sends fetch requests (e.g., to http://127.0.0.1:5000/api/search) once the Python Flask server is running.

# Launch Sequence
On application startup, main.js starts the Flask backend via child_process.spawn.

The React app interacts with the backend using API calls exposed in SearchForm.js.

The user fills out the search form, optionally adds advanced filters, and submits.

Results are displayed in SearchResultsPage.js or saved locally.

# Configuration & Tooling
tailwind.config.js and postcss.config.js manage styling and CSS transformations.

package.json contains the Electron build config (including main.js and scripts).

README.md files in /backend and /frontend explain implementation details for each layer.

# Deployment
The project is packaged into:

Windows installer (.exe) using Electron Builder

Linux build (.AppImage)

Releases are available on GitHub under the "Releases" tab


