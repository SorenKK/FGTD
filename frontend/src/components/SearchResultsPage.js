import React, { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function SearchResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const tableRef = useRef(); // Riferimento alla tabella
  const { results, isDarkMode, searchQuery, keywords, meshTerms,filters } = location.state || {};
  const [expandedSummaries, setExpandedSummaries] = useState(new Set()); // Stato per le righe espanse della colonna Summary
  const [showAllRows, setShowAllRows] = useState(false);
  const [showPMIDs, setShowPMIDs] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [hoveredRow, setHoveredRow] = useState(null); // Per effetto hover nelle righe della tabella

  const handleNewAnalysis = () => {
    navigate('/', { state: { isDarkMode } });
  };

  const handleContinueAnalysis = () => {
    // Espandi tutti i contenuti della colonna Summary
    const allRows = Array.from(Array(results.dataframe.length).keys()); // Indici di tutte le righe
    setExpandedSummaries(new Set(allRows)); // Espandi tutti i Summary
  
    // Mostra tutte le righe
    setShowAllRows(true);
  
    // Attendi che il DOM sia aggiornato
    setTimeout(() => {
      const tableHTML = tableRef.current?.outerHTML;
      console.log('Table HTML:', tableHTML); // Debug
      if (!tableHTML) {
        console.error('Table reference is invalid or table is not rendered.');
        return;
      }
      navigate('/analysis', { state: { tableHTML, isDarkMode } });
    }, 0); // Usa un timeout per assicurarti che lo stato sia aggiornato
  };

  if (!results || !results.dataframe) {
    return <div>No results to display.</div>;
  }

  // Colonne fisse
  const FIXED_COLUMNS = [
    'Title/PMID',
    'GSE',
    'Date',
    'Platform',
    'Organisms',
    'Instrument_1',
    'Instrument_2',
    'Instrument_3',
    'Summary',
    'Series Matrix Link',
    'SOFT formatted family file(s) Link',
    'MINiML formatted family file(s) Link',
    'BioProject link',
    'Geo2R',
    'Other link and GDV',
    'SRA Run Selector',
    'Samples_1',
    "Samples_2",
    "Samples_3",
    'Samples_Count',

  ];

  const allColumns = Object.keys(results.dataframe[0] || {});
  const dynamicColumns = allColumns.filter((col) => !FIXED_COLUMNS.includes(col));
  // Filtra le colonne duplicate (Sample_1, Sample_2, Sample_3)
  const uniqueColumns = [...FIXED_COLUMNS];
  const addedSamples = new Set();

  dynamicColumns.forEach((col) => {
    if (col.startsWith('Sample_')) {
      if (!addedSamples.has(col)) {
        uniqueColumns.push(col);
        addedSamples.add(col);
      }
    } else if (col === 'Sample_Count') {
      // Aggiungi Sample_Count solo se non è già presente
      if (!uniqueColumns.includes('Sample_Count')) {
        uniqueColumns.push(col);
      }
    } else {
      uniqueColumns.push(col); // Aggiungi tutte le altre colonne
    }
  });

// Usa uniqueColumns invece di ORDERED_COLUMNS
  const ORDERED_COLUMNS = uniqueColumns;
  

  // Funzione per troncare il testo
  const truncateText = (text = '', maxLength = 80) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  // Espansione/chiusura del Summary
  const toggleSummaryExpand = (rowIndex) => {
    setExpandedSummaries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowIndex)) {
        newSet.delete(rowIndex); // Rimuovi riga espansa
      } else {
        newSet.add(rowIndex); // Aggiungi riga da espandere
      }
      return newSet;
    });
  };

  // Link “corti” da visualizzare
  const shortenLink = (url) => {
    if (url.includes('pubmed.ncbi.nlm.nih.gov')) {
      return url.split('/').pop(); // Estrai solo il PMID
    }
    if (url.includes('geo/query/acc.cgi?acc=GSE')) {
      const gse = url.split('=').pop(); // Estrai l'ID GSE
      return gse;
    }
    if (url.includes('geo/query/acc.cgi?acc=GSM')) {
      const gsm = url.split('=').pop(); // Estrai l'ID GSM
      return gsm;
    }
    if (url.includes('geo/query/acc.cgi?acc=GPL')) {
      const gpl = url.split('=').pop(); // Estrai l'ID GPL
      return gpl.toLowerCase(); // Converte in minuscolo
    }
    if (url.includes('ftp.ncbi.nlm.nih.gov/geo/series/')) {
      const match = url.match(/GSE\d+\/(matrix|soft|miniml)/); // Estrai GSE ID + tipo
      return match ? match[0] : url; // Se trova un match, lo restituisce
    }
    if (url.includes('bioproject/')) {
      const bioproject = url.split('/').pop(); // Estrai il numero del bioproject
      return bioproject;
    }
    if (url.includes('geo2r/?acc=')) {
      const geo2r = url.split('=').pop(); // Estrai il GSE ID
      return `geo2r/${geo2r}`;
    }
    if (url.includes('other link')) {
      return 'Other Link'; // Testo fisso per "Other Link"
    }
    if (url.includes('ncbi.nlm.nih.gov/Traces/study')) {
      return 'SRA Run Selector';
    }

  };

  // Visualizzazione link
  const renderValue = (val) => {
    if (typeof val === 'string' && val.startsWith('http')) {
      return (
        <a
          href={val}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: isDarkMode ? '#1e90ff' : '#0066cc' }}
        >
          {shortenLink(val)}
        </a>
      );
    }
    return val;
  };

  const toggleRowExpand = (rowIndex) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowIndex)) {
      newExpanded.delete(rowIndex);
    } else {
      newExpanded.add(rowIndex);
    }
    setExpandedRows(newExpanded);
  };

  const renderShortLink = (url) => {
    if (url.includes('pubmed.ncbi.nlm.nih.gov')) {
      return url.split('/').pop(); // Estrai solo il PMID
    }
    if (url.includes('geo/query/acc.cgi?acc=')) {
      return url.split('=').pop(); // Estrai solo l'ID GSE
    }
    return truncateText(url, 35); // Testo ridotto per altri link
  };

  // Stile di base del container principale
  const containerStyle = {
    fontFamily: 'Inter, Arial, sans-serif',
    /* Piccolo gradiente in background */
    background: isDarkMode ? '#121212' : '#f0f4f8',
    color: isDarkMode ? '#ffffff' : '#000000',
    minHeight: '100vh',
    padding: '20px',
    /* Aggiungiamo un lieve box-shadow interno */
    transition: 'all 0.3s ease-in-out',
  };

  // Stile dei contenitori “card” (ad esempio per la sezione Title/PMIDs - GSE Codes)
  const cardStyle = {
    flex: 1,
    backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: isDarkMode
    ? '0 10px 15px -3px rgba(255, 255, 255, 0.1), 0 4px 6px -2px rgba(255, 255, 255, 0.05)' // Ombra per tema scuro
    : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', 
    transition: 'background-color 0.3s',
  };

  // Stile del pulsante generico
  const buttonStyle = {
    backgroundColor: isDarkMode ? '#3182ce' : '#4299e1', 
    color: '#ffffff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '4px',
    cursor: 'pointer',
    boxShadow: isDarkMode
    ? '0 4px 6px rgba(49, 130, 206, 0.3)' // Ombra per tema scuro
    : '0 4px 6px rgba(66, 153, 225, 0.3)', // Ombra per tema chiaro
    transition: 'background-color 0.3s, transform 0.2s',
  };

  // Stile per il pulsante “mostra tutti/nascondi” che compare sotto le tabelle
  const linkButtonStyle = {
    background: 'none',
    border: 'none',
    color: isDarkMode ? '#63b3ed' : '#3182ce',
    cursor: 'pointer',
    marginTop: '10px',
    textDecoration: 'underline',
  };

  // Stile per le righe “zebrate” della tabella
  const getRowStyle = (index) => {
    const isEven = index % 2 === 0;
    return {
      backgroundColor: isEven
        ? isDarkMode
          ? '#1f1f1f' // Grigio scuro (tema scuro)
          : '#ffffff' // Bianco (tema chiaro)
        : isDarkMode
          ? '#333333' // Grigio più scuro (tema scuro)
          : '#f7fafc', // Grigio chiaro (tema chiaro)
      /* Effetto hover */
      ...(hoveredRow === index && {
        backgroundColor: isDarkMode ? '#4a5568' : '#edf2f7',
      }),
      transition: 'background-color 0.2s ease-in-out',
    };
  };

  // Stile celle delle tabelle
  const cellStyle = {
    padding: '0px 10px',
    border: `3px solid ${isDarkMode ? '#333333' : '#e2e8f0'}`,
    color: isDarkMode ? '#ffffff' : '#4a5568',
    maxWidth: '5000px',
    overflowWrap: 'break-word',
  };

