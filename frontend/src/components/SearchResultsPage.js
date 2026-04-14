import React, { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function SearchResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const tableRef = useRef();
  const { results, isDarkMode, searchQuery, keywords, meshTerms, filters } = location.state || {};
  
  // State
  const [expandedSummaries, setExpandedSummaries] = useState(new Set());
  const [showAllRows, setShowAllRows] = useState(false);
  const [showPMIDs, setShowPMIDs] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [hoveredRow, setHoveredRow] = useState(null);
  
  // MODIFICA: Uso un Set per gestire multiple righe di score aperti contemporaneamente
  const [openScoresRows, setOpenScoresRows] = useState(new Set());

  // Helper per estrarre i dati dei punteggi (Spostato fuori dal render per essere riutilizzato)
  const getScoreData = (row) => {
    const dfScores = results?.df_scores || results?.df_scores_dict || [];
    const keyGSE  = row['GSE'];
    const keyPMID = row['Title/PMID'];
    let match = null;

    // Helper: estrae il codice GSE completo (es. "GSE12345") da una URL o stringa
    const extractGSECode = (str) => {
      if (!str) return null;
      const m = String(str).match(/GSE\d+/i);
      return m ? m[0].toUpperCase() : null;
    };

    // Helper: estrae il PMID numerico da una URL PubMed o stringa numerica
    const extractPMIDCode = (str) => {
      if (!str) return null;
      // URL style: .../12345678 oppure solo numero
      const m = String(str).match(/(\d{6,})/);
      return m ? m[1] : null;
    };

    // 1. Match esatto sull'intera stringa GSE (caso più comune — df_scores usa la stessa URL)
    if (keyGSE && dfScores.length) {
      match = dfScores.find(d => d['GSE'] === keyGSE);
    }

    // 2. Match sul codice GSE estratto (es. "GSE12345") — confronto esatto, no substring
    if (!match && keyGSE && dfScores.length) {
      const gseCode = extractGSECode(keyGSE);
      if (gseCode) {
        match = dfScores.find(d => extractGSECode(d['GSE']) === gseCode);
      }
    }

    // 3. Match sul PMID numerico estratto — confronto esatto, no substring
    if (!match && keyPMID && dfScores.length) {
      const pmidCode = extractPMIDCode(keyPMID);
      if (pmidCode) {
        match = dfScores.find(d => {
          const dPmid = extractPMIDCode(d['Title/PMID']);
          return dPmid && dPmid === pmidCode;
        });
      }
    }

    if (!match) {
      // Fallback: cerca colonne di score direttamente nella riga della tabella
      const possibleScores = {};
      Object.keys(row).forEach(k => {
        if (/score|relevance|R_raw|R_score|C_score|T_score|B_score|K_score|S_score/i.test(k)) {
          possibleScores[k] = row[k];
        }
      });
      return Object.keys(possibleScores).length
        ? possibleScores
        : { message: 'No detailed scores found.' };
    }
    return match;
  };

  const handleNewAnalysis = () => {
    navigate('/', { state: { isDarkMode } });
  };

  const handleContinueAnalysis = () => {
    // 1. Espande tutte le righe e i summary
    const allRowsIndices = Array.from(Array(results.dataframe.length).keys());
    const allRowsSet = new Set(allRowsIndices);
    
    setExpandedSummaries(allRowsSet);
    setShowAllRows(true);
    
    // MODIFICA: Espande anche tutti i sub-score
    setOpenScoresRows(allRowsSet);

    // Attende il rendering
    setTimeout(() => {
      const tableElement = tableRef.current;
      
      if (!tableElement) {
        console.error('Table reference is invalid or table is not rendered.');
        return;
      }

      // --- INIZIO PULIZIA HTML ---
      // 1. Clona la tabella per non modificare quella a schermo
      const tableClone = tableElement.cloneNode(true);

      // 2. Trova tutti i bottoni marcati come "no-export-btn" e rimuovili dal clone
      const buttonsToRemove = tableClone.querySelectorAll('.no-export-btn');
      buttonsToRemove.forEach(btn => btn.remove());

      // 3. Ottieni l'HTML pulito
      const tableHTML = tableClone.outerHTML;
      // --- FINE PULIZIA HTML ---

      navigate('/analysis', { state: { tableHTML, rawData: results.dataframe, isDarkMode } });
    }, 100); // Leggero incremento del timeout per sicurezza rendering
  };

  if (!results || !results.dataframe) {
    return <div>No results to display.</div>;
  }

  // --- DEFINIZIONE COLONNE ---
  const FIXED_COLUMNS = [
    'Title/PMID', 'GSE', 'Date', 'Platform', 'Organisms',
    'Instrument_1', 'Instrument_2', 'Instrument_3', 'Summary',
    'Series Matrix Link', 'SOFT formatted family file(s) Link',
    'MINiML formatted family file(s) Link', 'BioProject link',
    'Geo2R', 'Other link and GDV', 'SRA Run Selector',
    'Samples_1', "Samples_2", "Samples_3", 'Samples_Count',
    "Citations_Count", "Relevance_Display", "Study_Type_Extracted"
  ];

  const allColumns = Object.keys(results.dataframe[0] || {});
  const dynamicColumns = allColumns.filter((col) => !FIXED_COLUMNS.includes(col) && col !== 'Vector');
  const uniqueColumns = [...FIXED_COLUMNS];
  const addedSamples = new Set();

  dynamicColumns.forEach((col) => {
    if (col.startsWith('Sample_')) {
      if (!addedSamples.has(col)) {
        uniqueColumns.push(col);
        addedSamples.add(col);
      }
    } else if (col === 'Sample_Count') {
      if (!uniqueColumns.includes('Sample_Count')) {
        uniqueColumns.push(col);
      }
    } else {
      uniqueColumns.push(col);
    }
  });

  const ORDERED_COLUMNS = uniqueColumns;

// --- HELPERS ---
  const truncateText = (text, maxLength = 80) => {
    // 1. Se il testo è vuoto, null o undefined, restituiamo stringa vuota
    if (text === null || text === undefined) return '';
    
    // 2. FORZIAMO la conversione in stringa (salva il codice se arriva un numero come 0 o 1)
    const strText = String(text);
    
    // 3. Ora possiamo usare .length e .slice in totale sicurezza
    if (strText.length <= maxLength) return strText;
    return strText.slice(0, maxLength) + '...';
  };
  const toggleSummaryExpand = (rowIndex) => {
    setExpandedSummaries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowIndex)) newSet.delete(rowIndex);
      else newSet.add(rowIndex);
      return newSet;
    });
  };

  const toggleRowExpand = (rowIndex) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowIndex)) newExpanded.delete(rowIndex);
    else newExpanded.add(rowIndex);
    setExpandedRows(newExpanded);
  };

  // Funzione toggle per i sub-score (ora gestisce il Set)
  const toggleSubScores = (rowIndex) => {
    setOpenScoresRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowIndex)) newSet.delete(rowIndex);
      else newSet.add(rowIndex);
      return newSet;
    });
  };

  const shortenLink = (url) => {
    if (url.includes('pubmed.ncbi.nlm.nih.gov')) return url.split('/').pop();
    if (url.includes('geo/query/acc.cgi?acc=GSE')) return url.split('=').pop();
    if (url.includes('geo/query/acc.cgi?acc=GSM')) return url.split('=').pop();
    if (url.includes('geo/query/acc.cgi?acc=GPL')) return url.split('=').pop().toLowerCase();
    if (url.includes('ftp.ncbi.nlm.nih.gov/geo/series/')) {
      const match = url.match(/GSE\d+\/(matrix|soft|miniml)/);
      return match ? match[0] : url;
    }
    if (url.includes('bioproject/')) return url.split('/').pop();
    if (url.includes('geo2r/?acc=')) return `geo2r/${url.split('=').pop()}`;
    if (url.includes('other link')) return 'Other Link';
    if (url.includes('ncbi.nlm.nih.gov/Traces/study')) return 'SRA Run Selector';
    return url;
  };

  const formatScore = (val) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      return num.toFixed(4);
    }
    return val;
  };

  // --- STILI GLOBALI / TEMI ---
  const theme = {
    bg: isDarkMode ? '#121212' : '#f0f4f8',
    cardBg: isDarkMode ? '#1f1f1f' : '#ffffff',
    text: isDarkMode ? '#ffffff' : '#000000',
    textSecondary: isDarkMode ? '#a0aec0' : '#4a5568',
    primary: isDarkMode ? '#1e90ff' : '#0066cc',
    primaryLight: isDarkMode ? '#63b3ed' : '#3182ce',
    border: isDarkMode ? '#333333' : '#e2e8f0',
    tableHeaderBg: isDarkMode ? '#000000' : '#e2e8f0',
    tableRowEven: isDarkMode ? '#1f1f1f' : '#ffffff',
    tableRowOdd: isDarkMode ? '#333333' : '#f7fafc',
    tableRowHover: isDarkMode ? '#4a5568' : '#edf2f7',
    subScoreBg: isDarkMode ? '#0f172a' : '#f8fafc',
  };

  const containerStyle = {
    fontFamily: 'Inter, Arial, sans-serif',
    background: theme.bg,
    color: theme.text,
    minHeight: '100vh',
    padding: '20px',
    transition: 'all 0.3s ease-in-out',
  };

  const cardStyle = {
    flex: 1,
    backgroundColor: theme.cardBg,
    padding: '24px',
    borderRadius: '8px',
    boxShadow: isDarkMode
      ? '0 10px 15px -3px rgba(255, 255, 255, 0.1), 0 4px 6px -2px rgba(255, 255, 255, 0.05)'
      : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    transition: 'background-color 0.3s',
  };

  const buttonStyle = {
    backgroundColor: theme.primaryLight,
    color: '#ffffff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '4px',
    cursor: 'pointer',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    transition: 'background-color 0.3s, transform 0.2s',
  };

  const linkButtonStyle = {
    background: 'none',
    border: 'none',
    color: theme.primaryLight,
    cursor: 'pointer',
    marginTop: '10px',
    textDecoration: 'underline',
    fontSize: '14px',
  };

  const cellStyle = {
    padding: '0px 10px',
    border: `3px solid ${theme.border}`,
    color: isDarkMode ? '#ffffff' : '#4a5568',
    maxWidth: '500px',
    overflowWrap: 'break-word',
    verticalAlign: 'top',
    paddingTop: '12px',
    paddingBottom: '12px',
  };

  // --- RENDER FUNCTIONS ---
  
  const renderValue = (val) => {
    if (typeof val === 'string' && val.startsWith('http')) {
      return (
        <a
          href={val}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: theme.primary }}
        >
          {shortenLink(val)}
        </a>
      );
    }
    return val;
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div
        style={{
          backgroundColor: theme.cardBg,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          padding: '0 24px',
          maxWidth: '1880px',
          margin: '0 auto',
          height: '80px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: theme.textSecondary, marginBottom: '18px' }}>
          <span style={{ color: theme.text }}>Results</span>{' '}
          <span style={{ color: theme.primaryLight }}>Overview</span>
        </h1>
      </div>

      {/* Main Content Area */}
      <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ width: '100%', maxWidth: '1800px', backgroundColor: theme.cardBg, borderRadius: '8px', boxShadow: cardStyle.boxShadow, padding: '32px' }}>
          
          <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: theme.textSecondary, marginBottom: '24px' }}>
            <span style={{ color: theme.text }}>From Geo To</span>{' '}
            <span style={{ color: theme.primaryLight }}>Dataset</span>
          </h1>
          <p style={{ fontSize: '16px', color: theme.text, marginBottom: '32px' }}>
            Your search results are ready. The scientific information collected from PubMed and GEO have been organized in a tabular format.
          </p>

          {/* Search Summary Box */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '600', color: theme.textSecondary, marginBottom: '16px' }}>
              <span style={{ color: theme.text }}>Search</span>{' '}
              <span style={{ color: theme.primaryLight }}>Summary</span>
            </h2>
            <div style={{ backgroundColor: theme.cardBg, padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', border: `1px solid ${theme.border}` }}>
              <p style={{ marginBottom: '8px' }}><strong>Query:</strong> {searchQuery || 'N/A'}</p>
              <p style={{ marginBottom: '8px' }}><strong>Keywords:</strong> {keywords || 'N/A'}</p>
              <p><strong>MeSH Terms:</strong> {meshTerms || 'N/A'}</p>
              {filters && Object.keys(filters).length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '600', color: theme.textSecondary, marginBottom: '16px' }}>
                    <span style={{ color: theme.text }}>Applied</span> <span style={{ color: theme.primaryLight }}>Filters</span>
                  </h3>
                  <ul style={{ paddingLeft: '20px' }}>
                    {filters.organism && <li><strong>Organism(s):</strong> {filters.organism.join(', ')}</li>}
                    {filters.study_type && <li><strong>Study Type(s):</strong> {filters.study_type.join(', ')}</li>}
                    {filters.subset_type && <li><strong>Subset Type(s):</strong> {filters.subset_type.join(', ')}</li>}
                    {filters.supp_file && <li><strong>Supplementary File(s):</strong> {filters.supp_file.join(', ')}</li>}
                    {filters.attribute_name && <li><strong>Attribute(s):</strong> {filters.attribute_name.join(', ')}</li>}
                    {filters.date_range && (
                      <li><strong>Date Range:</strong> {filters.date_range[0].join('-')} → {filters.date_range[1].join('-')}</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Table Area */}
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '600', color: theme.textSecondary, marginBottom: '10px' }}>
              <span style={{ color: theme.text }}>Dataset</span>{' '}
              <span style={{ color: theme.primaryLight }}>Preview</span>
            </h2>
            
            <div style={{ overflowX: 'auto', maxHeight: '900px', scrollbarGutter: 'stable', borderRadius: '8px', backgroundColor: theme.border, boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
              <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: theme.tableHeaderBg, position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr>
                    {ORDERED_COLUMNS.map((colName, idx) => (
                      <th key={idx} style={{ border: `3px solid ${isDarkMode ? '#ffffff' : '#000000'}`, padding: '10px', textAlign: 'left', color: isDarkMode ? '#ffffff' : '#000000', whiteSpace: 'nowrap' }}>
                        {colName === 'Relevance_Display' ? 'Relevance Score' : colName}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {results.dataframe
                    .slice(0, showAllRows ? results.dataframe.length : 5)
                    .map((row, rowIndex) => {
                      const isExpanded = expandedRows.has(rowIndex);
                      const isSummaryExpanded = expandedSummaries.has(rowIndex);
                      
                      const isEven = rowIndex % 2 === 0;
                      const rowBg = hoveredRow === rowIndex ? theme.tableRowHover : (isEven ? theme.tableRowEven : theme.tableRowOdd);

                      return (
                        <tr
                          key={rowIndex}
                          style={{ backgroundColor: rowBg, transition: 'background-color 0.2s ease-in-out' }}
                          onMouseEnter={() => setHoveredRow(rowIndex)}
                          onMouseLeave={() => setHoveredRow(null)}
                        >
                          {ORDERED_COLUMNS.map((colName, colIndex) => {
                            const val = row[colName] || 0;

                            // 1. Colonna Title/PMID
                            if (colName === 'Title/PMID') {
                              if (colName) {
                                const pmidLink = val;
                                const isLink = typeof pmidLink === 'string' && pmidLink.startsWith('http');
                                const isPMID = isLink && pmidLink.includes('pubmed.ncbi.nlm.nih.gov');
                                const title = isPMID ? `PMID:${pmidLink.split('/').pop()}` : truncateText(pmidLink, 200);

                                return (
                                  <td key={colIndex} style={cellStyle}>
                                    {isLink ? (
                                      <a href={pmidLink} target="_blank" rel="noopener noreferrer" style={{ color: theme.primary, fontWeight: '500' }}>
                                        {title}
                                      </a>
                                    ) : (
                                      title
                                    )}
                                  </td>
                                );
                              } else {
                                const displayText = isExpanded ? val : truncateText(val, 30);
                                return (
                                  <td key={colIndex} style={cellStyle}>
                                    {displayText}
                                    {val.length > 30 && (
                                      <button onClick={() => toggleRowExpand(rowIndex)} style={{ ...linkButtonStyle, marginLeft: '5px' }}>
                                        {isExpanded ? 'Show Less' : 'Show More'}
                                      </button>
                                    )}
                                  </td>
                                );
                              }
                            }

                            // 2. Colonna Summary
                            if (colName === 'Summary') {
                              const displayText = isSummaryExpanded ? val : truncateText(val, 50);
                              return (
                                <td key={colIndex} style={cellStyle}>
                                  {displayText}
                                  {val.length > 50 && (
                                    <button onClick={() => toggleSummaryExpand(rowIndex)} style={{ ...linkButtonStyle, marginLeft: '5px' }}>
                                      {isSummaryExpanded ? 'Show Less' : 'Show More'}
                                    </button>
                                  )}
                                </td>
                              );
                            }

                            // 3. Colonna Relevance_Display
                            if (colName === 'Relevance_Display') {
                              const displayVal = formatScore(val || 0);
                              const isOpen = openScoresRows.has(rowIndex);
                              
                              // Calcola i dati solo se necessario (quando aperto)
                              const openScoresData = isOpen ? getScoreData(row) : null;

                              return (
                                <td key={colIndex} style={cellStyle}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                                    
                                    <span style={{fontWeight: 'bold', fontSize: '1.1em'}}>{displayVal}</span>
                                    
                                    {/* MODIFICA: Aggiunta className="no-export-btn" */}
                                    <button
                                      className="no-export-btn"
                                      onClick={() => toggleSubScores(rowIndex)}
                                      style={{
                                        ...linkButtonStyle,
                                        margin: 0,
                                        padding: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontSize: '13px'
                                      }}
                                    >
                                      {isOpen ? 'hide details' : 'show sub_scores'}
                                      <span style={{ fontSize: '10px' }}>{isOpen ? '▲' : '▼'}</span>
                                    </button>

                                    {isOpen && openScoresData && (
                                      <div style={{
                                        marginTop: '10px',
                                        width: '100%',
                                        minWidth: '300px', // MODIFICA: Box più largo
                                        backgroundColor: theme.subScoreBg,
                                        border: `1px solid ${isDarkMode ? '#374151' : '#cbd5e1'}`,
                                        borderRadius: '6px',
                                        padding: '12px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                        animation: 'fadeIn 0.2s ease-in-out'
                                      }}>
                                        {typeof openScoresData === 'object' ? (
                                          <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr auto',
                                            columnGap: '16px',
                                            rowGap: '8px',
                                            fontSize: '13px'
                                          }}>
                                            {/* Filtra e rinomina solo T e B Score */}
                                            {Object.entries(openScoresData).map(([k, v]) => {
                                              let label = null;
                                              if (k.includes('T_score') || k === 'T') {
                                                label = 't (textual_score)';
                                              } else if (k.includes('B_score') || k === 'B') {
                                                label = 'B (Bibliographic score)';
                                              }

                                              if (!label) return null;

                                              return (
                                                <React.Fragment key={k}>
                                                  <div style={{
                                                    color: theme.textSecondary,
                                                    fontWeight: '600',
                                                    textTransform: 'uppercase',
                                                    fontSize: '11px',
                                                    letterSpacing: '0.5px',
                                                    alignSelf: 'center'
                                                  }}>
                                                    {label}
                                                  </div>
                                                  <div style={{
                                                    color: theme.primary,
                                                    fontFamily: 'monospace',
                                                    fontWeight: '700',
                                                    textAlign: 'right'
                                                  }}>
                                                    {formatScore(v)}
                                                  </div>
                                                </React.Fragment>
                                              );
                                            })}
                                          </div>
                                        ) : (
                                          <div style={{ fontSize: '13px', fontStyle: 'italic' }}>
                                            {String(openScoresData)}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            }

                            // 4. Default render per altre colonne
                            return (
                              <td key={colIndex} style={cellStyle}>
                                {renderValue(val)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Footer Buttons for Table */}
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '16px' }}>
              {results.dataframe.length > 5 && (
                <button
                  onClick={() => setShowAllRows(!showAllRows)}
                  style={{
                    ...buttonStyle,
                    backgroundColor: 'transparent',
                    border: `1px solid ${theme.primary}`,
                    color: theme.primary,
                  }}
                >
                  {showAllRows ? 'Show Less' : 'Show All Rows'}
                </button>
              )}
              
              <button
                onClick={handleContinueAnalysis}
                style={{
                  ...buttonStyle,
                  backgroundColor: isDarkMode ? '#ff4500' : '#e53935',
                  marginLeft: 'auto',
                }}
              >
                Continue Analysis
              </button>
            </div>
          </div>

          {/* Download Notification */}
          {results.file_path && (
            <div
              style={{
                backgroundColor: isDarkMode ? 'rgba(30, 58, 138, 0.4)' : '#e3f2fd',
                borderLeft: `4px solid ${isDarkMode ? '#3b82f6' : '#2196f3'}`,
                padding: '16px',
                marginBottom: '20px',
                borderRadius: '4px',
              }}
            >
              <p style={{ color: theme.text, margin: 0 }}>
                <strong>Automatic Download:</strong> if enabled, file found at ({results.file_path}); You can download the filtered table on the next page.
              </p>
            </div>
          )}

          <button onClick={handleNewAnalysis} style={{ ...buttonStyle, backgroundColor: '#fbbf24', color: '#1e293b' }}>
            New Analysis
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default SearchResultsPage;