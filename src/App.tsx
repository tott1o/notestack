import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { SplitPdfNoteView } from './components/SplitPdfNoteView';
import { DashboardOverview } from './components/DashboardOverview';
import { FlashcardsModal } from './components/FlashcardsModal';
import { CreateNoteModal } from './components/CreateNoteModal';
import { CreateFolderModal } from './components/CreateFolderModal';

import type { FileItem, MainDirectory, ReadingSettings, ViewMode } from './types';
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

  const handleSelectFile = async (file: FileItem) => {
    const loadedFile = await ensureFileContentLoaded(file);
    setOpenTabs(prev => {
      const exists = prev.some(t => t.id === loadedFile.id);
      if (exists) {
        return prev.map(t => t.id === loadedFile.id ? loadedFile : t);
      }
      return [...prev, loadedFile];
    });
    setActiveFile(loadedFile);
    setViewMode('preview');
  };

  const handleCloseTab = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenTabs(prev => {
      const closingIdx = prev.findIndex(t => t.id === fileId);
      const nextTabs = prev.filter(t => t.id !== fileId);

      if (activeFile?.id === fileId) {
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
  };

  const handleContentChange = useCallback((newContent: string) => {
    if (!activeFile) return;
    const updated = { ...activeFile, content: newContent };
    setActiveFile(updated);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      await saveFileToDisk(updated, newContent);

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
  }, [activeFile]);

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
      await saveFileToDisk(newFile, initialText);
    }

    setMainDir(prev => {
      const addFileToTree = (items: FileItem[]): FileItem[] => {
        if (!targetFolderPath) return [...items, newFile];
        const normalizedTarget = targetFolderPath.replace(/^\//, '');

        return items.map(item => {
          if (item.type === 'folder') {
            const itemRelPath = item.path.replace(/^\//, '');
            if (itemRelPath === normalizedTarget) {
              return {
                ...item,
                children: [...(item.children || []), newFile]
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
      };

      return { ...prev, files: addFileToTree(prev.files) };
    });

    setActiveFile(newFile);
    setViewMode('preview');
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

  const [selectedPdfFile, setSelectedPdfFile] = useState<FileItem | null>(null);

  const allPdfFiles = useMemo(() => {
    const collectPdfs = (items: FileItem[]): FileItem[] => {
      let list: FileItem[] = [];
      for (const item of items) {
        if (item.type === 'pdf') {
          list.push(item);
        }
        if (item.children) {
          list = list.concat(collectPdfs(item.children));
        }
      }
      return list;
    };
    const vaultPdfs = collectPdfs(mainDir.files);

    if (activeFile && activeFile.moduleName) {
      const sameFolderPdfs = vaultPdfs.filter(pdf => pdf.moduleName === activeFile.moduleName);
      if (sameFolderPdfs.length > 0) return sameFolderPdfs;
    }
    return vaultPdfs;
  }, [mainDir.files, activeFile]);

  const activePdfFile = selectedPdfFile && allPdfFiles.some(p => p.id === selectedPdfFile.id)
    ? selectedPdfFile
    : (allPdfFiles.length > 0 ? allPdfFiles[0] : null);

  return (
    <div className="app-container">
      {viewMode !== 'focus' && (
        <Sidebar 
          mainDir={mainDir}
          activeFile={activeFile}
          onSelectFile={handleSelectFile}
          onSelectMainDirectory={handleSelectMainDirectory}
          onCreateNewNote={triggerOpenCreateModal}
          onCreateNewFolder={triggerOpenCreateFolderModal}
          onToggleFavorite={handleToggleFavorite}
          onDeleteItem={handleDeleteItem}
          onRenameItem={handleRenameItem}
          selectedFilter={selectedFilter}
          setSelectedFilter={setSelectedFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
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
          availablePdfFile={activePdfFile}
        />

        <TabBar 
          openTabs={openTabs}
          activeFile={activeFile}
          onSelectTab={(file) => {
            setActiveFile(file);
            if (viewMode === 'dashboard') setViewMode('preview');
          }}
          onCloseTab={handleCloseTab}
          onGoToDashboard={() => setViewMode('dashboard')}
          isDashboardActive={viewMode === 'dashboard' || !activeFile}
          onNewNoteClick={() => triggerOpenCreateModal()}
        />

        <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden', width: '100%', height: '100%' }}>
          {/* 1. Dashboard Overview Workspace Container */}
          <div 
            style={{ 
              position: 'absolute', 
              inset: 0, 
              visibility: (viewMode === 'dashboard' || !activeFile) ? 'visible' : 'hidden', 
              opacity: (viewMode === 'dashboard' || !activeFile) ? 1 : 0, 
              pointerEvents: (viewMode === 'dashboard' || !activeFile) ? 'auto' : 'none', 
              zIndex: (viewMode === 'dashboard' || !activeFile) ? 1 : -1, 
              display: 'flex', 
              flexDirection: 'column', 
              width: '100%', 
              height: '100%' 
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

          {/* 2. Persistent DOM Multi-Tab Viewer Containers (1 Container Per Open Tab for Instant 0ms Switching) */}
          {openTabs.map((file) => {
            const isTabActive = viewMode !== 'dashboard' && activeFile?.id === file.id;

            return (
              <div 
                key={file.id} 
                style={{ 
                  position: 'absolute', 
                  inset: 0, 
                  visibility: isTabActive ? 'visible' : 'hidden', 
                  opacity: isTabActive ? 1 : 0, 
                  pointerEvents: isTabActive ? 'auto' : 'none', 
                  zIndex: isTabActive ? 1 : -1, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  width: '100%', 
                  height: '100%' 
                }}
              >
                {viewMode === 'split-pdf' && file.type === 'md' ? (
                  <SplitPdfNoteView 
                    pdfFile={activePdfFile}
                    allPdfFiles={allPdfFiles}
                    onSelectPdfFile={setSelectedPdfFile}
                    markdownFile={file}
                    onMarkdownChange={(c) => {
                      if (activeFile?.id === file.id) handleContentChange(c);
                    }}
                    settings={settings}
                    onToggleBionic={() => setSettings(prev => ({ ...prev, bionicReading: !prev.bionicReading }))}
                    onOpenFlashcards={() => setShowFlashcards(true)}
                  />
                ) : file.type === 'md' ? (
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
                ) : file.type === 'code' ? (
                  <CodeEditor 
                    file={file} 
                    onContentChange={(c) => {
                      if (activeFile?.id === file.id) handleContentChange(c);
                    }} 
                  />
                ) : file.type === 'csv' ? (
                  <CsvViewer 
                    file={file} 
                    onContentChange={(c) => {
                      if (activeFile?.id === file.id) handleContentChange(c);
                    }} 
                  />
                ) : file.type === 'image' ? (
                  <ImageViewer file={file} />
                ) : file.type === 'video' ? (
                  <VideoViewer 
                    file={file} 
                    onExportNotesToMarkdown={(mdText) => {
                      const noteTitle = `VideoNotes-${file.name.replace(/\.[^/.]+$/, '')}.md`;
                      handleCreateNoteSubmit(noteTitle, file.moduleName, mdText);
                    }}
                  />
                ) : file.type === 'pdf' ? (
                  <PdfViewer file={file} />
                ) : file.type === 'docx' ? (
                  <DocxViewer file={file} />
                ) : file.type === 'pptx' ? (
                  <PptxViewer file={file} settings={settings} />
                ) : (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Unsupported file type ({file.extension}).
                  </div>
                )}
              </div>
            );
          })}
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
    </div>
  );
}

export default App;
