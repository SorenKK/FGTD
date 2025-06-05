import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; // Hook per la navigazione
import { FaEnvelope, FaSearch, FaKey, FaDna, FaQuestionCircle, FaInfoCircle, FaCheckCircle } from 'react-icons/fa'; // Icone
import logoInPage from './logo_in_page.png';

const SearchForm = () => {
    const [email, setEmail] = useState('');
    const [query, setQuery] = useState('');
    const [keywords, setKeywords] = useState('');
    const [m_s, setMS] = useState('');
    const [numPages, setNumPages] = useState('1');
    const [fileType, setFileType] = useState('excel');
    const [mode, setMode] = useState('normal')
    const [error, setError] = useState(null);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [loading, setLoading] = useState(false); // Stato per la barra di progressione
    const [showHelp, setShowHelp] = useState(false); // Stato per la visibilità del messaggio di aiuto
    const [showHelpMode, setShowHelpMode] = useState(false);
    const [generateFile, setGenerateFile] = useState(true); // Default: Yes (True)
    const[Remove,setRemove] = useState(true);
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



    const commonInputStyle = {
        width: '100%',
        padding: '10px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        backgroundColor: isDarkMode ? '#333333' : '#ffffff',
        color: isDarkMode ? '#ffffff' : '#000000',
        marginBottom: '10px',
        fontSize:'9px'
    };

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

    const handleCheckQuery = async () => {
    // Valida le date solo se sono compilate
        if (startDate.year && endDate.year && !validateDateRange()) {
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
        }
    };



    // Per chiudere il menu dei risultati della query
    const handleCloseCheckResult = () => {
        setCheckResult(null);
        setCheckError(null);
    };
    const toggleHelp = () => setShowHelp(!showHelp); // Toggle visibilità del messaggio di aiuto
    

const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (loading) {
        setError("Scraping is already in progress. Please wait...");
        return;
    }

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
    setLoading(true);

        const requestData = {
            query,
            email,
            num_pages: numPages,
            keywords,
            m_s,
            file_type: fileType,
            mode,
            generate_file: generateFile,
            remove: Remove,
            apply_filters: personalize,
            filters: personalize ? buildFiltersPayload() : {}

        };

        try {
            // Passa isDarkMode e altre informazioni alla pagina di processing
            navigate('/processing', {
                state: {
                    totalPages: numPages,
                    isDarkMode: isDarkMode, // Passa lo stato della modalità scura
                    requestData: requestData, // Passa i dati della richiesta se necessario
                    mode: requestData.mode,
                    filters: personalize ? buildFiltersPayload() : {}
                },
            });

            // Se vuoi effettuare la chiamata API qui
            const response = await axios.post('http://localhost:5000/api/search', requestData);
            navigate('/results', {
                state: {
                    results: response.data,
                    searchQuery: requestData.query,
                    keywords: requestData.keywords,
                    meshTerms: requestData.m_s,
                    isDarkMode: isDarkMode,
                    mode: requestData.mode,
                    filters: personalize ? buildFiltersPayload() : {}
                },
            });
        } catch (err) {
            setError('Error during search: ' + err.message);
        } finally {
            setLoading(false);
        }
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
            {/* Barra superiore con logo, toggle tema e help */}
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
                            lineHeight:'18.5px',
                        }}
                    >
                        Your tool to start your new searches, with just one click! Just enter keywords (We suggest at least 2) and MeSH Terms, and the app will do all the work for you: it will collect scientific information from PubMed and GEO, organize it into an Excel file ready for download. Simplify your search, optimize your time and start your projects immediately with ease (watch out for duplicated elements between keywords and MeSH Terms).
                    </p>

                    {error && <p style={{ color: 'red' }}>{error}</p>}
                    {loading && <p style={{ color: isDarkMode ? '#1e90ff' : '#0066cc' }}>Processing...</p>}

                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* Email */}
                            <div style={{ position: 'relative' }}>
                                <FaEnvelope
                                    style={{
                                        position: 'absolute',
                                        top: '35%',
                                        left: '10px',
                                        transform: 'translateY(-50%)',
                                        color: isDarkMode ? '#ffffff' : '#000080',
                                        pointerEvents: 'none',
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
                                {/* Info Icon */}
                                <div style={{ position: 'relative', marginLeft: '8px' }}>
                                    <FaInfoCircle
                                        style={{
                                            color: isDarkMode ? '#ffffff' : '#555555',
                                            cursor: 'pointer',
                                        }}
                                        onMouseEnter={() => setShowTooltip(true)}
                                        onMouseLeave={() => setShowTooltip(false)}
                                    />
                                    {showTooltip && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: '-10px',
                                                right: '0',
                                                padding: '8px',
                                                borderRadius: '4px',
                                                backgroundColor: isDarkMode ? '#444444' : '#f9f9f9',
                                                color: isDarkMode ? '#ffffff' : '#000000',
                                                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                                                fontSize: '12px',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            We don’t collect any data
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Query with Check Button */}
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
                                <div style={{ position: 'relative',fontSize:'14px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowPersonalizePrompt(true,setPersonalize(true))}
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
                                        }}
                                    >
                                        Check Query & filter
                                    
                                    </button>

                                    {(checkLoading || checkResult || checkError) && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '-10px',
                                            right: '-10px',
                                            padding: '8px',
                                            backgroundColor: isDarkMode ? '#333333' : '#ffffff',
                                            border: checkError ? '1px solid #ff4c4c' : '1px solid #4caf50',
                                            borderRadius: '4px',
                                            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                                            color: isDarkMode ? '#ffffff' : '#000000',
                                            zIndex: 10,
                                            minWidth: '180px',
                                            fontSize: '10px',
                                        }}>
                                            <button
                                                onClick={handleCloseCheckResult}
                                                style={{
                                                    position: 'absolute',
                                                    top: '3px',
                                                    right: '3px',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    fontSize: '14px',
                                                    cursor: 'pointer',
                                                    color: 'red',
                                                }}
                                            >
                                                ✖
                                            </button>

                                            {checkLoading && (
                                                <p style={{ fontSize: '12px' }}>Loading...</p>
                                            )}

                                            {checkResult && !checkLoading && (
                                                <>
                                                    <p style={{ color: isDarkMode ? '#ffffff' : '#000000', fontSize: '12px' }}>
                                                        <FaCheckCircle color="green" />   Total GEO's Pages: {checkResult.total_pages}
                                                    </p>
                                                    <p style={{ color: isDarkMode ? '#ffffff' : '#000000', fontSize: '12px', left:'100px' }}>
                                                        <FaCheckCircle color="green" /> 
                                                           Scientific articles found: {checkResult.series_count}
                                                    </p>
                                                </>
                                            )}

                                            {checkError && (
                                                <p style={{ color: 'red', fontSize: '12px' }}>{checkError}</p>
                                            )}
                                            
                                        </div>
                                    )}
                                </div>
                                
                            </div>
                            
                            {/* Keywords */}
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
                                    placeholder="Keywords (e.g., tumor, immunotherapy), at least one is needed"
                                    value={keywords}
                                    onChange={(e) => setKeywords(e.target.value)}
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
                            {/* MeSH Terms */}
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
                                    placeholder="MeSH Terms on site (e.g., Human, Mice; as written on PubMed site)"
                                    value={m_s}
                                    onChange={(e) => setMS(e.target.value)}
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
                            }}
                            />
                            {numPages && (
                            <span style={{ marginLeft: '5px', fontSize: '12px', color: isDarkMode ? '#ffffff' : '#000000' }}>
                                ({parseInt(numPages, 10) * 20} out of {checkResult?.series_count ?? '...'} will be elaborated)
                            </span>
                            )}


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
                    {personalize && showPersonalizePrompt && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        right: 0,
                        height: '100%',
                        width: '400px',
                        overflowY: 'scroll',
                        backgroundColor: isDarkMode ? '#222' : '#fff',
                        color: isDarkMode ? '#fff' : '#000',
                        borderLeft: '1px solid #ccc',
                        padding: '20px',
                        zIndex: 1000,
                    }}>
                        <button onClick={() => setShowPersonalizePrompt(false)} style={{ float: 'right' }}>✖</button>
                        <h3>
                            <span style={{ color: isDarkMode ? '#ffffff' : '#000000' }}>Advanced</span>{' '}
                            <span style={{ color: '#3182ce' }}>Filters</span>
                        </h3>

                        <p style={{ fontStyle: 'italic', fontWeight: 'bold', fontSize: '12px', marginTop: '5px', marginBottom: '10px' }}>
                         (Checking the query is required to enable these filters in the research.)
                        </p>

                        <div style={{
                            border: isDarkMode ? '1px solid #555' : '1px solid #ccc',
                            padding: '5px',
                            marginBottom: '10px',
                            backgroundColor: isDarkMode ? '#333333' : '#ffffff',
                            color: isDarkMode ? '#ffffff' : '#000000',
                            borderRadius: '4px'
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
                                    backgroundColor: isDarkMode ? '#555555' : '#ffffff',
                                    color: isDarkMode ? '#ffffff' : '#000000',
                                    border: '1px solid',
                                    borderColor: isDarkMode ? '#888888' : '#ccc',
                                    borderRadius: '4px',
                                }}
                                placeholder='e.g. homo sapiens, mice'
                            />
                        </div>

                        <div>
                        <strong>Study Types</strong>
                        <div style={{ maxHeight: '200px', overflowY: 'scroll', border: '1px solid #ccc', padding: '5px' }}>
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

                        <div style={{ marginTop: '10px' }}>
                        <strong>Subset Types</strong>
                        <div style={{ maxHeight: '150px', overflowY: 'scroll', border: '1px solid #ccc', padding: '5px' }}>
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

                        <div style={{
                            marginTop: '10px',
                            border: isDarkMode ? '1px solid #555' : '1px solid #ccc',
                            padding: '5px',
                            backgroundColor: isDarkMode ? '#333333' : '#ffffff',
                            color: isDarkMode ? '#ffffff' : '#000000',
                            borderRadius: '4px'
                        }}>
                            <label><strong>Date Range of interest</strong></label><br />
                            From:
                            <input
                                type="text"
                                placeholder="YYYY MM DD"
                                onChange={(e) => {
                                    const [y, m, d] = e.target.value.split(' ');
                                    setStartDate({ year: y, month: m, day: d });
                                }}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    margin: '5px 0',
                                    backgroundColor: isDarkMode ? '#555555' : '#ffffff',
                                    color: isDarkMode ? '#ffffff' : '#000000',
                                    border: '1px solid',
                                    borderColor: isDarkMode ? '#888888' : '#ccc',
                                    borderRadius: '4px',
                                }}
                            /><br />
                            To:
                            <input
                                type="text"
                                placeholder="YYYY MM DD"
                                onChange={(e) => {
                                    const [y, m, d] = e.target.value.split(' ');
                                    setEndDate({ year: y, month: m, day: d });
                                }}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    marginTop: '5px',
                                    backgroundColor: isDarkMode ? '#555555' : '#ffffff',
                                    color: isDarkMode ? '#ffffff' : '#000000',
                                    border: '1px solid',
                                    borderColor: isDarkMode ? '#888888' : '#ccc',
                                    borderRadius: '4px',
                                }}
                            />
                        </div>

                        

                        <div style={{ marginTop: '10px' }}>
                            <strong>Supplementary Files to research</strong>
                            <div style={{ maxHeight: '120px', overflowY: 'scroll', border: '1px solid #ccc', padding: '5px' }}>
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

                        <button
                        onClick={async () => {
                            setConfirmLoading(true);
                            await handleCheckQuery();
                            setConfirmLoading(false);
                        }}
                        disabled={confirmLoading}
                        style={{
                            marginTop: '15px',
                            backgroundColor: confirmLoading ? '#a0aec0' : '#0066cc',
                            color: 'white',
                            padding: '10px',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: confirmLoading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '220px',
                            fontWeight: 'bold',
                            fontSize: '14px',
                        }}
                        >
                        {confirmLoading ? (
                            <div
                            className="spinner"
                            style={{
                                border: '3px solid #f3f3f3',
                                borderTop: '3px solid #ffffff',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                animation: 'spin 1s linear infinite',
                            }}
                            />
                        ) : (
                            'Confirm and Check Query'
                        )}
                        </button>

                        {/* Spinner CSS */}
                        <style>
                        {`
                            @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                            }
                        `}
                        </style>
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
                <p>&copy; 2025 FGTD Desktop App. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default SearchForm;
