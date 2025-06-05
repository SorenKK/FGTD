const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const isDev = process.env.NODE_ENV === 'development';

console.log("Environment:", isDev ? "Development" : "Production");
const { dialog } = require('electron');

// Listener per la scelta del percorso di salvataggio
ipcMain.handle('choose-save-location', async (event) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Save Excel File',
        defaultPath: 'filtered_table.xlsx', // Nome di default del file
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }], // Filtri di formato
    });

    // Ritorna null se l'utente annulla
    return canceled ? null : filePath;
});

let backendProcess;
let isBackendRunning = false;

// Funzione per terminare un processo
function killProcess(pid) {
    if (process.platform === 'win32') {
        exec(`taskkill /PID ${pid} /T /F`, (err, stdout, stderr) => {
            if (err) {
                console.error(`Error terminating process ${pid}: ${err.message}`);
            } else {
                console.log(`Process ${pid} terminated`);
            }
        });
    } else {
        process.kill(-pid); // Usa il segno meno per uccidere il gruppo di processi
    }
}

// …inizio file invariato…
function startBackend() {
    console.log('Try to start backend...');
    if (isBackendRunning) return;

    if (isDev) {
        const script = path.join(__dirname, "backend", "dist","backend.exe");
        backendProcess = spawn(script, [], {
            stdio: 'inherit',
            detached: false
        });
    } else {
        const basePath = path.join(process.resourcesPath, "backend.exe");
        backendProcess = spawn(basePath, [], {
            stdio: 'inherit',
            detached: false,
            windowsHide: true
            
        });
    }

    backendProcess.on('error', (error) => {
        console.error(`Error starting backend: ${error.message}`);
    });

    backendProcess.on('exit', (code, signal) => {
        console.log(`backend terminated with code ${code} and signal ${signal}`);
        isBackendRunning = false;
        backendProcess = null;
    });

    isBackendRunning = true;
    console.log('Backend started with PID:', backendProcess.pid);
}

// …resto del file invariato…

// Funzione per terminare il backend
function killBackend() {
    if (backendProcess) {
        console.log('Try to stop backend process:', backendProcess.pid);

        if (process.platform === 'win32') {
            exec(`taskkill /PID ${backendProcess.pid} /T /F`, (err) => {
                if (err) {
                    console.error(`Error terminating ${backendProcess.pid}: ${err.message}`);
                } else {
                    console.log(`Process ${backendProcess.pid} terminated`);
                }
                backendProcess = null;
                isBackendRunning = false;
            });
        } else {
            backendProcess.kill('SIGTERM');
            console.log(`termination send to process ${backendProcess.pid}`);

            // Controlla se il processo è stato terminato
            setTimeout(() => {
                if (!backendProcess.killed) {
                    console.log(`Forcing ${backendProcess.pid}`);
                    backendProcess.kill('SIGKILL'); // Forza la terminazione
                }
                backendProcess = null;
                isBackendRunning = false;
            }, 1000); // Aspetta 1 secondo prima di forzare la terminazione
        }
    }
}

// Funzione per avviare il frontend (solo in sviluppo)
function startFrontend() {
    if (isDev) {
        frontendProcess = spawn('npm', ['start'], {
            cwd: path.join(__dirname, './frontend'),
            shell: true,
            stdio: 'inherit',
            detached: false,
            windowsHide: true // Previene l'apertura della finestra del terminale su Windows
        });

        frontendProcess.on('error', (error) => {
            console.error(`Error on React launch: ${error.message}`);
        });

        frontendProcess.on('exit', (code, signal) => {
            console.log(`frontend terminated with code ${code} and segnal ${signal}`);
        });
    }
}

// Creazione della finestra principale
function createWindow() {
    const win = new BrowserWindow({
        width: 1024,
        height: 768,
        icon: path.join(__dirname, 'assets', 'favicon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (isDev) {
        win.loadURL('http://localhost:3000');
    } else {
        win.loadFile(path.join(__dirname, 'frontend', 'build', 'index.html'))
            .then(() => console.log("Index.html correctly loaded"))
            .catch(err => console.error("Error loading index.html:", err));
    }

    // Listener per chiusura della finestra
    win.on('close', () => {
        console.log('Event win.close caleld');
        killBackend();
    });
}

// Eventi dell'app
app.whenReady().then(() => {
    startBackend();
    startFrontend();
    createWindow();
});

app.on('window-all-closed', () => {
    console.log('window-all-closed called');
    killBackend(); // Termina il backend
    if (process.platform !== 'darwin') {
        app.quit(); // Chiudi l'app
    }
});

app.on('before-quit', () => {
    console.log('before-quit called');
    killBackend(); // Termina il backend prima di chiudere l'app
});

app.on('quit', () => {
    console.log('app quit called');
    killBackend(); // Termina il backend quando l'app viene chiusa
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});