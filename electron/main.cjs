const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
const configPath = path.join(app.getPath('userData'), 'notestack-config.json');

function getSavedConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading saved config:", err);
  }
  return { savedVaults: [], activePath: null };
}

function saveConfig(config) {
  try {
    const existing = getSavedConfig();
    const merged = { ...existing, ...config };
    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf8');
  } catch (err) {
    console.error("Error saving config:", err);
  }
}

function scanDirectoryRecursively(dirPath, moduleName = '', currentRelPath = '') {
  const result = {
    subDirs: [],
    files: []
  };

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.join(currentRelPath, entry.name).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        result.subDirs.push(entry.name);
        const subScan = scanDirectoryRecursively(fullPath, entry.name, relPath);
        result.subDirs.push(...subScan.subDirs);
        
        result.files.push({
          id: `dir-${relPath}`,
          name: entry.name,
          path: `/${relPath}`,
          fullPath,
          type: 'folder',
          extension: '',
          moduleName: entry.name,
          children: subScan.files
        });
      } else if (entry.isFile()) {
        const extParts = entry.name.split('.');
        const ext = extParts.length > 1 ? extParts.pop().toLowerCase() : '';
        let fileType = 'other';

        if (['md', 'markdown', 'txt'].includes(ext)) fileType = 'md';
        else if (ext === 'pdf') fileType = 'pdf';
        else if (['docx', 'doc'].includes(ext)) fileType = 'docx';
        else if (['pptx', 'ppt', 'ppsx', 'pps', 'pptm', 'potx', 'pot', 'potm', 'odp'].includes(ext)) fileType = 'pptx';
        else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) fileType = 'image';
        else if (['mp4', 'webm', 'ogv', 'mov', 'mkv'].includes(ext)) fileType = 'video';
        else if (ext === 'csv') fileType = 'csv';
        else if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'html', 'css', 'json', 'rs', 'go', 'sh', 'sql', 'xml', 'yaml'].includes(ext)) fileType = 'code';

        const stats = fs.statSync(fullPath);

        result.files.push({
          id: `file-${relPath}`,
          name: entry.name,
          path: `/${relPath}`,
          fullPath,
          type: fileType,
          extension: ext,
          size: stats.size,
          lastModified: stats.mtimeMs,
          moduleName: moduleName || path.basename(dirPath),
          tags: [ext, (moduleName || path.basename(dirPath)).toLowerCase()]
        });
      }
    }
  } catch (err) {
    console.error(`Error scanning directory ${dirPath}:`, err);
  }

  return result;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 868,
    minWidth: 1000,
    minHeight: 650,
    title: 'NoteStack - Desktop Note & Reference Manager',
    backgroundColor: '#0b0f19',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  const indexPath = path.join(__dirname, '../dist/index.html');
  
  if (process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(indexPath).catch(err => {
      console.error("Failed to load dist/index.html:", err);
    });
  }
}

ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Main Collection Directory for NoteStack'
  });
  if (canceled || filePaths.length === 0) return null;
  const dirPath = filePaths[0];
  const dirName = path.basename(dirPath);

  const cfg = getSavedConfig();
  const vaults = cfg.savedVaults || [];
  
  const existingIdx = vaults.findIndex(v => v.path === dirPath);
  const scan = scanDirectoryRecursively(dirPath, dirName);
  const newVaultEntry = {
    name: dirName,
    path: dirPath,
    fileCount: scan.files.length,
    lastOpened: Date.now()
  };

  if (existingIdx >= 0) {
    vaults[existingIdx] = newVaultEntry;
  } else {
    vaults.push(newVaultEntry);
  }

  saveConfig({ activePath: dirPath, savedVaults: vaults });

  return {
    name: dirName,
    path: dirPath,
    subDirectories: scan.subDirs,
    files: scan.files,
    allVaults: vaults
  };
});

ipcMain.handle('fs:scanDirectory', async (_, dirPath) => {
  if (!dirPath || !fs.existsSync(dirPath)) return null;
  const dirName = path.basename(dirPath);
  const scan = scanDirectoryRecursively(dirPath, dirName);
  
  const cfg = getSavedConfig();
  saveConfig({ activePath: dirPath });

  return {
    name: dirName,
    path: dirPath,
    subDirectories: scan.subDirs,
    files: scan.files,
    allVaults: cfg.savedVaults || []
  };
});

ipcMain.handle('fs:readFileText', async (_, filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`Failed to read file ${filePath}:`, err);
    return null;
  }
});

