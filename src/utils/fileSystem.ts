import type { FileItem, FileType, MainDirectory, MainDirectorySummary } from '../types';
import { EMPTY_MAIN_DIRECTORY } from './sampleData';
import { get as idbGet, set as idbSet } from 'idb-keyval';

const IDB_VAULTS_KEY = 'notestack_saved_vault_handles';
const IDB_ACTIVE_PATH_KEY = 'notestack_active_vault_path';

export function getFileType(fileName: string): { type: FileType; extension: string } {
  const parts = fileName.split('.');
  if (parts.length === 1) return { type: 'other', extension: '' };
  const ext = parts.pop()!.toLowerCase();
  
  if (ext === 'md' || ext === 'markdown') {
    return { type: 'md', extension: ext };
  } else if (ext === 'pdf') {
    return { type: 'pdf', extension: ext };
  } else if (ext === 'docx' || ext === 'doc') {
    return { type: 'docx', extension: ext };
  } else if (['pptx', 'ppt', 'ppsx', 'pps', 'pptm', 'potx', 'pot', 'potm', 'odp'].includes(ext)) {
    return { type: 'pptx', extension: ext };
  } else if (ext === 'csv') {
    return { type: 'csv', extension: ext };
  } else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) {
    return { type: 'image', extension: ext };
  } else if (['mp4', 'webm', 'ogv', 'mov', 'mkv', 'avi'].includes(ext)) {
    return { type: 'video', extension: ext };
  } else if ([
    'py', 'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'java', 'js', 'jsx', 'ts', 'tsx', 
    'html', 'css', 'json', 'txt', 'rs', 'go', 'sh', 'bash', 'sql', 'xml', 'yaml', 'yml', 'ini', 'log'
  ].includes(ext)) {
    return { type: 'code', extension: ext };
  }
  return { type: 'other', extension: ext };
}

export async function getSavedMainDirectoryOnLaunch(): Promise<MainDirectory | null> {
  if (window.electronAPI?.getSavedDirectory) {
    try {
      const res = await window.electronAPI.getSavedDirectory();
      if (res && res.current) {
        return {
          ...res.current,
          allVaults: res.allVaults || []
        };
      }
    } catch (err) {
      console.error("Error retrieving Electron saved dir:", err);
    }
  }

  try {
    const savedHandles = await idbGet<Array<{ name: string; path: string; handle: FileSystemDirectoryHandle }>>(IDB_VAULTS_KEY) || [];
    const activePath = await idbGet<string>(IDB_ACTIVE_PATH_KEY);

    if (savedHandles.length > 0) {
      const target = savedHandles.find(h => h.path === activePath) || savedHandles[0];
      const status = await (target.handle as any).queryPermission({ mode: 'readwrite' });
      if (status === 'granted' || status === 'prompt') {
        const subDirs: string[] = [];
        const files: FileItem[] = [];
        await scanDirectoryHandle(target.handle, target.name, '', subDirs, files);
        
        const vaultSummaries: MainDirectorySummary[] = savedHandles.map(h => ({
          name: h.name,
          path: h.path,
          fileCount: 0
        }));

        return {
          name: target.name,
          path: target.path,
          handle: target.handle,
          subDirectories: subDirs,
          files,
          allVaults: vaultSummaries
        };
      }
    }
  } catch (err) {
    console.error("Error retrieving IndexedDB directory handles:", err);
  }

  return null;
}

