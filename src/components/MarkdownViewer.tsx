import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
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
  Link as LinkIcon,
  Maximize2,
  Minimize2,
  ListFilter,
  CheckCircle2,
  Layers,
  Sparkles,
  FileText
} from 'lucide-react';
import type { FileItem, ReadingSettings } from '../types';
import { 
  renderMarkdownToHtml, 
  calculateReadingTime, 
  extractTableOfContents, 
  getTaskProgress 
} from '../utils/markdownUtils';
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
  const [showToc, setShowToc] = useState<boolean>(false);
  const [isFullWidth, setIsFullWidth] = useState<boolean>(false);

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

  // Global event listener for 1-Click Code & Formula Copy buttons
  useEffect(() => {
    const handleCopyClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const copyBtn = target.closest('.copy-code-btn') as HTMLElement;
      if (copyBtn) {
        const rawCode = copyBtn.getAttribute('data-code');
        if (rawCode) {
          const decoded = decodeURIComponent(rawCode);
          navigator.clipboard.writeText(decoded);
          const originalText = copyBtn.innerHTML;
          copyBtn.innerHTML = '✓ Copied!';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.classList.remove('copied');
          }, 2000);
        }
      }
    };

    document.addEventListener('click', handleCopyClick);
    return () => document.removeEventListener('click', handleCopyClick);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setIsSaved(false);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      onContentChange(newContent);
      setIsSaved(true);
    }, 600);
  };

  const insertFormatting = (prefix: string, suffix: string = '') => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.substring(start, end);
    const replacement = prefix + (selected || 'text') + suffix;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);
    onContentChange(newContent);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + (selected.length || 4));
    }, 10);
  };

  const renderedHtml = useMemo(() => {
    return renderMarkdownToHtml(content, settings.bionicReading);
  }, [content, settings.bionicReading]);

  const tocItems = useMemo(() => {
    return extractTableOfContents(content);
  }, [content]);

  const taskProgress = useMemo(() => {
    return getTaskProgress(content);
  }, [content]);

  const wordCount = useMemo(() => {
    return content.trim() ? content.trim().split(/\s+/).length : 0;
  }, [content]);

  const lineCount = useMemo(() => {
    return content ? content.split('\n').length : 0;
  }, [content]);

  const readingTimeMinutes = useMemo(() => {
    return calculateReadingTime(content);
  }, [content]);

  const scrollToHeading = (headingId: string) => {
    if (!previewRef.current) return;
    const target = previewRef.current.querySelector(`#${headingId}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="viewer-shell">
      {/* ── Toolbar Header Ribbon ────────────────────────────────────────── */}
      <div className="viewer-toolbar">
        {/* 1. View Mode Switcher Pills (Far Left) */}
        <div className="mode-pill-container">
          <button 
            className={`mode-pill ${activeMode === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveMode('preview')}
            title="Reader Mode"
          >
            <Eye size={13} /> Preview
          </button>

          <button 
            className={`mode-pill ${activeMode === 'split' ? 'active' : ''}`}
            onClick={() => setActiveMode('split')}
            title="Split Editor & Preview"
          >
            <Columns size={13} /> Split
          </button>

          <button 
            className={`mode-pill ${activeMode === 'edit' ? 'active' : ''}`}
            onClick={() => setActiveMode('edit')}
            title="Markdown Source Editor"
          >
            <Edit3 size={13} /> Edit
          </button>
        </div>

        <span className="toolbar-sep" />

        {/* 2. Formatting Actions (Active in Edit or Split mode) */}
        {(activeMode === 'edit' || activeMode === 'split') && (
          <div className="toolbar-group formatting-group">
            <button className="tool-btn" onClick={() => insertFormatting('**', '**')} title="Bold (**text**)"><Bold size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('*', '*')} title="Italic (*text*)"><Italic size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('~~', '~~')} title="Strikethrough (~~text~~)"><Strikethrough size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('==', '==')} title="Highlight (==text==)"><Sparkles size={14} style={{ color: 'var(--accent-amber)' }} /></button>
            <span className="toolbar-sep" />
            <button className="tool-btn" onClick={() => insertFormatting('# ')} title="Heading 1"><Heading1 size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('## ')} title="Heading 2"><Heading2 size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('### ')} title="Heading 3"><Heading3 size={14} /></button>
            <span className="toolbar-sep" />
            <button className="tool-btn" onClick={() => insertFormatting('$$\n', '\n$$')} title="Display Formula ($$ equation $$)"><span className="math-sym">∑</span></button>
            <button className="tool-btn" onClick={() => insertFormatting('`', '`')} title="Inline Code (`code`)"><Code size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('- ')} title="Bullet List"><List size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('1. ')} title="Numbered List"><ListOrdered size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('- [ ] ')} title="Task Checklist"><CheckSquare size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('> [!NOTE]\n> ')} title="Study Callout Card"><AlertCircle size={14} style={{ color: 'var(--accent-cyan)' }} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('> ')} title="Quote Block"><Quote size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('\n---\n')} title="Section Divider"><Minus size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('[', '](url)')} title="Insert Link"><LinkIcon size={14} /></button>
          </div>
        )}

        {/* Font Size Adjuster */}
        <div className="font-size-stepper">
          <button className="font-btn" onClick={() => setFontSize(Math.max(12, fontSize - 1))} title="Decrease font size">A-</button>
          <span className="font-val">{fontSize}</span>
          <button className="font-btn" onClick={() => setFontSize(Math.min(26, fontSize + 1))} title="Increase font size">A+</button>
        </div>

        {/* Right Study Utilities */}
        <div className="toolbar-right">
          <button 
            className={`tool-btn ${settings.bionicReading ? 'active' : ''}`}
            onClick={onToggleBionic}
            title="Toggle Bionic Reading Mode"
          >
            <Zap size={14} style={{ color: settings.bionicReading ? 'var(--accent-amber)' : 'inherit' }} />
            <span>Bionic</span>
          </button>

          {tocItems.length > 0 && (
            <button 
              className={`tool-btn ${showToc ? 'active' : ''}`}
              onClick={() => setShowToc(!showToc)}
              title="Toggle Chapter Outline Sidebar"
            >
              <ListFilter size={14} style={{ color: showToc ? 'var(--primary)' : 'inherit' }} />
              <span>Outline ({tocItems.length})</span>
            </button>
          )}

          <button 
            className="tool-btn"
            onClick={onOpenFlashcards}
            title="Generate AI Review Flashcards"
          >
            <BookOpen size={14} style={{ color: 'var(--primary)' }} />
            <span>Flashcards</span>
          </button>

          <button 
            className={`tool-btn ${isFullWidth ? 'active' : ''}`}
            onClick={() => setIsFullWidth(!isFullWidth)}
            title={isFullWidth ? 'Compact Paper View' : 'Full-Width View'}
          >
            {isFullWidth ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {/* Auto-Save Indicator Badge */}
          <div className={`save-status-badge ${isSaved ? 'saved' : 'saving'}`}>
            {isSaved ? <Check size={11} /> : <Save size={11} className="spin-icon" />}
            <span>{isSaved ? 'Saved' : 'Saving...'}</span>
          </div>
        </div>
      </div>

      {/* ── Main Workspace Body ────────────────────────────────────────── */}
      <div className="viewer-workspace">
        {/* Collapsible Outline TOC Sidebar */}
        {showToc && tocItems.length > 0 && (activeMode === 'preview' || activeMode === 'split') && (
          <aside className="outline-toc-sidebar">
            <div className="outline-toc-header">
              <Layers size={13} style={{ color: 'var(--primary)' }} />
              <span>Outline</span>
              <span className="outline-count">{tocItems.length}</span>
            </div>

            <nav className="outline-toc-nav">
              {tocItems.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => scrollToHeading(item.id)}
                  className={`toc-node toc-level-${item.level}`}
                  title={item.text}
                >
                  <span className="toc-dot" />
                  <span className="toc-label">{item.text}</span>
                </button>
              ))}
            </nav>
          </aside>
        )}

        {/* Markdown Source Textarea Pane */}
        {(activeMode === 'edit' || activeMode === 'split') && (
          <div className="editor-pane" style={{ borderRight: activeMode === 'split' ? '1px solid var(--border-color)' : 'none' }}>
            <textarea
              ref={textareaRef}
              className="editor-textarea"
              style={{ fontSize: `${fontSize}px` }}
              value={content}
              onChange={handleChange}
              onScroll={handleScrollSave}
              placeholder="Start writing notes in Markdown... (Supports math $$ formula $$, ==highlights==, callouts > [!NOTE], and code blocks)"
            />
          </div>
        )}

        {/* Rendered Preview Reader Pane */}
        {(activeMode === 'preview' || activeMode === 'split') && (
          <div 
            ref={previewRef}
            onScroll={handleScrollSave}
            className="preview-pane"
          >
            <div 
              className="preview-paper"
              style={{ 
                maxWidth: isFullWidth ? '100%' : '880px', 
                fontSize: `${fontSize}px` 
              }}
            >
              {/* Study Task Progress Meter */}
              {taskProgress.total > 0 && (
                <div className="study-progress-card">
                  <div className="progress-info">
                    <CheckCircle2 size={15} style={{ color: 'var(--accent-emerald)' }} />
                    <span>Study Progress ({taskProgress.completed} of {taskProgress.total} tasks completed)</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-bar-fill" style={{ width: `${taskProgress.percent}%` }} />
                  </div>
                  <span className="progress-percent-label">{taskProgress.percent}%</span>
                </div>
              )}

              {/* Rendered HTML Container */}
              <div 
                className="rendered-markdown" 
                dangerouslySetInnerHTML={{ __html: renderedHtml }} 
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Document Meter Footer ────────────────────────────────────────── */}
      <footer className="viewer-footer">
        <div className="footer-meta-left">
          <span className="file-tag">
            <FileText size={12} style={{ color: 'var(--primary)' }} /> {file.name}
          </span>
          <span className="dot-sep">•</span>
          <span>{wordCount} words</span>
          <span className="dot-sep">•</span>
          <span>{lineCount} lines</span>
          <span className="dot-sep">•</span>
          <span>{content.length} chars</span>
        </div>

        <div className="footer-meta-right">
          <span>📖 ~{readingTimeMinutes} min read</span>
          <span className="dot-sep">•</span>
          <span className="engine-tag">Study Markdown Engine</span>
        </div>
      </footer>
    </div>
  );
};