ipcMain.handle('fs:readFileBuffer', async (_, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  } catch (err) {
    console.error(`Failed to read binary buffer ${filePath}:`, err);
    return null;
  }
});

ipcMain.handle('fs:writeFileText', async (_, { filePath, content }) => {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch (err) {
    console.error(`Failed to write file ${filePath}:`, err);
    return false;
  }
});

ipcMain.handle('fs:createNewFile', async (_, { parentPath, fileName, content }) => {
  try {
    if (!fs.existsSync(parentPath)) {
      fs.mkdirSync(parentPath, { recursive: true });
    }
    const fullPath = path.join(parentPath, fileName);
    fs.writeFileSync(fullPath, content, 'utf8');
    const stats = fs.statSync(fullPath);
    
    const extParts = fileName.split('.');
    const ext = extParts.length > 1 ? extParts.pop().toLowerCase() : '';
    let fileType = 'other';
    if (['md', 'markdown', 'txt'].includes(ext)) fileType = 'md';
    else if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'html', 'css', 'json', 'rs', 'go', 'sh', 'sql'].includes(ext)) fileType = 'code';
    else if (ext === 'csv') fileType = 'csv';

    return {
      id: `file-${fullPath}-${Date.now()}`,
      name: fileName,
      path: `/${fileName}`,
      fullPath,
      type: fileType,
      extension: ext,
      size: stats.size,
      lastModified: stats.mtimeMs,
      content
    };
  } catch (err) {
    console.error(`Failed to create new file in ${parentPath}:`, err);
    return null;
  }
});

ipcMain.handle('fs:createNewFolder', async (_, { parentPath, folderName }) => {
  try {
    const fullPath = path.join(parentPath, folderName);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    return {
      id: `dir-${fullPath}`,
      name: folderName,
      path: `/${folderName}`,
      fullPath,
      type: 'folder',
      extension: '',
      moduleName: folderName,
      children: []
    };
  } catch (err) {
    console.error(`Failed to create new folder in ${parentPath}:`, err);
    return null;
  }
});

ipcMain.handle('config:getSavedDirectory', async () => {
  const cfg = getSavedConfig();
  const vaults = cfg.savedVaults || [];
  let currentDir = null;

  if (cfg.activePath && fs.existsSync(cfg.activePath)) {
    const dirName = path.basename(cfg.activePath);
    const scan = scanDirectoryRecursively(cfg.activePath, dirName);
    currentDir = {
      name: dirName,
      path: cfg.activePath,
      subDirectories: scan.subDirs,
      files: scan.files,
      allVaults: vaults
    };
  } else if (vaults.length > 0 && fs.existsSync(vaults[0].path)) {
    const firstVault = vaults[0];
    const dirName = firstVault.name;
    const scan = scanDirectoryRecursively(firstVault.path, dirName);
    currentDir = {
      name: dirName,
      path: firstVault.path,
      subDirectories: scan.subDirs,
      files: scan.files,
      allVaults: vaults
    };
  }

  return {
    current: currentDir,
    allVaults: vaults
  };
});

ipcMain.handle('fs:openExternalFile', async (_, filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      const result = await shell.openPath(filePath);
      return result;
    }
    return 'File does not exist';
  } catch (err) {
    console.error(`Failed to open external file ${filePath}:`, err);
    return err.message;
  }
});

ipcMain.handle('fs:deleteItem', async (_, itemPath) => {
  try {
    if (itemPath && fs.existsSync(itemPath)) {
      const stats = fs.statSync(itemPath);
      if (stats.isDirectory()) {
        fs.rmSync(itemPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(itemPath);
      }
      return true;
    }
    return false;
  } catch (err) {
    console.error(`Failed to delete item at ${itemPath}:`, err);
    return false;
  }
});

ipcMain.handle('fs:renameItem', async (_, { oldPath, newName }) => {
  try {
    if (oldPath && fs.existsSync(oldPath) && newName && newName.trim()) {
      const dir = path.dirname(oldPath);
      const newPath = path.join(dir, newName.trim());
      if (oldPath !== newPath) {
        fs.renameSync(oldPath, newPath);
      }
      return { success: true, newPath, newName: newName.trim() };
    }
    return { success: false, error: 'Item path does not exist or invalid name' };
  } catch (err) {
    console.error(`Failed to rename item at ${oldPath}:`, err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('config:saveVaultList', async (_, vaults) => {
  saveConfig({ savedVaults: vaults });
  return true;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