export async function openMainDirectoryFromDisk(switchPath?: string): Promise<MainDirectory | null> {
  if (window.electronAPI?.openDirectoryDialog && !switchPath) {
    return await window.electronAPI.openDirectoryDialog();
  } else if (window.electronAPI?.scanDirectory && switchPath) {
    return await window.electronAPI.scanDirectory(switchPath);
  }

  if (!('showDirectoryPicker' in window) && !switchPath) {
    alert("Your browser doesn't support direct local directory picker.");
    return EMPTY_MAIN_DIRECTORY;
  }

  try {
    let dirHandle: FileSystemDirectoryHandle;
    const existingHandles = await idbGet<Array<{ name: string; path: string; handle: FileSystemDirectoryHandle }>>(IDB_VAULTS_KEY) || [];

    if (switchPath) {
      const found = existingHandles.find(h => h.path === switchPath);
      if (found) {
        dirHandle = found.handle;
      } else {
        dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      }
    } else {
      dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    }

    const dirPath = `/${dirHandle.name}`;
    const updatedHandles = existingHandles.filter(h => h.path !== dirPath);
    updatedHandles.push({ name: dirHandle.name, path: dirPath, handle: dirHandle });

    await idbSet(IDB_VAULTS_KEY, updatedHandles);
    await idbSet(IDB_ACTIVE_PATH_KEY, dirPath);

    const subDirs: string[] = [];
    const files: FileItem[] = [];

    await scanDirectoryHandle(dirHandle, dirHandle.name, '', subDirs, files);

    const vaultSummaries: MainDirectorySummary[] = updatedHandles.map(h => ({
      name: h.name,
      path: h.path,
      fileCount: 0
    }));

    return {
      name: dirHandle.name,
      path: dirPath,
      handle: dirHandle,
      subDirectories: subDirs,
      files,
      allVaults: vaultSummaries
    };
  } catch (err: any) {
    if (err.name === 'AbortError') return null;
    console.error("Error selecting directory:", err);
    throw err;
  }
}

async function scanDirectoryHandle(
  dirHandle: any,
  moduleName: string,
  currentPath: string,
  subDirs: string[],
  fileList: FileItem[]
) {
  for await (const entry of dirHandle.values()) {
    const entryPath = `${currentPath}/${entry.name}`;

    if (entry.kind === 'directory') {
      subDirs.push(entry.name);
      const childFiles: FileItem[] = [];
      await scanDirectoryHandle(entry, entry.name, entryPath, subDirs, childFiles);
      
      fileList.push({
        id: `dir-${entryPath}`,
        name: entry.name,
        path: entryPath,
        type: 'folder',
        extension: '',
        moduleName: entry.name,
        handle: entry,
        children: childFiles
      });
    } else if (entry.kind === 'file') {
      const file = await entry.getFile();
      const { type, extension } = getFileType(entry.name);
      
      let content: string | undefined;
      let arrayBuffer: ArrayBuffer | undefined;
      let blobUrl: string | undefined;

      if (type === 'md' || type === 'code' || type === 'csv') {
        content = await file.text();
      } else if (type === 'pdf' || type === 'docx' || type === 'image' || type === 'video') {
        arrayBuffer = await file.arrayBuffer();
        blobUrl = URL.createObjectURL(file);
      }

      fileList.push({
        id: `file-${entryPath}`,
        name: entry.name,
        path: entryPath,
        type,
        extension,
        size: file.size,
        lastModified: file.lastModified,
        content,
        arrayBuffer,
        url: blobUrl,
        handle: entry,
        moduleName,
        tags: [extension, moduleName.toLowerCase()]
      });
    }
  }
}

export async function ensureFileContentLoaded(fileItem: FileItem): Promise<FileItem> {
  if (fileItem.content || fileItem.arrayBuffer || fileItem.url) return fileItem;

  if (window.electronAPI && fileItem.fullPath) {
    if (fileItem.type === 'md' || fileItem.type === 'code' || fileItem.type === 'csv') {
      const text = await window.electronAPI.readFileText(fileItem.fullPath);
      if (text !== null) fileItem.content = text;
    } else if (fileItem.type === 'pdf' || fileItem.type === 'docx' || fileItem.type === 'pptx' || fileItem.type === 'image' || fileItem.type === 'video') {
      const buffer = await window.electronAPI.readFileBuffer(fileItem.fullPath);
      if (buffer) {
        fileItem.arrayBuffer = buffer;
        const mime = fileItem.type === 'image' ? `image/${fileItem.extension}` : fileItem.type === 'video' ? `video/${fileItem.extension}` : 'application/octet-stream';
        const blob = new Blob([buffer], { type: mime });
        fileItem.url = URL.createObjectURL(blob);
      }
    }
  } else if (fileItem.handle && 'getFile' in fileItem.handle) {
    try {
      const fileData = await (fileItem.handle as any).getFile();
      if (fileItem.type === 'md' || fileItem.type === 'code' || fileItem.type === 'csv') {
        fileItem.content = await fileData.text();
      } else {
        const buffer = await fileData.arrayBuffer();
        fileItem.arrayBuffer = buffer;
        fileItem.url = URL.createObjectURL(fileData);
      }
    } catch (err) {
      console.error("Error reading file handle in ensureFileContentLoaded:", err);
    }
  }

  return fileItem;
}

