const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
const configPath = path.join(app.getPath('userData'), 'notestack-config.json');

// Helper to get saved main directory from config
function getSavedConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading saved config:", err);
  }
  return {};
}

// Helper to save main directory config
function saveConfig(config) {
  try {
    const existing = getSavedConfig();
    const merged = { ...existing, ...config };
    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf8');
  } catch (err) {
    console.error("Error saving config:", err);
  }
}

// Recursive directory scanner for Node.js fs
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
        else if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'html', 'css', 'json'].includes(ext)) fileType = 'code';

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
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// IPC Handlers
ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Main Collection Directory for NoteStack'
  });
  if (canceled || filePaths.length === 0) return null;
  const dirPath = filePaths[0];
  const dirName = path.basename(dirPath);

  saveConfig({ mainDirPath: dirPath, mainDirName: dirName });

  const scan = scanDirectoryRecursively(dirPath, dirName);
  return {
    name: dirName,
    path: dirPath,
    subDirectories: scan.subDirs,
    files: scan.files
  };
});

ipcMain.handle('fs:scanDirectory', async (_, dirPath) => {
  if (!dirPath || !fs.existsSync(dirPath)) return null;
  const dirName = path.basename(dirPath);
  const scan = scanDirectoryRecursively(dirPath, dirName);
  return {
    name: dirName,
    path: dirPath,
    subDirectories: scan.subDirs,
    files: scan.files
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
    const fullPath = path.join(parentPath, fileName);
    fs.writeFileSync(fullPath, content, 'utf8');
    const stats = fs.statSync(fullPath);
    return {
      id: `file-${fullPath}-${Date.now()}`,
      name: fileName,
      path: `/${fileName}`,
      fullPath,
      type: 'md',
      extension: 'md',
      size: stats.size,
      lastModified: stats.mtimeMs,
      content
    };
  } catch (err) {
    console.error(`Failed to create new file in ${parentPath}:`, err);
    return null;
  }
});

ipcMain.handle('config:getSavedDir', async () => {
  const cfg = getSavedConfig();
  if (cfg.mainDirPath && fs.existsSync(cfg.mainDirPath)) {
    const scan = scanDirectoryRecursively(cfg.mainDirPath, cfg.mainDirName);
    return {
      name: cfg.mainDirName || path.basename(cfg.mainDirPath),
      path: cfg.mainDirPath,
      subDirectories: scan.subDirs,
      files: scan.files
    };
  }
  return null;
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
