# FGTD - From GEO To Dataset
FGTD (From GEO to Dataset) is a cross-platform desktop tool that integrates web scraping from the GEO DataSets portal with literature mining from PubMed. The app is built for researchers needing to retrieve, filter, and correlate experimental datasets and scientific publications quickly and interactively.

Architecture Overview
FGTD is structured in two main layers:

Frontend (React + Tailwind + Electron):
The user interface, built with React and styled with TailwindCSS, is packaged as a desktop app using Electron. It provides real-time interaction and displays results and statistics.

Backend (Python + Flask + Selenium + BeautifulSoup):
The backend is a Python service responsible for scraping and parsing data from GEO and PubMed. It supports advanced filtering (e.g., organism, study type, supplementary files) and outputs tabular results (Excel/CSV).

# How to install 
Once you have downloaded the Windows installer from the release section, simply run it as administrator to ensure proper installation.
After the installation is complete, the application will be available and ready to use. 
For the Linux version, simply download the `.AppImage` file and run it.  
Make sure that support for AppImage files is available on your system.  
For example, on Debian/Ubuntu-based systems you can install it with:

```bash
sudo apt install libfuse2

# If you encounter issues running the AppImage, try launching it using the no-sandbox mode:
./File.AppImage --no-sandbox



