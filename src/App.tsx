import { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { HeaderBar } from './components/HeaderBar';
import { TabBar } from './components/TabBar';
import { MarkdownViewer } from './components/MarkdownViewer';
import { PdfViewer } from './components/PdfViewer';
import { DocxViewer } from './components/DocxViewer';
import { PptxViewer } from './components/PptxViewer';
import { ImageViewer } from './components/ImageViewer';
import { VideoViewer } from './components/VideoViewer';
import { CodeEditor } from './components/CodeEditor';
import { CsvViewer } from './components/CsvViewer';
import { DashboardOverview } from './components/DashboardOverview';
import { FlashcardsModal } from './components/FlashcardsModal';
import { CreateNoteModal } from './components/CreateNoteModal';
import { CreateFolderModal } from './components/CreateFolderModal';
import { QuickSearchModal } from './components/QuickSearchModal';
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
  const [isAIChatOpen, setIsAIChatOpen] = useState<boolean>(false);
  
  // Sidebar Resizing & Visibility State
  const [isSidebarVisible, setIsSidebarVisible] = useState<boolean>(true);
  const [sidebarWidth, setSidebarWidth] = useState<number>(260);
  const isDraggingSidebarResizer = useRef<boolean>(false);

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

  const [settings, setSettings] = useState<ReadingSettings>({
    theme: 'full-black',
    fontSize: 16,
    lineHeight: 1.7,
    fontFamily: 'Inter',
    bionicReading: false,
    showToc: true,
    speedReadingActive: false,
    speedReadingWpm: 300
  });

  useEffect(() => {
    async function loadSavedDirectory() {
      const savedDir = await getSavedMainDirectoryOnLaunch();
      if (savedDir) {
        setMainDir(savedDir);

        const session = getGlobalSession();
        if (session.lastActiveFilePath) {
          const findFile = (items: FileItem[]): FileItem | null => {
            for (const item of items) {
              if (item.fullPath === session.lastActiveFilePath || item.path === session.lastActiveFilePath) {
                return item;
              }
              if (item.children) {
                const found = findFile(item.children);
                if (found) return found;
              }
            }
            return null;
          };

          const matched = findFile(savedDir.files);
          if (matched) {
            const loaded = await ensureFileContentLoaded(matched);
            setActiveFile(loaded);
            if (session.lastViewMode) {
              setViewMode(session.lastViewMode as ViewMode);
            } else {
              setViewMode(loaded.type === 'md' ? 'split' : 'preview');
            }
          }
        }
      }
    }
    loadSavedDirectory();
  }, []);

  useEffect(() => {
    saveGlobalSession({
      lastActiveFilePath: activeFile ? (activeFile.fullPath || activeFile.path) : undefined,
      lastViewMode: viewMode
    });
  }, [activeFile, viewMode]);

  useEffect(() => {
    document.body.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

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

  const handleOpenInNewTab = useCallback(async (file: FileItem) => {
    const loadedFile = await ensureFileContentLoaded(file);
    const uniqueTabId = `${loadedFile.id}_tab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const tabInstance: FileItem = {
      ...loadedFile,
      tabId: uniqueTabId
    };
    
    setOpenTabs(prev => [...prev, tabInstance]);
    setActiveFile(tabInstance);

    const targetPane = splitCount === 1 ? 0 : activePaneIdx;
    if (splitCount === 1) {
      setActivePaneIdx(0);
    }

    setPaneActiveFileIds(prev => {
      const next = [...prev];
      next[targetPane] = uniqueTabId;
      return next;
    });
    setViewMode('preview');
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

  const handleSelectFile = async (file: FileItem) => {
    const loadedFile = await ensureFileContentLoaded(file);
    setOpenTabs(prev => {
      const exists = prev.some(t => (t.tabId || t.id) === (loadedFile.tabId || loadedFile.id));
      if (exists) {
        return prev.map(t => (t.tabId || t.id) === (loadedFile.tabId || loadedFile.id) ? loadedFile : t);
      }
      return [...prev, loadedFile];
    });
    setActiveFile(loadedFile);
    
    // In Single View mode, always update Pane 0 and set activePaneIdx = 0
    const targetPane = splitCount === 1 ? 0 : activePaneIdx;
    if (splitCount === 1) {
      setActivePaneIdx(0);
    }

    setPaneActiveFileIds(prev => {
      const next = [...prev];
      next[targetPane] = loadedFile.tabId || loadedFile.id;
      return next;
    });
    setViewMode('preview');
  };

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

  // Enforce automatic single-screen view constraint if only 1 tab is open
  useEffect(() => {
    if (openTabs.length <= 1 && splitCount === 2) {
      setSplitCount(1);
    }
  }, [openTabs.length, splitCount]);

  // Drag Resizing for Sidebar and Dual Split Screen
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSidebarResizer.current) {
        const newWidth = Math.max(160, Math.min(500, e.clientX));
        setSidebarWidth(newWidth);
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

  const handleContentChange = useCallback((newContent: string) => {
    if (!activeFile) return;
    const updated = { ...activeFile, content: newContent };
    setActiveFile(updated);

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
      newFile.content = initialText;
      await saveFileToDisk(newFile, initialText, mainDir.path);
    }

    setMainDir(prev => {
      const targetFolderToUse = (newFile.moduleName || targetFolderPath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

      const addFileToTree = (items: FileItem[]): FileItem[] => {
        if (!targetFolderToUse) {
          const filtered = items.filter(c => c.id !== newFile.id && c.path !== newFile.path);
          return [...filtered, newFile];
        }

        let inserted = false;
        const updated = items.map(item => {
          if (item.type === 'folder') {
            const itemRelPath = item.path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
            if (itemRelPath === targetFolderToUse) {
              inserted = true;
              const existingChildren = item.children || [];
              const filtered = existingChildren.filter(c => c.id !== newFile.id && c.path !== newFile.path);
              return {
                ...item,
                children: [...filtered, newFile]
              };
            }
            if (item.children) {
              return {
                ...item,
                children: addFileToTree(item.children)
              };
            }
          }
          return item;
        });

        if (!inserted && items === prev.files) {
          const filtered = items.filter(c => c.id !== newFile.id && c.path !== newFile.path);
          return [...filtered, newFile];
        }
        return updated;
      };

      return { ...prev, files: addFileToTree(prev.files) };
    });

    handleOpenInNewTab(newFile);
  };

  const handleCreateFolderSubmit = async (folderName: string, parentFolderPath?: string) => {
    setShowCreateFolderModal(false);
    if (!folderName || !folderName.trim()) return;

    const newFolder = await createNewFolder(mainDir, folderName.trim(), parentFolderPath);

    setMainDir(prev => {
      const addFolderToTree = (items: FileItem[]): FileItem[] => {
        if (!parentFolderPath) return [...items, newFolder];
        const normalizedParent = parentFolderPath.replace(/^\//, '');

        return items.map(item => {
          if (item.type === 'folder') {
            const itemRelPath = item.path.replace(/^\//, '');
            if (itemRelPath === normalizedParent) {
              return {
                ...item,
                children: [...(item.children || []), newFolder]
              };
            }
            if (item.children) {
              return {
                ...item,
                children: addFolderToTree(item.children)
              };
            }
          }
          return item;
        });
      };
      return { ...prev, files: addFolderToTree(prev.files) };
    });
  };

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



  const renderFileViewer = (file: FileItem) => {
    switch (file.type) {
      case 'md':
        return (
          <MarkdownViewer 
            file={file}
            onContentChange={(c) => {
              if (activeFile?.id === file.id) handleContentChange(c);
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
            file={file} 
            onContentChange={(c) => {
              if (activeFile?.id === file.id) handleContentChange(c);
            }} 
          />
        );
      case 'csv':
        return (
          <CsvViewer 
            file={file} 
            onContentChange={(c) => {
              if (activeFile?.id === file.id) handleContentChange(c);
            }} 
          />
        );
      case 'image':
        return <ImageViewer file={file} />;
      case 'video':
        return (
          <VideoViewer 
            file={file} 
            onExportNotesToMarkdown={(mdText) => {
              const noteTitle = `VideoNotes-${file.name.replace(/\.[^/.]+$/, '')}.md`;
              handleCreateNoteSubmit(noteTitle, file.moduleName, mdText);
            }}
          />
        );
      case 'pdf':
        return <PdfViewer file={file} />;
      case 'docx':
        return <DocxViewer file={file} />;
      case 'pptx':
        return <PptxViewer file={file} settings={settings} />;
      default:
        return (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Unsupported file type ({file.extension}).
          </div>
        );
    }
  };

  const renderPaneContainer = (paneIdx: number) => {
    let targetFileId = paneActiveFileIds[paneIdx];
    if (!targetFileId) {
      if (paneIdx === 0) {
        targetFileId = activeFile ? activeFile.id : 'dashboard';
      } else {
        const fallback = openTabs[paneIdx] || openTabs[0];
        targetFileId = fallback ? fallback.id : 'dashboard';
      }
    }

    const assignedFile = targetFileId === 'dashboard' ? null : openTabs.find(t => t.id === targetFileId);
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
                  <option key={t.id} value={t.id}>
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
          {!assignedFile || targetFileId === 'dashboard' ? (
            <DashboardOverview 
              mainDir={mainDir}
              onSelectMainDirectory={handleSelectMainDirectory}
              onSelectFile={handleSelectFile}
              onCreateNewNote={triggerOpenCreateModal}
              onCreateFolder={triggerOpenCreateFolderModal}
              onToggleFavorite={handleToggleFavorite}
            />
          ) : (
            renderFileViewer(assignedFile)
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      {isSidebarVisible && viewMode !== 'focus' && (
        <>
          <div style={{ width: `${sidebarWidth}px`, height: '100%', flexShrink: 0, overflow: 'hidden' }}>
            <Sidebar 
              mainDir={mainDir}
              activeFile={activeFile}
              onSelectFile={handleSelectFile}
              onSelectMainDirectory={handleSelectMainDirectory}
              onRemoveVault={handleRemoveVault}
              onCreateNewNote={triggerOpenCreateModal}
              onCreateNewFolder={triggerOpenCreateFolderModal}
              onToggleFavorite={handleToggleFavorite}
              onDeleteItem={handleDeleteItem}
              onRenameItem={handleRenameItem}
              onOpenInNewTab={handleOpenInNewTab}
              selectedFilter={selectedFilter}
              setSelectedFilter={setSelectedFilter}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          </div>

          {/* Sidebar Resizer Handle */}
          <div
            className="sidebar-resizer-bar"
            onMouseDown={(e) => {
              e.preventDefault();
              isDraggingSidebarResizer.current = true;
              document.body.style.cursor = 'col-resize';
            }}
            onDoubleClick={() => setSidebarWidth(260)}
            style={{
              width: 6,
              height: '100%',
              cursor: 'col-resize',
              background: 'var(--bg-surface-elevated, #1e293b)',
              borderLeft: '1px solid var(--border-color)',
              borderRight: '1px solid var(--border-color)',
              zIndex: 15,
              userSelect: 'none',
              flexShrink: 0,
              transition: 'background 0.15s ease'
            }}
            title="Drag to resize sidebar width | Double-click to reset 260px"
          />
        </>
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
        />

        <TabBar 
          openTabs={openTabs}
          activeFile={activeFile}
          onSelectTab={(file) => {
            handleSelectFile(file);
            if (viewMode === 'dashboard') setViewMode('preview');
          }}
          onCloseTab={handleCloseTab}
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

      <AIChatPanel
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        activeFile={activeFile}
        openTabs={openTabs}
        mainDir={mainDir}
        onContentChange={handleContentChange}
        onSelectFile={handleSelectFile}
        onOpenInNewTab={handleOpenInNewTab}
        onCreateNoteFromAI={(title, content, targetFolderPath) => handleCreateNoteSubmit(title, targetFolderPath, content)}
      />
    </div>
  );
}

export default App;
