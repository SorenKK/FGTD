import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Network, DataSet } from 'vis-network/standalone';
// --- HELPER LOGICA DOWNLOAD (SVG PURO PER GRAFICI) ---
const performDownload = (ref, fileName, isCanvas = false, networkInstance = null) => {
    if (!ref.current) return;

    if (isCanvas && networkInstance && networkInstance.current) {
        // --- LOGICA MAPPA (VIS.JS) -> PNG ---
        const canvas = ref.current.querySelector('canvas');
        if (!canvas) return;

        const originalScale = networkInstance.current.getScale();
        const originalPosition = networkInstance.current.getViewPosition();

        networkInstance.current.fit({ animation: false });

        setTimeout(() => {
            try {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                const ctx = tempCanvas.getContext('2d');

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                
                ctx.drawImage(canvas, 0, 0);

                const link = document.createElement('a');
                link.download = `${fileName}.png`;
                link.href = tempCanvas.toDataURL('image/png', 1.0);
                link.click();
            } catch (e) {
                console.error("Errore download mappa:", e);
                alert("Errore durante il salvataggio della mappa.");
            } finally {
                networkInstance.current.moveTo({
                    position: originalPosition,
                    scale: originalScale,
                    animation: false
                });
            }
        }, 100);

    } else {
        const svgElement = ref.current.querySelector('svg');
        if (svgElement) {
            const serializer = new XMLSerializer();
            let source = serializer.serializeToString(svgElement);

            if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
                source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
            }
            if(!source.match(/^<svg[^>]+xmlns:xlink="http\:\/\/www\.w3\.org\/1999\/xlink"/)){
                source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
            }

            source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

            const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
            
            const link = document.createElement('a');
            link.download = `${fileName}.svg`;
            link.href = url;
            link.click();
        }
    }
};

const DownloadMenu = ({ chartRef, fileName, isCanvas, btnStyle }) => {
    const handleSave = () => {
        performDownload(chartRef, fileName, isCanvas);
    };

    return (
        <button onClick={handleSave} style={btnStyle}>
            {isCanvas ? 'Download PNG (Map)' : 'Download SVG (Vector)'}
        </button>
    );
};


