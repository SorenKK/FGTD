import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const ProcessingPage = () => {
  const location = useLocation();
  const { totalPages, isDarkMode, filters } = location.state || { totalPages: 0, isDarkMode: false };
  const [delayPhase, setDelayPhase] = useState(filters && Object.keys(filters).length > 0);
  const [progress, setProgress] = useState(0);
  const [showTerminal, setShowTerminal] = useState(false);
  const [logs, setLogs] = useState([]);
  const lastLogRef = useRef(null);

  const SECONDS_PER_PAGE = 57;
  const UPDATE_INTERVAL = 6.2;
  const totalTimeInSeconds = totalPages * SECONDS_PER_PAGE;
  const totalSteps = Math.ceil(totalTimeInSeconds / UPDATE_INTERVAL);
  const progressPerStep = 100 / totalSteps;

  useEffect(() => {
    document.body.style.backgroundColor = isDarkMode ? '#121212' : '#f0f4f8';
    document.body.style.margin = '0';
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, [isDarkMode]);

  // Gestione della fase di delay (barra rossa)
  useEffect(() => {
    let delayTimer;
    let redProgressTimer;

    if (delayPhase) {
      console.log('Inizio fase di attesa filtri (barra rossa)...');
      
      // Reset del progresso all'inizio della fase rossa
      setProgress(0);
      
      let steps = 0;
      const maxSteps = 35; // 35 secondi
      const interval = 1000; // 1 secondo
      const stepProgress = 99 / maxSteps; // Incremento per arrivare al 99%

      redProgressTimer = setInterval(() => {
        steps++;
        setProgress(prev => {
          const newProgress = Math.min(prev + stepProgress, 99);
          console.log(`Progresso barra rossa: ${Math.round(newProgress)}%`);
          return newProgress;
        });

        // Quando raggiungiamo i 35 secondi
        if (steps >= maxSteps) {
          clearInterval(redProgressTimer);
          console.log('Barra rossa completata al 99%. Avvio transizione...');
          
          // Breve pausa prima di resettare e passare alla barra blu
          setTimeout(() => {
            console.log('Reset progresso e avvio barra blu...');
            setProgress(0);
            setDelayPhase(false);
          }, 500); // Pausa di 500ms per rendere visibile il reset
        }
      }, interval);

      // Timer di sicurezza per assicurarsi che la fase termini
      delayTimer = setTimeout(() => {
        clearInterval(redProgressTimer);
        console.log('Timer di sicurezza attivato - Fine fase di attesa');
        setProgress(0);
        setDelayPhase(false);
      }, (maxSteps + 1) * interval);
    }

    return () => {
      clearTimeout(delayTimer);
      clearInterval(redProgressTimer);
    };
  }, [delayPhase]);

  // Gestione della fase di processing (barra blu)
  useEffect(() => {
    let blueTimer;

    // La barra blu parte sempre quando non siamo nella fase di delay
    if (!delayPhase) {
      console.log('Avvio barra blu di processing...');
      
      blueTimer = setInterval(() => {
        setProgress(prev => {
          const newProgress = Math.min(prev + progressPerStep, 99);
          console.log(`Progresso barra blu: ${Math.round(newProgress)}%`);
          return newProgress;
        });
      }, UPDATE_INTERVAL * 1000);
    }

    return () => {
      if (blueTimer) {
        clearInterval(blueTimer);
      }
    };
  }, [delayPhase, progressPerStep]);

  // Funzione per il fetch dei log
  const fetchLogs = async () => {
    console.log('Eseguo fetch dei log...');
    try {
      const response = await fetch('http://localhost:5000/log');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      console.log('Dati dei log ricevuti:', data);
      const filteredData = data.filter(log => !log.includes("GET /log HTTP/1.1"));
      setLogs(prevLogs => {
        console.log('Numero log prima del merge:', prevLogs.length);
        const newLogs = [...prevLogs, ...filteredData];
        console.log('Numero log dopo il merge:', newLogs.length);
        return newLogs;
      });
    } catch (error) {
      console.error('Errore nel fetch dei log:', error);
    }
  };

  // Timer per il fetch periodico dei log
  useEffect(() => {
    console.log('Avvio intervallo per il fetch dei log');
    const logInterval = setInterval(fetchLogs, 1000);
    return () => {
      clearInterval(logInterval);
      console.log('Intervallo per il fetch dei log cancellato');
    };
  }, []);

  // Funzione per mostrare/nascondere il terminale
  const toggleTerminal = () => {
    console.log('Toggle terminal. Stato prima:', showTerminal);
    setShowTerminal(prev => {
      const newState = !prev;
      console.log('Stato terminale dopo il toggle:', newState);
      return newState;
    });
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center"
      style={{
        backgroundColor: isDarkMode ? '#121212' : '#f0f4f8',
        color: isDarkMode ? '#ffffff' : '#000000',
        height: '100vh',
      }}
    >
      {/* Barra superiore */}
      <div
        style={{
          backgroundColor: isDarkMode ? '#1f1f1f' : 'rgba(255, 255, 255, 0.8)',
          padding: '10px 20px',
          boxShadow: 'none',
          position: 'relative',
          zIndex: 1,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontWeight: 'bold',
            fontSize: '28px',
            color: isDarkMode ? '#1e90ff' : '#000080',
            fontFamily: 'Sora, Arial, sans-serif',
            letterSpacing: '-1px',
            display: 'inline-block',
            background: isDarkMode
              ? 'linear-gradient(45deg, #1e90ff, #87cefa)'
              : 'linear-gradient(45deg, #000080, #0066cc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          FGTD
        </div>
      </div>

      {/* Contenuto principale */}
      <div
        className="w-full max-w-md p-6 rounded-lg shadow-md text-center mt-8"
        style={{
          backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
          boxShadow: isDarkMode ? '0 4px 15px rgba(255,255,255,0.1)' : '0 4px 15px rgba(0,0,0,0.1)',
          border: isDarkMode ? '1px solid #cccccc' : '1px solid #dddddd',
        }}
      >
        <h1
          className="text-3xl font-bold mb-4"
          style={{ color: isDarkMode ? '#1e90ff' : '#000080' }}
        >
          Processing <span>Your Request</span>
        </h1>
        <p
          className="text-lg mb-8"
          style={{ color: isDarkMode ? '#cccccc' : '#333333' }}
        >
          Please wait while we search for your data. This may take a few minutes depending on the number of pages and websites traffic.
        </p>
        
        {/* Indicatore della fase corrente */}
        <p
          style={{ 
            fontSize: '12px', 
            color: isDarkMode ? '#888888' : '#666666',
            marginBottom: '10px'
          }}
        >
          {delayPhase ? 'Applying filters...' : 'Processing data...'}
        </p>

        {/* Barra di progresso e percentuale */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
          <div
            className="rounded-full relative overflow-hidden"
            style={{
              backgroundColor: isDarkMode ? '#333333' : '#e0e0e0',
              width: '70%',
              height: '4px',
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                background: delayPhase
                  ? 'linear-gradient(to right, #ff9999, #ff6666)' // rosso chiaro
                  : isDarkMode
                    ? 'linear-gradient(to right, #1e90ff, #00bfff)' // blu scuro
                    : 'linear-gradient(to right, #00bfff, #0066cc)', // blu chiaro
                height: '100%',
                borderRadius: '4px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <p style={{ marginLeft: '10px', fontSize: '14px', color: isDarkMode ? '#1e90ff' : '#0066cc' }}>
            {Math.round(progress)}%
          </p>
        </div>
      </div>

      {/* Pulsante per il terminale */}
      <button
        onClick={toggleTerminal}
        style={{
          backgroundColor: isDarkMode ? '#1e90ff' : '#0066cc',
          color: '#ffffff',
          border: 'none',
          padding: '12px 20px',
          borderRadius: '4px',
          cursor: 'pointer',
          marginTop: '20px',
          position: 'fixed',
          bottom: '32px',
          left: '20px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
        }}
      >
        {showTerminal ? 'Hide Terminal' : 'Show Terminal'}
      </button>

      {/* Terminale */}
      {showTerminal && (
        <div
          className="fixed bottom-0 left-0 w-full h-1/3 p-4 rounded-t-lg overflow-y-auto shadow-lg"
          style={{
            backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9',
            color: isDarkMode ? '#ffffff' : '#000000',
            padding: '20px',
            overflowY: 'auto',
            borderTop: `1px solid ${isDarkMode ? '#cccccc' : '#dddddd'}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
            }}
          >
            <h2
              style={{
                fontSize: '18px',
                color: isDarkMode ? '#1e90ff' : '#0066cc',
              }}
            >
              Terminal Logs
            </h2>
            <button
              onClick={toggleTerminal}
              style={{
                backgroundColor: '#ff4d4d',
                color: '#ffffff',
                border: 'none',
                padding: '5px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
          {logs.length > 0 ? (
            logs.map((log, index) => (
              <p
                key={index}
                ref={index === logs.length - 1 ? lastLogRef : null}
                style={{
                  fontFamily: '"Consolas", "Lucida Console", "Courier New", monospace',
                  fontSize: '14px',
                  color: isDarkMode ? '#cccccc' : '#333333',
                  marginBottom: '5px',
                }}
              >
                {log}
              </p>
            ))
          ) : (
            <p
              style={{
                fontFamily: 'Courier New, monospace',
                fontSize: '14px',
                color: isDarkMode ? '#cccccc' : '#333333',
              }}
            >
              No logs available.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ProcessingPage;