return (
  <div style={containerStyle}>
    {/* Header */}
    <div
      style={{
        backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
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
      <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#2d3748', marginBottom: '18px', }}><span style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>Results</span>{' '}<span style={{ color: '#3182ce' }}>Overview</span></h1
    >
    </div>

    {/* Titolo e Descrizione */}
    <div
      style={{
        flexGrow: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1800px',
          backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          padding: '32px',
        }}
      >
        <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: '#2d3748', marginBottom: '24px' }}>
        <span style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>From Geo To</span>{' '}<span style={{ color: '#3182ce' }}>Dataset</span>
        </h1>
        <p style={{ fontSize: '16px', color: isDarkMode ? "#ffffff": "#000000", marginBottom: '32px' }}>
          Your search results are ready. The scientifics informations collected from PubMed and GEO have been organized in a tabular format.
        </p>

        {/* Search Summary */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#2d3748', marginBottom: '16px' }}>
          <span style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>Search</span>{' '}<span style={{ color: '#3182ce' }}>Summary</span>
          </h2>
          <div
            style={{
              backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
              padding: '24px',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
          >
            <p style={{ marginBottom: '8px' }}><strong>Query:</strong> {searchQuery || 'N/A'}</p>
            <p style={{ marginBottom: '8px' }}><strong>Keywords:</strong> {keywords || 'N/A'}</p>
            <p><strong>MeSH Terms:</strong> {meshTerms || 'N/A'}</p>
            {filters && Object.keys(filters).length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h3
                  style={{ fontSize: '20px', fontWeight: '600', color: '#2d3748', marginBottom: '16px' }}>
                  <span style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>Applied</span>{' '}<span style={{ color: '#3182ce' }}>Filters</span>
                </h3>
                <ul>
                  {filters.organism && <li><strong>Organism(s):</strong> {filters.organism.join(', ')}</li>}
                  {filters.study_type && <li><strong>Study Type(s):</strong> {filters.study_type.join(', ')}</li>}
                  {filters.subset_type && <li><strong>Subset Type(s):</strong> {filters.subset_type.join(', ')}</li>}
                  {filters.supp_file && <li><strong>Supplementary File(s):</strong> {filters.supp_file.join(', ')}</li>}
                  {filters.date_range && (
                    <li><strong>Date Range:</strong> {filters.date_range[0].join('-')} → {filters.date_range[1].join('-')}</li>
                  )}
                </ul>
              </div>
            )}

          </div>
        </div>

        {/* Results Overview */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#4a5568', marginBottom: '16px' }}>
          <span style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>Scientifics informations</span>{' '}<span style={{ color: '#3182ce' }}>Overview</span>
          </h2>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div
              style={{
                flex: 1,
                backgroundColor: '#ebf8ff',
                padding: '24px',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
              }}
            >
              <h3 style={{ fontWeight: '500', '#ffffff' : '#0d47a1', marginTop: 0 }}>
              </h3>
              {results.dataframe && (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th
                          style={{
                            borderBottom: `2px solid ${isDarkMode ? '#1e90ff' : '#00796b'}`,
                            textAlign: 'left',
                            padding: '8px',
                            color: isDarkMode ? '#1e90ff' : '#00796b',
                            borderRight: '6px solid #00000',
                            backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
                          }}
                        >
                          Title/PMID
                        </th>
                        <th
                          style={{
                            borderBottom: `2px solid ${isDarkMode ? '#1e90ff' : '#00796b'}`,
                            textAlign: 'left',
                            padding: '8px',
                            color: isDarkMode ? '#1e90ff' : '#00796b',
                            backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
                          }}
                        >
                          GSE Code
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.dataframe
                        .slice(0, showPMIDs ? results.dataframe.length : 5)
                        .map((row, index) => {
                          const pmidLink = row['Title/PMID'];
                          const gseLink = row['GSE'];
                          const isPMID =
                            pmidLink && pmidLink.includes('pubmed.ncbi.nlm.nih.gov');
                          const isLink = pmidLink && pmidLink.startsWith('http'); // Verifica se è un link
                          const title = isPMID
                            ? `PMID:${renderShortLink(pmidLink)}`
                            : truncateText(pmidLink, 150);

                          return (
                            <tr
                              key={index}
                              style={{
                                backgroundColor: index % 2 === 0
                                  ? isDarkMode
                                    ? '#2d3748'
                                    : '#ffffff'
                                  : isDarkMode
                                  ? '#4a5568'
                                  : '#f7fafc',
                                transition: 'background-color 0.2s ease-in-out',
                              }}
                              onMouseEnter={() => setHoveredRow(index)}
                              onMouseLeave={() => setHoveredRow(null)}
                            >
                              <td
                                style={{
                                  padding: '12px',
                                  borderBottom: `1px solid ${isDarkMode ? '#4a5568' : '#e2e8f0'}`,
                                  color: isLink
                                    ? isDarkMode
                                      ? '#1e90ff'
                                      : '#0066cc'
                                    : isDarkMode
                                    ? '#ffffff'
                                    : '#4a5568',
                                }}
                              >
                                {isLink ? (
                                  <a
                                    href={pmidLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: isDarkMode ? '#1e90ff' : '#0066cc' }}
                                  >
                                    {title}
                                  </a>
                                ) : (
                                  title
                                )}
                              </td>
                              <td
                                style={{
                                  padding: '12px',
                                  borderBottom: `1px solid ${isDarkMode ? '#4a5568' : '#e2e8f0'}`,
                                  color: isDarkMode ? '#1e90ff' : '#0066cc',
                                }}
                              >
                                <a
                                  href={gseLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: isDarkMode ? '#1e90ff' : '#0066cc' }}
                                >
                                  {renderShortLink(gseLink)}
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  {results.dataframe.length > 5 && (
                    <button
                      style={{
                        marginTop: '8px',
                        color: '#3182ce',
                        fontWeight: '500',
                        cursor: 'pointer',
                        backgroundColor: 'transparent',
                        border: 'none',
                        textDecoration: 'none',
                      }}
                      onClick={() => setShowPMIDs(!showPMIDs)}
                    >
                      {showPMIDs ? 'Hide Rows' : 'Show All Rows'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#2d3748', marginBottom: '10px' }}><span style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>Dataset</span>{' '}<span style={{ color: '#3182ce' }}>Preview</span></h2>
        <div
          style={{
            overflowX: 'auto',
            maxHeight: '900px',
            scrollbarGutter: 'stable',
            borderRadius: '8px',
            backgroundColor: '#edf2f7', // Sfondo grigio chiaro (bg-gray-200)
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', // Ombra leggera
          }}
        >
          <table 
            ref={tableRef}
            style={{ width: '100%', borderCollapse: 'collapse' }}
          >
            <thead
              style={{
                backgroundColor: isDarkMode ? '#000000':'#e2e8f0',
                position: 'sticky',
                top: 0,
                zIndex: 1,
              }}
            >
              <tr>
                {ORDERED_COLUMNS.map((colName, idx) => (
                  <th
                    key={idx}
                    style={{
                      border: `3px solid ${isDarkMode ? '#ffffff' : '#000000'}`,
                      padding: '10px',
                      textAlign: 'left',
                      color: isDarkMode ? '#ffffff' : '#000000',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {colName}
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

                  return (
                    <tr
                      key={rowIndex}
                      style={getRowStyle(rowIndex)}
                      onMouseEnter={() => setHoveredRow(rowIndex)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      {ORDERED_COLUMNS.map((colName, colIndex) => {
                        const val = row[colName] || 0;

                        // Gestione colonna Title/PMID
                        if (colName === 'Title/PMID') {
                          if (colName) {
                            const pmidLink = val;
                            const isLink =
                              typeof pmidLink === 'string' &&
                              pmidLink.startsWith('http');
                            const isPMID =
                              isLink &&
                              pmidLink.includes('pubmed.ncbi.nlm.nih.gov');
                            const title = isPMID
                              ? `PMID:${pmidLink.split('/').pop()}`
                              : truncateText(pmidLink, 200);

                            return (
                              <td key={colIndex} style={cellStyle}>
                                {isLink ? (
                                  <a
                                    href={pmidLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: isDarkMode ? '#1e90ff' : '#0066cc' }}
                                  >
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
                                  <button
                                    onClick={() => toggleRowExpand(rowIndex)}
                                    style={{
                                      ...linkButtonStyle,
                                      color: isDarkMode ? '#1e90ff' : '#0066cc',
                                      marginLeft: '5px',
                                      textDecoration: 'none',
                                    }}
                                  >
                                    {isExpanded ? 'Show Less' : 'Show More'}
                                  </button>
                                )}
                              </td>
                            );
                          }
                        }

                        // Gestione colonna Summary
                        if (colName === 'Summary') {
                          const displayText = isSummaryExpanded ? val : truncateText(val, 50);
                          return (
                            <td key={colIndex} style={cellStyle}>
                              {displayText}
                              {val.length > 50 && (
                                <button
                                  onClick={() => toggleSummaryExpand(rowIndex)}
                                  style={{
                                    ...linkButtonStyle,
                                    color: isDarkMode ? '#1e90ff' : '#0066cc',
                                    marginLeft: '5px',
                                    textDecoration: 'none',
                                  }}
                                >
                                  {isSummaryExpanded ? 'Show Less' : 'Show More'}
                                </button>
                              )}
                            </td>
                          );
                        }

                        // Altre colonne
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

        {results.dataframe.length > 5 && (
          <button
            onClick={() => setShowAllRows(!showAllRows)}
            style={{
              ...buttonStyle,
              marginTop: '10px',
              border: `0px solid ${isDarkMode ? '#ffffff' : '#000000'}`,
              marginLeft: '5px',
            }}
          >
            {showAllRows ? 'Show Less' : 'Show All Rows'}
          </button>
        
        )}

        <button
        onClick={handleContinueAnalysis}
        style={{
          backgroundColor: isDarkMode ? '#ff4500' : '#e53935',
          color: '#ffffff',
          padding: '10px 20px',
          border: 'none',
          borderRadius: 'none',
          cursor: 'pointer',
          fontSize: '16px',
          marginLeft: '16px',
        }}
      >
        Continue Analysis
      </button>
      </div>

      {results.file_path && (
        <div
          style={{
            backgroundColor: isDarkMode ? '#1e3a8a' : '#e3f2fd',
            borderLeft: `4px solid ${isDarkMode ? '#3b82f6' : '#2196f3'}`,
            padding: '10px',
            marginBottom: '20px',
            borderRadius: '4px',
            boxShadow: isDarkMode
              ? '0 4px 6px rgba(255, 255, 255, 0.05)'
              : '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          <p style={{ color: isDarkMode ? '#ffffff' : '#0d47a1', margin: 0 }}>
            <strong>Automatic Download:</strong> if it has been enabled you will find the file ({results.file_path}) in the app folder ; You can download the filtered table on the next page. 
          </p>
        </div>
      )}

      <button
          onClick={handleNewAnalysis}
          style={{
            backgroundColor: '#fbbf24', // Colore giallo
            color: '#1e293b', // Testo scuro per contrasto
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            transition: 'background-color 0.3s, transform 0.2s',
          }}
        >
          New Analysis
      </button>
    </div>
  );
}

export default SearchResultsPage;
