const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
  scanDirectory: (dirPath) => ipcRenderer.invoke('fs:scanDirectory', dirPath),
  readFileText: (filePath) => ipcRenderer.invoke('fs:readFileText', filePath),
  readFileBuffer: (filePath) => ipcRenderer.invoke('fs:readFileBuffer', filePath),
  writeFileText: (filePath, content) => ipcRenderer.invoke('fs:writeFileText', { filePath, content }),
  createNewFile: (parentPath, fileName, content) => ipcRenderer.invoke('fs:createNewFile', { parentPath, fileName, content }),
  getSavedDirectory: () => ipcRenderer.invoke('config:getSavedDir')
});
