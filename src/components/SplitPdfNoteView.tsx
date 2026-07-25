import React, { useState } from 'react';
import type { FileItem, ReadingSettings } from '../types';
import { PdfViewer } from './PdfViewer';
import { MarkdownViewer } from './MarkdownViewer';
import { FileText, BookOpen, ChevronDown, AlertCircle } from 'lucide-react';

interface SplitPdfNoteViewProps {
  pdfFile: FileItem | null;
  allPdfFiles: FileItem[];
  onSelectPdfFile: (pdf: FileItem) => void;
  markdownFile: FileItem;
  onMarkdownChange: (newContent: string) => void;
  settings: ReadingSettings;
  onToggleBionic: () => void;
  onOpenFlashcards: () => void;
}

export const SplitPdfNoteView: React.FC<SplitPdfNoteViewProps> = ({
  pdfFile,
  allPdfFiles,
  onSelectPdfFile,
  markdownFile,
  onMarkdownChange,
  settings,
  onToggleBionic,
  onOpenFlashcards
}) => {
  const [rightViewMode, setRightViewMode] = useState<'edit' | 'preview' | 'split'>('split');

  return (
    <div style={{ flex: 1, display: 'flex', width: '100%', height: '100%', overflow: 'hidden', background: 'var(--bg-main)' }}>
      {/* Left 50% - PDF Reference View */}
      <div style={{ width: '50%', height: '100%', borderRight: '2px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        {/* PDF Picker Header Toolbar */}
        <div style={{ padding: '8px 16px', background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
            <BookOpen size={16} style={{ color: '#ef4444' }} />
            <span>PDF Reference:</span>
          </div>

          {/* PDF Selector Dropdown */}
          {allPdfFiles.length > 0 ? (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <select
                value={pdfFile?.id || ''}
                onChange={(e) => {
                  const selected = allPdfFiles.find(p => p.id === e.target.value);
                  if (selected) onSelectPdfFile(selected);
                }}
                style={{
                  appearance: 'none',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-highlight)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-main)',
                  padding: '6px 32px 6px 12px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                  maxWidth: 320
                }}
              >
                {allPdfFiles.map(pdf => (
                  <option key={pdf.id} value={pdf.id}>
                    📄 {pdf.name} {pdf.moduleName ? `[${pdf.moduleName}]` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: 10, pointerEvents: 'none', color: 'var(--text-muted)' }} />
            </div>
          ) : (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={14} style={{ color: 'var(--accent-amber)' }} /> No PDF files in vault
            </div>
          )}
        </div>

        {/* PDF Embedded Engine View */}
        {pdfFile ? (
          <PdfViewer file={pdfFile} />
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, color: 'var(--text-muted)', textAlign: 'center' }}>
            <BookOpen size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <h3 style={{ color: 'var(--text-main)', fontWeight: 700, marginBottom: 8 }}>No PDF Selected</h3>
            <p style={{ fontSize: '0.85rem' }}>Select a PDF reference file from the dropdown menu above or add PDF textbooks to your vault folder.</p>
          </div>
        )}
      </div>

      {/* Right 50% - Interactive Markdown Editor & Live Preview */}
      <div style={{ width: '50%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)' }}>
        <div style={{ padding: '8px 16px', background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={16} style={{ color: '#818cf8' }} />
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>{markdownFile.name}</span>
          </div>

          {/* Mode Switcher for Right Pane */}
          <div style={{ display: 'flex', background: 'var(--bg-surface)', padding: 2, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', gap: 2 }}>
            <button 
              className={`mode-btn ${rightViewMode === 'edit' ? 'active' : ''}`}
              onClick={() => setRightViewMode('edit')}
              style={{ fontSize: '0.72rem', padding: '3px 8px' }}
            >
              Edit
            </button>
            <button 
              className={`mode-btn ${rightViewMode === 'preview' ? 'active' : ''}`}
              onClick={() => setRightViewMode('preview')}
              style={{ fontSize: '0.72rem', padding: '3px 8px' }}
            >
              Preview
            </button>
            <button 
              className={`mode-btn ${rightViewMode === 'split' ? 'active' : ''}`}
              onClick={() => setRightViewMode('split')}
              style={{ fontSize: '0.72rem', padding: '3px 8px' }}
            >
              Split
            </button>
          </div>
        </div>
        
        <MarkdownViewer 
          file={markdownFile}
          onContentChange={onMarkdownChange}
          settings={settings}
          onToggleBionic={onToggleBionic}
          onOpenFlashcards={onOpenFlashcards}
          viewMode={rightViewMode}
        />
      </div>
    </div>
  );
};
