import React, { useRef,useEffect,useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { debounce } from 'lodash';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart} from 'recharts';
import {Network,DataSet} from 'vis-network/standalone';

const AdvancedSearch = ({ tableData, setFilteredData, isDarkMode,scrollLeft  }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchFields, setSearchFields] = useState([]);
  const [caseSensitive, setCaseSensitive] = useState(false);

  const highlightText = (html, searchTerm) => {
    if (!searchTerm) return html; // Se non c'è un termine di ricerca, restituisci l'HTML originale

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html'); // Converte la stringa HTML in un documento DOM
    const body = doc.body; // Ottieni il corpo del documento

    // Funzione ricorsiva per evidenziare il testo nei nodi
    const highlightNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        // Se il nodo è di tipo testo, evidenzia il termine di ricerca
        const text = node.textContent;
        const regex = new RegExp(`(${searchTerm})`, caseSensitive ? 'g' : 'gi'); // Crea un'espressione regolare per cercare il termine
        const newText = text.replace(regex, '<mark class="highlight">$1</mark>'); // Sostituisci il termine con <mark>
        const newHtml = parser.parseFromString(newText, 'text/html').body; // Converte il nuovo testo in HTML
        node.replaceWith(...newHtml.childNodes); // Sostituisci il nodo di testo con il nuovo HTML
      } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'MARK') {
        // Se il nodo è un elemento (es. <a>, <div>, ecc.) e non è già un <mark>, elabora i suoi figli
        Array.from(node.childNodes).forEach(highlightNode);
      }
    };

    highlightNode(body); // Avvia la ricorsione dal corpo del documento
    return body.innerHTML; // Restituisci l'HTML modificato
  };

  const debouncedSearch = debounce((term, fields) => {
    if (!term) {
      setFilteredData(tableData);
      return;
    }

    const filtered = tableData.filter((row) => {
      return fields.some((field) => {
        const cellText = new DOMParser()
          .parseFromString(row[field], 'text/html')
          .body.textContent
          .trim();
        return caseSensitive
          ? cellText.includes(term)
          : cellText.toLowerCase().includes(term.toLowerCase());
      });
    });

    // Evidenzia il testo trovato
    const highlighted = filtered.map((row) => {
      const newRow = { ...row };
      fields.forEach((field) => {
        newRow[field] = highlightText(row[field], term);
      });
      return newRow;
    });

    setFilteredData(highlighted);
  }, 300);
  const columnGroups = {
    'Article Info': ['Title/PMID', 'GSE', 'Date'],
    'Procedure Info': ['Platform', 'Organisms', 'Instrument_1', 'Instrument_2', 'Instrument_3', 'Summary'],
    'Additional Info': [
      'Series Matrix Link',
      'SOFT formatted family file(s) Link',
      'MINiML formatted family file(s) Link',
      'BioProject link',
      'Geo2R',
      'Other link and GDV',
      'SRA Run Selector',
    ],
    'First 3 Samples and Info': ['Samples_1', 'Samples_2', 'Samples_3', 'Samples_Count'],
    'MeSH Term and Keywords': Object.keys(tableData[0] || {}).slice(20),
  };

  return (
    <div style={{ margin: '20px 0', padding: '10px', background: isDarkMode ? '#333' : '#f5f5f5', borderRadius: '4px',left: `calc(100% - 320px + ${scrollLeft}px)`,position:'relative', left: '500px' }}>
      {/* Checkbox Case Sensitive sopra la barra di ricerca */}
      <div style={{ marginBottom: '10px' }}>
        <label>
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
          />
          <span style={{ marginLeft: '5px', color: isDarkMode ? '#fff' : '#000' }}>Case Sensitive</span>
        </label>
      </div>
      {/* Barra di ricerca */}
      <input
        type="text"
        placeholder="Select below in which column you want to search, then write the word you want to search for..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          debouncedSearch(e.target.value, searchFields);
        }}
        style={{
          padding: '8px',
          marginRight: '10px',
          borderRadius: '4px',
          border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`,
          background: isDarkMode ? '#444' : '#fff',
          color: isDarkMode ? '#fff' : '#000',
          width: '100%',
          gap: '2px',
        }}
      />
      
      {/* Checkbox per selezionare le colonne */}
      <div style={{ marginTop: '10px', color: isDarkMode ? '#fff' : '#000', width: '100%' }}>
      {Object.entries(columnGroups).map(([groupName, fields]) => (
        <div key={groupName} style={{ marginBottom: '15px',display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center' }}>
          <h4 style={{ textDecoration: 'underline', marginBottom: '10px',fontSize: '1.2rem',fontWeight:'bold'}}>{groupName}</h4>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {fields.map((field) => (
              <label
                key={field}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginLeft: '10px',
                }}
              >
                <input
                  type="checkbox"
                  checked={searchFields.includes(field)}
                  onChange={(e) => {
                    const newFields = e.target.checked
                      ? [...searchFields, field]
                      : searchFields.filter((f) => f !== field);
                    setSearchFields(newFields);
                    debouncedSearch(searchTerm, newFields);
                  }}
                  style={{ marginRight: '8px', transform: 'scale(1.5)' }}
                />
                {field}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const parseTableHTML = (html) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rows = Array.from(doc.querySelectorAll('tbody tr'));
  const headers = Array.from(doc.querySelectorAll('thead th')).map((th) => th.textContent.trim());

  return rows.map((row) => {
      const cells = Array.from(row.cells);
      const rowData = {};
      cells.forEach((cell, i) => {
          let cellText = cell.innerHTML.trim();
          
          // Se la colonna è "Date", convertiamo in formato standard
          if (headers[i] === "Date") {
              let dateObj = new Date(cellText);
              if (!isNaN(dateObj.getTime())) {
                  cellText = dateObj.toISOString().split('T')[0]; // Formato YYYY-MM-DD
              } else {
                  cellText = "Unknown"; // Se la data non è valida
              }
          }

          rowData[headers[i]] = cellText;
      });
      return rowData;
  });
};

const DataVisualization = ({ tableData, isDarkMode }) => {
  const containerRef = useRef(null); // Riferimento per il grafo
  const [selectedPaper, setSelectedPaper] = useState(null); // Paper principale selezionato

  // Filtra i dati per il PieChart
  const relevantColumns = Object.keys(tableData[0] || {}).slice(20);

  // Calcola le statistiche per le colonne rilevanti
  const statistics = useMemo(() => {
    if (!tableData.length) return {};

    const stats = {};
    relevantColumns.forEach((column) => {
      const { sum, count } = tableData.reduce(
        (acc, row) => {
          const text = new DOMParser()
            .parseFromString(row[column], 'text/html')
            .body.textContent.trim();
          const value = isNaN(text) ? 0 : Number(text);

          acc.sum += value;
          acc.count += 1;
          return acc;
        },
        { sum: 0, count: 0 }
      );

      stats[column] = {
        max: sum, // Somma totale
        avg: sum / count, // Media
        count, // Numero di righe
      };
    });

    return stats;
  }, [tableData, relevantColumns]);

  // Funzione per calcolare la similarità
  const stopwords = new Set(["the", "is", "in", "and", "to", "of", "a", "for", "on", "with", "this", "that", "by", "at", "as", "it", "are", "from", "was", "be", "an", "or", "which", "its", "not", "but"]);

  const tokenize = (text) => {
      return text
          .toLowerCase()
          .replace(/[^\w\s]/g, '') // Rimuove punteggiatura
          .split(/\s+/) // Divide per spazio
          .filter(word => word.length > 2 && !stopwords.has(word)); // Esclude parole brevi e stopwords
  };
  
  const calculateTFIDF = (documents) => {
      const tfidf = [];
      const termFrequencies = documents.map(doc => {
          const words = tokenize(doc);
          const freq = {};
          words.forEach(word => {
              freq[word] = (freq[word] || 0) + 1;
          });
  
          // Normalizzazione per la lunghezza del documento
          const totalWords = words.length;
          Object.keys(freq).forEach(word => {
              freq[word] /= totalWords;
          });
  
          return freq;
      });
  
      const docCount = documents.length;
      const idf = {};
      termFrequencies.forEach(doc => {
          Object.keys(doc).forEach(word => {
              if (!idf[word]) {
                  idf[word] = Math.log((1 + docCount) / (1 + termFrequencies.filter(d => d[word]).length)) + 1;
              }
          });
      });
  
      termFrequencies.forEach(doc => {
          const docTFIDF = {};
          Object.keys(doc).forEach(word => {
              docTFIDF[word] = doc[word] * idf[word];
          });
          tfidf.push(docTFIDF);
      });
  
      return tfidf;
  };
  
  const cosineSimilarity = (vec1, vec2) => {
      const allWords = new Set([...Object.keys(vec1), ...Object.keys(vec2)]);
      const dotProduct = [...allWords].reduce((sum, word) => sum + (vec1[word] || 0) * (vec2[word] || 0), 0);
      const magnitude1 = Math.sqrt(Object.values(vec1).reduce((sum, val) => sum + val ** 2, 0));
      const magnitude2 = Math.sqrt(Object.values(vec2).reduce((sum, val) => sum + val ** 2, 0));
      return magnitude1 && magnitude2 ? dotProduct / (magnitude1 * magnitude2) : 0;
  };
  
  const calculateSimilarity = (papers, selectedIndex) => {
      if (!papers || !Array.isArray(papers) || selectedIndex < 0 || selectedIndex >= papers.length) {
          console.error('Invalid papers data or selected index out of range');
          return [];
      }
  
      const texts = papers.map(paper => {
          const summary = (paper.Summary || '').toLowerCase();
          const keywords = relevantColumns
              .filter(key => parseInt(paper[key]) === 1)
              .join(' ')
              .toLowerCase();
          const date = paper.Date || '';
  
          // 🔹 **Aumentiamo il peso della Summary (2x)**
          const summaryTokens = tokenize(summary);
          const weightedSummary = summaryTokens.map(w => `${w} ${w}`).join(' '); // Ogni parola appare 2 volte
  
          // 🔹 **Aumentiamo il peso delle Keywords (4x rispetto alla Summary)**
          const weightedKeywords = keywords.split(' ').map(k => `${k} ${k} ${k} ${k}`).join(' '); 
  
          return `${weightedSummary} ${weightedKeywords} ${date}`;
      });
  
      const tfidfVectors = calculateTFIDF(texts);
  
      return tfidfVectors.map((vec, i) => cosineSimilarity(tfidfVectors[selectedIndex], vec));
  };
// Funzione per estrarre il PMID se presente (ricerca "PMID:" seguito dai numeri), altrimenti restituisce il testo puro
  function extractPMID(paper) {
    const htmlContent = paper["Title/PMID"] || "";
    
    // Cerca il pattern "PMID:" seguito da spazi opzionali e dai numeri (case insensitive)
    const regex = /PMID[:\s]*(\d+)/i;
    const match = regex.exec(htmlContent);

    if (match) {
      // Se troviamo "PMID: 12345678", restituiamo "12345678"
      return match[1];
    } else {
      // Se non troviamo il pattern, estraiamo il testo puro dal contenuto HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, "text/html");
      const text = doc.body.textContent.trim();
      // Se il testo è vuoto, usiamo un fallback
      return text || "No PMID or Title available";
    }
  }
  function extractGSE(paper) {
    const htmlContent = paper["GSE"] || "";
    
    // Cerca il pattern "PMID:" seguito da spazi opzionali e dai numeri (case insensitive)
    const regex = /GSE[:\s]*(\d+)/i;
    const match = regex.exec(htmlContent);

    if (match) {
      // Se troviamo "PMID: 12345678", restituiamo "12345678"
      return match[1];
    } else {
      // Se non troviamo il pattern, estraiamo il testo puro dal contenuto HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, "text/html");
      const text = doc.body.textContent.trim();
      // Se il testo è vuoto, usiamo un fallback
      return text || "No GSE available";
    }
  }
  const cleanHTML = (htmlString) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
  
    // Rimuove tutti i bottoni e altri elementi non desiderati
    const elementsToRemove = doc.querySelectorAll('button, script, style');
    elementsToRemove.forEach(el => el.remove());
  
    return doc.body.textContent.trim();
  };
  
  useEffect(() => {
    let popup = document.getElementById('edge-tooltip');
    
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'edge-tooltip';
      document.body.appendChild(popup);
    }
  
    const formatNodeTitle = (paper, relevantColumns,similarity,isPopup=false) => {
      // Extract GSE and Summary
      const pmid= extractPMID(paper)
      const gse= extractGSE(paper)
      const rawsummary = paper.Summary || 'No summary available';
      const summary = cleanHTML(rawsummary)
      const splitTextOnSpace = (text, maxChars) => {
        const result = [];
        let current = '';

        text.split(' ').forEach(word => {
            if ((current + word).length <= maxChars) {
                current += word + ' ';
            } else {
                result.push(current.trim());
                current = word + ' ';
            }
        });

        if (current) {
            result.push(current.trim());
        }

        return result.join('\n');
      };

      const formattedSummary = splitTextOnSpace(summary, 100);
      const keywords = relevantColumns.filter(key => parseInt(paper[key]) ===1).join(', ');
      
      // Return clean formatted string
      return `PMID/Title: ${pmid}
    GSE: ${gse}
    Summary: ${isPopup ? summary : formattedSummary}
    Score: ${similarity.toFixed(2)}
    Keywords: ${keywords}`;
    };
    
    if (!containerRef.current || !tableData.length || selectedPaper === null) return;

    const selectedIndex = tableData.findIndex(paper => paper['Title/PMID'] === selectedPaper);
    if (selectedIndex === -1) return;

    const similarityScores = calculateSimilarity(tableData, selectedIndex);
    console.log("simil",similarityScores)

    // Crea i nodi con una posizione iniziale più dispersa
// Nodi
  const nodes = new DataSet(
    tableData.map((paper, index) => {
      const similarity = similarityScores[index] || 0;
      // Se il nodo è selezionato, ha la priorità
      if (index === selectedIndex) {
        return {
          id: index,
          label: `${index + 1}`,
          title: formatNodeTitle(paper, relevantColumns, similarity),
          color: {
            background: '#ff4136',
            border: '#ff1100',
            hover: { background: '#D2E5FF', border: '#2B7CE9' },
          },
          x: 0,
          y: 0,
        };
      }
      // Unifica le soglie per i nodi
      const bgColor =
        similarity >= 0.94
          ? '#808080'
          : similarity > 0.7
          ? '#FFD700'
          : similarity > 0.3
          ? '#2ca02c'
          : '#1f77b4';
      return {
        id: index,
        label: `${index + 1}`,
        title: formatNodeTitle(paper, relevantColumns, similarity),
        color: {
          background: bgColor,
          border: '#2B7CE9',
          hover: { background: '#D2E5FF', border: '#2B7CE9' },
        },
        x:
          Math.cos((index / tableData.length) * 2 * Math.PI) *
          (similarity > 0.7 ? 120 : similarity > 0.3 ? 200 : 500),
        y:
          Math.sin((index / tableData.length) * 2 * Math.PI) *
          (similarity > 0.7 ? 120 : similarity > 0.3 ? 200 : 500),
      };
    })
  );

  // Edge
  const edges = similarityScores.map((score, i) => ({
    id: i,
    from: selectedIndex,
    to: i,
    value: score,
    title: `Similarity Score: ${score.toFixed(2)}`,
    color:
      score >= 0.94
        ? '#808080'
        : score > 0.7
        ? '#FFD700'
        : score > 0.3   // Soglia aggiornata per gli edge: > 0.3
        ? '#2ca02c'
        : '#1f77b4',
    width: 1 + score * 6,
  })).filter(edge => edge.to !== selectedIndex && edge.value > 0.05);

  
  new Network(containerRef.current, { nodes, edges }, {
      nodes: { shape: 'dot', size: 20 },
      edges: { smooth: { type: 'continuous' }, arrows: { to: { enabled: false } } },
      layout: { improvedLayout: true, hierarchical: false },
      physics: {
          enabled: true,
          repulsion: { nodeDistance: 250, centralGravity: 0.02, springLength: 200, springConstant: 0.01 },
          solver: "repulsion",
          stabilization: { iterations: 300 },
      },
  }); 
}, [tableData, selectedPaper]);


  // Color palette
  const COLORS = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
    '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
    '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5'
  ];

  // Prepara i dati per il BarChart
  const chartData = Object.entries(statistics).map(([key, value]) => ({
    name: key,
    max: value.max,
    avg: value.avg,
  }));

  // Prepara i dati per il PieChart
  const filteredPieData = Object.entries(statistics)
    .map(([name, value]) => ({
      name,
      value: value.max,
    }))
    .filter(({ value }) => value !== 0);

  // Tooltip personalizzato per il PieChart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ 
          backgroundColor: isDarkMode ? '#333333' : 'white', 
          padding: '8px', 
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          color: isDarkMode ? '#ffffff' : '#000000',
        }}>
          <p style={{ fontWeight: 500 }}>{payload[0].name}</p>
          <p style={{ fontSize: '0.875rem' }}>Count: {payload[0].value.toFixed(2)}</p>
          <p style={{ fontSize: '0.875rem' }}>
            Percentage: {((payload[0].value / filteredPieData.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(2)}%
          </p>
        </div>
      );
    }
    return null;
  };

  // Prepara i dati per il LineChart - Trend analysis
  const lineData = Object.entries(statistics).map(([key, value], index) => ({
    name: key,
    value: value.max,
    trend: value.avg * (index + 1) // Simulazione di una tendenza
  }));

  // Prepara i dati per l'AreaChart - Cumulative analysis
  const areaData = Object.entries(statistics).reduce((acc, [key, value], index) => {
    const previousTotal = index > 0 ? acc[index - 1].total : 0;
    acc.push({
      name: key,
      total: previousTotal + value.max,
      increment: value.max
    });
    return acc;
  }, []);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '1rem',
      backgroundColor: isDarkMode ? '#2365a9' : '#2365a9', // Sfondo principale
      color: isDarkMode ? '#000000' : '#ffffff', // Colore del testo
      padding: '1.5rem',
    }}>
      {/* Statistical Analysis */}
      <div style={{ 
        padding: '1.5rem', 
        border: `1px solid ${isDarkMode ? '#333333' : '#e5e7eb'}`, 
        borderRadius: '0.5rem',
        backgroundColor: isDarkMode ? '#000000' : '#ffffff'
      }}>
        <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#4a5568', marginBottom: '16px' }}> 
          <span style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>Statistical </span>
          <span style={{ color: '#3182ce' }}>Analysis</span>
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {Object.entries(statistics).map(([column, stats]) => (
            <div
              key={column}
              style={{
                padding: '1rem',
                border: `1px solid ${isDarkMode ? '#333333' : '#e5e7eb'}`,
                borderRadius: '0.375rem',
                minWidth: '200px',
                backgroundColor: isDarkMode ? '#333333' : '#ffffff',
                color: isDarkMode ? '#ffffff' : '#000000',
              }}
            >
              <h3 style={{ fontWeight: 500 }}>{column}</h3>
              <p>Max (Total): {stats.max.toFixed(2)}</p>
              <p>Average: {stats.avg.toFixed(2)}</p>
              <p>Count: {stats.count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bar Chart */}
      <div style={{ 
        padding: '1.5rem', 
        border: `1px solid ${isDarkMode ? '#333333' : '#e5e7eb'}`, 
        borderRadius: '0.5rem',
        backgroundColor: isDarkMode ? '#000000' : '#ffffff', 
      }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem', color: isDarkMode ? '#ffffff' : '#000000' }}>
          Distribution Analysis
        </h2>
        <div style={{ height: '400px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" stroke={isDarkMode ? '#ffffff' : '#000000'} />
              <YAxis stroke={isDarkMode ? '#ffffff' : '#000000'} />
              <Tooltip />
              <Legend />
              <Bar dataKey="max" fill="#8884d8" name="Max (Total)" />
              <Bar dataKey="avg" fill="#82ca9d" name="Average" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Similarity Map */}
      <div style={{ 
          padding: '1.5rem', 
          border: `1px solid ${isDarkMode ? '#333333' : '#e5e7eb'}`, 
          borderRadius: '0.5rem',
          backgroundColor: isDarkMode ? '#333333' : 'white', 
      }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem', color: isDarkMode ? '#ffffff' : '#000000' }}>
              Similarity Map
          </h2>
            <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="paper-select" style={{ marginRight: '0.5rem', color: isDarkMode ? '#ffffff' : '#000000' }}>
                    Select a paper:
              </label>
                <select
                    id="paper-select"
                    value={selectedPaper || ''}
                    onChange={(e) => setSelectedPaper(e.target.value)}
                    style={{ 
                        padding: '0.5rem', 
                        color: isDarkMode ? '#ffffff' : '#000000', 
                        backgroundColor: isDarkMode ? '#222222' : '#ffffff', 
                        borderRadius: '4px', 
                        position:'relative',
                        maxWidth:'90%',
                        border: `1px solid ${isDarkMode ? '#ffffff' : '#000000'}`

                    }}
                >
                    <option value="">-- Select --</option>
                    {tableData.map((paper, index) => (
                        <option key={index} value={paper['Title/PMID']} style={{backgroundColor:index % 2 === 0 ? '#f0f0f0' : '#e0e0e0'}}>
                            {index + 1} - PMID/Title: {extractPMID(paper).slice(0, 150)}{extractPMID(paper).length > 150 ? '...' : ''}

                        </option>
                    ))}
                  
              </select>
              
          </div>

          {/* Contenitore della rete */}
          <div style={{ height: '600px' }} ref={containerRef} />

          {/* 🔹 Legenda per i colori */}
          <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '8px', backgroundColor: isDarkMode ? '#222222' : '#f8f9fa' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: isDarkMode ? '#ffffff' : '#000000' }}>
              Legend
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{width: '20px',height: '20px',backgroundColor: '#ff1100', borderRadius: '50%',marginRight: '10px' }}></span>
              <span style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>Selected</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ width: '20px', height: '20px', backgroundColor: '#808080', borderRadius: '50%', marginRight: '10px' }}></span>
              <span style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>Same paper, different GSE</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ width: '20px', height: '20px', backgroundColor: '#FFD700', borderRadius: '50%', marginRight: '10px' }}></span>
              <span style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>High similarity (&gt; 70%)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ width: '20px', height: '20px', backgroundColor: '#2ca02c', borderRadius: '50%', marginRight: '10px' }}></span>
              <span style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>Medium similarity (30% - 70%)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ width: '20px', height: '20px', backgroundColor: '#1f77b4', borderRadius: '50%', marginRight: '10px' }}></span>
              <span style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>Low similarity (&lt; 30%)</span>
            </div>
          </div>
      </div>



      {/* Pie Chart */}
      <div style={{ 
        padding: '1.5rem', 
        border: `1px solid ${isDarkMode ? '#333333' : '#e5e7eb'}`, 
        borderRadius: '0.5rem',
        backgroundColor: isDarkMode ? '#333333' : 'white', 
      }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem', color: isDarkMode ? '#ffffff' : '#000000' }}>
          Keyword Distribution
        </h2>
        <div style={{ height: '400px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={filteredPieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={120}
                label={({ name, percent }) => 
                  `${name} (${(percent * 100).toFixed(1)}%)`
                }
                labelLine={true}
              >
                {filteredPieData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend layout="horizontal" verticalAlign="bottom" align="center" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

{/* Line Chart - Keyword Cumulative Trend */}
      <div style={{ 
          padding: '1.5rem', 
          border: `1px solid ${isDarkMode ? '#333333' : '#e5e7eb'}`, 
          borderRadius: '0.5rem',
          backgroundColor: isDarkMode ? '#333333' : 'white', 
      }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem', color: isDarkMode ? '#ffffff' : '#000000' }}>
              Keyword Trend Over Publications (Cumulative)
          </h2>
          <div style={{ height: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                      data={(() => {
                          console.log("🔍 Initial tableData:", tableData);

                          // Ordina i dati per data crescente
                          const sortedData = tableData
                              .filter(row => row.Date && row.Date.match(/\d{2}\/\d{2}\/\d{4}/)) // Assicura che il formato della data sia corretto
                              .sort((a, b) => new Date(a.Date.split('/').reverse().join('-')) - new Date(b.Date.split('/').reverse().join('-'))); // Ordina per data

                          let cumulativeCounts = {}; // Accumulatore per keyword nel tempo

                          const formattedData = sortedData.map((row, index) => {
                              const formattedDate = row.Date; // Mantieni la data originale
                              const currentRow = { period: formattedDate };

                              // Per ogni keyword, aggiorniamo il valore cumulativo
                              Object.keys(row)
                                  .slice(20) // Solo colonne delle keyword
                                  .forEach(keyword => {
                                      const keywordKey = keyword.trim().toLowerCase();
                                      const keywordValue = parseInt(row[keyword]) || 0;

                                      // Se è la prima riga, inizia con il valore attuale, altrimenti accumula
                                      if (index === 0) {
                                          cumulativeCounts[keywordKey] = keywordValue;
                                      } else {
                                          cumulativeCounts[keywordKey] = (cumulativeCounts[keywordKey] || 0) + keywordValue;
                                      }

                                      currentRow[keywordKey] = cumulativeCounts[keywordKey]; // Assegna il valore aggiornato
                                  });

                              return currentRow;
                          });

                          console.log("📊 Cumulative keyword trend data:", formattedData);
                          return formattedData;
                      })()}
                      margin={{ top: 10, right: 30, left: 10, bottom: 30 }}
                  >
                      <XAxis 
                          dataKey="period" 
                          stroke={isDarkMode ? '#ffffff' : '#000000'}
                          angle={-45}
                          textAnchor="end"
                          height={70}
                      />
                      <YAxis 
                          stroke={isDarkMode ? '#ffffff' : '#000000'}
                      />
                      <Tooltip 
                          contentStyle={{
                              backgroundColor: isDarkMode ? '#333333' : 'white',
                              border: '1px solid #666',
                              color: isDarkMode ? '#ffffff' : '#000000'
                          }}
                      />
                      <Legend 
                          verticalAlign="top"
                          height={36}
                      />
                      {tableData[0] && Object.keys(tableData[0])
                          .slice(20)
                          .map((keyword, index) => (
                              <Line 
                                  key={keyword}
                                  type="monotone"
                                  dataKey={keyword.trim().toLowerCase()}
                                  stroke={COLORS[index % COLORS.length]}
                                  name={keyword}
                                  dot={false}
                                  strokeWidth={2}
                              />
                          ))
                      }
                  </LineChart>
              </ResponsiveContainer>
          </div>
      </div>


    </div>
  );
};

function Analysis() {
  const location = useLocation();
  const navigate = useNavigate();

  const { tableHTML, isDarkMode } = location.state || {};
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth', // Scroll fluido
    });
  };
  // Funzione per decodificare l'HTML della tabella in un array di dati
  const parseTableHTML = (html) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const rows = Array.from(doc.querySelectorAll('tbody tr'));
    const headers = Array.from(doc.querySelectorAll('thead th')).map((th) => th.textContent.trim());

    return rows.map((row) => {
      const cells = Array.from(row.cells);
      const rowData = {};
      cells.forEach((cell, i) => {
        rowData[headers[i]] = cell.innerHTML.trim(); // Salva il contenuto HTML della cella
      });
      return rowData;
    });
  };

  // Dati iniziali
  const initialTableData = tableHTML ? parseTableHTML(tableHTML) : [];
  const [tableData, setTableData] = useState(initialTableData);
  const [filters, setFilters] = useState({}); // Stato per i filtri
  const [openFilter, setOpenFilter] = useState(null); // Tiene traccia del filtro aperto
  const [expandedSummaries, setExpandedSummaries] = useState(new Set()); // Stato per righe espanse
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' }); // Stato per l'ordinamento
  const [showSearch, setShowSearch] = useState(false); // Stato per mostrare/nascondere la ricerca avanzata
  const [filterSearchTerm, setFilterSearchTerm] = useState(''); // Stato per la ricerca nel filtro
  const [showStatistics, setShowStatistics] = useState(false); // Stato per mostrare/nascondere le statistiche

  // Funzione per gestire l'ordinamento
  const handleSort = (columnKey) => {
    let direction = 'ascending';

    if (sortConfig.key === columnKey && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }

    setSortConfig({ key: columnKey, direction });
  };

  // Funzione per ordinare i dati
  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return tableData;

    return [...tableData].sort((a, b) => {
      // Estrai il testo puro rimuovendo i tag HTML
      const aValue = new DOMParser().parseFromString(a[sortConfig.key], 'text/html').body.textContent.trim();
      const bValue = new DOMParser().parseFromString(b[sortConfig.key], 'text/html').body.textContent.trim();

      // Gestisce ordinamento numerico se possibile
      if (!isNaN(aValue) && !isNaN(bValue)) {
        return sortConfig.direction === 'ascending'
          ? Number(aValue) - Number(bValue)
          : Number(bValue) - Number(aValue);
      }

      // Ordinamento alfabetico per testo
      return sortConfig.direction === 'ascending'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    });
  }, [tableData, sortConfig]);

  // Funzione per ottenere i valori unici di una colonna
  const getUniqueValues = (columnName) => {
    const parser = new DOMParser();
    return Array.from(new Set(tableData.map((row) => {
      const doc = parser.parseFromString(row[columnName], 'text/html');
      return doc.body.textContent.trim();
    }))).sort();
  };
  

  // Funzione per filtrare i valori unici in base alla ricerca
  const getFilteredUniqueValues = (columnName, searchTerm) => {
    const uniqueValues = getUniqueValues(columnName);
    if (!searchTerm) return uniqueValues;
    return uniqueValues.filter((value) =>
      value.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // Funzione per aggiornare i filtri
  const updateFilter = (columnName, value, checked) => {
    setFilters((prevFilters) => {
      const columnFilters = prevFilters[columnName] || [];
      if (checked) {
        return { ...prevFilters, [columnName]: [...columnFilters, value] };
      } else {
        return {
          ...prevFilters,
          [columnName]: columnFilters.filter((v) => v !== value),
        };
      }
    });
  };

  // Funzione per applicare i filtri
  const applyFilters = () => {
    const parser = new DOMParser();
    const filteredData = initialTableData.filter((row) =>
      Object.keys(filters).every((col) => {
        const filterValues = filters[col];
        if (!filterValues || filterValues.length === 0) return true;

        const cellText = parser.parseFromString(row[col], 'text/html').body.textContent.trim();
        return filterValues.includes(cellText);
      })
    );
    setTableData(filteredData);
    setOpenFilter(null);
  };

  // Funzione per resettare i filtri
  const resetFilters = () => {
    setFilters({});
    setTableData(initialTableData);
  };

  // Funzione per espandere/contrarre la colonna Summary
  const toggleSummaryExpand = (rowIndex) => {
    setExpandedSummaries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowIndex)) {
        newSet.delete(rowIndex);
      } else {
        newSet.add(rowIndex);
      }
      return newSet;
    });
  };
  const toggleAllSummaries = () => {
    if (expandedSummaries.size === sortedData.length) {
      // Se tutte le righe sono espanse, riduci tutto
      setExpandedSummaries(new Set());
    } else {
      // Altrimenti, espandi tutte le righe
      const allRowIndices = sortedData.map((_, index) => index);
      setExpandedSummaries(new Set(allRowIndices));
    }
  };
  // Funzione per esportare la tabella filtrata in Excel
  const exportToExcel = () => {
    // Prepara i dati per l'Excel
    const wsData = [];
    const headers = Object.keys(tableData[0] || {});

    // Aggiungi l'intestazione
    wsData.push(headers);

    // Aggiungi i dati riga per riga
    tableData.forEach((row) => {
      const rowData = [];
      headers.forEach((header) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(row[header], 'text/html');
        const links = doc.querySelectorAll('a');

        if (links.length > 0) {
          // Se ci sono link, crea una formula HYPERLINK
          const link = links[0]; // Prendi il primo link (se ce ne sono più di uno)
          rowData.push({
            f: `HYPERLINK("${link.href}", "${link.textContent}")`,
            s: { font: { color: { rgb: '	#0645AD' }, underline: true } },
          });
        } else {
          // Altrimenti, usa solo il testo
          rowData.push(doc.body.textContent.trim());
        }
      });
      wsData.push(rowData);
    });

    // Crea un nuovo foglio di lavoro manualmente
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    // Crea il file Excel
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filtered Data');

    // Scarica il file
    XLSX.writeFile(wb, 'filtered_table.xlsx');
  };

  // Funzione per esportare la tabella filtrata in CSV
  const exportToCSV = () => {
    const headers = Object.keys(tableData[0] || {});
    const csvContent = [
      headers.join(','), // Intestazione
      ...tableData.map((row) =>
        headers
          .map((header) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(row[header], 'text/html');
            return `"${doc.body.textContent.trim().replace(/"/g, '""')}"`; // Gestisce le virgolette nei dati
          })
          .join(',')
      ),
    ].join('\n');

    // Crea un file CSV e lo scarica
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'filtered_table.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (!tableHTML) {
    return <div>No table available for analysis.</div>;
  }

  return (
    <div
      style={{
        backgroundColor: isDarkMode ? '#121212' : '#ffffff',
        color: isDarkMode ? '#ffffff' : '#000000',
        padding: '20px',
        minHeight: '100vh',
        position: 'relative',
      }}
    >
      <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#4a5568', marginBottom: '16px' }}> <span style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>Analysis</span>{' '}<span style={{ color: '#3182ce' }}>Tools</span> </h1>
      <button
        onClick={scrollToTop}
        style={{
          position: 'fixed', // Fissa il pulsante nella viewport
          bottom: '20px', // Distanza dal basso
          right: '20px', // Distanza da destra
          width: '50px', // Larghezza del pulsante
          height: '50px', // Altezza del pulsante
          borderRadius: '50%', // Rende il pulsante circolare
          backgroundColor: '#3182ce', // Colore di sfondo
          border: 'none', // Rimuove il bordo
          cursor: 'pointer', // Cambia il cursore al passaggio del mouse
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', // Aggiunge un'ombra
        }}
      >
        {/* Freccia verso l'alto */}
        <span
          style={{
            color: isDarkMode ? '#000000' : '#ffffff', // Colore della freccia
            fontSize: '24px',
          }}
        >
          ↑
        </span>
      </button>
      <div
        style={{
          overflowX: 'auto',
          overflowY: 'scroll',
          maxHeight: '80vh',
          marginTop: '20px',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', height:'90%' }}>
          <thead>
            {/* Prima riga con le intestazioni raggruppate */}
            <tr>
              {/* Article Info */}
              <th
                colSpan="3"
                style={{
                  textAlign: 'center',
                  background: isDarkMode ? '#333' : '#f5f5f5',
                  border: '1px solid #ccc',
                  //borderBottom: `1px solid ${isDarkMode ? '#fff' : '#000'}`,
                  paddingBottom: '10px', // Aggiunto spazio sotto
                }}
              >
                Article Info
              </th>
              {/* Procedure Info & Summary */}
              <th
                colSpan="6"
                style={{
                  textAlign: 'center',
                  background: isDarkMode ? '#333' : '#f5f5f5',
                  border: '1px solid #ccc',
                  //borderBottom: `1px solid ${isDarkMode ? '#fff' : '#000'}`,
                  paddingBottom: '10px', // Aggiunto spazio sotto
                }}
              >
                Procedure Info & Summary
              </th>
              {/* Additional Info */}
              <th
                colSpan="7"
                style={{
                  textAlign: 'center',
                  background: isDarkMode ? '#333' : '#f5f5f5',
                  border: '1px solid #ccc',
                  //borderBottom: `1px solid ${isDarkMode ? '#fff' : '#000'}`,
                  paddingBottom: '10px', // Aggiunto spazio sotto
                }}
              >
                Additional Info
              </th>
              {/* First 3 Samples and Info */}
              <th
                colSpan="4"
                style={{
                  textAlign: 'center',
                  background: isDarkMode ? '#333' : '#f5f5f5',
                  border: '1px solid #ccc',
                  //borderBottom: `1px solid ${isDarkMode ? '#fff' : '#000'}`,
                  paddingBottom: '20px', // Aggiunto spazio sotto
                }}
              >
                First 3 Samples and Info
              </th>
              {/* MeSH Term in Articles and Keywords */}
              <th
                colSpan={Object.keys(initialTableData[0] || {}).length - 20}
                style={{
                  textAlign: 'center',
                  background: isDarkMode ? '#333' : '#f5f5f5',
                  border: '1px solid #ccc',
                  //borderBottom: `1px solid ${isDarkMode ? '#fff' : '#000'}`,
                  paddingBottom: '10px', // Aggiunto spazio sotto
                }}
              >
                MeSH Term in Articles and Keywords
              </th>
            </tr>
            <tr>
              {Object.keys(initialTableData[0] || {}).map((columnName) => (
                <th
                  key={columnName}
                  style={{
                    position: 'sticky',
                    top: 0,
                    padding: '10px',
                    cursor: 'pointer',
                    zIndex: 1,
                    border: '1px solid black',
                    background:isDarkMode ? '#333' : '#f5f5f5',
                  }}
                  onClick={() => {
                    setOpenFilter((prevOpen) => (prevOpen === columnName ? null : columnName));
                    setFilterSearchTerm(''); // Resetta il termine di ricerca
                  }}
                >
                 {columnName}
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Evita la propagazione dell'evento al th
                      setOpenFilter((prevOpen) => (prevOpen === columnName ? null : columnName));
                      setFilterSearchTerm(''); // Resetta il termine di ricerca
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      marginLeft: '10px',
                      fontSize: '16px',
                    }}
                  >
                    ▼
                  </button>
                  {columnName === 'Summary' && ( // Aggiungi il pulsante solo per la colonna "Summary"
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Evita la propagazione dell'evento
                        toggleAllSummaries(); // Espandi o riduci tutte le righe
                      }}
                      style={{
                        backgroundColor: '#1e90ff', // Colore blu
                        color: '#ffffff',
                        padding: '5px 10px',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginLeft: '10px',
                        marginTop: '10px',
                        fontSize: '10px',
                        width: '100px',
                        maxWidth: '100px',
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      {expandedSummaries.size === sortedData.length ? 'Reduce All' : 'Show All'}
                    </button>
                  )}
                  {openFilter === columnName && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        display: 'flex',
                        gap: '10px',
                        zIndex: 10,
                      }}
                      onClick={(e) => e.stopPropagation()} // Ferma la propagazione
                    >
                      <div
                        style={{
                          background: isDarkMode ? '#333' : '#fff',
                          color: isDarkMode ? '#fff' : '#000',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                          padding: '10px',
                          border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`,
                          borderRadius: '4px',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        {/* Barra di ricerca */}
                        <input
                          type="text"
                          placeholder="Search..."
                          value={filterSearchTerm}
                          onChange={(e) => {
                            e.stopPropagation(); // Ferma la propagazione
                            setFilterSearchTerm(e.target.value);
                          }}
                          style={{
                            padding: '5px',
                            marginBottom: '10px',
                            borderRadius: '4px',
                            border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`,
                            background: isDarkMode ? '#444' : '#fff',
                            color: isDarkMode ? '#fff' : '#000',
                          }}
                        />
                        <div
                          style={{
                            maxHeight: '200px',
                            overflowY: 'scroll',
                            paddingBottom: '10px',
                            borderBottom: `1px solid ${isDarkMode ? '#555' : '#ccc'}`,
                          }}
                        >
                          {getFilteredUniqueValues(columnName, filterSearchTerm).map((value) => (
                            <div
                              key={value}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                              }}
                              onClick={(e) => {
                                e.stopPropagation(); // Ferma la propagazione
                                updateFilter(
                                  columnName,
                                  value,
                                  !(filters[columnName]?.includes(value) || false)
                                );
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={filters[columnName]?.includes(value)}
                                onChange={(e) => {
                                  e.stopPropagation(); // Ferma la propagazione
                                  updateFilter(columnName, value, e.target.checked);
                                }}
                              />
                              <span style={{ marginLeft: '10px' }}>{value}</span>
                            </div>
                          ))}
                        </div>
                        <div
                          style={{
                            padding: '5px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Ferma la propagazione
                              applyFilters();
                            }}
                            style={{
                              backgroundColor: isDarkMode ? '#1e90ff' : '#0066cc',
                              color: '#ffffff',
                              fontSize: '12px',
                              padding: '5px 15px',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                      <div
                        style={{
                          background: isDarkMode ? '#333' : '#fff',
                          color: isDarkMode ? '#fff' : '#000',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                          padding: '10px',
                          border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`,
                          borderRadius: '4px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <span>Order:</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Ferma la propagazione
                            handleSort(columnName);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '32px',
                            color: isDarkMode ? '#fff' : '#000',
                          }}
                        >
                          {sortConfig.key === columnName && sortConfig.direction === 'ascending' ? '↑' : '↓'}
                          </button>
                          {/* Aggiungi il pulsante "All" */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Ferma la propagazione
                              const filteredValues = getFilteredUniqueValues(columnName, filterSearchTerm);
                              const areAllSelected = filteredValues.every((value) =>
                                filters[columnName]?.includes(value)
                              );
                              if (areAllSelected) {
                                // Se tutti i valori filtrati sono già selezionati, deseleziona tutto
                                setFilters((prevFilters) => ({
                                  ...prevFilters,
                                  [columnName]: prevFilters[columnName]?.filter((value) => !filteredValues.includes(value)) || [],
                                }));
                              } else {
                                // Altrimenti, seleziona tutti i valori filtrati
                                setFilters((prevFilters) => ({
                                  ...prevFilters,
                                  [columnName]: [...new Set([...(prevFilters[columnName] || []), ...filteredValues])],
                                }));
                              }
                            }}
                            style={{
                              backgroundColor: isDarkMode ? '#32cd32' : '#4caf50',
                              color: '#ffffff',
                              padding: '5px 10px',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              position: 'relative',
                              top: '0%',
                            }}
                            >
                            {filters[columnName]?.length === getFilteredUniqueValues(columnName, filterSearchTerm).length
                              ? 'Deselect All'
                              : 'Select All'}
                          </button>
                      </div>
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {Object.entries(row).map(([columnName, cellContent], cellIndex) => {
                  if (columnName === 'Summary') {
                    const cleanSummary = cellContent.replace(/<button.*?<\/button>/g, '').trim();
                    const isExpanded = expandedSummaries.has(rowIndex);
                    const displayText = isExpanded ? cleanSummary : `${cleanSummary.slice(0, 100)}...`;

                    return (
                      <td key={cellIndex} style={{ padding: '10px', border: '1px solid #ccc' }}>
                        <div>
                          <span dangerouslySetInnerHTML={{ __html: displayText }} />
                          {cleanSummary.length > 100 && (
                            <button
                              onClick={() => toggleSummaryExpand(rowIndex)}
                              style={{
                                marginLeft: '10px',
                                backgroundColor: isDarkMode ? '#1e90ff' : '#0066cc',
                                color: '#ffffff',
                                padding: '5px 10px',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              {isExpanded ? 'Show Less' : 'Show More'}
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  }

                  return (
                    <td
                      key={cellIndex}
                      style={{ padding: '10px', border: '1px solid #ccc' }}
                      dangerouslySetInnerHTML={{ __html: cellContent }}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ textAlign: 'center', marginTop: '20px', marginBottom : '20px',display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            backgroundColor: isDarkMode ? '#1e90ff' : '#0066cc',
            color: '#ffffff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          New Analysis
        </button>
        <button
          onClick={resetFilters}
          style={{
            backgroundColor: isDarkMode ? '#228b22' : '#4caf50',
            color: '#ffffff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Reset Filters
        </button>
        <button
          onClick={exportToExcel}
          style={{
            backgroundColor: isDarkMode ? '#ffd700' : '#ffc107',
            color: '#000000',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Download Filtered Table (Excel)
        </button>
        <button
          onClick={exportToCSV}
          style={{
            backgroundColor: isDarkMode ? '#6a5acd' : '#7b68ee',
            color: '#ffffff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Download Filtered Table (CSV)
        </button>
        {/* Nuovo pulsante per statistiche e grafici */}
        <button
          onClick={() => setShowStatistics(!showStatistics)}
          style={{
            backgroundColor: isDarkMode ? '#ff6347' : '#ff7f50',
            color: '#ffffff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Statistics & Charts
        </button>
      </div>
      {/* Mostra le statistiche e i grafici */}
      {showStatistics && <DataVisualization tableData={tableData} />}
    </div>
  );
};

export default Analysis;