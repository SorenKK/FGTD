# Tutorial : FGTD - From GEO To Dataset
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

```

# Search Form Overview
Once the application is launched, you will be presented with the following **search form module**, which needs to be filled out to start the analysis:

![Screenshot 2025-06-18 081857](https://github.com/user-attachments/assets/cd139f5f-df80-4321-b564-27d38cdebfd8)

At the top of the form, you are asked to enter an **email address**.  
This is required solely to access the **PubMed API**, as it is mandated by NCBI.  
🔒 No personal data is stored or collected — user privacy is fully respected.

Below that, you’ll find the **query input field**, where you can enter your search term (e.g. breast cancer).  
This is the core of your search and defines what will be queried on the GEO database.

Once the query is set, click on **"Check Query & Filter"**.  

![Screenshot 2025-06-18 083834](https://github.com/user-attachments/assets/269ddb19-7ff3-451b-b7f8-3a4160d68972)

This will open a **dropdown panel** (as shown in the screenshot below, from the pre-release version), allowing you to select **preliminary filters** such as:

- Organism  
- Study Type  
- Subset Variables
- Attribute Name (in pre-release version)
- Supplementary Files  
- Date Range

After choosing your filters, click **"Confirm and Check Query"**.  
The app will then check how many **GEO pages** and **PubMed articles** are available for that query-filter combination.  
It will also **suggest an appropriate number of pages** to analyze, which will be auto-filled in the page selection field.
