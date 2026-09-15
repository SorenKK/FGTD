const { app, BrowserWindow, ipcMain, dialog, Menu, shell, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const treeKill = require('tree-kill'); 
const fs = require('fs');

// -----------------------------------------------------------------------------
// 1. SETTINGS & GPU CONFIGURATION
// -----------------------------------------------------------------------------

const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'settings.json');

// Default settings: GPU è TRUE di default
let currentSettings = { enableGpu: true };

// Load settings
try {
  if (fs.existsSync(settingsPath)) {
    currentSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  }
} catch (e) {
  console.error("Error reading settings:", e);
}

// Check environment
const isDev = !app.isPackaged;
console.log("Environment:", isDev ? "Development" : "Production");
console.log("GPU Enabled:", currentSettings.enableGpu);

// DISABLE GPU IF REQUESTED
if (!currentSettings.enableGpu) {
    console.log("⚠️ Disabling Hardware Acceleration (User Setting)...");
    app.disableHardwareAcceleration();
}

let backendProcess = null;
let isBackendRunning = false; 
let isQuitting = false;       

// Linux/Electron config
app.commandLine.appendSwitch('disable-dev-shm-usage');

// -----------------------------------------------------------------------------
// 1b. SINGLE INSTANCE LOCK
// -----------------------------------------------------------------------------
// Senza lock una seconda istanza parte normalmente, ma il suo backend Python trova
// la porta 5000 gia' occupata da quello della prima, muore con "Address already in
// use" e la finestra resta senza backend: l'app sembra rotta a caso e l'utente lo
// scopre solo al primo Check Query.
// Il toggle GPU non ne soffre: la vecchia istanza rilascia il lock uscendo, prima
// che quella rilanciata arrivi a chiederlo (verificato).
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log("Another instance of FGTD is already running. Exiting this one.");
  app.quit();
  return;
}

// Seconda istanza tentata: invece di aprirne una monca, riporta in primo piano
// la finestra gia' aperta.
app.on('second-instance', () => {
  const [existingWindow] = BrowserWindow.getAllWindows();
  if (existingWindow) {
    if (existingWindow.isMinimized()) existingWindow.restore();
    existingWindow.show();
    existingWindow.focus();
  }
});

// -----------------------------------------------------------------------------
// 2. ROBUST KILL FUNCTION (Promise + Timeout)
// -----------------------------------------------------------------------------

function killBackendWithPromise() {
    return new Promise((resolve) => {
        if (!backendProcess || !backendProcess.pid) {
            isBackendRunning = false;
            resolve();
            return;
        }

        console.log(`[Kill] Sending SIGKILL to tree PID: ${backendProcess.pid}...`);
        
        const safetyTimeout = setTimeout(() => {
            console.error("[Kill] Timeout reached! Forcing resolution.");
            backendProcess = null;
            isBackendRunning = false;
            resolve();
        }, 3000);

        treeKill(backendProcess.pid, 'SIGKILL', (err) => {
            clearTimeout(safetyTimeout); 
            if (err) {
                console.error(`[Kill] Error killing backend: ${err.message}`);
            } else {
                console.log("[Kill] Backend tree killed successfully.");
            }
            backendProcess = null;
            isBackendRunning = false;
            resolve();
        });
    });
}



function createAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [ 
        { 
            label: 'Open Data Folder',
            click: async () => { await shell.openPath(userDataPath); }
        },
        { type: 'separator' },
        { role: 'quit' } 
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, 
        { role: 'forceReload' }, 
        { role: 'toggleDevTools' },
        { type: 'separator' }, 
        {
            label: 'Factory Reset (Clear Cache)',
            click: async () => {
                const choice = dialog.showMessageBoxSync({
                    type: 'warning',
                    buttons: ['Yes, Clear & Restart', 'Cancel'],
                    title: 'Confirm Reset',
                    message: 'This will clear the application cache.',
                    detail: 'The application needs to restart to apply this change, If the application does not restart automatically,or if an empty window should open, please reopen it manually to apply the changes.'
                });
                
                if (choice === 0) {
                    console.log("Clearing cache...");
                    await session.defaultSession.clearCache();
                    
                    console.log("Killing backend before reset...");
                    isQuitting = true; 
                    await killBackendWithPromise(); 
                    console.log("Relaunching app...");
                    restartApp();
                }
            }
        },
        { type: 'separator' }, 
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, 
        { type: 'separator' }, { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [ { role: 'minimize' }, { role: 'close' } ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: async () => {
            await dialog.showMessageBox({
              title: 'About',
              message: 'App v1.0',
              detail: 'Electron + Python Backend (AppImage Mode)'
            });
          }
        },
        {
            label: 'Report an Issue',
            click: async () => {
                await shell.openExternal('https://github.com/SorenKK/FGTD'); 
            }
        },
        { type: 'separator' },
        {
          label: 'Troubleshooting / Rendering Issues', 
          click: async () => {
            await dialog.showMessageBox({
              type: 'info',
              title: 'Troubleshooting',
              message: 'Having display problems?',
              detail: 'If you experience white screens, flickering, or loading errors, try disabling "Hardware Acceleration" in the "GPU?" menu above.'
            });
          }
        }
      ]
    },
    {
      label: 'GPU?',
      submenu: [
        {
            label: 'NOTE: Change this setting only if you',
            enabled: false 
        },
        {
            label: 'experience rendering errors or blank screens.',
            enabled: false
        },
        { type: 'separator' },
        {
          label: 'Enable Hardware Acceleration',
          type: 'checkbox',
          checked: currentSettings.enableGpu,
          click: () => toggleGpuSetting()
        },
        { type: 'separator' },
        {
            label: currentSettings.enableGpu ? 'Status: Active' : 'Status: Disabled (Safe Mode)',
            enabled: false
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function toggleGpuSetting() {
  const newState = !currentSettings.enableGpu;
  const stateText = newState ? "ENABLED" : "DISABLED";

  const choice = dialog.showMessageBoxSync({
    type: 'question',
    buttons: ['Restart Now', 'Cancel'],
    defaultId: 0,
    title: 'Restart Required',
    message: `You have set GPU Acceleration to: ${stateText}`,
    detail: 'The application needs to restart to apply this change, If the application does not restart automatically,or if an empty window should open, please reopen it manually to apply the hardware acceleration changes.'
  });

  if (choice === 0) {
    currentSettings.enableGpu = newState;
    try {
      fs.writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 2));
    } catch (e) {
      console.error("Error saving settings:", e);
    }
    
    console.log("Preparing to restart...");
    isQuitting = true; 
    await killBackendWithPromise();
    console.log("Relaunching app now.");
    restartApp();
  } else {
    createAppMenu(); 
  }
}

// -----------------------------------------------------------------------------
// IPC HANDLERS
// -----------------------------------------------------------------------------

ipcMain.handle('choose-save-location', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Excel File',
    defaultPath: 'filtered_table.xlsx',
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
  });
  return canceled ? null : filePath;
});

// Ambiente passato al backend Python.
// Il backend non puo' dedurre da solo dove electron-builder ha messo le risorse,
// quindi glielo diciamo: cosi' lo stesso codice funziona in sviluppo e dentro
// l'AppImage, e l'utente finale non deve installare né scaricare nulla.
// FGTD_HEADLESS=1 garantisce che in produzione non compaia mai una finestra
// Chrome; per il debug si lancia l'app con FGTD_HEADLESS=0 nell'ambiente.
function backendEnv() {
  const vendorPath = isDev
    ? path.join(__dirname, 'backend', 'vendor')
    : path.join(process.resourcesPath, 'backend', 'vendor');

  if (!fs.existsSync(vendorPath)) {
    console.warn(`[Backend] Chrome imbarcato non trovato in ${vendorPath}.`);
    console.warn('[Backend] In sviluppo, lancia: tools/fetch_chrome.sh');
  } else {
    console.log('[Backend] Chrome imbarcato:', vendorPath);
  }

  return {
    ...process.env,
    FGTD_VENDOR_DIR: vendorPath,
    FGTD_HEADLESS: process.env.FGTD_HEADLESS || '1',
  };
}

function startBackend() {
  console.log('--- Starting Backend (APPIMAGE MODE) ---');
  if (isBackendRunning) {
    console.log('Backend already online.');
    return;
  }

  const basePath = isDev
    ? path.join(__dirname, "backend", "Backend-x86_64.AppImage")
    : path.join(process.resourcesPath, "backend", "Backend-x86_64.AppImage");

  console.log('Backend path:', basePath);

  try {
      if (!fs.existsSync(basePath)) {
          throw new Error(`AppImage not found at: ${basePath}`);
      }
      try {
          fs.chmodSync(basePath, '755'); 
          console.log("Permissions set to 755 for backend.");
      } catch (permErr) {
          console.error("Warning: Could not set permissions on backend:", permErr,"Check whether Backend-x86_64.AppImage has execute permissions enabled.");
      }

      backendProcess = spawn(basePath, [], {
        stdio: 'inherit',
        detached: false,
        windowsHide: true,
        shell: false,
        env: backendEnv()
      });

      backendProcess.on('error', (error) => {
        console.error(`Error during backend launch: ${error.message}`);
        dialog.showErrorBox("Backend Error", "Failed to start AppImage backend.\n" + error.message);
      });

      backendProcess.on('exit', (code, signal) => {
        console.log(`Backend terminated with code ${code} and signal ${signal}`);
        isBackendRunning = false;
        backendProcess = null;
      });

      isBackendRunning = true;
      console.log('Backend started with PID:', backendProcess.pid);
  } catch (e) {
      console.error("CRITICAL: Failed to spawn backend process:", e);
      dialog.showErrorBox("Backend Launch Error", e.message);
  }
}

