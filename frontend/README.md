# Frontend – FGTD

This is the **React + Electron frontend** of FGTD (From GEO to Dataset), a desktop application that allows users to perform customized searches on GEO datasets and extract related PubMed literature.

---

## Main Files (in `src/`)

### `index.js`
- Root entry point of the React app.
- Uses `HashRouter` from `react-router-dom` to manage navigation in the Electron environment.
- Renders the `<App />` component and sets up routes.

### `App.js`
- Central routing component for the app.
- Defines main routes:
  - `/` → `SearchForm`: the main search interface
  - `/processing` → `ProcessingPage`: shows progress/loading
  - `/results` → `SearchResultsPage`: shows extracted data
  - `/analysis` → `Analysis`: displays charts and statistics
- Supports **Dark Mode** via a toggleable state.

### `App.css`
- Custom styles using **Tailwind CSS**.
- Styles the layout and animations.
- Includes:
  - `.App-header`, `.App-logo`, etc.
  - Dark mode support tied to Tailwind classes.

---

## Components (in `src/components/`)

### `SearchForm.js`
- The main entry form for user input.
- Allows insertion of:
  - Free-text query
  - Email (optional)
  - Keywords, MeSH terms, number of pages
  - Output file format
  - **Advanced Filters** (Organism, Study Type, Subset Type, Supplementary Files, Date Range)
- Sends the request to the backend's `/api/search` and `/api/check_query` endpoints.
- Dynamically renders submenus and conditionally expands filter panels.

### `ProcessingPage.js`
- Displays a progress bar and log streaming during backend processing.
- Progress bar changes color (e.g. red then blue) to indicate different scraping phases.
- Shows live log lines from Flask via periodic polling.

### `SearchResultsPage.js`
- Shows a paginated table of results (GSE datasets + metadata).
- Allows export of results and displays selected filters.
- Includes section for **Additional Info** like SRA links, MeSH terms, etc.

### `Analysis.js`
- Visual analytics dashboard.
- Displays:
  - Bar charts for organisms, keywords, study types
  - Pie chart of MeSH term categories
  - Time trends
- Uses Chart.js or Recharts (depending on implementation).

### `logo_in_page.png`
- Visual logo used in headers or pages for branding.

---

## ▶️ Running Locally

```bash
cd frontend
npm install
npm start
