import React, { useState, useMemo } from 'react';
import { 
  Folder, 
  ChevronRight, 
  FileText, 
  Moon, 
  Sun, 
  BookOpen,
  Terminal,
  Code,
  FileSpreadsheet,
  Image as ImageIcon,
  Video as VideoIcon,
  File,
  Copy,
  Check,
  PanelLeftClose,
  PanelLeft,
  Sparkles
} from 'lucide-react';
import type { FileItem, ReadingSettings, ViewMode } from '../types';

interface HeaderBarProps {
  mainDirName: string;
  activeFile: FileItem | null;
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
  settings: ReadingSettings;
  onUpdateSettings: (newSettings: Partial<ReadingSettings>) => void;
  onGoToDashboard: () => void;
  isSidebarVisible: boolean;
  onToggleSidebar: () => void;
  isAIChatOpen?: boolean;
  onToggleAIChat?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  mainDirName,
  activeFile,
  viewMode: _viewMode,
  onSetViewMode: _onSetViewMode,
  settings,
  onUpdateSettings,
  onGoToDashboard,
  isSidebarVisible,
  onToggleSidebar,
  isAIChatOpen,
  onToggleAIChat
}) => {
  const [copied, setCopied] = useState<boolean>(false);

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

  // Build complete nested breadcrumb folder hierarchy
  const pathSegments = useMemo(() => {
    if (!activeFile) return [];
    const relPath = activeFile.path || activeFile.fullPath || '';
    const normalized = relPath.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length > 0 && parts[parts.length - 1] === activeFile.name) {
      parts.pop();
    }
    return parts;
  }, [activeFile]);

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeFile) return;
    const fullPathStr = activeFile.fullPath || activeFile.path || activeFile.name;
    navigator.clipboard.writeText(fullPathStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <header className="header-bar">
      {/* Left: Universal Sidebar Toggle & Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
        <button
          className="tool-btn"
          onClick={onToggleSidebar}
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-color)',
            color: isSidebarVisible ? 'var(--primary)' : 'var(--text-muted)',
            padding: '4px 8px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0
          }}
          title={isSidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}
        >
          {isSidebarVisible ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
          <span>{isSidebarVisible ? 'Hide Sidebar' : 'Sidebar'}</span>
        </button>

        <div className="breadcrumbs" style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
          <div className="breadcrumb-item" onClick={onGoToDashboard} title="Go to Vault Dashboard">
            <Folder size={16} style={{ color: 'var(--primary)' }} />
            <span style={{ fontWeight: 700 }}>{mainDirName || 'Main Vault'}</span>
          </div>

          {activeFile && (
            <>
              {pathSegments.length > 0 ? (
                pathSegments.map((segment, idx) => (
                  <React.Fragment key={idx}>
                    <ChevronRight size={14} className="breadcrumb-separator" />
                    <div className="breadcrumb-item" title={`Folder: ${segment}`}>
                      <span style={{ color: 'var(--text-muted)' }}>{segment}</span>
                    </div>
                  </React.Fragment>
                ))
              ) : activeFile.moduleName ? (
                <>
                  <ChevronRight size={14} className="breadcrumb-separator" />
                  <div className="breadcrumb-item">
                    <span style={{ color: 'var(--text-muted)' }}>{activeFile.moduleName}</span>
                  </div>
                </>
              ) : null}

              <ChevronRight size={14} className="breadcrumb-separator" />
              <div className="breadcrumb-item active" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {getFileIcon(activeFile.type)}
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{activeFile.name}</span>
                <span className={`file-tag-badge ${activeFile.type}`} style={{ marginLeft: 4 }}>
                  {activeFile.extension || activeFile.type}
                </span>

                {/* 1-Click Copy Full Path Button */}
                <button
                  onClick={handleCopyPath}
                  className="tool-btn"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: copied ? '#4ade80' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 4px',
                    borderRadius: 4,
                    marginLeft: 4,
                    transition: 'color 0.15s ease'
                  }}
                  title={`Copy Path: ${activeFile.fullPath || activeFile.path}`}
                >
                  {copied ? <Check size={13} style={{ color: '#4ade80' }} /> : <Copy size={13} />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: AI Toggle & Reading Themes */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

        {/* AI Chat Toggle */}
        {onToggleAIChat && (
          <button
            className="tool-btn"
            onClick={onToggleAIChat}
            style={{
              background: isAIChatOpen 
                ? 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(99,102,241,0.25))'
                : 'var(--bg-surface-elevated)',
              border: isAIChatOpen 
                ? '1px solid rgba(168,85,247,0.5)'
                : '1px solid var(--border-color)',
              color: isAIChatOpen ? '#c084fc' : 'var(--text-muted)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.2s ease'
            }}
            title="Toggle AI Chat (Ctrl+Shift+A)"
          >
            <Sparkles size={14} />
            <span>AI</span>
          </button>
        )}

        {/* Theme Selector */}
        <div style={{ display: 'flex', gap: 3, background: 'var(--bg-surface-elevated)', padding: 3, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <button 
            className={`btn-icon ${settings.theme === 'full-black' ? 'active' : ''}`} 
            style={{ width: 28, height: 28, color: settings.theme === 'full-black' ? '#3b82f6' : 'inherit' }} 
            onClick={() => onUpdateSettings({ theme: 'full-black' })}
            title="Terminal Full Black & Blue Theme"
          >
            <Terminal size={14} />
          </button>
          <button 
            className={`btn-icon ${settings.theme === 'dark' ? 'active' : ''}`} 
            style={{ width: 28, height: 28 }} 
            onClick={() => onUpdateSettings({ theme: 'dark' })}
            title="Dark Theme"
          >
            <Moon size={14} />
          </button>
          <button 
            className={`btn-icon ${settings.theme === 'sepia' ? 'active' : ''}`} 
            style={{ width: 28, height: 28 }} 
            onClick={() => onUpdateSettings({ theme: 'sepia' })}
            title="Sepia Reading Theme"
          >
            <BookOpen size={14} />
          </button>
          <button 
            className={`btn-icon ${settings.theme === 'light' ? 'active' : ''}`} 
            style={{ width: 28, height: 28 }} 
            onClick={() => onUpdateSettings({ theme: 'light' })}
            title="Light Theme"
          >
            <Sun size={14} />
          </button>
        </div>
      </div>
    </header>
  );
};
