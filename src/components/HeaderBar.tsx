import React from 'react';
import { 
  Folder, 
  Moon, 
  Sun, 
  BookOpen,
  Terminal,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Settings as SettingsIcon
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
  onOpenSettings?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  mainDirName,
  activeFile: _activeFile,
  viewMode: _viewMode,
  onSetViewMode: _onSetViewMode,
  settings,
  onUpdateSettings,
  onGoToDashboard,
  isSidebarVisible,
  onToggleSidebar,
  isAIChatOpen,
  onToggleAIChat,
  onOpenSettings
}) => {

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

        {/* Settings Modal Toggle */}
        <button
          className="tool-btn"
          onClick={onOpenSettings}
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0
          }}
          title="Open App Settings"
        >
          <SettingsIcon size={14} />
          <span>Settings</span>
        </button>

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