const DataVisualization = ({ tableData, isDarkMode }) => {
  const networkRef = useRef(null);
  const barChartRef = useRef(null);
  const pieChartRef = useRef(null);
  const lineChartRef = useRef(null);
  const visNetworkInstance = useRef(null);

  const [selectedPaper, setSelectedPaper] = useState(tableData.length > 0 ? tableData[0]['Title/PMID'] : null);
  const [mapFilters, setMapFilters] = useState({ high: true, medium: true, low: true, lowest: true });
  const [similarProjectsList, setSimilarProjectsList] = useState([]);
  const [currentMapData, setCurrentMapData] = useState({ nodes: [], edges: [] });
  const relevantColumns = Object.keys(tableData[0] || {}).slice(23).filter(col => col !== 'Vector');

  const statistics = useMemo(() => {
    if (!tableData.length) return {};
    const stats = {};
    relevantColumns.forEach((column) => {
      const { sum, count } = tableData.reduce(
        (acc, row) => {
          const text = new DOMParser().parseFromString(row[column], 'text/html').body.textContent.trim();
          const value = isNaN(text) ? 0 : Number(text);
          acc.sum += value;
          acc.count += 1;
          return acc;
        },
        { sum: 0, count: 0 }
      );
      stats[column] = { max: sum, avg: sum / count, count };
    });
    return stats;
  }, [tableData, relevantColumns]);

  const cosineSimilarity = (vecA, vecB) => {
      let dotProduct = 0, normA = 0, normB = 0;
      for (let i = 0; i < vecA.length; i++) {
          dotProduct += vecA[i] * vecB[i];
          normA += vecA[i] * vecA[i];
          normB += vecB[i] * vecB[i];
      }
      return (normA === 0 || normB === 0) ? 0 : dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  };
  
  const calculateSimilarity = (papers, selectedIndex) => {
      if (!papers || !Array.isArray(papers) || selectedIndex < 0 || selectedIndex >= papers.length) return [];
      const vectors = papers.map(paper => {
          try { return JSON.parse(paper.Vector || "[]"); } 
          catch (e) { return []; }
      });
      const selectedVector = vectors[selectedIndex];
      if (!selectedVector || selectedVector.length === 0) return papers.map(() => 0);

      return vectors.map(vec => {
          if (!vec || vec.length === 0) return 0;
          return cosineSimilarity(selectedVector, vec);
      });
  };

  function extractPMID(paper) {
    const htmlContent = String(paper["Title/PMID"] || "");
    return new DOMParser().parseFromString(htmlContent, "text/html").body.textContent.trim() || "No PMID";
  }
  
  function extractGSE(paper) {
    const htmlContent = String(paper["GSE"] || "");
    return new DOMParser().parseFromString(htmlContent, "text/html").body.textContent.trim() || "No GSE";
  }
  const cleanHTML = (htmlString) => {
    const doc = new DOMParser().parseFromString(htmlString, 'text/html');
    doc.querySelectorAll('button, script, style').forEach(el => el.remove());
    return doc.body.textContent.trim();
  };
  // --- FUNZIONE PER SCARICARE LA LISTA IN CSV ---
  const downloadSimilarProjectsCSV = () => {
      if (similarProjectsList.length === 0) {
          alert('No projects to download. Please adjust your filters or select a different paper.');
          return;
      }
  
      
      // Creazione degli Header della tabella
      const headers = ['GSE', 'PMID', 'Match Score', 'GSE URL', 'BioProject URL'];
      const csvRows = [headers.join(',')];
      
      // Riempimento dei dati
      similarProjectsList.forEach(proj => {
          const row = [
              `"${proj.gse}"`,
              `"${proj.pmid}"`,
              `"${proj.match}"`,
              `"${proj.gseUrl || 'N/A'}"`,
              `"${proj.bpUrl || 'N/A'}"`
          ];
          csvRows.push(row.join(','));
      });
      
      // Creazione e download del file
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      
      // Nome del file dinamico in base al paper selezionato
      const safeName = selectedPaper ? selectedPaper.replace(/[^a-z0-9]/gi, '_').substring(0, 30) : 'Map';
      link.download = `Similar_Projects_${safeName}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
  };
  // --- FUNZIONE PER SCARICARE LA MAPPA INTERATTIVA (HTML) ---
  const downloadInteractiveHTML = () => {
      if (currentMapData.nodes.length === 0) {
          alert('Map is not ready yet!');
          return;
      }

      // Costruiamo un'intera pagina web all'interno di una stringa
      const htmlContent = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <title>FGTD - Interactive Similarity Map</title>
              <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
              <style>
                  body { margin: 0; padding: 0; background-color: ${isDarkMode ? '#222' : '#fff'}; font-family: sans-serif; color: ${isDarkMode ? '#fff' : '#000'}; }
                  #mynetwork { width: 100vw; height: 100vh; }
                  .header { position: absolute; top: 15px; left: 15px; z-index: 10; background: ${isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)'}; padding: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.2); border: 1px solid #8a2be2; }
                  h3 { margin: 0 0 5px 0; color: #8a2be2; }
                  p { margin: 0; font-size: 13px; }
              </style>
          </head>
          <body>
              <div class="header">
                  <h3>FGTD Similarity Map</h3>
                  <p>Interactive Offline View. Drag nodes to explore!</p>
              </div>
              <div id="mynetwork"></div>
              
              <script type="text/javascript">
                  // Inseriamo i dati esatti dell'utente nel file
                  var nodesData = ${JSON.stringify(currentMapData.nodes)};
                  var edgesData = ${JSON.stringify(currentMapData.edges)};
                  
                  var nodes = new vis.DataSet(nodesData);
                  var edges = new vis.DataSet(edgesData);
                  
                  var container = document.getElementById('mynetwork');
                  var data = { nodes: nodes, edges: edges };
                  var options = {
                      nodes: { shape: 'dot', font: { size: 14, color: '${isDarkMode ? '#fff' : '#000'}' } },
                      edges: { smooth: { type: 'continuous' } },
                      layout: { improvedLayout: true },
                      physics: { 
                          enabled: true, 
                          stabilization: { iterations: 200 },
                          barnesHut: { gravitationalConstant: -3000, springLength: 200 }
                      }
                  };
                  var network = new vis.Network(container, data, options);
              </script>
          </body>
          </html>
      `;

      // Creazione del file e Download
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const safeName = selectedPaper ? selectedPaper.replace(/[^a-z0-9]/gi, '_').substring(0, 30) : 'Map';
      link.download = `Interactive_Map_${safeName}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
  };
  const DownloadMenu = ({ chartRef, fileName, isCanvas, btnStyle, networkInstance }) => {
    const handleSave = () => {
        performDownload(chartRef, fileName, isCanvas, networkInstance);
    };

    return (
        <button onClick={handleSave} style={btnStyle}>
            {isCanvas ? 'Download PNG (Map)' : 'Download SVG (Vector)'}
        </button>
    );
};

useEffect(() => {
    if (!networkRef.current || !tableData.length) return; 
    
    let selectedIndex = -1;
    if (selectedPaper) { 
        selectedIndex = tableData.findIndex(paper => paper['Title/PMID'] === selectedPaper); 
    } else if (tableData.length > 0) { 
        selectedIndex = 0; 
    }

    if (selectedIndex === -1) return;
    
    const rawScores = calculateSimilarity(tableData, selectedIndex);
    const finalScores = rawScores.map(s => s >= 0.99 ? 1.0 : s);

    const formatNodeTitle = (paper, relevantColumns, score) => {
      const pmid = extractPMID(paper);
      const gse = extractGSE(paper);
      const keywords = relevantColumns.filter(key => parseInt(paper[key]) === 1).join(', ');
      return `PMID: ${pmid}\nGSE: ${gse}\nSemantic Match: ${(score * 100).toFixed(1)}%\nKeywords: ${keywords}`;
    };

    const visibleNodes = [];
    const tempEdges = [];
    const projectsList = []; 

    tableData.forEach((paper, index) => {
        const score = finalScores[index] || 0;
        const isMain = (index === selectedIndex);

        let bgColor = '#1f77b4'; let category = 'lowest';
        if (score >= 0.85) { bgColor = '#808080'; category = 'high'; }
        else if (score >= 0.65) { bgColor = '#FFD700'; category = 'medium'; }
        else if (score >= 0.45) { bgColor = '#2ca02c'; category = 'low'; }

        if (!isMain && !mapFilters[category]) return;

        visibleNodes.push({
            id: index,
            label: isMain ? `MAIN` : `${index + 1}`,
            title: formatNodeTitle(paper, relevantColumns, isMain ? 1.0 : score),
            color: { background: isMain ? '#ff4136' : bgColor, border: isMain ? '#ff1100' : '#2B7CE9' },
            x: isMain ? 0 : Math.cos((index / tableData.length) * 2 * Math.PI) * (score > 0.65 ? 150 : (score > 0.45 ? 250 : 400)),
            y: isMain ? 0 : Math.sin((index / tableData.length) * 2 * Math.PI) * (score > 0.65 ? 150 : (score > 0.45 ? 250 : 400)),
            size: isMain ? 30 : 15 + (score * 15)
        });

        if (!isMain && score >= 0.40) {
            tempEdges.push({
                id: index, from: selectedIndex, to: index, value: score,
                color: score >= 0.85 ? '#808080' : (score >= 0.65 ? '#FFD700' : '#2ca02c'),
                width: 1 + (score * 4)
            });
            
            const gseText = extractGSE(paper);
            const gseMatch = gseText.match(/GSE\d+/i); // Trova il codice esatto (es. GSE12345)
            const gseUrl = gseMatch ? `https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${gseMatch[0]}` : null;

            let bpUrl = null;
            const bpContent = String(paper['BioProject link'] || "");
            const bpParsedDoc = new DOMParser().parseFromString(bpContent, "text/html");
            const bpLinkTag = bpParsedDoc.querySelector('a');
            if (bpLinkTag && bpLinkTag.href) {
                bpUrl = bpLinkTag.href;
            } else {
                const bpText = bpParsedDoc.body.textContent.trim();
                if (bpText.startsWith('http')) bpUrl = bpText;
            }

            projectsList.push({
                pmid: extractPMID(paper),
                gse: gseText,
                gseUrl: gseUrl,
                bpUrl: bpUrl,
                match: (score * 100).toFixed(1) + '%',
                color: bgColor
            });
        }
    });

    const nodes = new DataSet(visibleNodes);
    const edges = tempEdges;
    setCurrentMapData({ nodes: visibleNodes, edges: tempEdges });
    setSimilarProjectsList(projectsList.sort((a, b) => parseFloat(b.match) - parseFloat(a.match)));
    
    if(visNetworkInstance.current) {
        visNetworkInstance.current.destroy();
    }

    visNetworkInstance.current = new Network(networkRef.current, { nodes, edges }, { 
        nodes: { shape: 'dot', font: { size: 14, color: isDarkMode ? '#fff' : '#000' } }, 
        edges: { smooth: { type: 'continuous' } }, 
        layout: { improvedLayout: true }, 
        physics: { 
            enabled: true, 
            stabilization: { iterations: 200 },
            barnesHut: { gravitationalConstant: -3000, springLength: 200 }
        } 
    }); 
  }, [tableData, selectedPaper, isDarkMode, mapFilters]);

  const COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
  const chartData = Object.entries(statistics).map(([key, value]) => ({ name: key, max: value.max, avg: value.avg }));
  const filteredPieData = Object.entries(statistics).map(([name, value]) => ({ name, value: value.max })).filter(({ value }) => value !== 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: isDarkMode ? '#333' : 'white', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', color: isDarkMode ? '#fff' : '#000' }}>
          <p style={{ fontWeight: 500 }}>{payload[0].name}</p>
          <p>Count: {payload[0].value.toFixed(2)}</p>
        </div>
      );
    }
    return null;
  };

  const btnStyle = { backgroundColor: '#4caf50', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' };
  const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: isDarkMode ? '#2365a9' : '#2365a9', color: isDarkMode ? '#000000' : '#ffffff', padding: '1.5rem' }}>
      
      <div style={{ padding: '1.5rem', border: `1px solid ${isDarkMode ? '#333' : '#e5e7eb'}`, borderRadius: '0.5rem', backgroundColor: isDarkMode ? '#000' : '#fff' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '600', color: isDarkMode ? '#fff' : '#4a5568', marginBottom: '16px' }}>Statistical Analysis</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {Object.entries(statistics).map(([column, stats]) => (
            <div key={column} style={{ padding: '1rem', border: `1px solid ${isDarkMode ? '#333' : '#e5e7eb'}`, borderRadius: '0.375rem', minWidth: '200px', backgroundColor: isDarkMode ? '#333' : '#fff', color: isDarkMode ? '#fff' : '#000' }}>
              <h3 style={{ fontWeight: 500 }}>{column}</h3>
              <p>Max: {stats.max.toFixed(2)}</p>
              <p>Avg: {stats.avg.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '1.5rem', border: `1px solid ${isDarkMode ? '#333' : '#e5e7eb'}`, borderRadius: '0.5rem', backgroundColor: isDarkMode ? '#000' : '#fff' }}>
        <div style={headerStyle}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: isDarkMode ? '#fff' : '#000' }}>Distribution Analysis</h2>
            <DownloadMenu chartRef={barChartRef} fileName="Distribution_Analysis" btnStyle={btnStyle} isDarkMode={isDarkMode} />
        </div>
        <div style={{ height: '400px' }} ref={barChartRef}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" stroke={isDarkMode ? '#fff' : '#000'} />
              <YAxis stroke={isDarkMode ? '#fff' : '#000'} />
              <Tooltip /> <Legend />
              <Bar dataKey="max" fill="#8884d8" name="Max (Total)" />
              <Bar dataKey="avg" fill="#82ca9d" name="Average" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{ padding: '1.5rem', border: `1px solid ${isDarkMode ? '#333' : '#e5e7eb'}`, borderRadius: '0.5rem', backgroundColor: isDarkMode ? '#333' : 'white' }}>
          
          <div style={headerStyle}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0, color: isDarkMode ? '#ffffff' : '#000000' }}>Similarity Map</h2>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                  {/* NUOVO BOTTONE HTML INTERATTIVO */}
                  <button 
                      onClick={downloadInteractiveHTML}
                      style={{ padding: '5px 10px', backgroundColor: '#8a2be2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                      title="Download interactive map to explore offline"
                  >
                      Download HTML Map
                  </button>

                  {/* BOTTONE PNG CLASSICO */}
                  <DownloadMenu 
                      chartRef={networkRef} 
                      fileName="Similarity_Map" 
                      isCanvas={true} 
                      btnStyle={{ backgroundColor: isDarkMode ? '#1e90ff' : '#0066cc', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }} 
                      networkInstance={visNetworkInstance} 
                  />
              </div>
          </div>
            
          
          
          <div style={{ marginBottom: '1rem', marginTop: '1rem' }}>
              <label htmlFor="paper-select" style={{ marginRight: '0.5rem', color: isDarkMode ? '#ffffff' : '#000000' }}>Select a paper:</label>
              <select
                  id="paper-select"
                  value={selectedPaper || ''}
                  onChange={(e) => setSelectedPaper(e.target.value)}
                  style={{ 
                      padding: '0.5rem', color: isDarkMode ? '#ffffff' : '#000000', backgroundColor: isDarkMode ? '#222222' : '#ffffff', 
                      borderRadius: '4px', position:'relative', maxWidth:'90%', border: `1px solid ${isDarkMode ? '#ffffff' : '#000000'}`
                  }}
              >
                  <option value="">-- Select --</option>
                  {tableData.map((paper, index) => (
                      <option key={index} value={paper['Title/PMID']} style={{backgroundColor:index % 2 === 0 ? '#f0f0f0' : '#e0e0e0'}}>
                          {index + 1} - {extractPMID(paper).slice(0, 150)}{extractPMID(paper).length > 150 ? '...' : ''}
                      </option>
                  ))}
              </select>
          </div>

          <div style={{ height: '600px' }} ref={networkRef} />

          <div style={{ marginTop: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1', minWidth: '300px', padding: '15px', backgroundColor: isDarkMode ? '#222' : '#f9f9f9', border: `1px solid ${isDarkMode ? '#444' : '#ccc'}`, borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 15px 0', color: isDarkMode ? '#fff' : '#000' }}>Filter Network Nodes</h4>
                  <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={mapFilters.high} onChange={(e) => setMapFilters(prev => ({...prev, high: e.target.checked}))} /> 
                      <span style={{ marginLeft: '8px', padding: '2px 8px', backgroundColor: '#808080', color: '#fff', borderRadius: '4px' }}>Grey (High Match or same paper with different GSE&gt; 85%)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={mapFilters.medium} onChange={(e) => setMapFilters(prev => ({...prev, medium: e.target.checked}))} /> 
                      <span style={{ marginLeft: '8px', padding: '2px 8px', backgroundColor: '#FFD700', color: '#000', borderRadius: '4px' }}>Gold (Medium Match &gt; 65%)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={mapFilters.low} onChange={(e) => setMapFilters(prev => ({...prev, low: e.target.checked}))} /> 
                      <span style={{ marginLeft: '8px', padding: '2px 8px', backgroundColor: '#2ca02c', color: '#fff', borderRadius: '4px' }}>Green (Low Match &gt; 45%)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={mapFilters.lowest} onChange={(e) => setMapFilters(prev => ({...prev, lowest: e.target.checked}))} /> 
                      <span style={{ marginLeft: '8px', padding: '2px 8px', backgroundColor: '#1f77b4', color: '#fff', borderRadius: '4px' }}>Blue (Lowest Match &lt; 45%)</span>
                  </label>
              </div>
              <div style={{ flex: '2', minWidth: '300px', padding: '15px', backgroundColor: isDarkMode ? '#222' : '#f9f9f9', border: `1px solid ${isDarkMode ? '#444' : '#ccc'}`, borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                      <h4 style={{ margin: 0, color: isDarkMode ? '#fff' : '#000' }}>Similar NCBI Project IDs</h4>
                      
                      {/* Contenitore per i due bottoni */}
                      <div style={{ display: 'flex', gap: '10px' }}>
                          <button 
                              onClick={() => {
                                  const textList = similarProjectsList.map(p => `${p.gse} | ${p.pmid} | BioProject: ${p.bpUrl || 'N/A'} (Match: ${p.match})`).join('\n');
                                  navigator.clipboard.writeText(textList);
                                  alert('List copied to clipboard!');
                              }}
                              style={{ padding: '5px 10px', backgroundColor: isDarkMode ? '#1e90ff' : '#0066cc', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                          >
                              Copy List
                          </button>
                          
                          {/* NUOVO BOTTONE DOWNLOAD TABELLA */}
                          <button 
                              onClick={downloadSimilarProjectsCSV}
                              style={{ padding: '5px 10px', backgroundColor: isDarkMode ? '#228b22' : '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}
                              title="Download list as CSV table"
                          >
                              ↓ Download Table
                          </button>
                      </div>
                  </div>
                  
                  <div style={{ maxHeight: '120px', overflowY: 'auto', border: `1px solid ${isDarkMode ? '#555' : '#ddd'}`, padding: '10px', borderRadius: '4px', backgroundColor: isDarkMode ? '#111' : '#fff' }}>
                      {similarProjectsList.length > 0 ? similarProjectsList.map((proj, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${isDarkMode ? '#333' : '#eee'}` }}>
                              
                              <span style={{ fontSize: '13px', color: isDarkMode ? '#fff' : '#000', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  
                                  {proj.gseUrl ? (
                                      <a href={proj.gseUrl} target="_blank" rel="noopener noreferrer" style={{ color: isDarkMode ? '#1e90ff' : '#0066cc', fontWeight: 'bold', textDecoration: 'none' }} onMouseEnter={(e) => e.target.style.textDecoration = 'underline'} onMouseLeave={(e) => e.target.style.textDecoration = 'none'}>
                                          {proj.gse}
                                      </a>
                                  ) : (
                                      <strong>{proj.gse}</strong>
                                  )}
                                  
                                  <span style={{ color: isDarkMode ? '#aaa' : '#666' }}>|</span> 
                                  <span>{proj.pmid}</span>
                                  
                                  {proj.bpUrl && proj.bpUrl !== "Not found" && (
                                      <>
                                          <span style={{ color: isDarkMode ? '#aaa' : '#666' }}>|</span>
                                          <a href={proj.bpUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#fff', backgroundColor: '#e85d04', padding: '2px 6px', borderRadius: '4px', textDecoration: 'none', fontWeight: 'bold', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                                              BioProject ↗
                                          </a>
                                      </>
                                  )}
                              </span>

                              <span style={{ fontSize: '12px', fontWeight: 'bold', color: proj.color }}>{proj.match}</span>
                          </div>
                      )) : (
                          <span style={{ fontSize: '13px', fontStyle: 'italic', color: '#888' }}>No connected projects visible. Try adjusting the filters.</span>
                      )}
                  </div>
              </div>
          </div>
      </div>

      <div style={{ padding: '1.5rem', border: `1px solid ${isDarkMode ? '#333' : '#e5e7eb'}`, borderRadius: '0.5rem', backgroundColor: isDarkMode ? '#333' : 'white' }}>
        <div style={headerStyle}>
             <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: isDarkMode ? '#fff' : '#000' }}>Keyword Distribution</h2>
             <DownloadMenu chartRef={pieChartRef} fileName="Keyword_Distribution" btnStyle={btnStyle} isDarkMode={isDarkMode} />
        </div>
        <div style={{ height: '400px' }} ref={pieChartRef}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={filteredPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label={({ name }) => name} labelLine={true}>
                {filteredPieData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} /> ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} /> <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ padding: '1.5rem', border: `1px solid ${isDarkMode ? '#333' : '#e5e7eb'}`, borderRadius: '0.5rem', backgroundColor: isDarkMode ? '#333' : 'white' }}>
          <div style={headerStyle}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: isDarkMode ? '#fff' : '#000' }}>Keyword Trend</h2>
            <DownloadMenu chartRef={lineChartRef} fileName="Keyword_Trend" btnStyle={btnStyle} isDarkMode={isDarkMode} />
          </div>
          <div style={{ height: '400px' }} ref={lineChartRef}>
              <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={(() => {
                        const sortedData = tableData.filter(row => row.Date && row.Date.match(/\d{2}\/\d{2}\/\d{4}/)).sort((a, b) => new Date(a.Date.split('/').reverse().join('-')) - new Date(b.Date.split('/').reverse().join('-')));
                        let cumulativeCounts = {}; 
                        return sortedData.map((row, index) => {
                            const currentRow = { period: row.Date };
                            Object.keys(row).slice(23).forEach(keyword => { 
                                    const k = keyword.trim().toLowerCase();
                                    const v = parseInt(row[keyword]) || 0;
                                    cumulativeCounts[k] = (index === 0 ? v : (cumulativeCounts[k] || 0) + v);
                                    currentRow[k] = cumulativeCounts[k]; 
                                });
                            return currentRow;
                        });
                    })()} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
                      <XAxis dataKey="period" stroke={isDarkMode ? '#fff' : '#000'} angle={-45} textAnchor="end" height={70} />
                      <YAxis stroke={isDarkMode ? '#fff' : '#000'} />
                      <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#333' : 'white', color: isDarkMode ? '#fff' : '#000' }} /> <Legend />
                      {tableData[0] && Object.keys(tableData[0]).slice(23).map((keyword, index) => (
                            <Line key={keyword} type="monotone" dataKey={keyword.trim().toLowerCase()} stroke={COLORS[index % COLORS.length]} name={keyword} dot={false} strokeWidth={2} />
                          ))}
                  </LineChart>
              </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
};


