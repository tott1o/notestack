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
  FolderOpen,
  Presentation,
  Image as ImageIcon,
  Video as VideoIcon,
  Calendar
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
  const [activeTab, setActiveTab] = useState<'all' | 'notes' | 'pptx' | 'pdf' | 'code' | 'starred'>('all');
  const [dashSearch, setDashSearch] = useState<string>('');

  // Time-based Greeting & Current Date
  const { greeting, currentDate } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    let greet = 'Good Morning ☀️';
    if (hour >= 12 && hour < 18) greet = 'Good Afternoon 🌤️';
    else if (hour >= 18) greet = 'Good Evening 🌙';

    const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return { greeting: greet, currentDate: dateStr };
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
    let md = 0, code = 0, csv = 0, pdf = 0, docx = 0, pptx = 0, fav = 0;
    for (const file of allFiles) {
      if (file.isFavorite) fav++;
      if (file.type === 'md') md++;
      else if (file.type === 'code') code++;
      else if (file.type === 'csv') csv++;
      else if (file.type === 'pdf') pdf++;
      else if (file.type === 'docx') docx++;
      else if (file.type === 'pptx') pptx++;
    }
    return { md, code, csv, pdf, docx, pptx, fav, total: allFiles.length, folders: allFolders.length };
  }, [allFiles, allFolders]);

  const filteredFiles = useMemo(() => {
    let result = allFiles;
    if (activeTab === 'notes') result = result.filter(f => f.type === 'md');
    else if (activeTab === 'pptx') result = result.filter(f => f.type === 'pptx');
    else if (activeTab === 'pdf') result = result.filter(f => f.type === 'pdf');
    else if (activeTab === 'code') result = result.filter(f => f.type === 'code');
    else if (activeTab === 'starred') result = result.filter(f => f.isFavorite);

    if (dashSearch.trim()) {
      const q = dashSearch.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(q) || (f.moduleName && f.moduleName.toLowerCase().includes(q)));
    }
    return result;
  }, [allFiles, activeTab, dashSearch]);

  // Format Breakdown Percentages
  const percentages = useMemo(() => {
    const total = counts.total || 1;
    return {
      md: Math.round((counts.md / total) * 100),
      pptx: Math.round((counts.pptx / total) * 100),
      code: Math.round((counts.code / total) * 100),
      pdf: Math.round((counts.pdf / total) * 100),
      other: Math.round(((counts.csv + counts.docx) / total) * 100)
    };
  }, [counts]);

  return (
    <div className="dashboard-container" style={{ padding: '32px 40px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--bg-main)', boxSizing: 'border-box' }}>
      
      {/* 1. Hero Glassmorphic Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-surface-elevated) 100%)',
        border: '1px solid var(--border-color)',
        borderRadius: 24,
        padding: '28px 32px',
        marginBottom: 28,
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 20,
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: -50, right: -50, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, var(--primary-light) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 900, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'var(--primary-light)', padding: '4px 12px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} /> Knowledge Hub & Vault Dashboard
            </span>
            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-dim)', background: 'var(--bg-surface)', padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={13} /> {currentDate}
            </span>
          </div>

          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-main)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.03em', margin: 0 }}>
            {greeting}, Scholar
          </h1>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 6, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <HardDrive size={16} style={{ color: 'var(--primary)' }} /> Active Vault: <strong style={{ color: 'var(--text-main)' }}>{mainDir.name || 'NoteStack Vault'}</strong> · {counts.total} items stored across {counts.folders} directories
          </p>
        </div>

        {/* Universal Vault Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', zIndex: 2 }}>
          {/* Vault Search Input */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 240 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, color: 'var(--text-dim)' }} />
            <input
              type="text"
              className="search-input"
              style={{ paddingLeft: 34, paddingRight: 28, width: '100%', padding: '10px 28px 10px 34px', fontSize: '0.84rem', borderRadius: 12 }}
              placeholder="Search vault documents..."
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
            style={{ padding: '10px 18px', borderRadius: 12, fontSize: '0.86rem', fontWeight: 800, boxShadow: 'var(--shadow-sm)' }}
          >
            <FilePlus size={16} /> + New Document
          </button>

          <button 
            className="tool-btn" 
            onClick={() => onCreateFolder()}
            style={{ padding: '10px 18px', borderRadius: 12, fontSize: '0.86rem', border: '1px solid var(--border-color)', fontWeight: 700 }}
          >
            <FolderPlus size={16} /> + New Folder
          </button>

          <button 
            className="tool-btn" 
            onClick={onSelectMainDirectory}
            style={{ padding: '10px 18px', borderRadius: 12, fontSize: '0.86rem', border: '1px solid var(--border-color)', fontWeight: 700 }}
          >
            <FolderOpen size={16} /> Switch Vault
          </button>
        </div>
      </div>

      {/* 2. Format Metrics Grid Cards (Top Analytics Row) */}
      <div className="dashboard-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18, marginBottom: 28 }}>
        {/* Markdown Metric Card */}
        <div 
          className="metric-card" 
          style={{ padding: '20px 22px', borderRadius: 18, cursor: 'pointer', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', transition: 'transform 0.2s ease, boxShadow 0.2s ease' }} 
          onClick={() => setActiveTab('notes')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div className="metric-icon-box" style={{ background: 'rgba(129, 140, 248, 0.15)', color: '#818cf8', padding: 10, borderRadius: 12 }}>
              <FileText size={24} />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#818cf8', background: 'rgba(129, 140, 248, 0.12)', padding: '3px 10px', borderRadius: 14 }}>
              {percentages.md}% of Vault
            </span>
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-main)' }}>{counts.md}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700 }}>Markdown Notes</div>
          </div>
        </div>

        {/* PPT Metric Card */}
        <div 
          className="metric-card" 
          style={{ padding: '20px 22px', borderRadius: 18, cursor: 'pointer', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', transition: 'transform 0.2s ease, boxShadow 0.2s ease' }} 
          onClick={() => setActiveTab('pptx')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div className="metric-icon-box" style={{ background: 'rgba(249, 115, 22, 0.15)', color: '#f97316', padding: 10, borderRadius: 12 }}>
              <Presentation size={24} />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#f97316', background: 'rgba(249, 115, 22, 0.12)', padding: '3px 10px', borderRadius: 14 }}>
              {percentages.pptx}% of Vault
            </span>
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-main)' }}>{counts.pptx}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700 }}>PowerPoint Decks</div>
          </div>
        </div>

        {/* PDF Metric Card */}
        <div 
          className="metric-card" 
          style={{ padding: '20px 22px', borderRadius: 18, cursor: 'pointer', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', transition: 'transform 0.2s ease, boxShadow 0.2s ease' }} 
          onClick={() => setActiveTab('pdf')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div className="metric-icon-box" style={{ background: 'rgba(251, 113, 133, 0.15)', color: '#fb7185', padding: 10, borderRadius: 12 }}>
              <BookOpen size={24} />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#fb7185', background: 'rgba(251, 113, 133, 0.12)', padding: '3px 10px', borderRadius: 14 }}>
              {percentages.pdf}% of Vault
            </span>
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-main)' }}>{counts.pdf}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700 }}>PDF Textbooks</div>
          </div>
        </div>

        {/* Code Metric Card */}
        <div 
          className="metric-card" 
          style={{ padding: '20px 22px', borderRadius: 18, cursor: 'pointer', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', transition: 'transform 0.2s ease, boxShadow 0.2s ease' }} 
          onClick={() => setActiveTab('code')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div className="metric-icon-box" style={{ background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', padding: 10, borderRadius: 12 }}>
              <Code size={24} />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#4ade80', background: 'rgba(74, 222, 128, 0.12)', padding: '3px 10px', borderRadius: 14 }}>
              {percentages.code}% of Vault
            </span>
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-main)' }}>{counts.code}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700 }}>Code Scripts</div>
          </div>
        </div>

        {/* Starred Favorites Metric Card */}
        <div 
          className="metric-card" 
          style={{ padding: '20px 22px', borderRadius: 18, cursor: 'pointer', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', transition: 'transform 0.2s ease, boxShadow 0.2s ease' }} 
          onClick={() => setActiveTab('starred')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div className="metric-icon-box" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', padding: 10, borderRadius: 12 }}>
              <Star size={24} />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--accent-amber)', background: 'rgba(245, 158, 11, 0.12)', padding: '3px 10px', borderRadius: 14 }}>
              Starred
            </span>
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-main)' }}>{counts.fav}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700 }}>Starred Favorites</div>
          </div>
        </div>
      </div>

      {/* 3. Main Explorer Body (Feed + Sidebar Analytics) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 28, flex: 1, minHeight: 0 }}>
        
        {/* Left Column: Recent Vault Feed */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 22,
          padding: 24,
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '1rem', fontWeight: 900, color: 'var(--text-main)' }}>
              <Clock size={20} style={{ color: 'var(--primary)' }} />
              <span>Recent Vault Feed ({filteredFiles.length})</span>
            </div>

            {/* Category Navigation Tabs */}
            <div style={{ display: 'flex', background: 'var(--bg-surface-elevated)', padding: 4, borderRadius: 12, border: '1px solid var(--border-color)', gap: 2 }}>
              {[
                { id: 'all', label: 'All Files' },
                { id: 'notes', label: 'Notes' },
                { id: 'pptx', label: 'PPT Decks' },
                { id: 'pdf', label: 'PDF Books' },
                { id: 'code', label: 'Code' },
                { id: 'starred', label: '★ Starred' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 8,
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    border: 'none',
                    background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                    color: activeTab === tab.id ? '#ffffff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Document Feed List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', flex: 1, paddingRight: 4 }}>
            {filteredFiles.length > 0 ? (
              filteredFiles.map(file => (
                <div
                  key={file.id}
                  onClick={() => onSelectFile(file)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: 14,
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                  className="breadcrumb-item"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {file.type === 'md' && <FileText size={20} style={{ color: '#818cf8', flexShrink: 0 }} />}
                    {file.type === 'pdf' && <BookOpen size={20} style={{ color: '#fb7185', flexShrink: 0 }} />}
                    {file.type === 'pptx' && <Presentation size={20} style={{ color: '#f97316', flexShrink: 0 }} />}
                    {file.type === 'code' && <Code size={20} style={{ color: '#4ade80', flexShrink: 0 }} />}
                    {file.type === 'csv' && <FileSpreadsheet size={20} style={{ color: '#34d399', flexShrink: 0 }} />}
                    {file.type === 'docx' && <File size={20} style={{ color: '#38bdf8', flexShrink: 0 }} />}
                    {file.type === 'image' && <ImageIcon size={20} style={{ color: '#22d3ee', flexShrink: 0 }} />}
                    {file.type === 'video' && <VideoIcon size={20} style={{ color: '#c084fc', flexShrink: 0 }} />}

                    <div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {file.name}
                        {file.isFavorite && <Star size={13} fill="var(--accent-amber)" color="var(--accent-amber)" />}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 3 }}>
                        Folder: {file.moduleName || 'Root Vault'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button 
                      className="star-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(file.id);
                      }}
                      title={file.isFavorite ? "Unstar File" : "Star File"}
                      style={{ color: file.isFavorite ? 'var(--accent-amber)' : 'var(--text-dim)' }}
                    >
                      <Star size={15} fill={file.isFavorite ? 'var(--accent-amber)' : 'none'} />
                    </button>

                    <span 
                      style={{ 
                        fontSize: '0.68rem', 
                        fontWeight: 900, 
                        textTransform: 'uppercase', 
                        padding: '3px 9px', 
                        borderRadius: 8,
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-muted)'
                      }}
                    >
                      {file.extension || file.type}
                    </span>
                    <ArrowRight size={16} style={{ color: 'var(--text-dim)' }} />
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No matching files found in vault.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Directories Tree & Storage Analytics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Vault Directories Explorer */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 22,
            padding: 22,
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            flex: 1
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.94rem', fontWeight: 900, color: 'var(--text-main)' }}>
                <Folder size={18} style={{ color: 'var(--accent-amber)' }} />
                <span>Vault Directories ({allFolders.length})</span>
              </div>
              <button className="btn-icon" onClick={() => onCreateFolder()} title="Create Subfolder" style={{ width: 28, height: 28 }}>
                <FolderPlus size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1, paddingRight: 2 }}>
              {allFolders.length > 0 ? (
                allFolders.map(folder => (
                  <div
                    key={folder.id}
                    onClick={() => onCreateNewNote(folder.path.replace(/^\//, ''))}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.84rem',
                      fontWeight: 700,
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
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-dim)', background: 'var(--bg-surface)', padding: '2px 7px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                      {folder.children?.length || 0} items
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>No subfolders in vault.</div>
              )}
            </div>
          </div>

          {/* Vault Format Breakdown Analytics Bar */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 22,
            padding: 22,
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: '0.94rem', fontWeight: 900, color: 'var(--text-main)' }}>
              <PieChart size={18} style={{ color: 'var(--primary)' }} />
              <span>Vault Format Breakdown</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>Markdown Notes</span>
                  <span style={{ color: '#818cf8' }}>{percentages.md}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-surface-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${percentages.md}%`, height: '100%', background: '#818cf8' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>PowerPoint Decks</span>
                  <span style={{ color: '#f97316' }}>{percentages.pptx}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-surface-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${percentages.pptx}%`, height: '100%', background: '#f97316' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>Code Files</span>
                  <span style={{ color: '#4ade80' }}>{percentages.code}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-surface-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${percentages.code}%`, height: '100%', background: '#4ade80' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>PDF Textbooks</span>
                  <span style={{ color: '#fb7185' }}>{percentages.pdf}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-surface-elevated)', borderRadius: 4, overflow: 'hidden' }}>
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
