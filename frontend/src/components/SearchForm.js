import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; // Hook per la navigazione
import { FaEnvelope, FaSearch, FaKey, FaDna, FaQuestionCircle, FaInfoCircle, FaCheckCircle, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa'; // Icone
import logoInPage from './logo_in_page.png';
import meshData from './mesh.json'; // IMPORTO IL FILE JSON DEI MESH TERMS
// IMPORTO IL FILE JSON DEI GENI
import geneData from './GENEINFO_Mammalia_Homo_Sapiens_genes.json';
const FocusWrapper = ({ fieldId, isFocused, onFocus, onClose, children, description, isDarkMode }) => {
    // Stile per l'overlay (sfondo sfocato)
    const overlayStyle = {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.6)', // Sfondo scuro semitrasparente
        backdropFilter: 'blur(8px)', // EFFETTO BLUR
        zIndex: 9998,
        cursor: 'zoom-out',
        opacity: isFocused ? 1 : 0,
        pointerEvents: isFocused ? 'all' : 'none',
        transition: 'opacity 0.3s ease',
    };

    // Stile per il contenitore quando è in focus (al centro)
    const activeContainerStyle = {
        position: 'fixed',
        top: '40%', // Un po' sopra il centro ottico
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        width: '80%', // Più largo in modalità focus
        maxWidth: '600px',
        transition: 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        backgroundColor: isDarkMode ? '#2b2b2b' : '#fff', // Sfondo solido necessario
        padding: '20px',
        borderRadius: '12px',
    };

    // Stile normale (nel flusso del form)
    const normalContainerStyle = {
        position: 'relative',
        transition: 'all 0.3s ease',
        zIndex: 1,
    };

    return (
        <>
            {/* Overlay Sfondo (Renderizzato solo se questo campo è quello attivo) */}
            {isFocused && <div style={overlayStyle} onClick={(e) => { e.stopPropagation(); onClose(); }} />}

            {/* Placeholder "Fantasma" per non rompere il layout quando l'elemento si sposta */}
            {isFocused && <div style={{ height: '60px', width: '100%' }}></div>}

            <div 
                onClick={(e) => {
                    // Attiva il focus se non è già attivo
                    if (!isFocused) {
                        e.stopPropagation(); // Evita conflitti
                        onFocus();
                    }
                }}
                style={isFocused ? activeContainerStyle : normalContainerStyle}
            >
                {/* Il campo di input vero e proprio */}
                {children}

                {/* Descrizione aggiuntiva visibile SOLO in focus mode */}
                <div style={{
                    maxHeight: isFocused ? '200px' : '0px',
                    opacity: isFocused ? 1 : 0,
                    overflow: 'hidden',
                    transition: 'all 0.5s ease',
                    marginTop: isFocused ? '15px' : '0',
                }}>
                    <div style={{ 
                        borderTop: `1px solid ${isDarkMode ? '#555' : '#eee'}`, 
                        paddingTop: '10px',
                        color: isDarkMode ? '#ddd' : '#555',
                        fontSize: '14px',
                        lineHeight: '1.5',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px'
                    }}>
                        <FaInfoCircle size={20} color={isDarkMode ? '#1e90ff' : '#0066cc'} style={{minWidth: '20px'}}/>
                        <p style={{margin: 0}}>{description}</p>
                    </div>
                    {/* Tasto per chiudere esplicitamente */}
                    <div style={{textAlign: 'right', marginTop: '10px'}}>
                        <button 
                            type="button" // Importante: type button per non inviare il form
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            style={{
                                background: 'transparent',
                                border: '1px solid #888',
                                color: isDarkMode ? '#fff' : '#333',
                                padding: '5px 15px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            Done / Close
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};
const SearchForm = () => {
    
    const [email, setEmail] = useState('');
    const [query, setQuery] = useState('');
    
    // --- STATI PER KEYWORDS (GENI) ---
    const [keywords, setKeywords] = useState('');
    const [geneSuggestions, setGeneSuggestions] = useState([]);
    const [showGeneSuggestions, setShowGeneSuggestions] = useState(false);

    // --- STATI PER MESH TERMS ---
    const [m_s, setMS] = useState('');
    const [suggestions, setSuggestions] = useState([]); // Per MeSH
    const [showSuggestions, setShowSuggestions] = useState(false); // Per MeSH

    const [numPages, setNumPages] = useState('1');
    const [fileType, setFileType] = useState('excel');
    const [mode, setMode] = useState('normal')
    const [error, setError] = useState(null);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [loading, setLoading] = useState(false); // Stato per la barra di progressione
    const [showHelp, setShowHelp] = useState(false); // Stato per la visibilità del messaggio di aiuto
    const [showHelpMode, setShowHelpMode] = useState(false);
    const [generateFile, setGenerateFile] = useState(true); // Default: Yes (True)
    const [Remove, setRemove] = useState(true);
    const [showTooltip, setShowTooltip] = useState(false);
    const navigate = useNavigate();
    const [personalize, setPersonalize] = useState(null);
    const [organism, setOrganism] = useState('');
    const [studyTypes, setStudyTypes] = useState({});
    const [subsetTypes, setSubsetTypes] = useState({});
    const [startDate, setStartDate] = useState({ year: '', month: '', day: '' });
    const [endDate, setEndDate] = useState({ year: '', month: '', day: '' });
    const [suppFiles, setSuppFiles] = useState('');
    const toggleDarkMode = () => setIsDarkMode(!isDarkMode);
    const [checkLoading, setCheckLoading] = useState(false);
    const [checkError, setCheckError] = useState(null);
    const [checkResult, setCheckResult] = useState(null);
    const [dateRange, setDateRange] = useState({ start: [], end: [] });
    const [showPersonalizePrompt, setShowPersonalizePrompt] = useState(false);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [focusedField, setFocusedField] = useState(null); 
    const focusDescriptions = {
        email: "Your email is required only to access PubMed servers. We don't collect or save any data.",
        query: "Type your biological question here (e.g., 'Lung Cancer'). IMPORTANT: Afterwards, click the 'Check Query' button to validate and filter results.",
        keywords: "These are semantic elements searched within the abstract or summary. They help narrow down specific genes,pathways,arguments (e.g., 'TP53', 'aging'). You can choose words that are not suggested in the retractable menu",
        mesh: "MeSH (Medical Subject Headings) are the NLM controlled vocabulary thesaurus used for indexing articles. Use this for broad topic filtering.You can choose words that are not suggested in the retractable menu, but they have to be valid MeSH terms.",
        numPages: "This determines how deep the scraper goes. It represents the number of pages to process relative to the total found in the 'Check Query' result, more pages means longer time.",
        fileType: "Choose the output format. Excel is recommended for better readability of complex datasets.",
        // Aggiungi altri campi se necessario
    };
    const closeFocus = () => setFocusedField(null);
    // --- NUOVO STATO: TRACCIA SE LA QUERY È STATA CONTROLLATA ---
    const [hasCheckedQuery, setHasCheckedQuery] = useState(false); 
    
    // --- NUOVO STATO: PER IL MENÙ DI AVVISO PERSONALIZZATO (Warning) ---
    const [showWarningModal, setShowWarningModal] = useState(false);

    // --- NUOVI STATI PER I MODAL DI CONTROLLO QUERY (Empty & Confirm) ---
    const [showEmptyQueryModal, setShowEmptyQueryModal] = useState(false);
    const [showConfirmCheckModal, setShowConfirmCheckModal] = useState(false);

    const allStudyTypes = [
        "Expression profiling by MPSS", "Expression profiling by RT-PCR", "Expression profiling by SAGE",
        "Expression profiling by SNP array", "Expression profiling by array", "Expression profiling by genome tiling array",
        "Expression profiling by high throughput sequencing", "Genome binding/occupancy profiling by SNP array",
        "Genome binding/occupancy profiling by array", "Genome binding/occupancy profiling by genome tiling array",
        "Genome binding/occupancy profiling by high throughput sequencing", "Genome variation profiling by SNP array",
        "Genome variation profiling by array", "Genome variation profiling by genome tiling array",
        "Genome variation profiling by high throughput sequencing", "Methylation profiling by SNP array",
        "Methylation profiling by array", "Methylation profiling by genome tiling array",
        "Methylation profiling by high throughput sequencing", "Non-coding RNA profiling by array",
        "Non-coding RNA profiling by genome tiling array", "Non-coding RNA profiling by high throughput sequencing",
        "Other", "Protein profiling by Mass Spec", "Protein profiling by protein array",
        "SNP genotyping by SNP array", "Third-party reanalysis"
    ];

    const allSubsetTypes = [
        "dose", "time", "tissue", "strain", "gender", "cell line", "development stage",
        "age", "agent", "cell type", "infection", "isolate", "metabolism", "shock",
        "stress", "specimen", "disease state", "protocol", "growth protocol",
        "genotype/variation", "species", "individual", "other"
    ];
    const allSupplementaryFiles = [
        "CEL", "GPR", "WIG", "BED", "FASTA", "FASTQ", "BAM", "SAM"
    ];
    const [attributeNames, setAttributeNames] = useState({});
    const [customAttribute, setCustomAttribute] = useState('');
    const allAttributeNames = [
        "dose", "time", "tissue", "strain", "gender", "cell line", "development stage",
        "age", "agent", "cell type", "infection", "isolate", "metabolism", "shock",
        "stress", "specimen", "disease state", "protocol", "growth protocol",
        "genotype/variation", "species", "individual", "other"
    ];


    const isValidDate = (year, month, day) => {
        const y = parseInt(year);
        const m = parseInt(month);
        const d = parseInt(day);
        if (isNaN(y) || isNaN(m) || isNaN(d)) return false;
        const date = new Date(y, m - 1, d);
        return (
            date.getFullYear() === y &&
            date.getMonth() === m - 1 &&
            date.getDate() === d
        );
    };

    const validateDateRange = () => {
        const { year: y1, month: m1, day: d1 } = startDate;
        const { year: y2, month: m2, day: d2 } = endDate;

        if (!isValidDate(y1, m1, d1) || !isValidDate(y2, m2, d2)) {
            setError("Please enter valid dates in the format YYYY MM DD.");
            return false;
        }

        const start = new Date(`${y1}-${m1}-${d1}`);
        const end = new Date(`${y2}-${m2}-${d2}`);

        if (start > end) {
            setError("Start date cannot be after end date.");
            return false;
        }

        return true;
    };


    // --- FUNZIONI PER AUTOCOMPLETAMENTO MESH TERMS ---
    const handleMeshChange = (e) => {
        const value = e.target.value;
        setMS(value);

        const terms = value.split(',');
        const currentTerm = terms[terms.length - 1].trim().toLowerCase();

        if (currentTerm.length > 1) {
            const filteredSuggestions = meshData.filter(term =>
                term.toLowerCase().startsWith(currentTerm)
            ).slice(0, 50);

            setSuggestions(filteredSuggestions);
            setShowSuggestions(true);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleSuggestionClick = (term) => {
        const terms = m_s.split(',');
        terms.pop();
        terms.push(term);
        const newValue = terms.join(', ') + ', ';
        setMS(newValue);
        setSuggestions([]);
        setShowSuggestions(false);
    };

    // --- FUNZIONI PER AUTOCOMPLETAMENTO KEYWORDS (GENI) ---
    const handleKeywordsChange = (e) => {
        const value = e.target.value;
        setKeywords(value);

        const terms = value.split(',');
        const currentTerm = terms[terms.length - 1].trim().toLowerCase();

        if (currentTerm.length > 0) {
            const filteredSuggestions = geneData.filter(gene => {
                const geneName = gene.Symbol || gene; 
                return geneName && geneName.toLowerCase().startsWith(currentTerm);
            }).slice(0, 50);

            setGeneSuggestions(filteredSuggestions);
            setShowGeneSuggestions(true);
        } else {
            setGeneSuggestions([]);
            setShowGeneSuggestions(false);
        }
    };

    const handleGeneSuggestionClick = (item) => {
        const term = item.Symbol || item;
        const terms = keywords.split(',');
        terms.pop(); 
        terms.push(term); 
        const newValue = terms.join(', ') + ', ';
        setKeywords(newValue);
        setGeneSuggestions([]);
        setShowGeneSuggestions(false);
    };

    // ------------------------------------------------

    const buildFiltersPayload = () => {
        const filters = {};

        if (organism.trim() !== '') {
            filters.organism = organism.split(',').map(o => o.trim()).filter(Boolean);
        }

        const selectedStudyTypes = Object.keys(studyTypes).filter(k => studyTypes[k]);
        if (selectedStudyTypes.length > 0) {
            filters.study_type = selectedStudyTypes;
        }
        const selectedSubsetTypes = Object.keys(subsetTypes).filter(k => subsetTypes[k]);
        if (selectedSubsetTypes.length > 0) {
            filters.subset_type = selectedSubsetTypes;
        }

        const selectedSuppFiles = suppFiles && typeof suppFiles === 'object'
            ? Object.keys(suppFiles).filter(k => suppFiles[k])
            : [];
        if (selectedSuppFiles.length > 0) {
            filters.supp_file = selectedSuppFiles;
        }

        if (startDate.year && endDate.year) {
            filters.date_range = [
                [parseInt(startDate.year), parseInt(startDate.month), parseInt(startDate.day)],
                [parseInt(endDate.year), parseInt(endDate.month), parseInt(endDate.day)]
            ];
        }
        const selectedAttributeNames = Object.keys(attributeNames).filter(k => attributeNames[k]);
        if (selectedAttributeNames.length > 0) {
            filters.attribute_name = selectedAttributeNames;
        }
        return filters;
    };


    const isValidEmail = (email) => {
        const emailRegex = /^[\w.-]+@[a-zA-Z_]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    };

    const calculateSuggestedPages = (totalPages) => {
        if (totalPages > 400) {
            return Math.max(1, Math.round(totalPages * 0.025)); // minimo 1
        } else if (totalPages > 200) {
            return Math.max(1, Math.round(totalPages * 0.06));
        } else if (totalPages > 100) {
            return Math.max(1, Math.round(totalPages * 0.09));
        } else {
            return Math.max(1, Math.round(totalPages * 0.14));
        }
    };

    // --- FUNZIONE 1: GESTIONE CLICK PULSANTE CHECK QUERY ---
    // Questa funzione apre le finestre modali, non esegue la chiamata API direttamente
    const handleCheckQuery = () => {
        // 1. Controllo se la query è vuota
        if (!query || query.trim() === '') {
            setShowEmptyQueryModal(true); // Apre la modale di errore
            return;
        }

        // 2. Se la query esiste, chiedi conferma con la modale
        setShowConfirmCheckModal(true);
    };

    // --- FUNZIONE 2: ESECUZIONE EFFETTIVA DEL CHECK (Chiamata dal Modal "Yes") ---
    const performCheckQuery = async () => {
        setShowConfirmCheckModal(false); // Chiudi la modale
        setConfirmLoading(true); // Attiva lo spinner

        // Segno che il controllo è stato fatto
        setHasCheckedQuery(true); 

        // Valida le date solo se sono compilate
        if (startDate.year && endDate.year && !validateDateRange()) {
            setConfirmLoading(false); // Ferma spinner se date invalide
            return;
        }

        setCheckLoading(true);
        setCheckError(null);

        const requestBody = {
            query,
            apply_filters: true,
            filters: buildFiltersPayload()
        };

        try {
            const response = await axios.post('http://localhost:5000/api/check_query', requestBody);
            setCheckResult(response.data);

            if (response.data && response.data.total_pages) {
                const suggestedPages = calculateSuggestedPages(response.data.total_pages);
                setNumPages(suggestedPages.toString());
            }
        } catch (err) {
            setCheckError('Error checking query: ' + err.message);
        } finally {
            setCheckLoading(false);
            setConfirmLoading(false); // Ferma lo spinner del bottone
        }
    };

    // Per chiudere il menu dei risultati della query
    const handleCloseCheckResult = () => {
        setCheckResult(null);
        setCheckError(null);
    };
    const toggleHelp = () => setShowHelp(!showHelp); // Toggle visibilità del messaggio di aiuto

    // --- FUNZIONE DI ESECUZIONE SCRAPING ---
    // SearchForm si occupa SOLO di costruire il payload e navigare.
    // L'axios.post è responsabilità di ProcessingPage (componente montato
    // durante l'attesa) — evita setState su componente già smontato.
    const executeScraping = () => {
        const cleanedMeshTerms = m_s.replace(/,\s*$/, '');
        const cleanedKeywords  = keywords.replace(/,\s*$/, '');

        const requestData = {
            query,
            email,
            num_pages: numPages,
            keywords: cleanedKeywords,
            m_s: cleanedMeshTerms,
            file_type: fileType,
            mode,
            generate_file: generateFile,
            remove: Remove,
            apply_filters: personalize,
            filters: personalize ? buildFiltersPayload() : {},
        };

        setShowWarningModal(false);

        navigate('/processing', {
            state: {
                totalPages: numPages,
                isDarkMode,
                requestData,
                mode: requestData.mode,
                filters: requestData.filters,
            },
        });
    };


    // --- GESTIONE SUBMIT ---
    const handleSubmit = (e) => {
        e.preventDefault();
        setError(null);

        if (!isValidEmail(email)) {
            setError("Please enter a valid email address (e.g., user@domain.com).");
            return;
        }

        if (!keywords.trim()) {
            setError("At least one keyword is required to start scraping.");
            return;
        }

        if (confirmLoading) {
            setError("Please wait until the filter check is complete.");
            return;
        }

        // Se non ha controllato la query, apri il menu di avviso
        if (!hasCheckedQuery) {
            setShowWarningModal(true);
            return;
        }

        executeScraping();
    };

    return (
        <div
            style={{
                fontFamily: 'Inter, Arial, sans-serif',
                margin: 0,
                padding: 0,
                backgroundColor: isDarkMode ? '#121212' : '#f0f4f8',
                color: isDarkMode ? '#ffffff' : '#000000',
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Barra superiore */}
            <div
                style={{
                    backgroundColor: isDarkMode ? '#1f1f1f' : 'rgba(255, 255, 255, 0.8)',
                    padding: '10px 20px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                <img
                    src={logoInPage}
                    alt="Logo FGTD"
                    style={{
                        height: '40px',
                        marginRight: '10px',
                        display: 'inline-block',
                        borderRadius: '5px',
                    }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        onClick={toggleDarkMode}
                        style={{
                            backgroundColor: 'transparent',
                            color: isDarkMode ? '#ffffff' : '#000080',
                            border: '1px solid',
                            borderColor: isDarkMode ? '#ffffff' : '#000080',
                            padding: '5px 10px',
                            borderRadius: '5px',
                            cursor: 'pointer',
                        }}
                    >
                        {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                    </button>
                    <button
                        onClick={toggleHelp}
                        style={{
                            backgroundColor: 'transparent',
                            color: isDarkMode ? '#ffffff' : '#000080',
                            border: '1px solid',
                            borderColor: isDarkMode ? '#ffffff' : '#000080',
                            padding: '5px 10px',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                        }}
                    >
                        <FaQuestionCircle /> Help
                    </button>
                </div>
            </div>

            {/* Testo di aiuto */}
            {showHelp && (
                <div
                    style={{
                        position: 'absolute',
                        top: '60px',
                        right: '20px',
                        backgroundColor: isDarkMode ? '#333333' : '#ffffff',
                        color: isDarkMode ? '#ffffff' : '#000000',
                        padding: '20px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                        zIndex: 2,
                        maxWidth: '300px',
                        fontSize: '14px',
                        lineHeight: '1.5',
                    }}
                >
                    <strong>Welcome to FGTD Desktop App!</strong>
                    <p>
                        This app helps researchers collect data from GEO and PubMed efficiently. Simply enter your search terms,
                        and the app will find GEO datasets and retrieve all linked PubMed articles (with PMIDs). Results are organized
                        into tables showing key details like article titles, abstracts, MeSH terms, platforms, and organisms. You can
                        explore the data directly in the app. The app offers two profiles
                        to tailor your search: Normal Mode, which quickly retrieves GEO datasets and all directly linked PubMed articles with PMIDs,
                        and Ultra Mode, which goes beyond by analyzing the entire GEO page for additional data when PMIDs are not available,
                        ensuring maximum data extraction for comprehensive searches. This tool saves time by automating the process of linking GEO
                        datasets with PubMed articles—no coding required!
                    </p>
                </div>
            )}

            {/* Contenitore del form */}
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '20px',
                }}
            >
                <div
                    style={{
                        maxWidth: '600px',
                        width: '100%',
                        backgroundColor: isDarkMode ? '#1f1f1f' : 'rgba(255, 255, 255, 0.9)',
                        padding: '30px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                    }}
                >
                    <h1
                        style={{
                            fontSize: '32px',
                            marginBottom: '15px',
                            textAlign: 'center',
                            fontFamily: 'Sora, Arial, sans-serif',
                        }}
                    >
                        From Geo To <span style={{ color: isDarkMode ? '#1e90ff' : '#000080' }}>Dataset</span>
                    </h1>
                    <p
                        style={{
                            marginBottom: '25px',
                            textAlign: 'center',
                            fontSize: '14px',
                            lineHeight: '18.5px',
                        }}
                    >
                        Your tool to start your new searches, with just one click! Just enter keywords (We suggest at least 2) and MeSH Terms, and the app will do all the work for you: it will collect scientific information from PubMed and GEO, organize it into an Excel file ready for download. Simplify your search, optimize your time and start your projects immediately with ease (watch out for duplicated elements between keywords and MeSH Terms).
                    </p>

                    {error && <p style={{ color: 'red' }}>{error}</p>}
                    {loading && <p style={{ color: isDarkMode ? '#1e90ff' : '#0066cc' }}>Processing...</p>}

                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                            {/* --- EMAIL SECTION (Wrapped) --- */}
                            <FocusWrapper
                                fieldId="email"
                                isFocused={focusedField === 'email'}
                                onFocus={() => setFocusedField('email')}
                                onClose={closeFocus}
                                description={focusDescriptions.email}
                                isDarkMode={isDarkMode}
                            >
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <FaEnvelope
                                        style={{
                                            position: 'absolute',
                                            top: '50%', // Centrato verticalmente
                                            left: '10px',
                                            transform: 'translateY(-50%)',
                                            color: isDarkMode ? '#ffffff' : '#000080',
                                            pointerEvents: 'none',
                                            zIndex: 1
                                        }}
                                    />
                                    <input
                                        type="email"
                                        placeholder="Enter your email (e.g., example@mail.com)"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '10px 10px 10px 40px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            backgroundColor: isDarkMode ? '#333333' : '#ffffff',
                                            color: isDarkMode ? '#ffffff' : '#000000',
                                        }}
                                    />
                                </div>
                            </FocusWrapper>

                            {/* --- QUERY SECTION (Wrapped - Include Bottone Check) --- */}
                            <FocusWrapper
                                fieldId="query"
                                isFocused={focusedField === 'query'}
                                onFocus={() => setFocusedField('query')}
                                onClose={closeFocus}
                                description={focusDescriptions.query}
                                isDarkMode={isDarkMode}
                            >
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <div style={{ position: 'relative', flex: 1 }}>
                                        <FaSearch
                                            style={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '10px',
                                                transform: 'translateY(-50%)',
                                                color: isDarkMode ? '#ffffff' : '#000080',
                                                pointerEvents: 'none',
                                            }}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Search query (e.g., cancer immunotherapy)"
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '10px 10px 10px 40px',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                backgroundColor: isDarkMode ? '#333333' : '#ffffff',
                                                color: isDarkMode ? '#ffffff' : '#000000',
                                            }}
                                        />
                                    </div>

                                    <div style={{ position: 'relative', fontSize: '14px' }}>
                                        
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                closeFocus(); // Chiude il focus visivo
                                                if (!query || query.trim() === '') {
                                                    setShowEmptyQueryModal(true);
                                                    return;
                                                }   
                                                setPersonalize(true);
                                                setShowPersonalizePrompt(true);
                                            }}
                                            style={{
                                                padding: '8px 8px',
                                                backgroundColor: isDarkMode ? '#1e90ff' : '#0066cc',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                marginLeft: '10px',
                                                marginRight: '0px',
                                                fontSize: '10px',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            Check Query & filter
                                        </button>

                                        {/* RISULTATO DEL CHECK (Loading / Error / Success) */}
                                        {(checkLoading || checkResult || checkError) && (
                                            <div style={{
                                                position: 'absolute',
                                                // MODIFICA QUI: Lo posizioniamo SOPRA il bottone (bottom: 100%)
                                                bottom: '120%', 
                                                right: '0', // Allineato a destra
                                                padding: '10px',
                                                backgroundColor: isDarkMode ? '#333333' : '#ffffff',
                                                border: checkError ? '1px solid #ff4c4c' : '1px solid #4caf50',
                                                borderRadius: '6px',
                                                boxShadow: '0 -4px 15px rgba(0, 0, 0, 0.2)', // Ombra verso l'alto
                                                color: isDarkMode ? '#ffffff' : '#000000',
                                                zIndex: 20, // Z-index alto per stare sopra a tutto
                                                minWidth: '200px',
                                                fontSize: '11px',
                                            }}>
                                                {/* Freccina decorativa che punta in basso verso il bottone (Opzionale) */}
                                                <div style={{
                                                    position: 'absolute',
                                                    bottom: '-5px',
                                                    right: '20px',
                                                    width: '10px',
                                                    height: '10px',
                                                    backgroundColor: isDarkMode ? '#333333' : '#ffffff',
                                                    borderRight: checkError ? '1px solid #ff4c4c' : '1px solid #4caf50',
                                                    borderBottom: checkError ? '1px solid #ff4c4c' : '1px solid #4caf50',
                                                    transform: 'rotate(45deg)'
                                                }}></div>

                                                <button
                                                    onClick={handleCloseCheckResult}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '2px',
                                                        right: '5px',
                                                        background: 'transparent',
                                                        border: 'none',
                                                        fontSize: '14px',
                                                        cursor: 'pointer',
                                                        color: 'red',
                                                    }}
                                                >
                                                    ✖
                                                </button>

                                                {checkLoading && <p style={{ margin: 0, fontWeight: 'bold' }}>Checking GEO...</p>}

                                                {checkResult && !checkLoading && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '5px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <FaCheckCircle color="green" />
                                                            <span><strong>Total Pages:</strong> {checkResult.total_pages}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <FaCheckCircle color="green" />
                                                            <span><strong>Series Found:</strong> {checkResult.series_count}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {checkError && (
                                                    <p style={{ color: '#ff4c4c', margin: 0, marginTop: '5px' }}>
                                                        <FaExclamationTriangle style={{ marginRight: '5px' }}/>
                                                        {checkError}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </FocusWrapper>

                            {/* --- KEYWORDS SECTION (Wrapped) --- */}
                            <FocusWrapper
                                fieldId="keywords"
                                isFocused={focusedField === 'keywords'}
                                onFocus={() => setFocusedField('keywords')}
                                onClose={closeFocus}
                                description={focusDescriptions.keywords}
                                isDarkMode={isDarkMode}
                            >
                                <div style={{ position: 'relative' }}>
                                    <FaKey
                                        style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '10px',
                                            transform: 'translateY(-50%)',
                                            color: isDarkMode ? '#ffffff' : '#000080',
                                            pointerEvents: 'none',
                                        }}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Keywords (e.g. TP53, aging, skin) unlisted words are also accepted."
                                        value={keywords}
                                        onChange={handleKeywordsChange}
                                        onBlur={() => setTimeout(() => setShowGeneSuggestions(false), 200)}
                                        autoComplete="off"
                                        style={{
                                            width: '100%',
                                            padding: '10px 10px 10px 40px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            backgroundColor: isDarkMode ? '#333333' : '#ffffff',
                                            color: isDarkMode ? '#ffffff' : '#000000',
                                        }}
                                    />
                                    {/* LISTA DEI SUGGERIMENTI GENI */}
                                    {showGeneSuggestions && geneSuggestions.length > 0 && (
                                        <ul style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            width: '100%',
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            backgroundColor: isDarkMode ? '#444' : '#fff',
                                            border: '1px solid #ccc',
                                            borderRadius: '0 0 4px 4px',
                                            zIndex: 1000,
                                            listStyle: 'none',
                                            padding: 0,
                                            margin: 0,
                                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                        }}>
                                            {geneSuggestions.map((suggestion, index) => {
                                                const displayLabel = suggestion.Symbol || suggestion;
                                                return (
                                                    <li
                                                        key={index}
                                                        onClick={() => handleGeneSuggestionClick(suggestion)}
                                                        style={{
                                                            padding: '10px',
                                                            cursor: 'pointer',
                                                            borderBottom: isDarkMode ? '1px solid #555' : '1px solid #eee',
                                                            color: isDarkMode ? '#fff' : '#000',
                                                            fontSize: '13px'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.target.style.backgroundColor = isDarkMode ? '#1e90ff' : '#f0f0f0';
                                                            e.target.style.color = isDarkMode ? '#fff' : '#000';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.target.style.backgroundColor = 'transparent';
                                                            e.target.style.color = isDarkMode ? '#fff' : '#000';
                                                        }}
                                                    >
                                                        {displayLabel}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            </FocusWrapper>

                            {/* --- MESH TERMS SECTION (Wrapped) --- */}
                            <FocusWrapper
                                fieldId="mesh"
                                isFocused={focusedField === 'mesh'}
                                onFocus={() => setFocusedField('mesh')}
                                onClose={closeFocus}
                                description={focusDescriptions.mesh}
                                isDarkMode={isDarkMode}
                            >
                                <div style={{ position: 'relative' }}>
                                    <FaDna
                                        style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '10px',
                                            transform: 'translateY(-50%)',
                                            color: isDarkMode ? '#ffffff' : '#000080',
                                            pointerEvents: 'none',
                                        }}
                                    />
                                    <input
                                        type="text"
                                        placeholder="MeSH Terms (e.g.Human, Mice) - Start typing..."
                                        value={m_s}
                                        onChange={handleMeshChange}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                        autoComplete="off"
                                        style={{
                                            width: '100%',
                                            padding: '10px 10px 10px 40px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            backgroundColor: isDarkMode ? '#333333' : '#ffffff',
                                            color: isDarkMode ? '#ffffff' : '#000000',
                                        }}
                                    />
                                    {/* LISTA DEI SUGGERIMENTI MESH */}
                                    {showSuggestions && suggestions.length > 0 && (
                                        <ul style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            width: '100%',
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            backgroundColor: isDarkMode ? '#444' : '#fff',
                                            border: '1px solid #ccc',
                                            borderRadius: '0 0 4px 4px',
                                            zIndex: 1000,
                                            listStyle: 'none',
                                            padding: 0,
                                            margin: 0,
                                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                        }}>
                                            {suggestions.map((suggestion, index) => (
                                                <li
                                                    key={index}
                                                    onClick={() => handleSuggestionClick(suggestion)}
                                                    style={{
                                                        padding: '10px',
                                                        cursor: 'pointer',
                                                        borderBottom: isDarkMode ? '1px solid #555' : '1px solid #eee',
                                                        color: isDarkMode ? '#fff' : '#000',
                                                        fontSize: '13px'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.target.style.backgroundColor = isDarkMode ? '#1e90ff' : '#f0f0f0';
                                                        e.target.style.color = isDarkMode ? '#fff' : '#000';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.target.style.backgroundColor = 'transparent';
                                                        e.target.style.color = isDarkMode ? '#fff' : '#000';
                                                    }}
                                                >
                                                    {suggestion}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </FocusWrapper>

                            {/* --- NUM PAGES SECTION (Wrapped) --- */}
                            <FocusWrapper
                                fieldId="numPages"
                                isFocused={focusedField === 'numPages'}
                                onFocus={() => setFocusedField('numPages')}
                                onClose={closeFocus}
                                description={focusDescriptions.numPages}
                                isDarkMode={isDarkMode}
                            >
                                <div>
                                    <input
                                        type="number"
                                        placeholder="Number of pages to scrape (e.g., 5)"
                                        value={numPages}
                                        onChange={(e) => setNumPages(e.target.value)}
                                        min="1"
                                        required
                                        style={{
                                            padding: '10px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            backgroundColor: isDarkMode ? '#333333' : '#ffffff',
                                            color: isDarkMode ? '#ffffff' : '#000000',
                                            width: '100px'
                                        }}
                                    />
                                    {numPages && (
                                        <span style={{ marginLeft: '10px', fontSize: '12px', color: isDarkMode ? '#ffffff' : '#000000' }}>
                                            ({
                                                checkResult?.series_count
                                                    ? Math.min(parseInt(numPages, 10) * 20, checkResult.series_count)
                                                    : parseInt(numPages, 10) * 20
                                            } out of {checkResult?.series_count ?? '...'} will be elaborated)
                                        </span>
                                    )}
                                </div>
                            </FocusWrapper>


                            <select
                                value={fileType}
                                onChange={(e) => setFileType(e.target.value)}
                                style={{
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    backgroundColor: !generateFile ? (isDarkMode ? '#555555' : '#cccccc') : (isDarkMode ? '#333333' : '#ffffff'),
                                    color: !generateFile ? (isDarkMode ? '#888888' : '#666666') : (isDarkMode ? '#ffffff' : '#000000'),
                                    cursor: 'pointer',
                                }}
                            >
                                <option value="excel">
                                    {generateFile ? "Xlsx (recommended)" : ""} {/* Mostra il testo solo se generateFile è true */}
                                </option>
                                <option value="csv">
                                    {generateFile ? "CSV" : ""} {/* Mostra il testo solo se generateFile è true */}
                                </option>
                            </select>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '170px', marginBottom: '15px' }}>
                                <label style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                    Automatic download of unfiltered file?
                                </label>
                                <select
                                    value={generateFile ? "yes" : "no"} // Mostra "yes" o "no" in base al valore di generateFile
                                    onChange={(e) => setGenerateFile(e.target.value === "yes")} // Converte "yes" in true e "no" in false
                                    style={{
                                        padding: '5px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        backgroundColor: isDarkMode ? '#333333' : '#ffffff',
                                        color: isDarkMode ? '#ffffff' : '#000000',
                                        width: "80px",
                                    }}
                                >
                                    <option value="yes">Yes</option>
                                    <option value="no">No</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '269px', marginBottom: '15px' }}>
                                <label style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                    Remove empty columns?
                                </label>
                                <select
                                    value={Remove ? "yes" : "no"} // Mostra "yes" o "no" in base al valore di Remove
                                    onChange={(e) => setRemove(e.target.value === "yes")} // Converte "yes" in true e "no" in false
                                    style={{
                                        padding: '5px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        backgroundColor: isDarkMode ? '#333333' : '#ffffff',
                                        color: isDarkMode ? '#ffffff' : '#000000',
                                        width: "80px",
                                    }}
                                >
                                    <option value="yes">Yes</option>
                                    <option value="no">No</option>
                                </select>
                            </div>
                            {/* Selettore per Normal/Ultra Mode */}
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '15px', }}>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setShowHelpMode(!showHelpMode);
                                    }}
                                    style={{
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        color: isDarkMode ? '#ffffff' : '#000080',
                                    }}
                                >
                                    <FaQuestionCircle
                                        style={{
                                            color: isDarkMode ? '#ffffff' : '#000080',
                                            fontSize: '18px',
                                        }}
                                    />
                                </button>
                                <label style={{ fontWeight: 'bold', fontSize: '14px', flex: '1' }}>
                                    <select
                                        value={mode}
                                        onChange={(e) => setMode(e.target.value)}
                                        style={{
                                            marginLeft: '205px',
                                            padding: '10px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            backgroundColor: isDarkMode ? '#333333' : '#ffffff',
                                            color: isDarkMode ? '#ffffff' : '#000000',
                                        }}
                                    >
                                        <option value="normal">Normal Mode</option>
                                        <option value="ultra">Ultra Mode</option>
                                    </select>
                                </label>
                                <div
                                    style={{
                                        position: "relative",
                                        marginLeft: "10px",
                                    }}
                                ></div>
                            </div>

                            {/* Messaggio di aiuto per le modalità */}
                            {showHelpMode && (
                                <div
                                    style={{
                                        position: 'fixed',
                                        bottom: '10px',
                                        left: '30px',
                                        backgroundColor: isDarkMode ? '#333333' : '#ffffff',
                                        color: isDarkMode ? '#ffffff' : '#000000',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                                        zIndex: 3,
                                        maxWidth: '150px',
                                        fontSize: '14px',
                                        lineHeight: '1.5',
                                        border: `1px solid ${isDarkMode ? '#ffffff' : '#000080'}`,
                                    }}
                                >
                                    <p>
                                        <strong> Normal Mode </strong> is <em> ~ 10% faster </em> than Ultra mode; as it only annotates GEO pages linked to a PMID. Ultra Mode processes all GEO elements to avoid data loss, making it slower. We suggest using Ultra Mode for 1-3 pages, as recent articles may lack a PMID, risking an empty dataset and scraper issues.
                                    </p>
                                </div>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={loading || confirmLoading}
                            style={{
                                backgroundColor: (loading || confirmLoading) ? '#888' : (isDarkMode ? '#1e90ff' : '#0066cc'),
                                cursor: (loading || confirmLoading) ? 'not-allowed' : 'pointer',
                                color: '#ffffff',
                                border: 'none',
                                padding: '12px',
                                borderRadius: '4px',
                                marginTop: '20px',
                                width: '100%',
                                fontFamily: 'Inter, Arial, sans-serif',
                                fontSize: '16px',
                            }}
                        >
                            {(loading || confirmLoading) ? 'Loading...' : 'Start Scraping'}
                        </button>

                    </form>
                    {/* --- MODALE FILTRI AVANZATI (CENTRATA) --- */}
                    {personalize && showPersonalizePrompt && (
                        <>
                            {/* 1. Sfondo scuro (Backdrop) per i filtri */}
                            <div 
                                onClick={() => setShowPersonalizePrompt(false)} // Chiude se si clicca fuori
                                style={{
                                    position: 'fixed',
                                    top: 0,
                                    left: 0,
                                    width: '100vw',
                                    height: '100vh',
                                    backgroundColor: 'rgba(0,0,0,0.7)', // Sfondo scuro
                                    backdropFilter: 'blur(5px)', // Blur aggiuntivo
                                    zIndex: 10000, // Più alto del FocusWrapper (che è 9999)
                                }}
                            />

                            {/* 2. Il Contenitore del Menù (Centrato) */}
                            <div style={{
                                position: 'fixed',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)', // Centratura perfetta
                                width: '90%',
                                maxWidth: '500px', // Larghezza massima ottimale
                                maxHeight: '85vh', // Non supera l'altezza dello schermo
                                overflowY: 'auto', // Scroll interno se i filtri sono tanti
                                backgroundColor: isDarkMode ? '#222' : '#fff',
                                color: isDarkMode ? '#fff' : '#000',
                                borderRadius: '12px', // Bordi arrotondati
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', // Ombra profonda
                                padding: '25px',
                                zIndex: 10001, // Sopra lo sfondo (10000)
                                border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
                            }}>
                                
                                {/* Intestazione Modale */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h3 style={{ margin: 0 }}>
                                        <span style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>Advanced</span>{' '}
                                        <span style={{ color: '#3182ce' }}>Filters</span>
                                    </h3>
                                    <button 
                                        onClick={() => setShowPersonalizePrompt(false)} 
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: isDarkMode ? '#fff' : '#000',
                                            fontSize: '20px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ✖
                                    </button>
                                </div>

                                <p style={{ fontStyle: 'italic', fontWeight: 'bold', fontSize: '12px', marginBottom: '15px', color: isDarkMode ? '#aaa' : '#666' }}>
                                    (Checking the query is required to enable these filters in the research.)
                                </p>

                                {/* --- QUI INIZIA IL CONTENUTO DEI TUOI FILTRI (Copiato dal tuo codice originale) --- */}
                                
                                {/* Organism */}
                                <div style={{
                                    border: isDarkMode ? '1px solid #555' : '1px solid #ccc',
                                    padding: '10px',
                                    marginBottom: '15px',
                                    backgroundColor: isDarkMode ? '#333' : '#f9f9f9',
                                    borderRadius: '6px'
                                }}>
                                    <label><strong>Organism</strong></label>
                                    <input
                                        type="text"
                                        value={organism || ''}
                                        onChange={(e) => setOrganism(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            marginTop: '5px',
                                            backgroundColor: isDarkMode ? '#555' : '#fff',
                                            color: isDarkMode ? '#fff' : '#000',
                                            border: '1px solid',
                                            borderColor: isDarkMode ? '#888' : '#ccc',
                                            borderRadius: '4px',
                                        }}
                                        placeholder='e.g. homo sapiens, mice'
                                    />
                                </div>

                                {/* Study Types */}
                                <div style={{ marginBottom: '15px' }}>
                                    <strong>Study Types</strong>
                                    <div style={{ maxHeight: '150px', overflowY: 'scroll', border: '1px solid #ccc', padding: '5px', borderRadius: '4px', marginTop: '5px' }}>
                                        {allStudyTypes.map(type => (
                                            <div key={type}>
                                                <input
                                                    type="checkbox"
                                                    checked={!!studyTypes[type]}
                                                    onChange={() => setStudyTypes(prev => ({ ...prev, [type]: !prev[type] }))}
                                                /> {type}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Subset Types */}
                                <div style={{ marginBottom: '15px' }}>
                                    <strong>Subset Types</strong>
                                    <p style={{ fontStyle: 'italic', fontSize: '11px', margin: '2px 0 5px 0', opacity: 0.8 }}>
                                        (Extremely selective, use with caution)
                                    </p>
                                    <div style={{ maxHeight: '100px', overflowY: 'scroll', border: '1px solid #ccc', padding: '5px', borderRadius: '4px' }}>
                                        {allSubsetTypes.map(sub => (
                                            <div key={sub}>
                                                <input
                                                    type="checkbox"
                                                    checked={!!subsetTypes[sub]}
                                                    onChange={() => setSubsetTypes(prev => ({ ...prev, [sub]: !prev[sub] }))}
                                                /> {sub}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Attribute Names */}
                                <div style={{ marginBottom: '15px' }}>
                                    <strong>Attribute Names</strong>
                                    <div style={{ display: 'flex', gap: '5px', marginBottom: '5px', marginTop: '5px' }}>
                                        <input
                                            type="text"
                                            placeholder="Add custom (e.g. cell type)"
                                            value={customAttribute}
                                            onChange={(e) => setCustomAttribute(e.target.value)}
                                            style={{ flex: 1, padding: '5px', borderRadius: '4px', border: '1px solid #ccc',backgroundColor: isDarkMode ? '#555' : '#fff',color: isDarkMode ? '#fff' : '#000',border: '1px solid',borderColor: isDarkMode ? '#888' : '#ccc',borderRadius: '4px', }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const trimmed = customAttribute.trim();
                                                if (trimmed && !attributeNames[trimmed]) {
                                                    setAttributeNames(prev => ({ ...prev, [trimmed]: true }));
                                                    setCustomAttribute('');
                                                }
                                            }}
                                            style={{ padding: '5px 10px', cursor: 'pointer',backgroundColor: isDarkMode ? '#555' : '#fff',color: isDarkMode ? '#fff' : '#000',border: '1px solid',borderColor: isDarkMode ? '#888' : '#ccc',borderRadius: '4px', }}
                                        >
                                            Add
                                        </button>
                                    </div>
                                    <div style={{ maxHeight: '100px', overflowY: 'scroll', border: '1px solid #ccc', padding: '5px', borderRadius: '4px', }}>
                                        {allAttributeNames.map(attr => (
                                            <div key={attr}>
                                                <input
                                                    type="checkbox"
                                                    checked={!!attributeNames[attr]}
                                                    onChange={() => setAttributeNames(prev => ({ ...prev, [attr]: !prev[attr] }))}
                                                /> {attr}
                                            </div>
                                        ))}
                                        {Object.keys(attributeNames).filter(attr => !allAttributeNames.includes(attr)).map(attr => (
                                            <div key={attr}>
                                                <input
                                                    type="checkbox"
                                                    checked={!!attributeNames[attr]}
                                                    onChange={() => setAttributeNames(prev => ({ ...prev, [attr]: !prev[attr] }))}
                                                /> {attr} <span style={{ fontStyle: 'italic', color: '#888' }}>(custom)</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Date Range */}
                                <div style={{
                                    marginBottom: '15px',
                                    border: isDarkMode ? '1px solid #555' : '1px solid #ccc',
                                    padding: '10px',
                                    backgroundColor: isDarkMode ? '#333' : '#ffffff',
                                    borderRadius: '6px'
                                }}>
                                    <label><strong>Date Range</strong></label>
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                                        <div style={{ flex: 1 }}>
                                            <small>From:</small>
                                            <input
                                                type="text"
                                                placeholder="YYYY MM DD"
                                                onChange={(e) => {
                                                    const [y, m, d] = e.target.value.split(' ');
                                                    setStartDate({ year: y, month: m, day: d });
                                                }}
                                                style={{ width: '100%', padding: '5px', borderRadius: '4px', border: '1px solid #ccc',backgroundColor: isDarkMode ? '#555' : '#fff',color: isDarkMode ? '#fff' : '#000',border: '1px solid',borderColor: isDarkMode ? '#888' : '#ccc',borderRadius: '4px', }}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <small>To:</small>
                                            <input
                                                type="text"
                                                placeholder="YYYY MM DD"
                                                onChange={(e) => {
                                                    const [y, m, d] = e.target.value.split(' ');
                                                    setEndDate({ year: y, month: m, day: d });
                                                }}
                                                style={{ width: '100%', padding: '5px', borderRadius: '4px', border: '1px solid #ccc',backgroundColor: isDarkMode ? '#555' : '#fff',color: isDarkMode ? '#fff' : '#000',border: '1px solid',borderColor: isDarkMode ? '#888' : '#ccc',borderRadius: '4px', }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Supp Files */}
                                <div style={{ marginBottom: '20px' }}>
                                    <strong>Supplementary Files</strong>
                                    <div style={{ maxHeight: '80px', overflowY: 'scroll', border: '1px solid #ccc', padding: '5px', borderRadius: '4px', marginTop: '5px' }}>
                                        {allSupplementaryFiles.map(file => (
                                            <div key={file}>
                                                <input
                                                    type="checkbox"
                                                    checked={!!suppFiles[file]}
                                                    onChange={() => setSuppFiles(prev => ({ ...prev, [file]: !prev[file] }))}
                                                /> {file}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* ACTION BUTTONS */}

                                <button
                                    onClick={() => {
                                        // 1. Chiudi IMMEDIATAMENTE la modale dei filtri
                                        setShowPersonalizePrompt(false); 
                                        
                                        // 2. Lancia la logica di controllo (che aprirà la modale di conferma "Yes, Check")
                                        handleCheckQuery();
                                    }}
                                    disabled={confirmLoading}
                                    style={{
                                        width: '100%',
                                        backgroundColor: confirmLoading ? '#a0aec0' : '#0066cc',
                                        color: 'white',
                                        padding: '12px',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: confirmLoading ? 'not-allowed' : 'pointer',
                                        fontWeight: 'bold',
                                        fontSize: '15px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '10px'
                                    }}
                                >
                                    {confirmLoading ? 'Processing...' : 'Confirm & Check Query'}
                                </button>
                                
                                {/* Style per lo spinner interno se serve */}
                                <style>{`
                                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                                `}</style>
                            </div>
                        </>
                    )}

                    {/* --- MENÙ PERSONALIZZATO DI AVVISO (WARNING MODAL) --- */}
                    {showWarningModal && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 2000 
                        }}>
                            <div style={{
                                backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
                                padding: '30px',
                                borderRadius: '10px',
                                maxWidth: '450px',
                                width: '90%',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                                border: `1px solid ${isDarkMode ? '#333' : '#ddd'}`,
                                textAlign: 'center',
                                color: isDarkMode ? '#ffffff' : '#000000',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center'
                            }}>
                                <FaExclamationTriangle size={40} color={'#ffcc00'} style={{ marginBottom: '15px' }} />
                                
                                <h3 style={{ marginBottom: '15px', fontFamily: 'Sora, sans-serif' }}>
                                    Wait a moment!
                                </h3>
                                
                                <p style={{ marginBottom: '25px', lineHeight: '1.5', fontSize: '14px' }}>
                                    You haven't checked the query results or applied filters yet.<br/><br/>
                                    We strongly suggest checking the data volume before scraping to avoid empty results or long waiting times.
                                </p>

                                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                                    <button
                                        onClick={() => {
                                            setShowWarningModal(false);
                                            if (!query || query.trim() === '') {
                                                setShowEmptyQueryModal(true);
                                                return;
                                            }
                                            setPersonalize(true);
                                            setShowPersonalizePrompt(true);
                                        }}
                                        style={{
                                            padding: '10px 20px',
                                            borderRadius: '5px',
                                            border: `1px solid ${isDarkMode ? '#fff' : '#000080'}`,
                                            backgroundColor: 'transparent',
                                            color: isDarkMode ? '#fff' : '#000080',
                                            cursor: 'pointer',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        Check Filters
                                    </button>

                                    <button
                                        onClick={() => {
                                            setShowWarningModal(false); // Chiudi modale
                                            executeScraping(); // Esegui scraping
                                        }}
                                        style={{
                                            padding: '10px 20px',
                                            borderRadius: '5px',
                                            border: 'none',
                                            backgroundColor: isDarkMode ? '#1e90ff' : '#0066cc',
                                            color: '#fff',
                                            cursor: 'pointer',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        Continue Anyway
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- 🆕 MODALE 1: QUERY VUOTA --- */}
                    {showEmptyQueryModal && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 2100 
                        }}>
                            <div style={{
                                backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
                                padding: '30px',
                                borderRadius: '10px',
                                maxWidth: '400px',
                                width: '90%',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                                border: `1px solid ${isDarkMode ? '#333' : '#ddd'}`,
                                textAlign: 'center',
                                color: isDarkMode ? '#ffffff' : '#000000',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center'
                            }}>
                                <FaTimesCircle size={40} color={'#ff4c4c'} style={{ marginBottom: '15px' }} />
                                
                                <h3 style={{ marginBottom: '15px', fontFamily: 'Sora, sans-serif' }}>
                                    Missing Query
                                </h3>
                                
                                <p style={{ marginBottom: '25px', lineHeight: '1.5', fontSize: '14px' }}>
                                    Please enter a search query before checking results.
                                </p>

                                <button
                                    onClick={() => setShowEmptyQueryModal(false)}
                                    style={{
                                        padding: '10px 30px',
                                        borderRadius: '5px',
                                        border: 'none',
                                        backgroundColor: isDarkMode ? '#1e90ff' : '#0066cc',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    )}

                    {/* --- 🆕 MODALE 2: CONFERMA CHECK QUERY --- */}
                    {showConfirmCheckModal && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 2100 
                        }}>
                            <div style={{
                                backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
                                padding: '30px',
                                borderRadius: '10px',
                                maxWidth: '450px',
                                width: '90%',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                                border: `1px solid ${isDarkMode ? '#333' : '#ddd'}`,
                                textAlign: 'center',
                                color: isDarkMode ? '#ffffff' : '#000000',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center'
                            }}>
                                <FaQuestionCircle size={40} color={isDarkMode ? '#1e90ff' : '#0066cc'} style={{ marginBottom: '15px' }} />
                                
                                <h3 style={{ marginBottom: '15px', fontFamily: 'Sora, sans-serif' }}>
                                    Confirm Check
                                </h3>
                                
                                <p style={{ marginBottom: '25px', lineHeight: '1.5', fontSize: '14px' }}>
                                    Are you sure you want to check the query:<br/><br/>
                                    <strong>"{query}"</strong>?
                                </p>

                                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                                    <button
                                        onClick={() => setShowConfirmCheckModal(false)}
                                        style={{
                                            padding: '10px 20px',
                                            borderRadius: '5px',
                                            border: `1px solid ${isDarkMode ? '#fff' : '#555'}`,
                                            backgroundColor: 'transparent',
                                            color: isDarkMode ? '#fff' : '#555',
                                            cursor: 'pointer',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        onClick={performCheckQuery}
                                        style={{
                                            padding: '10px 20px',
                                            borderRadius: '5px',
                                            border: 'none',
                                            backgroundColor: isDarkMode ? '#1e90ff' : '#0066cc',
                                            color: '#fff',
                                            cursor: 'pointer',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        Yes, Check
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
            
            {/* Footer */}
            <footer
                style={{
                    backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
                    color: isDarkMode ? '#ffffff' : '#000000',
                    textAlign: 'center',
                    padding: '10px 0',
                    borderTop: `1px solid ${isDarkMode ? '#333333' : '#dddddd'}`,
                    fontSize: '14px',
                }}
            >
                <p>&copy; 2026 FGTD Desktop App. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default SearchForm;
