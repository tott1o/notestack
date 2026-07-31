import React from 'react';
import { 
  FileText, 
  BookOpen, 
  File, 
  Code, 
  FileSpreadsheet, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  X, 
  Plus,
  LayoutDashboard
} from 'lucide-react';
import type { FileItem } from '../types';

interface TabBarProps {
  openTabs: FileItem[];
  activeFile: FileItem | null;
  onSelectTab: (file: FileItem) => void;
  onCloseTab: (fileId: string, e: React.MouseEvent) => void;
  onGoToDashboard: () => void;
  isDashboardActive: boolean;
  onNewNoteClick: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  openTabs,
  activeFile,
  onSelectTab,
  onCloseTab,
  onGoToDashboard,
  isDashboardActive,
  onNewNoteClick
}) => {
  const getFileIcon = (type?: string) => {
    switch (type) {
      case 'md': return <FileText size={14} style={{ color: '#818cf8' }} />;
      case 'pdf': return <BookOpen size={14} style={{ color: '#fb7185' }} />;
      case 'pptx': return <File size={14} style={{ color: '#f97316' }} />;
      case 'docx': return <File size={14} style={{ color: '#38bdf8' }} />;
      case 'code': return <Code size={14} style={{ color: '#4ade80' }} />;
      case 'csv': return <FileSpreadsheet size={14} style={{ color: '#34d399' }} />;
      case 'image': return <ImageIcon size={14} style={{ color: '#f59e0b' }} />;
      case 'video': return <VideoIcon size={14} style={{ color: '#c084fc' }} />;
      default: return <FileText size={14} style={{ color: 'var(--primary)' }} />;
    }
  };

  return (
    <div className="browser-tab-bar">
      <div className="tab-scroll-container">
        {/* Dashboard Fixed Primary Tab */}
        <button
          className={`app-tab dashboard-tab ${isDashboardActive ? 'active' : ''}`}
          onClick={onGoToDashboard}
          title="Vault Overview & Galaxy Brain"
        >
          <LayoutDashboard size={14} style={{ color: isDashboardActive ? 'var(--primary)' : 'var(--text-muted)' }} />
          <span className="tab-title">Dashboard</span>
        </button>

        {/* Dynamic File Viewer Tabs */}
        {openTabs.map((file) => {
          const isActive = !isDashboardActive && activeFile?.id === file.id;
          return (
            <div
              key={file.id}
              className={`app-tab ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(file)}
              title={`${file.name} (${file.moduleName || 'Root'})`}
            >
              <span className="tab-icon">{getFileIcon(file.type)}</span>
              <span className="tab-title">{file.name}</span>
              <button
                className="tab-close-btn"
                onClick={(e) => onCloseTab(file.id, e)}
                title="Close Tab"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* New Note / Tab Action Button */}
      <button
        className="new-tab-btn"
        onClick={onNewNoteClick}
        title="Create New Note"
      >
        <Plus size={15} />
      </button>
    </div>
  );
};
