import React, { useState, useMemo, useEffect } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  File, 
  BookOpen, 
  Search, 
  Plus, 
  Star, 
  HardDrive, 
  ChevronRight, 
  ChevronDown,
  Layers,
  Image as ImageIcon,
  Video as VideoIcon,
  Code as CodeIcon,
  FileSpreadsheet,
  ChevronsDown,
  ChevronsUp,
  ArrowUpDown,
  X,
  FolderPlus,
  Trash2,
  AlertTriangle,
  Edit3,
  Presentation
} from 'lucide-react';
import type { FileItem, MainDirectory } from '../types';
import { getGlobalSession, saveGlobalSession } from '../utils/stateMemory';

interface SidebarProps {
  mainDir: MainDirectory;
  activeFile: FileItem | null;
  onSelectFile: (file: FileItem) => void;
  onSelectMainDirectory: (switchPath?: string) => void;
  onCreateNewNote: (folderPath?: string) => void;
  onCreateNewFolder: (parentFolderPath?: string) => void;
  onToggleFavorite: (fileId: string) => void;
  onDeleteItem: (item: FileItem) => void;
  onRenameItem: (item: FileItem, newName: string) => void;
  selectedFilter: string;
  setSelectedFilter: (filter: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  mainDir,
  activeFile,
  onSelectFile,
  onSelectMainDirectory,
  onCreateNewNote,
  onCreateNewFolder,
  onToggleFavorite,
  onDeleteItem,
  onRenameItem,
  selectedFilter,
  setSelectedFilter,
  searchQuery,
  setSearchQuery
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(() => {
    const session = getGlobalSession();
    return session.expandedFolders || {};
  });

  useEffect(() => {
    saveGlobalSession({ expandedFolders });
  }, [expandedFolders]);
  const [showVaultDropdown, setShowVaultDropdown] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'name' | 'date' | 'type'>('name');

  // Deletion Modal state
  const [itemToDelete, setItemToDelete] = useState<FileItem | null>(null);

  // Rename Modal state
  const [itemToRename, setItemToRename] = useState<FileItem | null>(null);
  const [renameInputValue, setRenameInputValue] = useState<string>('');

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: FileItem;
  } | null>(null);

  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  const counts = useMemo(() => {
    let md = 0, code = 0, csv = 0, pdf = 0, image = 0, video = 0, docx = 0, fav = 0, total = 0;

    const traverse = (items: FileItem[]) => {
      for (const item of items) {
        if (item.type === 'folder' && item.children) {
          traverse(item.children);
        } else if (item.type !== 'folder') {
          total++;
          if (item.isFavorite) fav++;
          if (item.type === 'md') md++;
          else if (item.type === 'code') code++;
          else if (item.type === 'csv') csv++;
          else if (item.type === 'pdf') pdf++;
          else if (item.type === 'image') image++;
          else if (item.type === 'video') video++;
          else if (item.type === 'docx') docx++;
        }
      }
    };

    traverse(mainDir.files);
    return { md, code, csv, pdf, image, video, docx, fav, total };
  }, [mainDir.files]);

  const toggleFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const handleExpandAll = () => {
    const newExpanded: Record<string, boolean> = {};
    const traverse = (items: FileItem[]) => {
      for (const item of items) {
        if (item.type === 'folder') {
          newExpanded[item.id] = true;
          if (item.children) traverse(item.children);
        }
      }
    };
    traverse(mainDir.files);
    setExpandedFolders(newExpanded);
  };

  const handleCollapseAll = () => {
    setExpandedFolders({});
  };

