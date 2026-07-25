import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  FileText, 
  FolderPlus, 
  FilePlus, 
  Sparkles, 
  Clock, 
  Star,
  Code,
  HardDrive,
  FileSpreadsheet,
  File,
  ArrowRight,
  Search,
  Folder,
  X,
  PieChart,
  FolderOpen
} from 'lucide-react';
import type { FileItem, MainDirectory } from '../types';

interface DashboardOverviewProps {
  mainDir: MainDirectory;
  onSelectMainDirectory: () => void;
  onSelectFile: (file: FileItem) => void;
  onCreateNewNote: (folderPath?: string) => void;
  onCreateFolder: (parentFolderPath?: string) => void;
  onToggleFavorite: (fileId: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  mainDir,
  onSelectMainDirectory,
  onSelectFile,
  onCreateNewNote,
  onCreateFolder,
  onToggleFavorite
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'notes' | 'pdf' | 'starred'>('all');
  const [dashSearch, setDashSearch] = useState<string>('');

  // Time-based Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning ☀️';
    if (hour < 18) return 'Good Afternoon 🌤️';
    return 'Good Evening 🌙';
  }, []);

  // Recursively collect all files and subfolders
  const { allFiles, allFolders } = useMemo(() => {
    const files: FileItem[] = [];
    const folders: FileItem[] = [];

    const traverse = (items: FileItem[]) => {
      for (const item of items) {
        if (item.type === 'folder') {
          folders.push(item);
          if (item.children) traverse(item.children);
        } else {
          files.push(item);
        }
      }
    };

    traverse(mainDir.files);
    return { allFiles: files, allFolders: folders };
  }, [mainDir.files]);

  const counts = useMemo(() => {
    let md = 0, code = 0, csv = 0, pdf = 0, docx = 0, fav = 0;
    for (const file of allFiles) {
      if (file.isFavorite) fav++;
      if (file.type === 'md') md++;
      else if (file.type === 'code') code++;
      else if (file.type === 'csv') csv++;
      else if (file.type === 'pdf') pdf++;
      else if (file.type === 'docx') docx++;
    }
    return { md, code, csv, pdf, docx, fav, total: allFiles.length, folders: allFolders.length };
  }, [allFiles, allFolders]);

  const filteredFiles = useMemo(() => {
    let result = allFiles;
    if (activeTab === 'notes') result = result.filter(f => f.type === 'md' || f.type === 'code');
    else if (activeTab === 'pdf') result = result.filter(f => f.type === 'pdf');
    else if (activeTab === 'starred') result = result.filter(f => f.isFavorite);

    if (dashSearch.trim()) {
      const q = dashSearch.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(q) || (f.moduleName && f.moduleName.toLowerCase().includes(q)));
    }
    return result;
  }, [allFiles, activeTab, dashSearch]);

  // Breakdown percentages
  const percentages = useMemo(() => {
    const total = counts.total || 1;
    return {
      md: Math.round((counts.md / total) * 100),
      code: Math.round((counts.code / total) * 100),
      pdf: Math.round((counts.pdf / total) * 100),
      other: Math.round(((counts.csv + counts.docx) / total) * 100)
    };
  }, [counts]);

  return (
    <div className="dashboard-container" style={{ padding: '24px 32px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--bg-main)', boxSizing: 'border-box' }}>
      
      {/* 1. Header Banner */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        marginBottom: 24,
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} /> Knowledge Hub & Vault Dashboard
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.5px', margin: 0 }}>
            {greeting}, Scholar
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <HardDrive size={14} /> Active Vault: <strong style={{ color: 'var(--text-main)' }}>{mainDir.name || 'NoteStack Vault'}</strong> · {counts.total} items stored
          </p>
        </div>

        {/* Quick Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Quick Search */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 240 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, color: 'var(--text-dim)' }} />
            <input
              type="text"
              className="search-input"
              style={{ paddingLeft: 34, paddingRight: 28, width: '100%', padding: '8px 28px 8px 34px', fontSize: '0.84rem' }}
              placeholder="Search vault notes..."
              value={dashSearch}
              onChange={e => setDashSearch(e.target.value)}
            />
            {dashSearch && (
              <X size={14} style={{ position: 'absolute', right: 10, cursor: 'pointer', color: 'var(--text-dim)' }} onClick={() => setDashSearch('')} />
            )}
          </div>

          <button 
            className="btn-primary" 
            onClick={() => onCreateNewNote()}
            style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.84rem' }}
          >
            <FilePlus size={16} /> + New File
          </button>

          <button 
            className="tool-btn" 
            onClick={() => onCreateFolder()}
            style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.84rem', border: '1px solid var(--border-color)' }}
          >
            <FolderPlus size={16} /> + New Folder
          </button>

          <button 
            className="tool-btn" 
            onClick={onSelectMainDirectory}
            style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.84rem', border: '1px solid var(--border-color)' }}
          >
            <FolderOpen size={16} /> Switch Vault
          </button>
        </div>
      </div>

      {/* 2. Analytics Metric Cards Grid */}
      <div className="dashboard-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="metric-card" style={{ padding: '16px 18px', cursor: 'pointer' }} onClick={() => setActiveTab('notes')}>
          <div className="metric-icon-box" style={{ background: 'rgba(129, 140, 248, 0.15)', color: '#818cf8' }}>
            <FileText size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{counts.md}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Markdown Notes</div>
          </div>
        </div>

        <div className="metric-card" style={{ padding: '16px 18px', cursor: 'pointer' }} onClick={() => setActiveTab('pdf')}>
          <div className="metric-icon-box" style={{ background: 'rgba(251, 113, 133, 0.15)', color: '#fb7185' }}>
            <BookOpen size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{counts.pdf}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>PDF Textbooks</div>
          </div>
        </div>

        <div className="metric-card" style={{ padding: '16px 18px', cursor: 'pointer' }} onClick={() => setActiveTab('notes')}>
          <div className="metric-icon-box" style={{ background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80' }}>
            <Code size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{counts.code}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Code Scripts</div>
          </div>
        </div>

        <div className="metric-card" style={{ padding: '16px 18px' }}>
          <div className="metric-icon-box" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{counts.csv + counts.docx}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Datasets & Docs</div>
          </div>
        </div>

        <div className="metric-card" style={{ padding: '16px 18px', cursor: 'pointer' }} onClick={() => setActiveTab('starred')}>
          <div className="metric-icon-box" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)' }}>
            <Star size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{counts.fav}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Starred Favorites</div>
          </div>
        </div>
      </div>

      {/* 3. Main Explorer Body (Feed + Sidebar Panels) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, flex: 1, minHeight: 0 }}>
        
        {/* Left Pane: Recent Vault Feed */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: 20,
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-main)' }}>
              <Clock size={17} style={{ color: 'var(--primary)' }} />
              <span>Vault Documents ({filteredFiles.length})</span>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', background: 'var(--bg-surface-elevated)', padding: 3, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', gap: 2 }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'notes', label: 'Notes & Code' },
                { id: 'pdf', label: 'PDFs' },
                { id: 'starred', label: '★ Starred' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: 'none',
                    background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                    color: activeTab === tab.id ? '#ffffff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'var(--transition)'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Document Feed List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1, paddingRight: 4 }}>
            {filteredFiles.length > 0 ? (
              filteredFiles.map(file => (
                <div
                  key={file.id}
                  onClick={() => onSelectFile(file)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'var(--transition)'
                  }}
                  className="breadcrumb-item"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {file.type === 'md' && <FileText size={17} style={{ color: '#818cf8' }} />}
                    {file.type === 'pdf' && <BookOpen size={17} style={{ color: '#fb7185' }} />}
                    {file.type === 'code' && <Code size={17} style={{ color: '#4ade80' }} />}
                    {file.type === 'csv' && <FileSpreadsheet size={17} style={{ color: '#34d399' }} />}
                    {file.type === 'docx' && <File size={17} style={{ color: '#38bdf8' }} />}

                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {file.name}
                        {file.isFavorite && <Star size={12} fill="var(--accent-amber)" color="var(--accent-amber)" />}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Folder: {file.moduleName || 'Root'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button 
                      className="star-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(file.id);
                      }}
                      title={file.isFavorite ? "Unstar File" : "Star File"}
                      style={{ color: file.isFavorite ? 'var(--accent-amber)' : 'var(--text-dim)' }}
                    >
                      <Star size={13} fill={file.isFavorite ? 'var(--accent-amber)' : 'none'} />
                    </button>

                    <span className={`file-tag-badge ${file.type}`}>
                      {file.extension || file.type}
                    </span>
                    <ArrowRight size={14} style={{ color: 'var(--text-dim)' }} />
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                No matching files in vault.
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Vault Folders & Storage Composition */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Subfolders Explorer */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: 18,
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            flex: 1
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)' }}>
                <Folder size={16} style={{ color: 'var(--primary)' }} />
                <span>Vault Directories ({allFolders.length})</span>
              </div>
              <button className="btn-icon" onClick={() => onCreateFolder()} title="Create Subfolder" style={{ width: 26, height: 26 }}>
                <FolderPlus size={13} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flex: 1, paddingRight: 2 }}>
              {allFolders.length > 0 ? (
                allFolders.map(folder => (
                  <div
                    key={folder.id}
                    onClick={() => onCreateNewNote(folder.path.replace(/^\//, ''))}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer'
                    }}
                    className="breadcrumb-item"
                    title={`Click to create note inside ${folder.name}`}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      📁 {folder.name}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {folder.children?.length || 0} items
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No subfolders in vault.</div>
              )}
            </div>
          </div>

          {/* Vault Composition Bar */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: 18,
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-main)' }}>
              <PieChart size={16} style={{ color: 'var(--primary)' }} />
              <span>Vault Breakdown</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>Markdown Notes</span>
                  <span>{percentages.md}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-surface-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${percentages.md}%`, height: '100%', background: '#818cf8' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>Code Files</span>
                  <span>{percentages.code}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-surface-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${percentages.code}%`, height: '100%', background: '#4ade80' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>PDF Textbooks</span>
                  <span>{percentages.pdf}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-surface-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${percentages.pdf}%`, height: '100%', background: '#fb7185' }} />
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