function Analysis() {
  const location = useLocation();
  const getColumnLetter = (index) => {
    let letter = '';
    let temp = index;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };
  const navigate = useNavigate();
  const { tableHTML, rawData, isDarkMode } = location.state || {}; 
  const [showRelInfo, setShowRelInfo] = useState(false);
  
  const parseTableHTML = (html) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const rows = Array.from(doc.querySelectorAll('tbody tr'));
    const headers = Array.from(doc.querySelectorAll('thead th')).map((th) => th.textContent.trim());
    return rows.map((row) => {
      const cells = Array.from(row.cells);
      const rowData = {};
      cells.forEach((cell, i) => { rowData[headers[i]] = cell.innerHTML.trim(); });
      return rowData;
    });
  };
  const parsedHTMLData = tableHTML ? parseTableHTML(tableHTML) : [];
  const initialTableData = parsedHTMLData.map((row, index) => ({
      ...row,
      Vector: (rawData && rawData[index] && rawData[index].Vector) ? rawData[index].Vector : "[]"
  }));  
  const [tableData, setTableData] = useState(initialTableData);
  const [filters, setFilters] = useState({});
  const [openFilter, setOpenFilter] = useState(null);
  const [expandedSummaries, setExpandedSummaries] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [filterSearchTerm, setFilterSearchTerm] = useState('');
  const [showStatistics, setShowStatistics] = useState(false);
  const cleanRelevance = (content) => {
    const cleanContent = content.replace(/<[^>]*>?/gm, ''); 
    const match = cleanContent.match(/^[\d\.]+/); 
    return match ? match[0] : cleanContent.substring(0, 6).trim(); 
  };

  const handleSort = (columnKey) => {
    let direction = 'ascending';
    if (sortConfig.key === columnKey && sortConfig.direction === 'ascending') direction = 'descending';
    setSortConfig({ key: columnKey, direction });
  };

  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return tableData;
    return [...tableData].sort((a, b) => {
      let aValue = new DOMParser().parseFromString(a[sortConfig.key], 'text/html').body.textContent.trim();
      let bValue = new DOMParser().parseFromString(b[sortConfig.key], 'text/html').body.textContent.trim();
      if(sortConfig.key.includes('Relevance')){ aValue = cleanRelevance(a[sortConfig.key]); bValue = cleanRelevance(b[sortConfig.key]); }
      if (!isNaN(aValue) && !isNaN(bValue)) return sortConfig.direction === 'ascending' ? Number(aValue) - Number(bValue) : Number(bValue) - Number(aValue);
      return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    });
  }, [tableData, sortConfig]);

  const getCleanValuesForColumn = (columnName) => {
    const uniqueValues = new Set();
    tableData.forEach((row) => {
      if(columnName.includes('Relevance')) {
         uniqueValues.add(cleanRelevance(row[columnName]));
      } else {
         const doc = new DOMParser().parseFromString(row[columnName], 'text/html');
         uniqueValues.add(doc.body.textContent.trim());
      }
    });
    return Array.from(uniqueValues).sort();
  };
  
  const getFilteredUniqueValues = (columnName, searchTerm) => {
    const uniqueValues = getCleanValuesForColumn(columnName);
    if (!searchTerm) return uniqueValues;
    return uniqueValues.filter((value) => value.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  const updateFilter = (columnName, value, checked) => {
    setFilters((prev) => checked ? { ...prev, [columnName]: [...(prev[columnName]||[]), value] } : { ...prev, [columnName]: (prev[columnName]||[]).filter((v) => v !== value) });
  };

  const applyFilters = () => {
    const parser = new DOMParser();
    const filteredData = initialTableData.filter((row) =>
      Object.keys(filters).every((col) => {
        const filterValues = filters[col];
        if (!filterValues || !filterValues.length) return true;
        let cellText = parser.parseFromString(row[col], 'text/html').body.textContent.trim();
        if (col.includes('Relevance')) cellText = cleanRelevance(row[col]);
        return filterValues.includes(cellText);
      })
    );
    setTableData(filteredData);
    setOpenFilter(null);
  };

  const resetFilters = () => { setFilters({}); setTableData(initialTableData); };
  const toggleSummaryExpand = (rowIndex) => { setExpandedSummaries((prev) => { const newSet = new Set(prev); if (newSet.has(rowIndex)) newSet.delete(rowIndex); else newSet.add(rowIndex); return newSet; }); };
  const toggleAllSummaries = () => { if (expandedSummaries.size === sortedData.length) setExpandedSummaries(new Set()); else setExpandedSummaries(new Set(sortedData.map((_, i) => i))); };

  const exportToExcel = () => {
    const wsData = [Object.keys(tableData[0] || {})];
    tableData.forEach((row) => {
      const rowData = [];
      wsData[0].forEach((header) => {
        if (header === 'Vector') return;
        if(header.includes('Relevance')) rowData.push(cleanRelevance(row[header]));
        else {
            const doc = new DOMParser().parseFromString(row[header], 'text/html');
            const links = doc.querySelectorAll('a');
            if (links.length > 0) rowData.push({ f: `HYPERLINK("${links[0].href}", "${links[0].textContent}")`, s: { font: { color: { rgb: ' #0645AD' }, underline: true } } });
            else rowData.push(doc.body.textContent.trim());
        }
      });
      wsData.push(rowData);
    });
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = wsData[0].map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filtered Data');
    XLSX.writeFile(wb, 'filtered_table.xlsx');
  };

  const exportToCSV = () => {
    const headers = Object.keys(tableData[0] || {}).filter(h => h !== 'Vector');
    const csvContent = [headers.join(','), ...tableData.map((row) => headers.map((header) => {
            if(header.includes('Relevance')) return `"${cleanRelevance(row[header])}"`;
            const doc = new DOMParser().parseFromString(row[header], 'text/html');
            return `"${doc.body.textContent.trim().replace(/"/g, '""')}"`; 
          }).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'filtered_table.csv'; link.click(); URL.revokeObjectURL(link.href);
  };

  if (!tableHTML) return <div>No table available.</div>;

  return (
    <div style={{ backgroundColor: isDarkMode ? '#121212' : '#ffffff', color: isDarkMode ? '#ffffff' : '#000000', padding: '20px', minHeight: '100vh' }}>
      {showRelInfo && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: isDarkMode ? '#333' : '#fff', color: isDarkMode ? '#fff' : '#000', padding: '20px', border: '2px solid #3182ce', borderRadius: '8px', zIndex: 9999, maxWidth: '600px', width: '90%', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
            <h3 style={{marginBottom: '10px', fontSize: '1.2rem', fontWeight: 'bold'}}>Relevance Score Calculation</h3>
            <div style={{backgroundColor: isDarkMode ? '#111' : '#f4f4f4', padding: '10px', borderRadius: '4px', marginBottom:'10px', fontSize:'0.9rem'}}>
                <p><strong>calcT:</strong> Weigh Semantic (50%), Keyword (30%) and MeSH (20%).</p>
                <p><strong>calcB:</strong> Exact average between Recency (50%) and Citations (50%).</p>
            </div>
            <div style={{backgroundColor: isDarkMode ? '#222' : '#e0e0e0', padding: '10px', borderRadius: '4px', fontSize:'1rem', fontWeight: 'bold', textAlign: 'center', fontFamily: 'monospace'}}>Relevance = 0.75 * T + 0.25 * B</div>
            <div style={{textAlign:'right', marginTop:'15px'}}><button onClick={() => setShowRelInfo(false)} style={{backgroundColor: '#3182ce', color:'white', border:'none', padding:'5px 15px', borderRadius:'4px', cursor:'pointer'}}>Close</button></div>
        </div>
      )}
      {showRelInfo && <div onClick={() => setShowRelInfo(false)} style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9998}}></div>}

      <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#4a5568', marginBottom: '16px' }}> <span style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>Analysis</span>{' '}<span style={{ color: '#3182ce' }}>Tools</span> </h1>
      <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ position: 'fixed', bottom: '20px', right: '20px', width: '50px', height: '50px', borderRadius: '50%', backgroundColor: '#3182ce', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}><span style={{ color: isDarkMode ? '#000000' : '#ffffff', fontSize: '24px' }}>↑</span></button>
      
      <div style={{ overflowX: 'auto', overflowY: 'scroll', maxHeight: '80vh', marginTop: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', height:'90%' }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 15, backgroundColor: isDarkMode ? '#333' : '#f5f5f5' }}>
            <tr>
              <th rowSpan="3" style={{ position: 'sticky', left: 0, top: 0, zIndex: 20, width: '40px', textAlign: 'center', background: isDarkMode ? '#1e90ff' : '#0066cc', border: '1px solid #ccc', color: '#ffffff', fontSize: '14px' }}> </th>
              
              {/* Generazione delle lettere A, B, C... */}
              {Object.keys(initialTableData[0] || {}).map((columnName, colIndex) => {
                if (columnName === 'Vector') return null;
                return (
                  <th key={`letter-${colIndex}`} style={{ textAlign: 'center', background: isDarkMode ? '#1e90ff' : '#0066cc', color: '#ffffff', border: '1px solid #ccc', padding: '6px', fontSize: '18px', fontWeight: 'bold' }}>
                    {getColumnLetter(colIndex)}
                  </th>
                );
              })}
            </tr>

            <tr>
              <th colSpan="3" style={{ textAlign: 'center', background: isDarkMode ? '#333' : '#f5f5f5', border: '1px solid #ccc', paddingBottom: '10px' }}>Article Info</th>
              <th colSpan="6" style={{ textAlign: 'center', background: isDarkMode ? '#333' : '#f5f5f5', border: '1px solid #ccc', paddingBottom: '10px' }}>Procedure Info & Summary</th>
              <th colSpan="7" style={{ textAlign: 'center', background: isDarkMode ? '#333' : '#f5f5f5', border: '1px solid #ccc', paddingBottom: '10px' }}>Additional Info</th>
              <th colSpan="6" style={{ textAlign: 'center', background: isDarkMode ? '#333' : '#f5f5f5', border: '1px solid #ccc', paddingBottom: '20px' }}>First 3 Samples and Info</th>
              <th colSpan={Object.keys(initialTableData[0] || {}).length - 22} style={{ textAlign: 'center', background: isDarkMode ? '#333' : '#f5f5f5', border: '1px solid #ccc', paddingBottom: '10px' }}>MeSH Term in Articles and Keywords</th>
            </tr>
            
            <tr>
              {Object.keys(initialTableData[0] || {}).map((columnName) => {
                if (columnName === 'Vector') return null; 

                return (
                  <th key={columnName} style={{ padding: '10px', cursor: 'default', border: '1px solid black', background:isDarkMode ? '#333' : '#f5f5f5' }}>
                    <div style={{display:'flex', flexDirection: 'column', alignItems:'center', justifyContent:'center', width:'100%'}}>
                      <div style={{display:'flex', alignItems:'center', gap: '6px'}}>
                        <span>{columnName}</span>
                        
                        {columnName.includes('Relevance') && (
                          <div onClick={(e) => { e.stopPropagation(); setShowRelInfo(true); }} style={{ display:'flex', alignItems:'center', justifyContent:'center', borderRadius: '50%', border: '1px solid #3182ce', background: '#3182ce', color: 'white', width: '18px', height: '18px', flexShrink: 0, fontSize: '11px', cursor: 'pointer', fontWeight:'bold', zIndex: 5 }}>?</div>
                        )}
                        
                        <button onClick={(e) => { e.stopPropagation(); setOpenFilter((prevOpen) => (prevOpen === columnName ? null : columnName)); setFilterSearchTerm(''); }} title="Filter values" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '0' }}>
                          ▼
                        </button>
                      </div>

                      <button 
                        onClick={(e) => { e.stopPropagation(); handleSort(columnName); }} 
                        title="Order by this column"
                        style={{ 
                          backgroundColor: isDarkMode ? '#1e90ff' : '#0066cc',
                          color: '#fff',
                          border: 'none', 
                          borderRadius: '4px',
                          padding: '4px 8px',
                          marginTop: '8px',
                          cursor: 'pointer', 
                          fontSize: '11px', 
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                      >
                        Order {sortConfig.key === columnName ? (sortConfig.direction === 'ascending' ? '↑' : '↓') : '↕'}
                      </button>
                    </div>
                  {columnName === 'Summary' && ( <button onClick={(e) => { e.stopPropagation(); toggleAllSummaries(); }} style={{ backgroundColor: '#1e90ff', color: '#ffffff', padding: '5px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px', fontSize: '10px', width: '100%', maxWidth: '100px' }}>{expandedSummaries.size === sortedData.length ? 'Reduce All' : 'Show All'}</button> )}
                  {openFilter === columnName && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, display: 'flex', gap: '10px', zIndex: 10 }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ background: isDarkMode ? '#333' : '#fff', color: isDarkMode ? '#fff' : '#000', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', padding: '10px', border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`, borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
                        <input type="text" placeholder="Search..." value={filterSearchTerm} onChange={(e) => { e.stopPropagation(); setFilterSearchTerm(e.target.value); }} style={{ padding: '5px', marginBottom: '10px', borderRadius: '4px', border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`, background: isDarkMode ? '#444' : '#fff', color: isDarkMode ? '#fff' : '#000' }} />
                        <div style={{ maxHeight: '200px', overflowY: 'scroll', paddingBottom: '10px', borderBottom: `1px solid ${isDarkMode ? '#555' : '#ccc'}` }}>
                          {getFilteredUniqueValues(columnName, filterSearchTerm).map((value) => (
                            <div key={value} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); updateFilter(columnName, value, !(filters[columnName]?.includes(value) || false)); }}>
                              <input type="checkbox" checked={filters[columnName]?.includes(value)} onChange={(e) => { e.stopPropagation(); updateFilter(columnName, value, e.target.checked); }} />
                              <span style={{ marginLeft: '10px' }}>{value}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ padding: '5px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          <button onClick={(e) => { e.stopPropagation(); applyFilters(); }} style={{ backgroundColor: isDarkMode ? '#1e90ff' : '#0066cc', color: '#ffffff', fontSize: '12px', padding: '5px 15px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Apply</button>
                        </div>
                      </div>
                      <div style={{ background: isDarkMode ? '#333' : '#fff', color: isDarkMode ? '#fff' : '#000', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', padding: '10px', border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`, borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                        <span>Order:</span>
                        <button onClick={(e) => { e.stopPropagation(); handleSort(columnName); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '32px', color: isDarkMode ? '#fff' : '#000' }}>{sortConfig.key === columnName && sortConfig.direction === 'ascending' ? '↑' : '↓'}</button>
                          <button onClick={(e) => { e.stopPropagation(); const filteredValues = getFilteredUniqueValues(columnName, filterSearchTerm); const areAllSelected = filteredValues.every((value) => filters[columnName]?.includes(value)); if (areAllSelected) { setFilters((prevFilters) => ({ ...prevFilters, [columnName]: prevFilters[columnName]?.filter((value) => !filteredValues.includes(value)) || [], })); } else { setFilters((prevFilters) => ({ ...prevFilters, [columnName]: [...new Set([...(prevFilters[columnName] || []), ...filteredValues])], })); } }} style={{ backgroundColor: isDarkMode ? '#32cd32' : '#4caf50', color: '#ffffff', padding: '5px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>{filters[columnName]?.length === getFilteredUniqueValues(columnName, filterSearchTerm).length ? 'Deselect All' : 'Select All'}</button>
                      </div>
                    </div>
                  )}
                  </th>
                );
              })} 
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, rowIndex) => (
              <tr key={rowIndex}>
                
                <td style={{ position: 'sticky', left: 0, zIndex: 5, background: isDarkMode ? '#1e90ff' : '#0066cc', border: '1px solid #ccc', textAlign: 'center', fontWeight: 'bold', color: '#ffffff', fontSize: '18px' }}>
                  {rowIndex + 1}
                </td>

                {Object.entries(row).map(([columnName, cellContent], cellIndex) => {
                  if (columnName === 'Vector') return null;
                  if (columnName === 'Summary') {
                    let cleanSummary = cellContent.replace(/<button.*?<\/button>/g, '').trim();
                    if (cleanSummary === '0') {
                      cleanSummary = 'No summary available or Summary related to a SuperSeries'; 
                    }
                    const isExpanded = expandedSummaries.has(rowIndex);
                    return (<td key={cellIndex} style={{ padding: '10px', border: '1px solid #ccc' }}><div><span dangerouslySetInnerHTML={{ __html: isExpanded ? cleanSummary : `${cleanSummary.slice(0, 100)}...` }} />{cleanSummary.length > 100 && (<button onClick={() => toggleSummaryExpand(rowIndex)} style={{ marginLeft: '10px', backgroundColor: isDarkMode ? '#1e90ff' : '#0066cc', color: '#ffffff', padding: '5px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{isExpanded ? 'Show Less' : 'Show More'}</button>)}</div></td>);                  
                  }
                  return <td key={cellIndex} style={{ padding: '10px', border: '1px solid #ccc' }} dangerouslySetInnerHTML={{ __html: cellContent }} />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div style={{ textAlign: 'center', marginTop: '20px', marginBottom : '20px',display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button onClick={() => navigate('/')} style={{ backgroundColor: isDarkMode ? '#1e90ff' : '#0066cc', color: '#ffffff', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>New Analysis</button>
        <button onClick={resetFilters} style={{ backgroundColor: isDarkMode ? '#228b22' : '#4caf50', color: '#ffffff', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Reset Filters</button>
        <button onClick={exportToExcel} style={{ backgroundColor: isDarkMode ? '#ffd700' : '#ffc107', color: '#000000', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Download Filtered Table (Excel)</button>
        <button onClick={exportToCSV} style={{ backgroundColor: isDarkMode ? '#6a5acd' : '#7b68ee', color: '#ffffff', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Download Filtered Table (CSV)</button>
        <button onClick={() => setShowStatistics(!showStatistics)} style={{ backgroundColor: isDarkMode ? '#ff6347' : '#ff7f50', color: '#ffffff', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Statistics & Charts</button>
      </div>
      {showStatistics && <DataVisualization tableData={tableData} />}
    </div>
  );
};

export default Analysis;