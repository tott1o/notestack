import React, { useState } from 'react';
import { FolderPlus, X, Folder } from 'lucide-react';
import type { FileItem, MainDirectory } from '../types';

interface CreateFolderModalProps {
  mainDir: MainDirectory;
  initialParentFolderPath?: string;
  onClose: () => void;
  onCreateFolder: (folderName: string, parentFolderPath?: string) => void;
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  mainDir,
  initialParentFolderPath,
  onClose,
  onCreateFolder
}) => {
  const [folderName, setFolderName] = useState<string>('');
  const [parentFolder, setParentFolder] = useState<string>(initialParentFolderPath || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    onCreateFolder(folderName.trim(), parentFolder.trim() || undefined);
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
  const displayParent = parentFolder ? parentFolder.replace(/^\//, '') : '';
  const previewFolderName = folderName.trim() || 'new_folder';
  const previewPath = displayParent ? `/${mainDir.name}/${displayParent}/${previewFolderName}` : `/${mainDir.name}/${previewFolderName}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: 500, 
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
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', background: 'linear-gradient(180deg, var(--bg-surface-elevated), var(--bg-surface))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, background: 'linear-gradient(135deg, var(--primary), #4338ca)', color: '#fff', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-glow)' }}>
              <FolderPlus size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.3px' }}>
                Create New Folder
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Organize notes and code modules into structured subdirectories</p>
            </div>
          </div>

          <button className="btn-icon" onClick={onClose} style={{ width: 30, height: 30 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Folder Name Input */}
          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Folder Name
            </label>
            <input 
              type="text" 
              className="search-input" 
              style={{ paddingLeft: 14, fontSize: '0.9rem', height: 42 }}
              placeholder="e.g. Lesson-01-Algebra or Lab-Experiments"
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              autoFocus
              required
            />
          </div>

          {/* Parent Folder Location Picker */}
          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Parent Folder Location
            </label>
            <select 
              className="search-input" 
              style={{ paddingLeft: 12, fontSize: '0.85rem', height: 40, cursor: 'pointer' }}
              value={parentFolder}
              onChange={e => setParentFolder(e.target.value)}
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
            <span style={{ fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', fontSize: '0.7rem' }}>DIRECTORY:</span>
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
              <Folder size={15} /> Create Folder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
