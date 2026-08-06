const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
  scanDirectory: (dirPath) => ipcRenderer.invoke('fs:scanDirectory', dirPath),
  readFileText: (filePath) => ipcRenderer.invoke('fs:readFileText', filePath),
  readFileBuffer: (filePath) => ipcRenderer.invoke('fs:readFileBuffer', filePath),
  writeFileText: (filePath, content) => ipcRenderer.invoke('fs:writeFileText', { filePath, content }),
  createNewFile: (parentPath, fileName, content) => ipcRenderer.invoke('fs:createNewFile', { parentPath, fileName, content }),
  createNewFolder: (parentPath, folderName) => ipcRenderer.invoke('fs:createNewFolder', { parentPath, folderName }),
  openExternalFile: (filePath) => ipcRenderer.invoke('fs:openExternalFile', filePath),
  deleteItem: (itemPath) => ipcRenderer.invoke('fs:deleteItem', itemPath),
  renameItem: (oldPath, newName) => ipcRenderer.invoke('fs:renameItem', { oldPath, newName }),
  openExternalUrl: (url) => ipcRenderer.invoke('shell:openExternalUrl', url),
  getSavedDirectory: () => ipcRenderer.invoke('config:getSavedDirectory'),
  saveVaultList: (vaults) => ipcRenderer.invoke('config:saveVaultList', vaults),
  removeSavedVault: (vaultPath) => ipcRenderer.invoke('config:removeSavedVault', vaultPath)
});