export async function saveFileToDisk(fileItem: FileItem, newContent: string): Promise<boolean> {
  if (window.electronAPI?.writeFileText && fileItem.fullPath) {
    const success = await window.electronAPI.writeFileText(fileItem.fullPath, newContent);
    if (success) fileItem.content = newContent;
    return success;
  }

  try {
    if (fileItem.handle && 'createWritable' in fileItem.handle) {
      const writable = await (fileItem.handle as any).createWritable();
      await writable.write(newContent);
      await writable.close();
      fileItem.content = newContent;
      return true;
    } else {
      fileItem.content = newContent;
      return true;
    }
  } catch (err) {
    console.error("Failed to save file to disk:", err);
    fileItem.content = newContent;
    return false;
  }
}

export async function createNewMarkdownFile(
  parentDirectory: MainDirectory,
  fileName: string,
  targetFolderPath?: string
): Promise<FileItem> {
  const isCode = !fileName.endsWith('.md') && fileName.includes('.');
  const cleanName = fileName.trim();
  const initialContent = isCode 
    ? (cleanName.endsWith('.csv') ? 'Column1,Column2,Column3\nValue1,Value2,Value3\n' : `// ${cleanName}\n// Created on ${new Date().toLocaleDateString()}\n\n`)
    : `# ${cleanName.replace('.md', '')}\n\n*Created on ${new Date().toLocaleDateString()}*\n\nType your lecture notes or reference summary here...\n`;

  const cleanFolderPath = targetFolderPath ? targetFolderPath.replace(/^\//, '') : '';

  if (window.electronAPI?.createNewFile) {
    const parentPath = cleanFolderPath 
      ? `${parentDirectory.path}/${cleanFolderPath}`
      : parentDirectory.path;
    const created = await window.electronAPI.createNewFile(parentPath, cleanName, initialContent);
    if (created) return created;
  }

  const path = cleanFolderPath ? `/${cleanFolderPath}/${cleanName}` : `/${cleanName}`;
  const { type, extension } = getFileType(cleanName);

  if (parentDirectory.handle) {
    try {
      let targetDirHandle = parentDirectory.handle;
      if (cleanFolderPath) {
        const parts = cleanFolderPath.split('/');
        for (const p of parts) {
          if (p) targetDirHandle = await targetDirHandle.getDirectoryHandle(p, { create: true });
        }
      }
      const fileHandle = await targetDirHandle.getFileHandle(cleanName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(initialContent);
      await writable.close();

      return {
        id: `file-${path}-${Date.now()}`,
        name: cleanName,
        path,
        type,
        extension,
        content: initialContent,
        handle: fileHandle,
        moduleName: cleanFolderPath || parentDirectory.name,
        lastModified: Date.now(),
        tags: [extension, (cleanFolderPath || parentDirectory.name).toLowerCase()]
      };
    } catch (err) {
      console.error("Error creating file on disk:", err);
    }
  }

  return {
    id: `file-${path}-${Date.now()}`,
    name: cleanName,
    path,
    type,
    extension,
    content: initialContent,
    moduleName: cleanFolderPath || parentDirectory.name,
    lastModified: Date.now(),
    tags: [extension]
  };
}

export async function createNewFolder(
  parentDirectory: MainDirectory,
  folderName: string,
  parentFolderPath?: string
): Promise<FileItem> {
  const cleanName = folderName.trim();
  const cleanFolderPath = parentFolderPath ? parentFolderPath.replace(/^\//, '') : '';
  const relPath = cleanFolderPath ? `${cleanFolderPath}/${cleanName}` : cleanName;

  if (window.electronAPI?.createNewFolder) {
    const parentPath = cleanFolderPath 
      ? `${parentDirectory.path}/${cleanFolderPath}`
      : parentDirectory.path;
    const created = await window.electronAPI.createNewFolder(parentPath, cleanName);
    if (created) return created;
  }

  if (parentDirectory.handle) {
    try {
      let targetDirHandle = parentDirectory.handle;
      if (cleanFolderPath) {
        const parts = cleanFolderPath.split('/');
        for (const p of parts) {
          if (p) targetDirHandle = await targetDirHandle.getDirectoryHandle(p, { create: true });
        }
      }
      const subHandle = await targetDirHandle.getDirectoryHandle(cleanName, { create: true });
      return {
        id: `dir-/${relPath}-${Date.now()}`,
        name: cleanName,
        path: `/${relPath}`,
        type: 'folder',
        extension: '',
        handle: subHandle,
        moduleName: cleanName,
        children: []
      };
    } catch (err) {
      console.error("Error creating folder on disk:", err);
    }
  }

  return {
    id: `dir-/${relPath}-${Date.now()}`,
    name: cleanName,
    path: `/${relPath}`,
    type: 'folder',
    extension: '',
    moduleName: cleanName,
    children: []
  };
}

export async function deleteItemFromDisk(item: FileItem): Promise<boolean> {
  try {
    if (item.fullPath && window.electronAPI?.deleteItem) {
      return await window.electronAPI.deleteItem(item.fullPath);
    }
    if (item.handle?.remove) {
      await item.handle.remove({ recursive: true });
      return true;
    }
    return true;
  } catch (err) {
    console.error("Failed to delete item from disk:", err);
    return false;
  }
}

export async function renameItemOnDisk(item: FileItem, newName: string): Promise<{ success: boolean; newPath?: string; newName?: string }> {
  try {
    if (item.fullPath && window.electronAPI?.renameItem) {
      return await window.electronAPI.renameItem(item.fullPath, newName);
    }
    return { success: true, newName };
  } catch (err) {
    console.error("Failed to rename item on disk:", err);
    return { success: false };
  }
}

export async function removeVaultFromSavedList(vaultPath: string): Promise<{ allVaults: MainDirectorySummary[]; activePath: string | null }> {
  if (window.electronAPI?.removeSavedVault) {
    try {
      const res = await window.electronAPI.removeSavedVault(vaultPath);
      if (res && res.updatedVaults) {
        return { allVaults: res.updatedVaults, activePath: res.activePath };
      } else if (Array.isArray(res)) {
        return { allVaults: res, activePath: res.length > 0 ? res[0].path : null };
      }
    } catch (err) {
      console.error("Error removing saved vault in Electron:", err);
    }
  }

  try {
    const savedHandles = await idbGet<Array<{ name: string; path: string; handle: FileSystemDirectoryHandle }>>(IDB_VAULTS_KEY) || [];
    const updated = savedHandles.filter(h => h.path !== vaultPath);
    await idbSet(IDB_VAULTS_KEY, updated);
    const activePath = updated.length > 0 ? updated[0].path : null;
    await idbSet(IDB_ACTIVE_PATH_KEY, activePath);
    return {
      allVaults: updated.map(h => ({ name: h.name, path: h.path, fileCount: 0 })),
      activePath
    };
  } catch (err) {
    console.error("Error removing saved vault in IDB:", err);
    return { allVaults: [], activePath: null };
  }
}

