// index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter as Router, Routes, Route } from 'react-router-dom'; // Usa HashRouter
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  //<React.StrictMode>
    <Router>
      {/* Definisci le rotte della tua applicazione */}
      <Routes>
        <Route path="/*" element={<App />} />  {/* App gestisce tutte le rotte */}
      </Routes>
    </Router>
  //</React.StrictMode>
);

reportWebVitals();
