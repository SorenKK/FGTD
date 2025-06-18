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

## Query section

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

## Keywords and MeSH Terms

In the next section, you can enter **keywords** and **MeSH terms** relevant to your research.

- **Keywords** are searched within the **GEO summary** and, if available, in the **abstract** of the linked PubMed article.
- **MeSH terms** are searched specifically in the **MeSH section** of the associated PubMed article.

During the analysis, each keyword or MeSH term you enter will be checked for presence.  
If a match is found, the corresponding column in the final results table will be marked with a `1`, otherwise `0`.

This binary system allows you to **easily filter** the papers or datasets that are most relevant to your research goals, directly from the final tabular output.

Below the MeSH Terms section, you can define the **number of GEO pages** to scrape.  
The higher the number of pages, the more datasets and associated papers will be analyzed — but this also increases the overall processing time.

Next, you can choose the **file format** for the **unfiltered output** (CSV or Excel), which will be automatically downloaded if you leave **"Yes"** selected in the *"Automatic download of unfiltered file?"* option.

You also have the option to **remove empty columns** from the final output, helping to keep your results clean and focused.

### Analysis Modes

The final setting is the **analysis mode**:

- **Normal Mode**: Only GSE entries that explicitly list a **PMID** (PubMed ID) are analyzed.  
  This makes the process faster — about **10% quicker** than Ultra Mode — and is ideal for large-scale queries.
  
- **Ultra Mode**: Bypasses the PMID restriction by scraping **all available papers** linked to the query results.  
  This offers a more comprehensive analysis, but takes slightly longer to complete.

Choose the mode based on the **depth vs speed** trade-off that suits your research.
Now it's possibile to click on "Start Scraping" to start the analysis. 

# Processing Phase

Once the analysis is launched, the app navigates to the **processing page**, where you can monitor the progress in real time.

![Screenshot 2025-06-18 091435](https://github.com/user-attachments/assets/d15b6fc3-b296-4086-ae57-c26a6cff592f)

This page provides:
- An **estimated processing time**, which depends on the size of the query, your internet connection, and the current load on external servers (e.g., GEO, PubMed).
- A **toggleable terminal view**, where you can inspect the live log output of the scraping process.

## Timing Breakdown

- Applying filters: ~**40 seconds**
- Scraping a single GEO page (20 papers) : ~**50 seconds to 1 minute**

These durations are indicative and may vary slightly depending on network speed and server responsiveness.

Since the application is lightweight, you can safely launch the analysis and continue working on other tasks —  
letting the program handle the bibliographic search for you.
Once processing is complete, the user is taken to the **Results Overview** page,  
where all findings are summarized in a clear, interactive dashboard.

# 📊 Results Overview

Once the processing is complete, the user is automatically redirected to the **Results Overview** page.

## Summary Panel

At the top of the page, a **summary panel** displays the details of the search:
- Query terms
- Keywords and MeSH terms used
- Applied filters (e.g., organism, study type, date range)

This gives a clear and immediate overview of the scope and criteria of your analysis.

##  GSE–PMID Associations

Immediately below, a **tabular list of GSE–PMID associations** is displayed.  
For each dataset, you can view:
- The study title (if the GSE does not have a PMID associated ) or The PubMed ID (PMID)
- The corresponding GSE accession code
  
![Screenshot 2025-06-18 092123](https://github.com/user-attachments/assets/ef6ef0cc-98f1-4d32-adae-b453b83ca651)

You can expand the table to show all results using the **"Show All Rows"** button.

Further down, the app shows a **preview of the complete dataset** generated after the scraping process.  

![Screenshot 2025-06-18 092310](https://github.com/user-attachments/assets/b7a4edb3-be05-4df2-8400-aa6e28db1f42)

> If **automatic download** is enabled, the raw table is saved in the app folder.  
> A filtered version will be available on the next page.
