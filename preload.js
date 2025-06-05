const { contextBridge, ipcRenderer } = require('electron');

// Espone funzioni sicure al renderer
contextBridge.exposeInMainWorld('electronAPI', {
  startBackend: () => ipcRenderer.send('start-backend'),
  stopBackend: () => ipcRenderer.send('stop-backend'),
  openFileDialog: async () => ipcRenderer.invoke('dialog:openFile'),
  saveFileDialog: async (data) => ipcRenderer.invoke('dialog:saveFile', data),
});
