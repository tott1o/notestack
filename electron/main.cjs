const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
const configPath = path.join(app.getPath('userData'), 'notestack-config.json');

let activeWatcher = null;
let watchTimer = null;

function setupVaultWatcher(dirPath) {
  if (activeWatcher) {
    try { activeWatcher.close(); } catch (e) {}
    activeWatcher = null;
  }
  if (!dirPath || !fs.existsSync(dirPath)) return;

  try {
    activeWatcher = fs.watch(dirPath, { recursive: true }, (_eventType, filename) => {
      if (watchTimer) clearTimeout(watchTimer);
      watchTimer = setTimeout(() => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        const dirName = path.basename(dirPath);
        const scan = scanDirectoryRecursively(dirPath, dirName);
        const cfg = getSavedConfig();
        mainWindow.webContents.send('fs:vault-updated', {
          name: dirName,
          path: dirPath,
          subDirectories: scan.subDirs,
          files: scan.files,
          allVaults: cfg.savedVaults || []
        });

        if (filename) {
          const fullPath = path.join(dirPath, filename);
          try {
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
              const ext = path.extname(fullPath).toLowerCase();
              if (['.md', '.markdown', '.txt', '.json', '.js', '.ts', '.py', '.css', '.html', '.csv'].includes(ext)) {
                const content = fs.readFileSync(fullPath, 'utf8');
                mainWindow.webContents.send('fs:file-changed', { fullPath, content });
              }
            }
          } catch (e) {}
        }
      }, 300);
    });
  } catch (err) {
    console.error('Failed to setup directory watcher:', err);
  }
}

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
  const iconPath = path.join(__dirname, '../notestacklogo.ico');
  const appIcon = nativeImage.createFromPath(iconPath);

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 868,
    minWidth: 1000,
    minHeight: 650,
    title: 'NoteStack - Desktop Note & Reference Manager',
    icon: appIcon,
    backgroundColor: '#0b0f19',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  if (process.platform === 'win32') {
    mainWindow.setIcon(appIcon);
  }

  // Intercept new window requests (target="_blank") and open external URLs in default system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Intercept in-app link navigation to prevent overriding NoteStack UI
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      if (process.argv.includes('--dev') && url.startsWith('http://localhost:5173')) {
        return;
      }
      event.preventDefault();
      shell.openExternal(url);
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

ipcMain.handle('shell:openExternalUrl', async (_, url) => {
  try {
    if (url && (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:'))) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`Failed to open external URL ${url}:`, err);
    return false;
  }
});

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
  setupVaultWatcher(dirPath);

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
  setupVaultWatcher(dirPath);

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

    const cfg = getSavedConfig();
    let relPath = fileName;
    if (cfg.activePath && fullPath.startsWith(cfg.activePath)) {
      relPath = fullPath.substring(cfg.activePath.length).replace(/\\/g, '/');
      if (!relPath.startsWith('/')) relPath = '/' + relPath;
    } else {
      relPath = '/' + fileName;
    }
    
    const extParts = fileName.split('.');
    const ext = extParts.length > 1 ? extParts.pop().toLowerCase() : '';
    let fileType = 'other';
    if (['md', 'markdown', 'txt'].includes(ext)) fileType = 'md';
    else if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'html', 'css', 'json', 'rs', 'go', 'sh', 'sql'].includes(ext)) fileType = 'code';
    else if (ext === 'csv') fileType = 'csv';

    return {
      id: `file-${relPath}`,
      name: fileName,
      path: relPath,
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
    setupVaultWatcher(cfg.activePath);
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
    setupVaultWatcher(firstVault.path);
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

const os = require('os');
const http = require('http');
const url = require('url');

let embeddedServer = null;
const openSockets = new Set();
let embeddedServerInfo = {
  active: false,
  port: 3000,
  localUrl: 'http://localhost:3000',
  networkUrl: null
};

function getLocalIpAddress() {
  try {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
      const iface = interfaces[devName];
      for (let i = 0; i < iface.length; i++) {
        const alias = iface[i];
        if (alias.family === 'IPv4' && !alias.internal && alias.address !== '127.0.0.1') {
          return alias.address;
        }
      }
    }
  } catch (e) {}
  return 'localhost';
}

function stopEmbeddedServer() {
  if (!embeddedServer) return;
  try {
    for (const socket of openSockets) {
      try {
        socket.destroy();
      } catch (_) {}
    }
    openSockets.clear();
    embeddedServer.close(() => {
      console.log('Embedded server closed cleanly.');
    });
  } catch (err) {
    console.error('Error stopping embedded server:', err);
  } finally {
    embeddedServer = null;
    embeddedServerInfo.active = false;
  }
}

