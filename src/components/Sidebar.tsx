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
  Presentation,
  Filter
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
    let md = 0, code = 0, csv = 0, pdf = 0, image = 0, video = 0, docx = 0, pptx = 0, fav = 0, total = 0;

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
          else if (item.type === 'pptx') pptx++;
        }
      }
    };

    traverse(mainDir.files);
    return { md, code, csv, pdf, image, video, docx, pptx, fav, total };
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

  // Ultra-Professional Tree Row Renderer with Connector Lines & Vivid File Format Badges
  const renderFileRow = (file: FileItem, depth: number = 0): React.ReactNode => {
    const isActive = activeFile?.id === file.id;

    if (file.type === 'folder') {
      const isExpanded = expandedFolders[file.id] ?? false;
      const sortedChildren = file.children ? sortItems(file.children) : [];
      const childCount = file.children?.length || 0;

      return (
        <div key={file.id} style={{ marginBottom: 2 }}>
          {/* Folder Line Header */}
          <div 
            className={`tree-item-row ${isExpanded ? 'active-folder' : ''}`}
            onClick={(e) => toggleFolder(file.id, e)}
            onContextMenu={(e) => handleContextMenu(e, file)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, color: 'var(--text-dim)' }}>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
              {isExpanded ? (
                <FolderOpen size={16} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
              ) : (
                <Folder size={16} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
              )}
              <span className="folder-name" style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {file.name}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.66rem', fontWeight: 800, color: 'var(--text-dim)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', padding: '1px 6px', borderRadius: 10 }}>
                {childCount}
              </span>
            </div>
          </div>

          {/* Subfolder Children Container with Dashed Tree Guide Connector Line */}
          {isExpanded && (
            <div className="folder-children-container">
              {sortedChildren.length > 0 ? (
                sortedChildren.map(child => renderFileRow(child, depth + 1))
              ) : (
                <div style={{ padding: '4px 12px 4px 28px', fontSize: '0.74rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                  (empty folder)
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Filter validation
    if (selectedFilter === 'md' && file.type !== 'md') return null;
    if (selectedFilter === 'pdf' && file.type !== 'pdf') return null;
    if (selectedFilter === 'docx' && file.type !== 'docx') return null;
    if (selectedFilter === 'pptx' && file.type !== 'pptx') return null;
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
        className={`tree-item-row ${isActive ? 'active' : ''}`}
        onClick={() => onSelectFile(file)}
        onContextMenu={(e) => handleContextMenu(e, file)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden', flex: 1 }}>
          {file.type === 'md' && <FileText size={15} style={{ color: '#818cf8', flexShrink: 0 }} />}
          {file.type === 'pdf' && <BookOpen size={15} style={{ color: '#fb7185', flexShrink: 0 }} />}
          {file.type === 'docx' && <File size={15} style={{ color: '#38bdf8', flexShrink: 0 }} />}
          {file.type === 'pptx' && <Presentation size={15} style={{ color: '#f97316', flexShrink: 0 }} />}
          {file.type === 'image' && <ImageIcon size={15} style={{ color: '#22d3ee', flexShrink: 0 }} />}
          {file.type === 'video' && <VideoIcon size={15} style={{ color: '#c084fc', flexShrink: 0 }} />}
          {file.type === 'code' && <CodeIcon size={15} style={{ color: '#4ade80', flexShrink: 0 }} />}
          {file.type === 'csv' && <FileSpreadsheet size={15} style={{ color: '#34d399', flexShrink: 0 }} />}
          {file.type === 'other' && <File size={15} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />}
          
          <span style={{ fontSize: '0.83rem', color: isActive ? 'var(--primary)' : 'var(--text-main)', fontWeight: isActive ? 800 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.name}>
            {file.name}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {file.isFavorite && <Star size={12} fill="var(--accent-amber)" color="var(--accent-amber)" />}
          <span 
            style={{ 
              fontSize: '0.62rem', 
              fontWeight: 800, 
              textTransform: 'uppercase', 
              letterSpacing: '0.04em',
              padding: '2px 6px', 
              borderRadius: 4,
              background: isActive ? 'var(--primary)' : 'var(--bg-surface-elevated)',
              color: isActive ? '#fff' : 'var(--text-dim)',
              border: '1px solid var(--border-color)'
            }}
          >
            {file.extension || file.type}
          </span>
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
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
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
          <div style={{ position: 'absolute', top: 64, left: 16, right: 16, background: 'var(--bg-surface)', border: '1px solid var(--border-highlight)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 200, padding: 8 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-dim)', padding: '4px 8px', marginBottom: 4 }}>
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
                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
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
            placeholder="Search notes, decks & code..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <X size={14} style={{ position: 'absolute', right: 10, cursor: 'pointer', color: 'var(--text-dim)' }} onClick={() => setSearchQuery('')} />
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button className="btn-primary" style={{ padding: '7px 12px', fontSize: '0.8rem', justifyContent: 'center', fontWeight: 700 }} onClick={() => onCreateNewNote()}>
            <Plus size={14} /> New File
          </button>
          <button className="tool-btn" style={{ padding: '7px 12px', fontSize: '0.8rem', justifyContent: 'center', border: '1px solid var(--border-color)', fontWeight: 700 }} onClick={() => onCreateNewFolder()}>
            <FolderPlus size={14} /> New Folder
          </button>
        </div>
      </div>

      {/* 3. Category Filter Pills */}
      <div style={{ padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: '1px solid var(--border-color)' }}>
        {[
          { id: 'all', label: 'All', count: counts.total },
          { id: 'md', label: '.MD', count: counts.md },
          { id: 'pptx', label: 'PPT', count: counts.pptx },
          { id: 'pdf', label: 'PDF', count: counts.pdf },
          { id: 'docx', label: 'DOCX', count: counts.docx },
          { id: 'code', label: 'Code', count: counts.code },
          { id: 'csv', label: 'CSV', count: counts.csv },
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
              fontWeight: 800,
              border: '1px solid',
              borderColor: selectedFilter === filter.id ? 'var(--primary)' : 'transparent',
              background: selectedFilter === filter.id ? 'var(--primary-light)' : 'var(--bg-surface-elevated)',
              color: selectedFilter === filter.id ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.15s ease'
            }}
          >
            <span>{filter.label}</span>
            <span style={{ fontSize: '0.64rem', opacity: 0.8 }}>({filter.count})</span>
          </button>
        ))}
      </div>

      {/* 4. Folder Tree Header Controls */}
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={12} /> Vault Hierarchy
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
      <div className="file-tree-container" style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
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
            minWidth: 160,
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.item.type === 'folder' ? (
            <>
              <div 
                className="tool-btn" 
                style={{ padding: '6px 10px', fontSize: '0.8rem', width: '100%', justifyContent: 'flex-start' }}
                onClick={() => {
                  onCreateNewNote(contextMenu.item.path);
                  setContextMenu(null);
                }}
              >
                <Plus size={14} /> New File in Folder
              </div>
              <div 
                className="tool-btn" 
                style={{ padding: '6px 10px', fontSize: '0.8rem', width: '100%', justifyContent: 'flex-start' }}
                onClick={() => {
                  onCreateNewFolder(contextMenu.item.path);
                  setContextMenu(null);
                }}
              >
                <FolderPlus size={14} /> New Subfolder
              </div>
            </>
          ) : (
            <div 
              className="tool-btn" 
              style={{ padding: '6px 10px', fontSize: '0.8rem', width: '100%', justifyContent: 'flex-start' }}
              onClick={() => {
                onToggleFavorite(contextMenu.item.id);
                setContextMenu(null);
              }}
            >
              <Star size={14} fill={contextMenu.item.isFavorite ? 'var(--accent-amber)' : 'none'} />
              {contextMenu.item.isFavorite ? 'Unstar Item' : 'Star Item'}
            </div>
          )}

          <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 0' }} />

          <div 
            className="tool-btn" 
            style={{ padding: '6px 10px', fontSize: '0.8rem', width: '100%', justifyContent: 'flex-start' }}
            onClick={() => {
              setItemToRename(contextMenu.item);
              setRenameInputValue(contextMenu.item.name);
              setContextMenu(null);
            }}
          >
            <Edit3 size={14} /> Rename Item
          </div>

          <div 
            className="tool-btn" 
            style={{ padding: '6px 10px', fontSize: '0.8rem', width: '100%', justifyContent: 'flex-start', color: 'var(--accent-rose)' }}
            onClick={() => {
              setItemToDelete(contextMenu.item);
              setContextMenu(null);
            }}
          >
            <Trash2 size={14} /> Delete Item
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 24, maxWidth: 400, width: '100%', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(244,63,94,0.15)', color: 'var(--accent-rose)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>Delete {itemToDelete.type === 'folder' ? 'Folder' : 'File'}?</h3>
            </div>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20 }}>
              Are you sure you want to permanently delete <strong style={{ color: 'var(--text-main)' }}>{itemToDelete.name}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="tool-btn" style={{ padding: '8px 16px', fontWeight: 700 }} onClick={() => setItemToDelete(null)}>Cancel</button>
              <button className="btn-primary" style={{ background: 'var(--accent-rose)', color: '#fff', border: 'none', padding: '8px 16px', fontWeight: 700, borderRadius: 8 }} onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {itemToRename && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <form onSubmit={handleConfirmRename} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 24, maxWidth: 400, width: '100%', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>Rename {itemToRename.name}</h3>
            <input
              type="text"
              className="search-input"
              style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem', marginBottom: 20 }}
              value={renameInputValue}
              onChange={e => setRenameInputValue(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="tool-btn" style={{ padding: '8px 16px', fontWeight: 700 }} onClick={() => setItemToRename(null)}>Cancel</button>
              <button type="submit" className="btn-primary" style={{ padding: '8px 16px', fontWeight: 700 }}>Save</button>
            </div>
          </form>
        </div>
      )}
    </aside>
  );
};
