// App.js
import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import SearchForm from './components/SearchForm';
import SearchResultsPage from './components/SearchResultsPage';
import ProcessingPage from './components/ProcessingPage';
import Analysis from './components/Analysis';
import './index.css';

function App() {
    const [isDarkMode, setIsDarkMode] = useState(false); // Stato per la modalità scura

    return (
        <div className="App">
            <Routes>
                {/* Rotta principale con SearchForm */}
                <Route
                    path="/"
                    element={
                        <SearchForm
                            isDarkMode={isDarkMode}
                            setIsDarkMode={setIsDarkMode}
                        />
                    }
                />

                {/* Pagina di processing */}
                <Route
                    path="/processing"
                    element={<ProcessingPage isDarkMode={isDarkMode} />}
                />

                {/* Pagina dei risultati */}
                <Route
                    path="/results"
                    element={<SearchResultsPage isDarkMode={isDarkMode} />}
                />
                <Route
                    path= "/analysis" 
                    element = {<Analysis isDarkMode={isDarkMode} />}
                />
            </Routes>
        </div>
    );
}

export default App;