  const sortItems = (items: FileItem[]): FileItem[] => {
    return [...items].sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;

      if (sortOrder === 'date') {
        return (b.lastModified || 0) - (a.lastModified || 0);
      }
      if (sortOrder === 'type') {
        return a.type.localeCompare(b.type);
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  };

  const handleContextMenu = (e: React.MouseEvent, item: FileItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item
    });
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      onDeleteItem(itemToDelete);
      setItemToDelete(null);
    }
  };

  const handleConfirmRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (itemToRename && renameInputValue.trim()) {
      onRenameItem(itemToRename, renameInputValue.trim());
      setItemToRename(null);
    }
  };

  const renderFileRow = (file: FileItem, depth: number = 0): React.ReactNode => {
    const isActive = activeFile?.id === file.id;

    if (file.type === 'folder') {
      const isExpanded = expandedFolders[file.id] ?? false;
      const sortedChildren = file.children ? sortItems(file.children) : [];
      const childCount = file.children?.length || 0;

      return (
        <div key={file.id} style={{ marginBottom: 2 }}>
          <div 
            className={`tree-item folder-row ${isExpanded ? 'expanded' : ''}`}
            style={{ paddingLeft: `${depth * 14 + 10}px` }}
            onClick={(e) => toggleFolder(file.id, e)}
            onContextMenu={(e) => handleContextMenu(e, file)}
          >
            <div className="tree-item-content">
              {isExpanded ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
              {isExpanded ? <FolderOpen size={16} style={{ color: 'var(--primary)' }} /> : <Folder size={16} style={{ color: 'var(--text-muted)' }} />}
              <span className="folder-name" style={{ fontWeight: 600, fontSize: '0.84rem' }}>{file.name}</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', background: 'var(--bg-surface-elevated)', padding: '1px 5px', borderRadius: 4, marginLeft: 4 }}>
                {childCount}
              </span>
            </div>
          </div>

          {isExpanded && sortedChildren.length > 0 && (
            <div className="folder-children">
              {sortedChildren.map(child => renderFileRow(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    if (selectedFilter === 'md' && file.type !== 'md') return null;
    if (selectedFilter === 'pdf' && file.type !== 'pdf') return null;
    if (selectedFilter === 'docx' && file.type !== 'docx') return null;
    if (selectedFilter === 'image' && file.type !== 'image') return null;
    if (selectedFilter === 'video' && file.type !== 'video') return null;
    if (selectedFilter === 'code' && file.type !== 'code') return null;
    if (selectedFilter === 'csv' && file.type !== 'csv') return null;
    if (selectedFilter === 'favorite' && !file.isFavorite) return null;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = file.name.toLowerCase().includes(q);
      const tagMatch = file.tags?.some(t => t.toLowerCase().includes(q));
      if (!nameMatch && !tagMatch) return null;
    }

    return (
      <div 
        key={file.id} 
        className={`tree-item ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 14}px` }}
        onClick={() => onSelectFile(file)}
        onContextMenu={(e) => handleContextMenu(e, file)}
      >
        <div className="tree-item-content">
          {file.type === 'md' && <FileText size={15} style={{ color: '#818cf8' }} />}
          {file.type === 'pdf' && <BookOpen size={15} style={{ color: '#fb7185' }} />}
          {file.type === 'docx' && <File size={15} style={{ color: '#38bdf8' }} />}
          {file.type === 'pptx' && <Presentation size={15} style={{ color: '#f97316' }} />}
          {file.type === 'image' && <ImageIcon size={15} style={{ color: '#38bdf8' }} />}
          {file.type === 'video' && <VideoIcon size={15} style={{ color: '#c084fc' }} />}
          {file.type === 'code' && <CodeIcon size={15} style={{ color: '#4ade80' }} />}
          {file.type === 'csv' && <FileSpreadsheet size={15} style={{ color: '#34d399' }} />}
          {file.type === 'other' && <File size={15} style={{ color: 'var(--text-dim)' }} />}
          
          <span className="file-title" style={{ fontSize: '0.84rem' }} title={file.name}>{file.name}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {file.isFavorite && <Star size={12} fill="var(--accent-amber)" color="var(--accent-amber)" />}
          <span className={`file-tag-badge ${file.type}`}>{file.extension || file.type}</span>
        </div>
      </div>
    );
  };

  const sortedRootFiles = sortItems(mainDir.files);

  return (
    <aside className="sidebar">
      {/* 1. Vault Header with Switcher Dropdown */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
        <div 
          onClick={() => setShowVaultDropdown(!showVaultDropdown)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {mainDir.name || 'NoteStack Vault'}
                <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <HardDrive size={11} /> {counts.total} Vault Files
              </div>
            </div>
          </div>
        </div>

        {/* Vault Switcher Dropdown */}
        {showVaultDropdown && (
          <div style={{ position: 'absolute', top: 60, left: 16, right: 16, background: 'var(--bg-surface)', border: '1px solid var(--border-highlight)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 200, padding: 8 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', padding: '4px 8px', marginBottom: 4 }}>
              Local Vault Directories
            </div>

            {mainDir.allVaults && mainDir.allVaults.length > 0 ? (
              mainDir.allVaults.map(vault => (
                <div
                  key={vault.path}
                  onClick={() => {
                    setShowVaultDropdown(false);
                    onSelectMainDirectory(vault.path);
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: vault.path === mainDir.path ? 'var(--primary-light)' : 'transparent',
                    color: vault.path === mainDir.path ? 'var(--primary)' : 'var(--text-main)',
                    marginBottom: 2
                  }}
                >
                  <span>📁 {vault.name}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{vault.fileCount} files</span>
                </div>
              ))
            ) : (
              <div style={{ padding: '6px 8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{mainDir.name}</div>
            )}

            <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 6, paddingTop: 6 }}>
              <button
                onClick={() => {
                  setShowVaultDropdown(false);
                  onSelectMainDirectory();
                }}
                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
              >
                <FolderPlus size={14} /> Open Other Local Folder
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Global Search & Actions */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-dim)' }} />
          <input
            type="text"
            className="search-input"
            style={{ paddingLeft: 30, paddingRight: 26, width: '100%' }}
            placeholder="Search notes & code..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <X size={14} style={{ position: 'absolute', right: 10, cursor: 'pointer', color: 'var(--text-dim)' }} onClick={() => setSearchQuery('')} />
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button className="btn-primary" style={{ padding: '7px 12px', fontSize: '0.8rem', justifyContent: 'center' }} onClick={() => onCreateNewNote()}>
            <Plus size={14} /> New File
          </button>
          <button className="tool-btn" style={{ padding: '7px 12px', fontSize: '0.8rem', justifyContent: 'center', border: '1px solid var(--border-color)' }} onClick={() => onCreateNewFolder()}>
            <FolderPlus size={14} /> New Folder
          </button>
        </div>
      </div>

      {/* 3. Category Filter Pills */}
      <div style={{ padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: '1px solid var(--border-color)' }}>
        {[
          { id: 'all', label: 'All', count: counts.total },
          { id: 'md', label: '.MD', count: counts.md },
          { id: 'code', label: 'Code', count: counts.code },
          { id: 'csv', label: 'CSV', count: counts.csv },
          { id: 'pdf', label: 'PDF', count: counts.pdf },
          { id: 'image', label: 'Img', count: counts.image },
          { id: 'favorite', label: '★ Star', count: counts.fav }
        ].map(filter => (
          <button
            key={filter.id}
            onClick={() => setSelectedFilter(filter.id)}
            style={{
              padding: '3px 9px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.72rem',
              fontWeight: 700,
              border: '1px solid',
              borderColor: selectedFilter === filter.id ? 'var(--primary)' : 'transparent',
              background: selectedFilter === filter.id ? 'var(--primary-light)' : 'var(--bg-surface-elevated)',
              color: selectedFilter === filter.id ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'var(--transition)'
            }}
          >
            <span>{filter.label}</span>
            <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>({filter.count})</span>
          </button>
        ))}
      </div>

      {/* 4. Folder Tree Header Controls */}
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-dim)' }}>
          Vault Explorer
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={handleExpandAll} title="Expand All Folders">
            <ChevronsDown size={13} />
          </button>
          <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={handleCollapseAll} title="Collapse All Folders">
            <ChevronsUp size={13} />
          </button>
          <button 
            className="btn-icon" 
            style={{ width: 22, height: 22 }} 
            onClick={() => setSortOrder(prev => prev === 'name' ? 'date' : prev === 'date' ? 'type' : 'name')} 
            title={`Sort Order: ${sortOrder.toUpperCase()}`}
          >
            <ArrowUpDown size={13} />
          </button>
        </div>
      </div>

      {/* 5. Hierarchical Folder Tree */}
      <div className="file-tree-container" style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        {sortedRootFiles.length > 0 ? (
          sortedRootFiles.map(item => renderFileRow(item, 0))
        ) : (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
            No items found. Click + New File to create notes or program code files.
          </div>
        )}
      </div>

      {/* 6. Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-highlight)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 99999,
            padding: 6,
            minWidth: 180
          }}
          onClick={e => e.stopPropagation()}
        >
          <div 
            style={{ padding: '6px 12px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={() => {
              if (contextMenu.item.type !== 'folder') onSelectFile(contextMenu.item);
              setContextMenu(null);
            }}
          >
            {contextMenu.item.type === 'folder' ? <FolderOpen size={14} /> : <FileText size={14} />}
            <span>Open {contextMenu.item.type === 'folder' ? 'Folder' : 'File'}</span>
          </div>

          {contextMenu.item.type === 'folder' && (
            <>
              <div 
                style={{ padding: '6px 12px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}
                onClick={() => {
                  onCreateNewNote(contextMenu.item.path.replace(/^\//, ''));
                  setContextMenu(null);
                }}
              >
                <Plus size={14} /> Create File in Folder
              </div>
              <div 
                style={{ padding: '6px 12px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}
                onClick={() => {
                  onCreateNewFolder(contextMenu.item.path.replace(/^\//, ''));
                  setContextMenu(null);
                }}
              >
                <FolderPlus size={14} /> Create Subfolder
              </div>
            </>
          )}

          {contextMenu.item.type !== 'folder' && (
            <div 
              style={{ padding: '6px 12px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}
              onClick={() => {
                onToggleFavorite(contextMenu.item.id);
                setContextMenu(null);
              }}
            >
              <Star size={14} style={{ color: contextMenu.item.isFavorite ? 'var(--accent-amber)' : undefined }} />
              <span>{contextMenu.item.isFavorite ? 'Unstar Item' : 'Star Item'}</span>
            </div>
          )}

          <div 
            style={{ padding: '6px 12px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={() => {
              setItemToRename(contextMenu.item);
              setRenameInputValue(contextMenu.item.name);
              setContextMenu(null);
            }}
          >
            <Edit3 size={14} style={{ color: 'var(--primary)' }} />
            <span>Rename {contextMenu.item.type === 'folder' ? 'Folder' : 'File'}</span>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

          <div 
            style={{ padding: '6px 12px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', borderRadius: 'var(--radius-sm)', color: 'var(--accent-rose)', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={() => {
              setItemToDelete(contextMenu.item);
              setContextMenu(null);
            }}
          >
            <Trash2 size={14} />
            <span>Delete Permanently</span>
          </div>
        </div>
      )}

      {/* 7. Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="modal-overlay" onClick={() => setItemToDelete(null)}>
          <div className="modal-content" style={{ maxWidth: 440, padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-rose)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Delete {itemToDelete.type === 'folder' ? 'Folder' : 'File'}?
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  This action cannot be undone.
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20 }}>
              Are you sure you want to delete <strong style={{ color: 'var(--text-main)' }}>"{itemToDelete.name}"</strong>{itemToDelete.type === 'folder' ? ' and all of its contents' : ''}? This will permanently remove the item from your disk.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button 
                className="tool-btn"
                onClick={() => setItemToDelete(null)}
                style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontWeight: 600 }}
              >
                Cancel
              </button>

              <button 
                className="btn-primary"
                onClick={confirmDelete}
                style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', background: 'var(--accent-rose)', color: '#fff', fontWeight: 700 }}
              >
                <Trash2 size={15} /> Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Rename Item Modal */}
      {itemToRename && (
        <div className="modal-overlay" onClick={() => setItemToRename(null)}>
          <div className="modal-content" style={{ maxWidth: 420, padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Edit3 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Rename {itemToRename.type === 'folder' ? 'Folder' : 'File'}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Enter a new name for "{itemToRename.name}"
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmRename}>
              <div style={{ marginBottom: 20 }}>
                <input
                  type="text"
                  className="search-input"
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem' }}
                  value={renameInputValue}
                  onChange={e => setRenameInputValue(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button 
                  type="button"
                  className="tool-btn"
                  onClick={() => setItemToRename(null)}
                  style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontWeight: 600 }}
                >
                  Cancel
                </button>

                <button 
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontWeight: 700 }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
};
