import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { 
  Bold, 
  Italic, 
  Strikethrough,
  Heading1, 
  Heading2, 
  Heading3,
  Code, 
  List, 
  ListOrdered,
  CheckSquare, 
  Table as TableIcon, 
  Zap, 
  BookOpen, 
  AlertCircle,
  Save,
  Check,
  Edit3,
  Eye,
  Columns,
  Quote,
  Minus,
  Link as LinkIcon
} from 'lucide-react';
import type { FileItem, ReadingSettings } from '../types';
import { renderMarkdownToHtml, calculateReadingTime } from '../utils/markdownUtils';
import { getFileState, saveFileState } from '../utils/stateMemory';

interface MarkdownViewerProps {
  file: FileItem;
  onContentChange: (newContent: string) => void;
  settings: ReadingSettings;
  onToggleBionic: () => void;
  onOpenFlashcards: () => void;
  viewMode: 'edit' | 'preview' | 'split';
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  file,
  onContentChange,
  settings,
  onToggleBionic,
  onOpenFlashcards,
  viewMode
}) => {
  const [content, setContent] = useState<string>(file.content || '');
  const [isSaved, setIsSaved] = useState<boolean>(true);
  const [activeMode, setActiveMode] = useState<'preview' | 'edit' | 'split'>(viewMode || 'preview');
  const [fontSize, setFontSize] = useState<number>(16);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileKey = file.fullPath || file.id;

  // Restore scroll position instantly before paint when active file changes
  useLayoutEffect(() => {
    setContent(file.content || '');
    setIsSaved(true);

    const saved = getFileState(fileKey);
    if (saved.scrollTop) {
      if (textareaRef.current) textareaRef.current.scrollTop = saved.scrollTop;
      if (previewRef.current) previewRef.current.scrollTop = saved.scrollTop;
      requestAnimationFrame(() => {
        if (textareaRef.current) textareaRef.current.scrollTop = saved.scrollTop!;
        if (previewRef.current) previewRef.current.scrollTop = saved.scrollTop!;
      });
    }
  }, [file.id, fileKey]);

  const handleScrollSave = useCallback((e: React.UIEvent<HTMLElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    saveFileState(fileKey, { scrollTop });
  }, [fileKey]);

  // Sync view mode when header bar viewMode prop changes
  useEffect(() => {
    if (viewMode) {
      setActiveMode(viewMode);
    }
  }, [viewMode]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Global event listener for 1-Click Code Copy buttons
  useEffect(() => {
    const handleCopyClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.classList.contains('copy-code-btn')) {
        const rawCode = target.getAttribute('data-code');
        if (rawCode) {
          const decoded = decodeURIComponent(rawCode);
          navigator.clipboard.writeText(decoded);
          target.innerHTML = '✓ Copied!';
          target.style.background = 'var(--primary-light)';
          target.style.color = 'var(--primary)';
          setTimeout(() => {
            target.innerHTML = '📋 Copy Code';
            target.style.background = 'rgba(255, 255, 255, 0.06)';
            target.style.color = '#c9d1d9';
          }, 2000);
        }
      }
    };

    document.addEventListener('click', handleCopyClick);
    return () => document.removeEventListener('click', handleCopyClick);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    setIsSaved(false);
    onContentChange(val);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      setIsSaved(true);
    }, 600);
  }, [onContentChange]);

  const insertFormatting = useCallback((prefix: string, suffix: string = '', defaultText: string = 'text') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const textToUse = selectedText || defaultText;
    const replacement = `${prefix}${textToUse}${suffix}`;
    const newText = content.substring(0, start) + replacement + content.substring(end);
    
    setContent(newText);
    setIsSaved(false);
    onContentChange(newText);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      setIsSaved(true);
    }, 600);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + textToUse.length);
    }, 50);
  }, [content, onContentChange]);

  const htmlContent = renderMarkdownToHtml(content, settings.bionicReading);
  const readingTime = calculateReadingTime(content);
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const lineCount = content.split('\n').length;
  const charCount = content.length;

  return (
    <div className="content-area" style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', height: '100%', overflow: 'hidden', background: 'var(--bg-main)' }}>
      {/* 1. Command Toolbelt Header */}
      <div className="editor-toolbar" style={{ borderBottom: '1px solid var(--border-color)', padding: '8px 16px', background: 'var(--bg-surface)', gap: 8, flexWrap: 'wrap' }}>
        {/* View Mode Segmented Switcher */}
        <div style={{ display: 'flex', background: 'var(--bg-surface-elevated)', padding: 3, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', gap: 2 }}>
          <button 
            className={`mode-btn ${activeMode === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveMode('preview')}
            title="Claude / GitHub Rendered View"
          >
            <Eye size={14} /> Preview
          </button>

          <button 
            className={`mode-btn ${activeMode === 'edit' ? 'active' : ''}`}
            onClick={() => setActiveMode('edit')}
            title="Live Raw Markdown Code Editor"
          >
            <Edit3 size={14} /> Edit
          </button>

          <button 
            className={`mode-btn ${activeMode === 'split' ? 'active' : ''}`}
            onClick={() => setActiveMode('split')}
            title="Side-by-Side Live Editor & Preview"
          >
            <Columns size={14} /> Split View
          </button>
        </div>

        <div style={{ width: 1, height: 20, background: 'var(--border-color)', margin: '0 2px' }} />

        {/* Formatting Buttons (Visible in Edit & Split mode) */}
        {activeMode !== 'preview' && (
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <button className="tool-btn" onClick={() => insertFormatting('**', '**', 'bold text')} title="Bold">
              <Bold size={14} />
            </button>
            <button className="tool-btn" onClick={() => insertFormatting('*', '*', 'italic text')} title="Italic">
              <Italic size={14} />
            </button>
            <button className="tool-btn" onClick={() => insertFormatting('~~', '~~', 'strikethrough')} title="Strikethrough">
              <Strikethrough size={14} />
            </button>

            <div style={{ width: 1, height: 16, background: 'var(--border-color)', margin: '0 2px' }} />

            <button className="tool-btn" onClick={() => insertFormatting('# ', '', 'Heading 1')} title="Heading 1">
              <Heading1 size={14} />
            </button>
            <button className="tool-btn" onClick={() => insertFormatting('## ', '', 'Heading 2')} title="Heading 2">
              <Heading2 size={14} />
            </button>
            <button className="tool-btn" onClick={() => insertFormatting('### ', '', 'Heading 3')} title="Heading 3">
              <Heading3 size={14} />
            </button>

            <div style={{ width: 1, height: 16, background: 'var(--border-color)', margin: '0 2px' }} />

            <button className="tool-btn" onClick={() => insertFormatting('$$ ', ' $$', '\\sum_{i=1}^n x_i')} title="LaTeX Math Block">
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', fontSize: '0.8rem' }}>$\sum$</span>
            </button>
            <button className="tool-btn" onClick={() => insertFormatting('```python\n', '\n```', '# write code here')} title="Code Block">
              <Code size={14} />
            </button>
            <button className="tool-btn" onClick={() => insertFormatting('- ', '', 'List item')} title="Unordered List">
              <List size={14} />
            </button>
            <button className="tool-btn" onClick={() => insertFormatting('1. ', '', 'First item')} title="Ordered List">
              <ListOrdered size={14} />
            </button>
            <button className="tool-btn" onClick={() => insertFormatting('- [ ] ', '', 'Task item')} title="Interactive Checklist">
              <CheckSquare size={14} />
            </button>
            <button className="tool-btn" onClick={() => insertFormatting('> [!NOTE]\n> ', '', 'Important note details...')} title="Callout Card">
              <AlertCircle size={14} />
            </button>
            <button className="tool-btn" onClick={() => insertFormatting('> ', '', 'Quote text')} title="Blockquote">
              <Quote size={14} />
            </button>
            <button className="tool-btn" onClick={() => insertFormatting('\n| Header 1 | Header 2 |\n| :--- | :--- |\n| Data 1 | Data 2 |\n', '')} title="Table Grid">
              <TableIcon size={14} />
            </button>
            <button className="tool-btn" onClick={() => insertFormatting('\n---\n')} title="Horizontal Divider">
              <Minus size={14} />
            </button>
            <button className="tool-btn" onClick={() => insertFormatting('[', '](https://example.com)', 'Link Title')} title="Insert Link">
              <LinkIcon size={14} />
            </button>
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Font Size Adjuster */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600 }}>Size:</span>
            <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={() => setFontSize(prev => Math.max(12, prev - 1))}>-</button>
            <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{fontSize}px</span>
            <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={() => setFontSize(prev => Math.min(26, prev + 1))}>+</button>
          </div>

          {/* Bionic Reading */}
          <button 
            className={`tool-btn ${settings.bionicReading ? 'active' : ''}`}
            onClick={onToggleBionic}
            title="Bionic Speed Reading Mode"
            style={{ background: settings.bionicReading ? 'var(--primary-light)' : undefined, color: settings.bionicReading ? 'var(--primary)' : undefined }}
          >
            <Zap size={14} style={{ color: settings.bionicReading ? 'var(--accent-amber)' : undefined }} />
            <span>Bionic</span>
          </button>

          {/* Flashcards */}
          <button className="tool-btn" onClick={onOpenFlashcards} title="Generate Flashcards from Note">
            <BookOpen size={14} style={{ color: 'var(--accent-emerald)' }} />
            <span>Flashcards</span>
          </button>

          {/* Disk Save Badge */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: isSaved ? 'var(--accent-emerald)' : 'var(--accent-amber)', fontWeight: 600, fontSize: '0.78rem' }}>
            {isSaved ? <Check size={14} /> : <Save size={14} />}
            {isSaved ? 'Saved' : 'Saving...'}
          </span>
        </div>
      </div>

      {/* 2. Main Workspace (Editor + Claude/GitHub Preview) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Editor Pane */}
        {(activeMode === 'edit' || activeMode === 'split') && (
          <div className="markdown-editor-pane" style={{ flex: 1, borderRight: activeMode === 'split' ? '1px solid var(--border-color)' : 'none', background: 'var(--bg-main)' }}>
            <textarea
              ref={textareaRef}
              className="markdown-textarea"
              style={{ fontSize: `${fontSize}px`, lineHeight: 1.7, fontFamily: 'var(--font-mono)' }}
              placeholder="Type your markdown notes, code blocks, LaTeX formulas..."
              value={content}
              onChange={handleChange}
              onScroll={handleScrollSave}
            />
          </div>
        )}

        {/* Claude / ChatGPT & GitHub Rendered Preview Pane */}
        {(activeMode === 'preview' || activeMode === 'split') && (
          <div 
            ref={previewRef}
            className="markdown-preview-pane"
            onScroll={handleScrollSave}
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: activeMode === 'split' ? '32px 28px' : '40px 60px'
            }}
          >
            {/* Rendered Markdown HTML in 100% fullscreen canvas */}
            <div 
              className="rendered-markdown"
              style={{ 
                fontSize: `${fontSize}px`, 
                lineHeight: 1.75,
                width: '100%'
              }}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>
        )}
      </div>

      {/* 3. Document Footer Meter Bar */}
      <div style={{ padding: '6px 20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface)', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <span>📄 {file.name}</span>
          <span>{wordCount} words</span>
          <span>{charCount} characters</span>
          <span>{lineCount} lines</span>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <span>⏱️ {readingTime} min read</span>
          <span style={{ color: 'var(--text-dim)' }}>Format: Markdown GFM + KaTeX</span>
        </div>
      </div>
    </div>
  );
};