function startBackend1() {
  console.log('--- Starting Backend (PYTHON SCRIPT MODE) ---');
  if (isBackendRunning) {
    console.log('Backend already online.');
    return;
  }

  const pythonExecutable = path.join(__dirname, 'venv', 'bin', 'python'); // Usa 'python3' o adatta il path al tuo venv
  const scriptPath = path.join(__dirname, 'backend','app.py'); 

  console.log('Python executable path:', pythonExecutable);
  console.log('Script path:', scriptPath);

  try {
      if (!fs.existsSync(scriptPath)) {
          throw new Error(`app.py not found at: ${scriptPath}`);
      }

      backendProcess = spawn(pythonExecutable, [scriptPath], {
        stdio: 'inherit',
        detached: false,
        shell: false,
        env: backendEnv()
      });

      backendProcess.on('error', (error) => {
        console.error(`Error during python backend launch: ${error.message}`);
        dialog.showErrorBox("Backend Error", "Failed to start Python script.\n" + error.message);
      });

      backendProcess.on('exit', (code, signal) => {
        console.log(`Python Backend terminated with code ${code} and signal ${signal}`);
        isBackendRunning = false;
        backendProcess = null;
      });

      isBackendRunning = true;
      console.log('Python Backend started with PID:', backendProcess.pid);
  } catch (e) {
      console.error("CRITICAL: Failed to spawn python backend process:", e);
      dialog.showErrorBox("Backend Launch Error", e.message);
  }
}

// -----------------------------------------------------------------------------
// WINDOW & LIFECYCLE
// -----------------------------------------------------------------------------

// shell.openExternal consegna l'URL al sistema operativo, che lo apre con
// l'handler registrato per quello schema. Vanno passati solo http e https:
// file:, javascript: o smb: farebbero aprire risorse locali o eseguire codice
// fuori dal controllo della app.

// Riavvio dell'app. In sviluppo il processo Electron gira sotto concurrently
// insieme al dev server React: qualunque uscita di Electron fa scattare la
// --kill-others e porta giu' anche localhost:3000, quindi il processo riaperto da
// app.relaunch() troverebbe il frontend morto e mostrerebbe una finestra bianca.
// Nell'app impacchettata (AppImage/deb) non c'e' nessun supervisore e il relaunch
// e' la cosa giusta.
function restartApp() {
  if (isDev) {
    console.log("Dev mode: relaunch skipped. Restart manually with npm run start.");
    dialog.showMessageBoxSync({
      type: "info",
      title: "Restart required",
      message: "Settings saved.",
      detail: "Running in development mode: close this window and start the app again with npm run start to apply the change."
    });
    return;
  }
  app.relaunch();
  // app.exit() termina il processo subito, saltando il ciclo before-quit/will-quit
  // dentro cui Electron esegue il relaunch registrato sopra: l'app moriva senza
  // riaprirsi. app.quit() percorre il ciclo e fa scattare il riavvio.
  app.quit();
}

function openExternalIfSafe(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (e) {
    console.warn('Blocked malformed external URL:', rawUrl);
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    console.warn('Blocked non-http external URL:', rawUrl);
    return false;
  }
  shell.openExternal(rawUrl);
  return true;
}

// L'interfaccia della app: localhost:3000 in sviluppo, il file buildato in
// produzione. Tutto il resto e' esterno.
function isInternalUrl(rawUrl) {
  if (isDev) return rawUrl.startsWith('http://localhost:3000');
  return rawUrl.startsWith('file://');
}

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

  // I link della UI (GEO, PubMed, NCBI, GitHub) usano window.open e
  // target="_blank". Senza handler Electron apriva una propria finestra, senza
  // barra indirizzi ne' cronologia: vanno consegnati al browser dell'utente.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalIfSafe(url);
    return { action: 'deny' };
  });

  // Stesso discorso per un link che prova a navigare nella finestra corrente:
  // rimpiazzerebbe l'interfaccia con la pagina esterna, senza modo di tornare
  // indietro.
  win.webContents.on('will-navigate', (event, url) => {
    if (isInternalUrl(url)) return;
    event.preventDefault();
    openExternalIfSafe(url);
  });

  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    const indexPath = path.join(__dirname, 'frontend', 'build', 'index.html');
    win.loadFile(indexPath).catch(err => console.error(err));
  }
}

app.whenReady().then(() => {
  createAppMenu();
  startBackend(); 
  createWindow();
});

// FINAL CLEANUP HANDLER
app.on('before-quit', async (event) => {
    if (isQuitting) return;

    if (backendProcess) {
        console.log('App closing: Cleaning up backend...');
        event.preventDefault(); 
        isQuitting = true;      
        
        await killBackendWithPromise();
        
        console.log('Cleanup finished. Exiting Electron.');
        app.exit(0); 
    }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});