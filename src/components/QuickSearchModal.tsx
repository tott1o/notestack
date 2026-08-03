import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  X, 
  FileText, 
  BookOpen, 
  File, 
  Code, 
  FileSpreadsheet, 
  Image as ImageIcon, 
  Video as VideoIcon,
  Plus,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import type { FileItem } from '../types';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileItem[];
  openTabs?: FileItem[];
  activeFile?: FileItem | null;
  onSelectFile: (file: FileItem) => void;
  onCreateNewNote: () => void;
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({
  isOpen,
  onClose,
  files,
  openTabs = [],
  activeFile,
  onSelectFile,
  onCreateNewNote
}) => {
  const [query, setQuery] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Flatten tree recursively to get all vault files
  const allFlattenedFiles = useMemo(() => {
    const flatten = (items: FileItem[]): FileItem[] => {
      let result: FileItem[] = [];
      for (const item of items) {
        if (item.type !== 'folder') {
          result.push(item);
        }
        if (item.children && item.children.length > 0) {
          result = result.concat(flatten(item.children));
        }
      }
      return result;
    };
    return flatten(files);
  }, [files]);

  // Filter & prioritize open tabs in search results
  const filteredFiles = useMemo(() => {
    const openTabSet = new Set(openTabs.map(t => t.fullPath || t.path || t.id));
    const activePath = activeFile ? (activeFile.fullPath || activeFile.path || activeFile.id) : null;
    const q = query.toLowerCase().trim();

    let matches = allFlattenedFiles;
    if (q) {
      matches = allFlattenedFiles.filter(f => 
        f.name.toLowerCase().includes(q) ||
        (f.path && f.path.toLowerCase().includes(q)) ||
        (f.extension && f.extension.toLowerCase().includes(q)) ||
        (f.moduleName && f.moduleName.toLowerCase().includes(q))
      );
    }

    // Sort so active file & open tabs appear at the top!
    const sorted = [...matches].sort((a, b) => {
      const aKey = a.fullPath || a.path || a.id;
      const bKey = b.fullPath || b.path || b.id;

      const aActive = aKey === activePath;
      const bActive = bKey === activePath;
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;

      const aOpen = openTabSet.has(aKey);
      const bOpen = openTabSet.has(bKey);
      if (aOpen && !bOpen) return -1;
      if (!aOpen && bOpen) return 1;

      return 0;
    });

    return sorted.slice(0, 40);
  }, [allFlattenedFiles, query, openTabs, activeFile]);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < filteredFiles.length ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredFiles.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex === 0) {
          onClose();
          onCreateNewNote();
        } else if (filteredFiles[selectedIndex - 1]) {
          onSelectFile(filteredFiles[selectedIndex - 1]);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredFiles, onClose, onSelectFile, onCreateNewNote]);

  if (!isOpen) return null;

  const getFileIcon = (type?: string) => {
    switch (type) {
      case 'md': return <FileText size={16} style={{ color: '#818cf8' }} />;
      case 'pdf': return <BookOpen size={16} style={{ color: '#fb7185' }} />;
      case 'docx': return <File size={16} style={{ color: '#38bdf8' }} />;
      case 'code': return <Code size={16} style={{ color: '#4ade80' }} />;
      case 'csv': return <FileSpreadsheet size={16} style={{ color: '#34d399' }} />;
      case 'image': return <ImageIcon size={16} style={{ color: '#f59e0b' }} />;
      case 'video': return <VideoIcon size={16} style={{ color: '#c084fc' }} />;
      default: return <FileText size={16} style={{ color: 'var(--primary)' }} />;
    }
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh'
      }}
    >
      <div 
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '640px',
          maxWidth: '90vw',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-highlight)',
          borderRadius: 'var(--radius-xl, 16px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '75vh'
        }}
      >
        {/* Top Search Input Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-surface-elevated)'
        }}>
          <Search size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search vault files by name or extension..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-main)',
              fontSize: '1.02rem',
              fontWeight: 500
            }}
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
            >
              <X size={16} />
            </button>
          )}
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Results List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          {/* Action 0: Create New Note */}
          <div
            onClick={() => {
              onClose();
              onCreateNewNote();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 'var(--radius-md, 8px)',
              background: selectedIndex === 0 ? 'var(--primary-light)' : 'transparent',
              border: selectedIndex === 0 ? '1px solid var(--primary)' : '1px solid transparent',
              cursor: 'pointer',
              marginBottom: 4,
              transition: 'background 0.15s ease'
            }}
          >
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'var(--primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Plus size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                Create New Note / File...
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Create a markdown note or code file in your active vault
              </div>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: 4 }}>
              Enter ↵
            </span>
          </div>

          <div style={{ height: 1, background: 'var(--border-color)', margin: '6px 0' }} />          {/* Files List */}
          {filteredFiles.length > 0 ? (
            filteredFiles.map((file, idx) => {
              const isSelected = selectedIndex === idx + 1;
              const fKey = file.fullPath || file.path || file.id;
              const isActive = activeFile && (activeFile.fullPath || activeFile.path || activeFile.id) === fKey;
              const isOpenTab = openTabs.some(t => (t.fullPath || t.path || t.id) === fKey);

              return (
                <div
                  key={file.id}
                  onClick={() => {
                    onSelectFile(file);
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md, 8px)',
                    background: isSelected ? 'var(--bg-surface-hover)' : 'transparent',
                    border: isSelected ? '1px solid var(--border-highlight)' : '1px solid transparent',
                    cursor: 'pointer',
                    marginBottom: 2,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ flexShrink: 0 }}>
                    {getFileIcon(file.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-main)' }}>
                        {file.name}
                      </span>
                      {isActive ? (
                        <span className="ai-file-tab-badge active">active tab</span>
                      ) : isOpenTab ? (
                        <span className="ai-file-tab-badge">open tab</span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.moduleName ? `${file.moduleName} • ` : ''}{file.path}
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)', opacity: isSelected ? 1 : 0.4 }} />
                </div>
              );
            })
          ) : (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
              No vault files found matching "{query}"
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <div style={{
          padding: '8px 16px',
          background: 'var(--bg-surface-elevated)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.74rem',
          color: 'var(--text-muted)'
        }}>
          <span>Use <b>↑ ↓</b> to navigate, <b>Enter</b> to select</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Sparkles size={13} style={{ color: 'var(--primary)' }} /> Quick Vault Search
          </span>
        </div>
      </div>
    </div>
  );
};