function startEmbeddedServer(port = 3000) {
  if (embeddedServer) return embeddedServerInfo;

  const distDir = path.join(__dirname, '../dist');
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.wasm': 'application/wasm',
    '.pdf': 'application/pdf',
    '.md': 'text/markdown',
    '.txt': 'text/plain'
  };

  try {
    embeddedServer = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url, true);
      const pathname = parsedUrl.pathname;

      // Enable CORS for all local network requests
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // REST API: Server Status
      if (pathname === '/api/status') {
        const cfg = getSavedConfig();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ...embeddedServerInfo,
          activeVault: cfg.activePath || null,
          savedVaultsCount: (cfg.savedVaults || []).length
        }));
        return;
      }

      // REST API: Active Vault Directory Tree
      if (pathname === '/api/vault/tree') {
        const cfg = getSavedConfig();
        const activeVaultPath = cfg.activePath;
        if (!activeVaultPath || !fs.existsSync(activeVaultPath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No active vault loaded on desktop' }));
          return;
        }

        try {
          const files = scanDirectoryRecursive(activeVaultPath);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ vaultPath: activeVaultPath, files }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // REST API: Read File Content
      if (pathname === '/api/vault/read') {
        const targetPath = parsedUrl.query.path;
        if (!targetPath || typeof targetPath !== 'string' || !fs.existsSync(targetPath)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File path invalid or does not exist' }));
          return;
        }

        try {
          const ext = path.extname(targetPath).toLowerCase();
          const contentType = mimeTypes[ext] || 'application/octet-stream';
          const stat = fs.statSync(targetPath);
          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': stat.size,
            'Cache-Control': 'no-cache'
          });
          fs.createReadStream(targetPath).pipe(res);
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // REST API: Write/Update File Content
      if (pathname === '/api/vault/write' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (!data.path || data.content === undefined) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing path or content' }));
              return;
            }
            fs.writeFileSync(data.path, data.content, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      // Serve Static Web Assets with SPA fallback
      let reqPath = pathname === '/' ? 'index.html' : pathname;
      let filePath = path.join(distDir, reqPath);

      if (!fs.existsSync(filePath) || (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory())) {
        filePath = path.join(distDir, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      fs.stat(filePath, (statErr, stat) => {
        if (statErr || !stat.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
          return;
        }

        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stat.size,
          'Cache-Control': 'no-cache'
        });

        fs.createReadStream(filePath).pipe(res);
      });
    });

    // Track active connection sockets for clean shutdown
    embeddedServer.on('connection', (socket) => {
      openSockets.add(socket);
      socket.on('close', () => openSockets.delete(socket));
    });

    embeddedServer.on('error', (e) => {
      if (e.code === 'EADDRINUSE' && port < 3020) {
        console.log(`Port ${port} in use, retrying embedded server on ${port + 1}...`);
        embeddedServer = null;
        startEmbeddedServer(port + 1);
      }
    });

    embeddedServer.listen(port, '0.0.0.0', () => {
      const ip = getLocalIpAddress();
      embeddedServerInfo = {
        active: true,
        port: port,
        localUrl: `http://localhost:${port}`,
        networkUrl: `http://${ip}:${port}`
      };
      console.log(`\n🚀 NoteStack Live Embedded Server Active!`);
      console.log(`➜ Local access:   ${embeddedServerInfo.localUrl}`);
      console.log(`➜ Network access: ${embeddedServerInfo.networkUrl}\n`);
    });
  } catch (err) {
    console.error('Failed to start embedded server:', err);
  }

  return embeddedServerInfo;
}

ipcMain.handle('server:getStatus', async () => {
  if (!embeddedServerInfo.active) {
    startEmbeddedServer();
  }
  return embeddedServerInfo;
});

ipcMain.handle('config:saveVaultList', async (_, vaults) => {
  saveConfig({ savedVaults: vaults });
  return true;
});

ipcMain.handle('config:removeSavedVault', async (_, vaultPath) => {
  const cfg = getSavedConfig();
  const updatedVaults = (cfg.savedVaults || []).filter(v => v.path !== vaultPath);
  let activePath = cfg.activePath;
  if (activePath === vaultPath) {
    activePath = updatedVaults.length > 0 ? updatedVaults[0].path : null;
  }
  saveConfig({ savedVaults: updatedVaults, activePath });
  return { updatedVaults, activePath };
});

app.whenReady().then(() => {
  createWindow();
  startEmbeddedServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  stopEmbeddedServer();
});

app.on('will-quit', () => {
  stopEmbeddedServer();
});

app.on('window-all-closed', () => {
  stopEmbeddedServer();
  if (process.platform !== 'darwin') app.quit();
});
