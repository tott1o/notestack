import { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { HeaderBar } from './components/HeaderBar';
import { TabBar } from './components/TabBar';
import { MarkdownViewer } from './components/MarkdownViewer';
import { PdfViewer } from './components/PdfViewer';
import { DocxViewer } from './components/DocxViewer';
import { PptxViewer } from './components/PptxViewer';
import { ImageViewer } from './components/ImageViewer';
import { SvgViewer } from './components/SvgViewer';
import { VideoViewer } from './components/VideoViewer';
import { CodeEditor } from './components/CodeEditor';
import { CsvViewer } from './components/CsvViewer';
import { DashboardOverview } from './components/DashboardOverview';
import { FlashcardsModal } from './components/FlashcardsModal';
import { CreateNoteModal } from './components/CreateNoteModal';
import { CreateFolderModal } from './components/CreateFolderModal';
import { QuickSearchModal } from './components/QuickSearchModal';
import { SettingsModal } from './components/SettingsModal';
import { AIChatPanel } from './components/AIChatPanel';

import type { FileItem, MainDirectory, ReadingSettings, ViewMode, SplitLayoutMode } from './types';
import { EMPTY_MAIN_DIRECTORY } from './utils/sampleData';
import { 
  openMainDirectoryFromDisk, 
  getSavedMainDirectoryOnLaunch, 
  saveFileToDisk, 
  createNewMarkdownFile,
  createNewFolder,
  ensureFileContentLoaded,
  deleteItemFromDisk,
  renameItemOnDisk,
  removeVaultFromSavedList,
  getFileType
} from './utils/fileSystem';
import { getGlobalSession, saveGlobalSession } from './utils/stateMemory';

export function App() {
  const [mainDir, setMainDir] = useState<MainDirectory>(EMPTY_MAIN_DIRECTORY);
  const [activeFile, setActiveFile] = useState<FileItem | null>(null);
  const [openTabs, setOpenTabs] = useState<FileItem[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [showFlashcards, setShowFlashcards] = useState<boolean>(false);
  const [showQuickSearch, setShowQuickSearch] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const AI_PANEL_OPEN_KEY = 'notestack_ai_panel_open_v1';

  const [isAIChatOpen, setIsAIChatOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(AI_PANEL_OPEN_KEY);
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(AI_PANEL_OPEN_KEY, JSON.stringify(isAIChatOpen));
    } catch (err) {
      console.error("Failed to save AI panel open state:", err);
    }
  }, [isAIChatOpen]);
  
  // Sidebar Resizing & Visibility State
  const [isSidebarVisible, setIsSidebarVisible] = useState<boolean>(true);
  const [sidebarWidth, setSidebarWidth] = useState<number>(260);
  const isDraggingSidebarResizer = useRef<boolean>(false);

  // AI Panel Resizing State
  const [aiPanelWidth, setAiPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem('notestack_ai_panel_width');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 260 && parsed <= 900) return parsed;
    }
    return 380;
  });
  const isDraggingAiPanelResizer = useRef<boolean>(false);

  useEffect(() => {
    localStorage.setItem('notestack_ai_panel_width', aiPanelWidth.toString());
  }, [aiPanelWidth]);

  // Dual Split Screen Layout State (1 or 2 Panes)
  const [splitCount, setSplitCount] = useState<SplitLayoutMode>(1);
  const [splitRatio, setSplitRatio] = useState<number>(50); // % ratio for dual panes
  const [paneActiveFileIds, setPaneActiveFileIds] = useState<(string | null)[]>([null, null]);
  const [activePaneIdx, setActivePaneIdx] = useState<number>(0);
  const isDraggingSplitter = useRef<boolean>(false);
  
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState<boolean>(false);
  const [targetModuleName, setTargetModuleName] = useState<string | undefined>(undefined);

  const [settings, setSettings] = useState<ReadingSettings>(() => {
    let savedTheme: any = 'full-black';
    try {
      savedTheme = localStorage.getItem('notestack_permanent_theme_v1') || 'full-black';
    } catch {}
    return {
      theme: savedTheme,
      fontSize: 16,
      lineHeight: 1.7,
      fontFamily: 'Inter',
      bionicReading: false,
      showToc: true,
      speedReadingActive: false,
      speedReadingWpm: 300
    };
  });

  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const isSessionLoadedRef = useRef<boolean>(false);

  useEffect(() => {
    async function loadSavedDirectory() {
      try {
        const savedDir = await getSavedMainDirectoryOnLaunch();
        if (savedDir) {
          setMainDir(savedDir);

          const session = getGlobalSession();

          const flattenAllFiles = (items: FileItem[]): FileItem[] => {
            const res: FileItem[] = [];
            for (const item of items) {
              if (item.type !== 'folder') res.push(item);
              if (item.children) res.push(...flattenAllFiles(item.children));
            }
            return res;
          };

          const allVaultFiles = flattenAllFiles(savedDir.files);
          const normalizePath = (p?: string) => (p || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').toLowerCase();

          // 1. Restore all open tabs if openTabPaths exist
          if (session.openTabPaths && session.openTabPaths.length > 0) {
            const restoredTabs: FileItem[] = [];
            for (const pathKey of session.openTabPaths) {
              const matched = allVaultFiles.find(item => 
                normalizePath(item.fullPath) === normalizePath(pathKey) ||
                normalizePath(item.path) === normalizePath(pathKey) ||
                item.id === pathKey ||
                normalizePath(item.name) === normalizePath(pathKey)
              );
              if (matched) {
                const loaded = await ensureFileContentLoaded(matched);
                restoredTabs.push(loaded);
              }
            }

            if (restoredTabs.length > 0) {
              setOpenTabs(restoredTabs);

              let activeToSet = restoredTabs[0];
              if (session.lastActiveFilePath) {
                const activeMatched = restoredTabs.find(t => 
                  normalizePath(t.fullPath) === normalizePath(session.lastActiveFilePath) ||
                  normalizePath(t.path) === normalizePath(session.lastActiveFilePath)
                );
                if (activeMatched) activeToSet = activeMatched;
              }

              setActiveFile(activeToSet);
              setPaneActiveFileIds([activeToSet.tabId || activeToSet.id, null]);

              if (session.lastViewMode) {
                setViewMode(session.lastViewMode as ViewMode);
              } else {
                setViewMode(activeToSet.type === 'md' ? 'split' : 'preview');
              }
              isSessionLoadedRef.current = true;
              return;
            }
          }

          // Fallback: restore single last active file if openTabPaths was not saved yet
          if (session.lastActiveFilePath) {
            const matched = allVaultFiles.find(item => 
              normalizePath(item.fullPath) === normalizePath(session.lastActiveFilePath) ||
              normalizePath(item.path) === normalizePath(session.lastActiveFilePath)
            );
            if (matched) {
              const loaded = await ensureFileContentLoaded(matched);
              setActiveFile(loaded);
              setOpenTabs([loaded]);
              setPaneActiveFileIds([loaded.tabId || loaded.id, null]);
              if (session.lastViewMode) {
                setViewMode(session.lastViewMode as ViewMode);
              } else {
                setViewMode(loaded.type === 'md' ? 'split' : 'preview');
              }
            }
          }
        }
      } finally {
        isSessionLoadedRef.current = true;
        setIsInitialLoading(false);
      }
    }
    loadSavedDirectory();
  }, []);

  useEffect(() => {
    if (!isSessionLoadedRef.current) return; // Prevent overwriting stored session on initial mount!

    saveGlobalSession({
      lastActiveFilePath: activeFile ? (activeFile.fullPath || activeFile.path) : undefined,
      lastViewMode: viewMode,
      openTabPaths: openTabs.map(t => t.fullPath || t.path || t.id),
      activeTabId: activeFile ? (activeFile.tabId || activeFile.id) : undefined
    });
  }, [activeFile, viewMode, openTabs]);

  useEffect(() => {
    document.body.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // Real-time live synchronization for file system changes
  useEffect(() => {
    if (!window.electronAPI) return;

    const unSubVault = window.electronAPI.onVaultUpdated?.((updatedDir) => {
      setMainDir(prev => ({
        ...prev,
        name: updatedDir.name || prev.name,
        path: updatedDir.path || prev.path,
        subDirectories: updatedDir.subDirectories || prev.subDirectories,
        files: updatedDir.files || prev.files,
        allVaults: updatedDir.allVaults || prev.allVaults
      }));
    });

    const unSubFile = window.electronAPI.onFileChanged?.(({ fullPath, content }) => {
      if (!fullPath) return;
      const norm = (p?: string) => (p || '').replace(/\\/g, '/').toLowerCase();
      const targetNorm = norm(fullPath);

      setOpenTabs(prev => prev.map(tab => {
        if (norm(tab.fullPath) === targetNorm || norm(tab.path) === targetNorm) {
          return { ...tab, content };
        }
        return tab;
      }));

      setActiveFile(prev => {
        if (prev && (norm(prev.fullPath) === targetNorm || norm(prev.path) === targetNorm)) {
          return { ...prev, content };
        }
        return prev;
      });
    });

    return () => {
      if (unSubVault) unSubVault();
      if (unSubFile) unSubFile();
    };
  }, []);

  const handleSelectMainDirectory = async (switchPath?: string) => {
    try {
      const selected = await openMainDirectoryFromDisk(switchPath);
      if (selected) {
        setMainDir(selected);
        setActiveFile(null);
        setViewMode('dashboard');
      }
    } catch (err) {
      console.error("Failed to select local directory:", err);
    }
  };

  const handleRemoveVault = async (vaultPath: string) => {
    try {
      const { allVaults, activePath } = await removeVaultFromSavedList(vaultPath);
      if (vaultPath === mainDir.path) {
        if (activePath) {
          const loaded = await openMainDirectoryFromDisk(activePath);
          if (loaded) {
            setMainDir({ ...loaded, allVaults });
          } else {
            setMainDir({ ...EMPTY_MAIN_DIRECTORY, allVaults });
          }
        } else {
          setMainDir({ ...EMPTY_MAIN_DIRECTORY, allVaults: [] });
        }
        setActiveFile(null);
        setOpenTabs([]);
        setViewMode('dashboard');
      } else {
        setMainDir(prev => ({
          ...prev,
          allVaults
        }));
      }
    } catch (err) {
      console.error("Failed to remove vault:", err);
    }
  };

  const handleOpenInNewTab = useCallback((file: FileItem) => {
    if (!file) return;
    const uniqueTabId = `${file.id}_dup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const tabInstance: FileItem = {
      ...file,
      tabId: uniqueTabId,
      isDuplicate: true
    };
    
    // Batch all state updates together to avoid multiple re-renders
    const targetPane = splitCount === 1 ? 0 : activePaneIdx;
    setOpenTabs(prev => [...prev, tabInstance]);
    setActiveFile(tabInstance);
    if (splitCount === 1) {
      setActivePaneIdx(0);
    }
    setPaneActiveFileIds(prev => {
      const next = [...prev];
      next[targetPane] = uniqueTabId;
      return next;
    });
    setViewMode('preview');

    if (!tabInstance.content && !tabInstance.arrayBuffer && !tabInstance.url) {
      ensureFileContentLoaded(tabInstance).then(loaded => {
        if (loaded && (loaded.content || loaded.arrayBuffer || loaded.url)) {
          setActiveFile(prev => (prev && prev.tabId === uniqueTabId) ? { ...prev, ...loaded } : prev);
          setOpenTabs(prev => prev.map(t => t.tabId === uniqueTabId ? { ...t, ...loaded } : t));
        }
      });
    }
  }, [splitCount, activePaneIdx]);

  // Global Keyboard Shortcuts: Ctrl+D (Duplicate Tab) & Ctrl+P (Quick Vault File Search) & Ctrl+Shift+A (AI Chat)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (activeFile) {
          handleOpenInNewTab(activeFile);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setShowQuickSearch(prev => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setIsAIChatOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeFile, handleOpenInNewTab]);

  const handleSelectFile = useCallback((file: FileItem) => {
    if (!file) return;

    // 1. If file object has a specific tabId (e.g. clicked directly from TabBar), match strictly by tabId!
    let targetTab: FileItem | undefined;

    if (file.tabId) {
      targetTab = openTabs.find(t => t.tabId === file.tabId);
    }

    // 2. If clicked from Sidebar (no tabId): check if activeFile is already a tab for this file
    if (!targetTab && activeFile && (
      (activeFile.fullPath && file.fullPath && activeFile.fullPath === file.fullPath) ||
      (activeFile.path && file.path && activeFile.path === file.path) ||
      activeFile.id === file.id
    )) {
      targetTab = activeFile;
    }

    // 3. Otherwise check if ANY open tab matches fullPath/path/id
    if (!targetTab) {
      targetTab = openTabs.find(t => 
        (t.fullPath && file.fullPath && t.fullPath === file.fullPath) ||
        (t.path && file.path && t.path === file.path) ||
        t.id === file.id
      );
    }

    // 4. If no open tab exists, assign a normal tabId to this file for openTabs
    const finalTab: FileItem = targetTab || {
      ...file,
      tabId: file.tabId || file.id
    };

    const targetKey = finalTab.tabId!;

    // 5. Synchronous instant active file selection (0ms delay)
    setActiveFile(finalTab);

    // 6. Update target pane ID instantly
    const targetPane = splitCount === 1 ? 0 : activePaneIdx;
    if (splitCount === 1) {
      setActivePaneIdx(0);
    }

    setPaneActiveFileIds(prev => {
      const next = [...prev];
      next[targetPane] = targetKey;
      return next;
    });

    if (viewMode === 'dashboard') {
      setViewMode('preview');
    }

    // 7. Ensure file is present in openTabs
    setOpenTabs(prev => {
      const exists = prev.some(t => t.tabId === targetKey);
      if (exists) {
        return prev;
      }
      return [...prev, finalTab];
    });

    // 8. Asynchronously load content in background if missing
    if (!finalTab.content && !finalTab.arrayBuffer && !finalTab.url) {
      ensureFileContentLoaded(finalTab).then(loaded => {
        if (loaded && (loaded.content || loaded.arrayBuffer || loaded.url)) {
          setActiveFile(prev => (prev && prev.tabId === targetKey) ? { ...prev, ...loaded } : prev);
          setOpenTabs(prev => prev.map(t => t.tabId === targetKey ? { ...t, ...loaded } : t));
        }
      });
    }
  }, [openTabs, activeFile, splitCount, activePaneIdx, viewMode]);

  const handleChangeSplitCount = (count: SplitLayoutMode) => {
    if (count === 1) {
      // Switching back to Single View: bring currently active file to Pane 0 and reset activePaneIdx = 0
      if (activeFile) {
        setPaneActiveFileIds([activeFile.id, null]);
      }
      setActivePaneIdx(0);
    }
    setSplitCount(count);
  };

  const handleAssignFileToPane = (paneIdx: number, fileId: string | null) => {
    setPaneActiveFileIds(prev => {
      const next = [...prev];
      next[paneIdx] = fileId;
      return next;
    });
    if (fileId) {
      const matched = openTabs.find(t => t.id === fileId);
      if (matched) {
        setActiveFile(matched);
        ensureFileContentLoaded(matched);
      }
    }
  };

  const handleReorderTabs = (reorderedTabs: FileItem[]) => {
    setOpenTabs(reorderedTabs);
  };

  const handleCloseTab = (tabKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenTabs(prev => {
      const closingIdx = prev.findIndex(t => (t.tabId || t.id) === tabKey);
      const nextTabs = prev.filter(t => (t.tabId || t.id) !== tabKey);

      const currentActiveKey = activeFile ? (activeFile.tabId || activeFile.id) : null;
      if (currentActiveKey === tabKey) {
        if (nextTabs.length > 0) {
          const fallbackIdx = Math.max(0, closingIdx - 1);
          const nextActive = nextTabs[fallbackIdx];
          setActiveFile(nextActive);
        } else {
          setActiveFile(null);
          setViewMode('dashboard');
        }
      }

      return nextTabs;
    });

    // When closing ANY tab while in split screen view, automatically collapse back to Single Screen view!
    if (splitCount === 2) {
      handleChangeSplitCount(1);
    }

    setPaneActiveFileIds(prev => prev.map(id => id === tabKey ? null : id));
  };

  const handleCloseAllTabs = useCallback(() => {
    setOpenTabs([]);
    setActiveFile(null);
    setPaneActiveFileIds([null, null]);
    if (splitCount === 2) {
      setSplitCount(1);
    }
    setViewMode('dashboard');
  }, [splitCount]);

  // Enforce automatic single-screen view constraint if only 1 tab is open
  useEffect(() => {
    if (openTabs.length <= 1 && splitCount === 2) {
      setSplitCount(1);
    }
  }, [openTabs.length, splitCount]);

  // Drag Resizing for Sidebar, AI Section, and Dual Split Screen
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSidebarResizer.current) {
        const newWidth = Math.max(160, Math.min(500, e.clientX));
        setSidebarWidth(newWidth);
      }
      if (isDraggingAiPanelResizer.current) {
        const newWidth = Math.max(260, Math.min(900, window.innerWidth - e.clientX));
        setAiPanelWidth(newWidth);
      }
      if (isDraggingSplitter.current) {
        const currentSidebarW = isSidebarVisible ? sidebarWidth : 0;
        const totalWidth = window.innerWidth - currentSidebarW;
        if (totalWidth > 0) {
          const newRatio = ((e.clientX - currentSidebarW) / totalWidth) * 100;
          if (newRatio >= 20 && newRatio <= 80) {
            setSplitRatio(Math.round(newRatio));
          }
        }
      }
    };

    const handleMouseUp = () => {
      isDraggingSidebarResizer.current = false;
      isDraggingAiPanelResizer.current = false;
      isDraggingSplitter.current = false;
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isSidebarVisible, sidebarWidth]);

  const handleFileContentUpdated = useCallback((filePathOrName: string, newContent: string) => {
    // 1. Update openTabs
    setOpenTabs(prev => prev.map(tab => {
      const match = (tab.fullPath && tab.fullPath === filePathOrName) ||
                    (tab.path && tab.path === filePathOrName) ||
                    tab.name === filePathOrName;
      if (match) {
        return { ...tab, content: newContent };
      }
      return tab;
    }));

    // 2. Update activeFile
    setActiveFile(prev => {
      if (!prev) return null;
      const match = (prev.fullPath && prev.fullPath === filePathOrName) ||
                    (prev.path && prev.path === filePathOrName) ||
                    prev.name === filePathOrName;
      if (match) {
        return { ...prev, content: newContent };
      }
      return prev;
    });

    // 3. Update mainDir tree
    setMainDir(prev => {
      const updateFilesRecursive = (items: FileItem[]): FileItem[] => {
        return items.map(item => {
          const match = (item.fullPath && item.fullPath === filePathOrName) ||
                        (item.path && item.path === filePathOrName) ||
                        item.name === filePathOrName;
          if (match) {
            return { ...item, content: newContent };
          }
          if (item.type === 'folder' && item.children) {
            return { ...item, children: updateFilesRecursive(item.children) };
          }
          return item;
        });
      };
      return { ...prev, files: updateFilesRecursive(prev.files) };
    });
  }, []);

  const handleContentChange = useCallback((newContent: string) => {
    if (!activeFile) return;
    const updated = { ...activeFile, content: newContent };
    setActiveFile(updated);

    // Sync content across any duplicate open tabs of the same file
    setOpenTabs(prev => prev.map(t => {
      const isSameFile = (t.fullPath && activeFile.fullPath && t.fullPath === activeFile.fullPath) ||
                         (t.path && activeFile.path && t.path === activeFile.path) ||
                         t.id === activeFile.id;
      return isSameFile ? { ...t, content: newContent } : t;
    }));

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      await saveFileToDisk(updated, newContent, mainDir.path);

      setMainDir(prev => {
        const updateFilesRecursive = (items: FileItem[]): FileItem[] => {
          return items.map(item => {
            if (item.id === updated.id) {
              return updated;
            }
            if (item.type === 'folder' && item.children) {
              return { ...item, children: updateFilesRecursive(item.children) };
            }
            return item;
          });
        };
        return { ...prev, files: updateFilesRecursive(prev.files) };
      });
    }, 1000);
  }, [activeFile, mainDir.path]);

  const triggerOpenCreateModal = (moduleName?: string) => {
    setTargetModuleName(moduleName);
    setShowCreateModal(true);
  };

  const triggerOpenCreateFolderModal = (moduleName?: string) => {
    setTargetModuleName(moduleName);
    setShowCreateFolderModal(true);
  };

  const handleCreateNoteSubmit = async (title: string, targetFolderPath?: string, initialText?: string) => {
    setShowCreateModal(false);
    if (!title || !title.trim()) return;

    const newFile = await createNewMarkdownFile(mainDir, title.trim(), targetFolderPath);
    
    if (initialText) {
      // Only write to disk if the AI content differs from the template content
      // that createNewMarkdownFile already wrote
      newFile.content = initialText;
      if (newFile.fullPath && window.electronAPI?.writeFileText) {
        // Direct Electron write is faster than saveFileToDisk for known fullPath
        await window.electronAPI.writeFileText(newFile.fullPath, initialText);
      } else {
        await saveFileToDisk(newFile, initialText, mainDir.path);
      }
    }

    // Update tree + open tab in one synchronous block
    setMainDir(prev => {
      let folderPathToMatch = (targetFolderPath || newFile.moduleName || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      if (!folderPathToMatch && newFile.path && newFile.path.includes('/')) {
        folderPathToMatch = newFile.path.substring(0, newFile.path.lastIndexOf('/')).replace(/^\/+|\/+$/g, '');
      }

      if (!folderPathToMatch) {
        const filtered = prev.files.filter(c => c.id !== newFile.id && c.path !== newFile.path);
        return { ...prev, files: [...filtered, newFile] };
      }

      let insertedSuccessfully = false;

      const addFileRecursive = (items: FileItem[]): FileItem[] => {
        return items.map(item => {
          if (item.type === 'folder') {
            const itemCleanPath = item.path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
            const folderMatches = (itemCleanPath === folderPathToMatch) ||
                                  (item.name === folderPathToMatch) ||
                                  (itemCleanPath.endsWith(`/${folderPathToMatch}`));

            if (folderMatches) {
              insertedSuccessfully = true;
              const existingChildren = item.children || [];
              const filteredChildren = existingChildren.filter(c => c.id !== newFile.id && c.path !== newFile.path);
              return {
                ...item,
                children: [...filteredChildren, newFile]
              };
            }

            if (item.children) {
              return {
                ...item,
                children: addFileRecursive(item.children)
              };
            }
          }
          return item;
        });
      };

      const updatedFiles = addFileRecursive(prev.files);

      if (!insertedSuccessfully) {
        const filteredRoot = updatedFiles.filter(c => c.id !== newFile.id && c.path !== newFile.path);
        return { ...prev, files: [...filteredRoot, newFile] };
      }

      return { ...prev, files: updatedFiles };
    });

    // Open and view immediately without requiring a refresh!
    await handleSelectFile(newFile);
  };

  const handleCreateFolderSubmit = async (folderName: string, parentFolderPath?: string) => {
    setShowCreateFolderModal(false);
    if (!folderName || !folderName.trim()) return;

    const newFolder = await createNewFolder(mainDir, folderName.trim(), parentFolderPath);

    setMainDir(prev => {
      const cleanParentPath = (parentFolderPath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

      if (!cleanParentPath) {
        const filtered = prev.files.filter(c => c.id !== newFolder.id && c.path !== newFolder.path);
        return { ...prev, files: [...filtered, newFolder] };
      }

      let folderInserted = false;

      const addFolderRecursive = (items: FileItem[]): FileItem[] => {
        return items.map(item => {
          if (item.type === 'folder') {
            const itemCleanPath = item.path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
            const isMatch = (itemCleanPath === cleanParentPath) || (item.name === cleanParentPath) || itemCleanPath.endsWith(`/${cleanParentPath}`);

            if (isMatch) {
              folderInserted = true;
              const existingChildren = item.children || [];
              const filteredChildren = existingChildren.filter(c => c.id !== newFolder.id && c.path !== newFolder.path);
              return {
                ...item,
                children: [...filteredChildren, newFolder]
              };
            }

            if (item.children) {
              return {
                ...item,
                children: addFolderRecursive(item.children)
              };
            }
          }
          return item;
        });
      };

      const updatedFiles = addFolderRecursive(prev.files);
      if (!folderInserted) {
        const filteredRoot = updatedFiles.filter(c => c.id !== newFolder.id && c.path !== newFolder.path);
        return { ...prev, files: [...filteredRoot, newFolder] };
      }

      return { ...prev, files: updatedFiles };
    });
  };

  const handleCopyFile = useCallback(async (source: FileItem, targetFolderPath?: string) => {
    const destDirRelPath = (targetFolderPath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const cleanVaultPath = mainDir.path.replace(/\\/g, '/').replace(/\/$/, '');
    
    const sourceParent = (source.path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').split('/').slice(0, -1).join('/');
    const isSameDir = sourceParent === destDirRelPath;

    let newName = source.name;
    if (isSameDir) {
      const extIndex = source.name.lastIndexOf('.');
      if (extIndex !== -1) {
        const namePart = source.name.substring(0, extIndex);
        const extPart = source.name.substring(extIndex);
        newName = `${namePart}_copy${extPart}`;
      } else {
        newName = `${source.name}_copy`;
      }
    }

    const newRelPath = destDirRelPath ? `${destDirRelPath}/${newName}` : newName;
    const destFullPath = `${cleanVaultPath}/${newRelPath}`;

    const loadedSource = (source.content !== undefined) ? source : await ensureFileContentLoaded(source);
    const contentToCopy = loadedSource.content || '';

    if (window.electronAPI?.writeFileText) {
      await window.electronAPI.writeFileText(destFullPath, contentToCopy);
    }

    const newFileItem: FileItem = {
      id: `file-${newRelPath}`,
      name: newName,
      path: newRelPath,
      fullPath: destFullPath,
      type: source.type,
      extension: source.extension,
      size: source.size,
      lastModified: Date.now(),
      content: contentToCopy
    };

    setMainDir(prev => {
      if (!destDirRelPath) {
        const filtered = prev.files.filter(c => c.id !== newFileItem.id && c.path !== newFileItem.path);
        return { ...prev, files: [...filtered, newFileItem] };
      }

      let insertedSuccessfully = false;

      const addFileRecursive = (items: FileItem[]): FileItem[] => {
        return items.map(item => {
          if (item.type === 'folder') {
            const itemCleanPath = item.path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
            const folderMatches = (itemCleanPath === destDirRelPath) ||
                                  (item.name === destDirRelPath) ||
                                  (itemCleanPath.endsWith(`/${destDirRelPath}`));

            if (folderMatches) {
              insertedSuccessfully = true;
              const existingChildren = item.children || [];
              const filteredChildren = existingChildren.filter(c => c.id !== newFileItem.id && c.path !== newFileItem.path);
              return {
                ...item,
                children: [...filteredChildren, newFileItem]
              };
            }

            if (item.children) {
              return {
                ...item,
                children: addFileRecursive(item.children)
              };
            }
          }
          return item;
        });
      };

      const updatedFiles = addFileRecursive(prev.files);

      if (!insertedSuccessfully) {
        const filteredRoot = updatedFiles.filter(c => c.id !== newFileItem.id && c.path !== newFileItem.path);
        return { ...prev, files: [...filteredRoot, newFileItem] };
      }

      return { ...prev, files: updatedFiles };
    });
  }, [mainDir.path]);

  const handleMoveFile = useCallback(async (source: FileItem, targetFolderPath?: string) => {
    const destDirRelPath = (targetFolderPath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const cleanVaultPath = mainDir.path.replace(/\\/g, '/').replace(/\/$/, '');
    
    const newRelPath = destDirRelPath ? `${destDirRelPath}/${source.name}` : source.name;
    const destFullPath = `${cleanVaultPath}/${newRelPath}`;

    if (source.fullPath === destFullPath || source.path === newRelPath) return;

    const loadedSource = (source.content !== undefined) ? source : await ensureFileContentLoaded(source);
    const contentToMove = loadedSource.content || '';

    if (window.electronAPI?.deleteItem && source.fullPath) {
      await window.electronAPI.deleteItem(source.fullPath);
    }
    if (window.electronAPI?.writeFileText) {
      await window.electronAPI.writeFileText(destFullPath, contentToMove);
    }

    const movedItem: FileItem = {
      ...source,
      id: `file-${newRelPath}`,
      path: newRelPath,
      fullPath: destFullPath,
      content: contentToMove
    };

    setMainDir(prev => {
      const removeRecursive = (items: FileItem[]): FileItem[] => {
        return items.filter(c => c.id !== source.id && c.path !== source.path).map(item => {
          if (item.type === 'folder' && item.children) {
            return { ...item, children: removeRecursive(item.children) };
          }
          return item;
        });
      };

      const cleanedFiles = removeRecursive(prev.files);

      if (!destDirRelPath) {
        return { ...prev, files: [...cleanedFiles, movedItem] };
      }

      let insertedSuccessfully = false;

      const addFileRecursive = (items: FileItem[]): FileItem[] => {
        return items.map(item => {
          if (item.type === 'folder') {
            const itemCleanPath = item.path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
            const folderMatches = (itemCleanPath === destDirRelPath) ||
                                  (item.name === destDirRelPath) ||
                                  (itemCleanPath.endsWith(`/${destDirRelPath}`));

            if (folderMatches) {
              insertedSuccessfully = true;
              const existingChildren = item.children || [];
              const filteredChildren = existingChildren.filter(c => c.id !== movedItem.id && c.path !== movedItem.path);
              return {
                ...item,
                children: [...filteredChildren, movedItem]
              };
            }

            if (item.children) {
              return {
                ...item,
                children: addFileRecursive(item.children)
              };
            }
          }
          return item;
        });
      };

      const updatedFiles = addFileRecursive(cleanedFiles);

      if (!insertedSuccessfully) {
        const filteredRoot = updatedFiles.filter(c => c.id !== movedItem.id && c.path !== movedItem.path);
        return { ...prev, files: [...filteredRoot, movedItem] };
      }

      return { ...prev, files: updatedFiles };
    });
  }, [mainDir.path]);

  const handleToggleFavorite = (fileId: string) => {
    setMainDir(prev => {
      const toggleRecursive = (items: FileItem[]): FileItem[] => {
        return items.map(item => {
          if (item.id === fileId) {
            return { ...item, isFavorite: !item.isFavorite };
          }
          if (item.type === 'folder' && item.children) {
            return { ...item, children: toggleRecursive(item.children) };
          }
          return item;
        });
      };
      return { ...prev, files: toggleRecursive(prev.files) };
    });

    if (activeFile && activeFile.id === fileId) {
      setActiveFile(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : null);
    }
  };

  const handleDeleteItem = async (item: FileItem) => {
    const success = await deleteItemFromDisk(item);
    if (!success) return;

    setMainDir(prev => {
      const deleteRecursive = (items: FileItem[]): FileItem[] => {
        return items
          .filter(i => i.id !== item.id)
          .map(i => {
            if (i.type === 'folder' && i.children) {
              return { ...i, children: deleteRecursive(i.children) };
            }
            return i;
          });
      };
      return { ...prev, files: deleteRecursive(prev.files) };
    });

    if (activeFile && (activeFile.id === item.id || activeFile.path.startsWith(item.path))) {
      setActiveFile(null);
      setViewMode('dashboard');
    }
  };

  const handleRenameItem = async (item: FileItem, newName: string) => {
    const cleanName = newName.trim();
    if (!cleanName || cleanName === item.name) return;

    const res = await renameItemOnDisk(item, cleanName);
    if (!res.success) return;

    const { type, extension } = item.type === 'folder' ? { type: 'folder' as const, extension: '' } : getFileType(cleanName);

    setMainDir(prev => {
      const updateRecursive = (items: FileItem[]): FileItem[] => {
        return items.map(i => {
          if (i.id === item.id) {
            const oldPath = i.path;
            const parentDir = oldPath.substring(0, oldPath.lastIndexOf('/'));
            const newPath = `${parentDir}/${cleanName}`;
            const updatedFullPath = res.newPath || i.fullPath;

            if (i.type === 'folder') {
              const updateChildrenPaths = (children?: FileItem[]): FileItem[] | undefined => {
                if (!children) return undefined;
                return children.map(c => {
                  const childRel = c.path.substring(oldPath.length);
                  const childNewPath = `${newPath}${childRel}`;
                  let childFullPath = c.fullPath;
                  if (c.fullPath && i.fullPath && updatedFullPath) {
                    childFullPath = c.fullPath.replace(i.fullPath, updatedFullPath);
                  }
                  return {
                    ...c,
                    path: childNewPath,
                    fullPath: childFullPath,
                    children: updateChildrenPaths(c.children)
                  };
                });
              };

              return {
                ...i,
                name: cleanName,
                path: newPath,
                fullPath: updatedFullPath,
                moduleName: cleanName,
                children: updateChildrenPaths(i.children)
              };
            } else {
              return {
                ...i,
                name: cleanName,
                path: newPath,
                fullPath: updatedFullPath,
                type,
                extension
              };
            }
          }

          if (i.type === 'folder' && i.children) {
            return { ...i, children: updateRecursive(i.children) };
          }
          return i;
        });
      };
      return { ...prev, files: updateRecursive(prev.files) };
    });

    if (activeFile && activeFile.id === item.id) {
      setActiveFile(prev => prev ? {
        ...prev,
        name: cleanName,
        type: item.type === 'folder' ? prev.type : type,
        extension: item.type === 'folder' ? prev.extension : extension
      } : null);
    }
  };



  const renderFileViewer = (file: FileItem, isTabActive: boolean = true) => {
    const key = file.tabId || file.id;

    switch (file.type) {
      case 'md':
        return (
          <MarkdownViewer 
            key={key}
            file={file}
            isActive={isTabActive}
            onContentChange={(c) => {
              if (activeFile?.id === file.id || activeFile?.tabId === file.tabId) handleContentChange(c);
            }}
            settings={settings}
            onToggleBionic={() => setSettings(prev => ({ ...prev, bionicReading: !prev.bionicReading }))}
            onOpenFlashcards={() => setShowFlashcards(true)}
            viewMode={viewMode === 'focus' ? 'split' : viewMode as any}
          />
        );
      case 'code':
        return (
          <CodeEditor 
            key={key}
            file={file} 
            onContentChange={(c) => {
              if (activeFile?.id === file.id || activeFile?.tabId === file.tabId) handleContentChange(c);
            }} 
          />
        );
      case 'csv':
        return (
          <CsvViewer 
            key={key}
            file={file} 
            onContentChange={(c) => {
              if (activeFile?.id === file.id || activeFile?.tabId === file.tabId) handleContentChange(c);
            }} 
          />
        );
      case 'image':
        if (file.extension?.toLowerCase() === 'svg' || file.name.toLowerCase().endsWith('.svg')) {
          return <SvgViewer key={key} file={file} />;
        }
        return <ImageViewer key={key} file={file} />;
      case 'video':
        return (
          <VideoViewer 
            key={key}
            file={file} 
            onExportNotesToMarkdown={(mdText) => {
              const noteTitle = `VideoNotes-${file.name.replace(/\.[^/.]+$/, '')}.md`;
              handleCreateNoteSubmit(noteTitle, file.moduleName, mdText);
            }}
          />
        );
      case 'pdf':
        return <PdfViewer key={key} file={file} />;
      case 'docx':
        return <DocxViewer key={key} file={file} />;
      case 'pptx':
        return <PptxViewer key={key} file={file} settings={settings} />;
      default:
        return (
          <div key={key} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Unsupported file type ({file.extension}).
          </div>
        );
    }
  };

  const renderPaneContainer = (paneIdx: number) => {
    let targetFileId = paneActiveFileIds[paneIdx];
    if (!targetFileId) {
      if (paneIdx === 0) {
        targetFileId = activeFile ? (activeFile.tabId || activeFile.id) : 'dashboard';
      } else {
        const fallback = openTabs[paneIdx] || openTabs[0];
        targetFileId = fallback ? (fallback.tabId || fallback.id) : 'dashboard';
      }
    }

    const assignedFile = targetFileId === 'dashboard' ? null : openTabs.find(t => (t.tabId || t.id) === targetFileId);
    const isPaneFocused = activePaneIdx === paneIdx;

    return (
      <div 
        key={paneIdx}
        onClick={() => setActivePaneIdx(paneIdx)}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          overflow: 'hidden',
          background: 'var(--bg-main)',
          borderRadius: splitCount > 1 ? 8 : 0,
          border: splitCount > 1 ? '1px solid var(--border-color)' : 'none',
          boxShadow: 'none',
          transition: 'border-color 0.15s ease'
        }}
      >
        {splitCount > 1 && (
          <div 
            className="pro-pane-header"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '6px 14px', 
              background: 'var(--bg-surface-elevated, #1e293b)', 
              borderBottom: '1px solid var(--border-color)',
              borderTop: isPaneFocused ? '2px solid var(--primary, #6366f1)' : '2px solid transparent',
              fontSize: '0.74rem',
              gap: 8,
              userSelect: 'none',
              transition: 'border-color 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span 
                style={{ 
                  fontWeight: 900, 
                  fontSize: '0.66rem', 
                  background: isPaneFocused ? 'var(--primary, #6366f1)' : 'var(--bg-surface)', 
                  color: isPaneFocused ? '#fff' : 'var(--text-muted)', 
                  padding: '2px 8px', 
                  borderRadius: 4,
                  letterSpacing: '0.04em'
                }}
              >
                PANE {paneIdx + 1}
              </span>

              {assignedFile && (
                <span 
                  style={{ 
                    fontSize: '0.64rem', 
                    fontWeight: 800, 
                    textTransform: 'uppercase',
                    background: 'var(--primary-light, rgba(99,102,241,0.15))', 
                    color: 'var(--primary, #6366f1)',
                    padding: '2px 6px',
                    borderRadius: 4
                  }}
                >
                  {assignedFile.type}
                </span>
              )}

              <select
                style={{
                  background: 'var(--bg-surface)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '3px 10px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  outline: 'none',
                  cursor: 'pointer'
                }}
                value={targetFileId || 'dashboard'}
                onChange={(e) => handleAssignFileToPane(paneIdx, e.target.value === 'dashboard' ? null : e.target.value)}
              >
                <option value="dashboard">📊 Dashboard Overview</option>
                {openTabs.map(t => (
                  <option key={t.tabId || t.id} value={t.tabId || t.id}>
                    📄 {t.name} ({t.type})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {assignedFile && (
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {assignedFile.moduleName || 'Root'}
                </span>
              )}
            </div>
          </div>
        )}

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', width: '100%', height: '100%' }}>
          {/* Dashboard view when no active file or dashboard selected */}
          <div 
            style={{ 
              display: 'flex', 
              flex: 1, 
              width: '100%', 
              height: '100%', 
              flexDirection: 'column',
              position: 'absolute',
              inset: 0,
              overflow: 'hidden',
              opacity: (!assignedFile || targetFileId === 'dashboard') ? 1 : 0,
              pointerEvents: (!assignedFile || targetFileId === 'dashboard') ? 'auto' : 'none',
              visibility: (!assignedFile || targetFileId === 'dashboard') ? 'visible' : 'hidden',
              zIndex: (!assignedFile || targetFileId === 'dashboard') ? 10 : 1
            }}
          >
            <DashboardOverview 
              mainDir={mainDir}
              onSelectMainDirectory={handleSelectMainDirectory}
              onSelectFile={handleSelectFile}
              onCreateNewNote={triggerOpenCreateModal}
              onCreateFolder={triggerOpenCreateFolderModal}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>

          {/* Persistent mounted tabs with 0ms DOM visibility switching & layout preservation */}
          {openTabs.map(tab => {
            const tabKey = tab.tabId || tab.id;
            const isTabActive = Boolean(targetFileId !== 'dashboard' && assignedFile && (assignedFile.tabId || assignedFile.id) === tabKey);

            return (
              <div
                key={tabKey}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  width: '100%',
                  height: '100%',
                  position: 'absolute',
                  inset: 0,
                  overflow: 'hidden',
                  opacity: isTabActive ? 1 : 0,
                  pointerEvents: isTabActive ? 'auto' : 'none',
                  visibility: isTabActive ? 'visible' : 'hidden',
                  zIndex: isTabActive ? 10 : 1
                }}
              >
                {renderFileViewer(tab, isTabActive)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      {isInitialLoading && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--bg-main)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          gap: 16
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: '3px solid rgba(168, 85, 247, 0.15)',
            borderTopColor: '#a855f7',
            animation: 'spin 0.7s linear infinite'
          }} />
          <div style={{
            fontSize: '0.86rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            letterSpacing: '0.05em',
            fontFamily: 'var(--font-body)'
          }}>
            Restoring NoteStack Session...
          </div>
        </div>
      )}
      {isSidebarVisible && viewMode !== 'focus' && (
        <div 
          style={{ 
            width: `${sidebarWidth}px`, 
            height: '100%', 
            position: 'relative',
            flexShrink: 0,
            borderRight: '1px solid var(--border-color)'
          }}
        >
          <Sidebar 
            mainDir={mainDir}
            activeFile={activeFile}
            onSelectFile={handleSelectFile}
            onSelectMainDirectory={handleSelectMainDirectory}
            onRemoveVault={handleRemoveVault}
            onCreateNewNote={triggerOpenCreateModal}
            onCreateNewFolder={triggerOpenCreateFolderModal}
            onCopyItem={handleCopyFile}
            onMoveItem={handleMoveFile}
            onToggleFavorite={handleToggleFavorite}
            onDeleteItem={handleDeleteItem}
            onRenameItem={handleRenameItem}
            onOpenInNewTab={handleOpenInNewTab}
            selectedFilter={selectedFilter}
            setSelectedFilter={setSelectedFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
          {/* Overlay Sidebar Resizer Handle (0px layout width, zero gap) */}
          <div
            className="sidebar-resizer-bar"
            onMouseDown={(e) => {
              e.preventDefault();
              isDraggingSidebarResizer.current = true;
              document.body.style.cursor = 'col-resize';
            }}
            onDoubleClick={() => setSidebarWidth(260)}
            style={{
              position: 'absolute',
              right: -3,
              top: 0,
              bottom: 0,
              width: 6,
              cursor: 'col-resize',
              zIndex: 20,
              userSelect: 'none'
            }}
            title="Drag to resize sidebar width | Double-click to reset 260px"
          />
        </div>
      )}

      <main className="main-canvas">
        <HeaderBar 
          mainDirName={mainDir.name}
          activeFile={activeFile}
          viewMode={viewMode}
          onSetViewMode={setViewMode}
          settings={settings}
          onUpdateSettings={(newSet) => setSettings(prev => ({ ...prev, ...newSet }))}
          onGoToDashboard={() => setViewMode('dashboard')}
          isSidebarVisible={isSidebarVisible && viewMode !== 'focus'}
          onToggleSidebar={() => setIsSidebarVisible(prev => !prev)}
          isAIChatOpen={isAIChatOpen}
          onToggleAIChat={() => setIsAIChatOpen(prev => !prev)}
          onOpenSettings={() => setShowSettingsModal(true)}
        />

        <TabBar 
          openTabs={openTabs}
          activeFile={activeFile}
          onSelectTab={(file) => {
            handleSelectFile(file);
            if (viewMode === 'dashboard') setViewMode('preview');
          }}
          onCloseTab={handleCloseTab}
          onCloseAllTabs={handleCloseAllTabs}
          onGoToDashboard={() => {
            setViewMode('dashboard');
            handleAssignFileToPane(activePaneIdx, 'dashboard');
          }}
          isDashboardActive={viewMode === 'dashboard' || !activeFile}
          onNewNoteClick={() => setShowQuickSearch(true)}
          onReorderTabs={handleReorderTabs}
          splitCount={splitCount}
          onChangeSplitCount={handleChangeSplitCount}
        />

        <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden', width: '100%', height: '100%', padding: splitCount > 1 ? 6 : 0 }}>
          {splitCount === 1 ? (
            renderPaneContainer(0)
          ) : (
            <>
              {/* Left Pane (Pane 0) */}
              <div style={{ width: `${splitRatio}%`, height: '100%', display: 'flex' }}>
                {renderPaneContainer(0)}
              </div>

              {/* Pro Resizable Splitter Handle */}
              <div
                className="pro-splitter-bar"
                onMouseDown={(e) => {
                  e.preventDefault();
                  isDraggingSplitter.current = true;
                  document.body.style.cursor = 'col-resize';
                }}
                onDoubleClick={() => setSplitRatio(50)}
                style={{
                  width: 8,
                  height: '100%',
                  cursor: 'col-resize',
                  background: 'var(--bg-surface-elevated, #1e293b)',
                  borderLeft: '1px solid var(--border-color)',
                  borderRight: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                  userSelect: 'none',
                  transition: 'background 0.15s ease, box-shadow 0.15s ease'
                }}
                title="Drag to resize | Double-click to reset 50/50 balance"
              >
                <div 
                  style={{ 
                    width: 3, 
                    height: 32, 
                    background: 'var(--text-muted)', 
                    borderRadius: 2,
                    opacity: 0.7 
                  }} 
                />
              </div>

              {/* Right Pane (Pane 1) */}
              <div style={{ width: `${100 - splitRatio}%`, height: '100%', display: 'flex' }}>
                {renderPaneContainer(1)}
              </div>
            </>
          )}
        </div>
      </main>

      {showFlashcards && activeFile && activeFile.type === 'md' && (
        <FlashcardsModal 
          file={activeFile} 
          onClose={() => setShowFlashcards(false)} 
        />
      )}

      {showCreateModal && (
        <CreateNoteModal 
          mainDir={mainDir}
          initialModuleName={targetModuleName}
          onClose={() => setShowCreateModal(false)}
          onCreate={(title, moduleName) => handleCreateNoteSubmit(title, moduleName)}
        />
      )}

      {showCreateFolderModal && (
        <CreateFolderModal 
          mainDir={mainDir}
          initialParentFolderPath={targetModuleName}
          onClose={() => setShowCreateFolderModal(false)}
          onCreateFolder={(folderName, parentFolderPath) => handleCreateFolderSubmit(folderName, parentFolderPath)}
        />
      )}

      <QuickSearchModal 
        isOpen={showQuickSearch}
        onClose={() => setShowQuickSearch(false)}
        files={mainDir.files}
        openTabs={openTabs}
        activeFile={activeFile}
        onSelectFile={(file) => {
          handleSelectFile(file);
          setShowQuickSearch(false);
        }}
        onCreateNewNote={() => triggerOpenCreateModal()}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        readingSettings={settings}
        onUpdateReadingSettings={(newSet) => {
          setSettings(prev => {
            const updated = { ...prev, ...newSet };
            if (newSet.theme) {
              try { localStorage.setItem('notestack_permanent_theme_v1', newSet.theme); } catch {}
            }
            return updated;
          });
        }}
      />

      <AIChatPanel
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        activeFile={activeFile}
        openTabs={openTabs}
        mainDir={mainDir}
        width={aiPanelWidth}
        onResizeStart={() => {
          isDraggingAiPanelResizer.current = true;
          document.body.style.cursor = 'col-resize';
        }}
        onResizeReset={() => setAiPanelWidth(380)}
        onContentChange={handleContentChange}
        onFileContentUpdated={handleFileContentUpdated}
        onSelectFile={handleSelectFile}
        onOpenInNewTab={handleOpenInNewTab}
        onCreateNoteFromAI={(title, content, targetFolderPath) => handleCreateNoteSubmit(title, targetFolderPath, content)}
      />
    </div>
  );
}

export default App;
