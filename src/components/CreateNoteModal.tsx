import React, { useState } from 'react';
import { FilePlus, X, FileText, Code, Check } from 'lucide-react';
import type { FileItem, MainDirectory } from '../types';

interface CreateNoteModalProps {
  mainDir: MainDirectory;
  initialModuleName?: string;
  onClose: () => void;
  onCreate: (title: string, moduleName?: string) => void;
}

export const CreateNoteModal: React.FC<CreateNoteModalProps> = ({
  mainDir,
  initialModuleName,
  onClose,
  onCreate
}) => {
  const [fileName, setFileName] = useState<string>('');
  const [selectedFolder, setSelectedFolder] = useState<string>(initialModuleName || '');
  const [fileCategory, setFileCategory] = useState<'md' | 'code'>('md');
  const [codeExt, setCodeExt] = useState<string>('py');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) return;
    
    let rawName = fileName.trim();
    let finalName = rawName;

    if (fileCategory === 'md') {
      if (!rawName.endsWith('.md') && !rawName.endsWith('.markdown')) {
        finalName = `${rawName}.md`;
      }
    } else {
      if (!rawName.includes('.')) {
        finalName = `${rawName}.${codeExt}`;
      }
    }

    onCreate(finalName, selectedFolder.trim() || undefined);
  };

  const getAllFolderOptions = (items: FileItem[], depth: number = 0): Array<{ path: string; name: string; depth: number }> => {
    let options: Array<{ path: string; name: string; depth: number }> = [];
    for (const item of items) {
      if (item.type === 'folder') {
        const relPath = item.path.replace(/^\//, '');
        options.push({ path: relPath, name: item.name, depth });
        if (item.children) {
          options = options.concat(getAllFolderOptions(item.children, depth + 1));
        }
      }
    }
    return options;
  };

  const folderOptions = getAllFolderOptions(mainDir.files);

  // Compute live path preview
  const displayFolder = selectedFolder ? selectedFolder.replace(/^\//, '') : '';
  let previewFileName = fileName.trim() || (fileCategory === 'md' ? 'untitled_note.md' : `script.${codeExt}`);
  if (fileCategory === 'md' && !previewFileName.endsWith('.md')) {
    previewFileName += '.md';
  } else if (fileCategory === 'code' && !previewFileName.includes('.')) {
    previewFileName += `.${codeExt}`;
  }
  const previewPath = displayFolder ? `/${mainDir.name}/${displayFolder}/${previewFileName}` : `/${mainDir.name}/${previewFileName}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: 520, 
          background: 'var(--bg-surface)', 
          border: '1px solid var(--border-color)', 
          borderRadius: 'var(--radius-lg)', 
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          padding: 0
        }} 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, background: 'var(--primary)', color: '#fff', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FilePlus size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.3px' }}>
                Create New File
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Choose note document or programming language file</p>
            </div>
          </div>

          <button className="btn-icon" onClick={onClose} style={{ width: 30, height: 30 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* File Category Switcher Tabs */}
          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              File Category
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div 
                style={{ 
                  padding: '12px 14px', 
                  borderRadius: 'var(--radius-md)', 
                  border: `2px solid ${fileCategory === 'md' ? 'var(--primary)' : 'var(--border-color)'}`,
                  background: fileCategory === 'md' ? 'var(--primary-light)' : 'var(--bg-surface-elevated)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'var(--transition)'
                }}
                onClick={() => setFileCategory('md')}
              >
                <div style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', background: 'rgba(129, 140, 248, 0.2)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>Markdown Note</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>.md document format</div>
                </div>
                {fileCategory === 'md' && <Check size={16} style={{ marginLeft: 'auto', color: 'var(--primary)' }} />}
              </div>

              <div 
                style={{ 
                  padding: '12px 14px', 
                  borderRadius: 'var(--radius-md)', 
                  border: `2px solid ${fileCategory === 'code' ? 'var(--primary)' : 'var(--border-color)'}`,
                  background: fileCategory === 'code' ? 'var(--primary-light)' : 'var(--bg-surface-elevated)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'var(--transition)'
                }}
                onClick={() => setFileCategory('code')}
              >
                <div style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', background: 'rgba(74, 222, 128, 0.2)', color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Code size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>Program Code</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>.py, .cpp, .java, .js, .csv</div>
                </div>
                {fileCategory === 'code' && <Check size={16} style={{ marginLeft: 'auto', color: 'var(--primary)' }} />}
              </div>
            </div>
          </div>

          {/* Programming Extension Select */}
          {fileCategory === 'code' && (
            <div>
              <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Programming Language
              </label>
              <select 
                className="search-input" 
                style={{ paddingLeft: 14, fontSize: '0.88rem', height: 40, cursor: 'pointer' }}
                value={codeExt}
                onChange={e => setCodeExt(e.target.value)}
              >
                <option value="py">🐍 Python (.py)</option>
                <option value="cpp">⚡ C++ (.cpp)</option>
                <option value="c">⚙️ C Language (.c)</option>
                <option value="java">☕ Java (.java)</option>
                <option value="js">🟨 JavaScript (.js)</option>
                <option value="ts">🟦 TypeScript (.ts)</option>
                <option value="csv">📊 CSV Table (.csv)</option>
                <option value="html">🌐 HTML Web (.html)</option>
                <option value="css">🎨 CSS Styles (.css)</option>
                <option value="json">📦 JSON Data (.json)</option>
                <option value="rs">🦀 Rust (.rs)</option>
                <option value="go">🐹 Go (.go)</option>
                <option value="sql">🗄️ SQL (.sql)</option>
                <option value="sh">💻 Shell Script (.sh)</option>
                <option value="txt">📄 Plain Text (.txt)</option>
              </select>
            </div>
          )}

          {/* File Name Input */}
          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              File Name
            </label>
            <input 
              type="text" 
              className="search-input" 
              style={{ paddingLeft: 14, fontSize: '0.9rem', height: 42 }}
              placeholder={fileCategory === 'md' ? 'e.g. Lecture-01-Notes' : `e.g. main_script.${codeExt}`}
              value={fileName}
              onChange={e => setFileName(e.target.value)}
              autoFocus
              required
            />
          </div>

          {/* Target Subfolder Picker */}
          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Target Folder Location
            </label>
            <select 
              className="search-input" 
              style={{ paddingLeft: 12, fontSize: '0.85rem', height: 40, cursor: 'pointer' }}
              value={selectedFolder}
              onChange={e => setSelectedFolder(e.target.value)}
            >
              <option value="">📁 Root Vault ({mainDir.name})</option>
              {folderOptions.map(opt => (
                <option key={opt.path} value={opt.path}>
                  {'  '.repeat(opt.depth)}📁 /{opt.path}
                </option>
              ))}
            </select>
          </div>

          {/* Live Path Preview Banner */}
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', fontSize: '0.7rem' }}>PATH:</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {previewPath}
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4, justifyContent: 'flex-end' }}>
            <button type="button" className="btn-secondary" style={{ padding: '9px 18px' }} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ padding: '9px 24px', fontSize: '0.88rem' }}>
              + Create File
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
