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
  Eye,
  Edit3,
  Columns,
  Quote,
  Minus,
  Link as LinkIcon,
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
  const [activeMode, setActiveMode] = useState<'preview' | 'edit' | 'split'>('preview');
  const [fontSize, setFontSize] = useState<number>(16);
  const [showToc, setShowToc] = useState<boolean>(false);
  const [activeLine, setActiveLine] = useState<number>(1);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineGutterRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncScrolling = useRef<boolean>(false);

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

  // Sync content state when file.content prop changes externally (e.g. AI edits or disk reloads)
  useEffect(() => {
    if (file.content !== undefined && file.content !== content) {
      setContent(file.content);
      setIsSaved(true);
    }
  }, [file.content]);

  // Active line calculation
  const updateActiveLine = useCallback(() => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart;
    const textBeforeCursor = textareaRef.current.value.substring(0, cursorPos);
    const lineNumber = textBeforeCursor.split('\n').length;
    setActiveLine(lineNumber);
  }, []);

  // Proportional scroll synchronization between editor & preview
  const handleEditorScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const scrollTop = el.scrollTop;

    // Sync line gutter scroll position
    if (lineGutterRef.current) {
      lineGutterRef.current.scrollTop = scrollTop;
    }

    saveFileState(fileKey, { scrollTop });

    // Sync preview scroll position proportionally in split mode
    if (activeMode === 'split' && previewRef.current && !isSyncScrolling.current) {
      isSyncScrolling.current = true;
      const scrollRatio = scrollTop / (el.scrollHeight - el.clientHeight || 1);
      const previewEl = previewRef.current;
      previewEl.scrollTop = scrollRatio * (previewEl.scrollHeight - previewEl.clientHeight);
      
      requestAnimationFrame(() => {
        isSyncScrolling.current = false;
      });
    }
  };

  const handlePreviewScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const previewEl = e.currentTarget;
    const scrollTop = previewEl.scrollTop;

    saveFileState(fileKey, { scrollTop });

    if (activeMode === 'split' && textareaRef.current && !isSyncScrolling.current) {
      isSyncScrolling.current = true;
      const scrollRatio = scrollTop / (previewEl.scrollHeight - previewEl.clientHeight || 1);
      const editorEl = textareaRef.current;
      editorEl.scrollTop = scrollRatio * (editorEl.scrollHeight - editorEl.clientHeight);
      if (lineGutterRef.current) {
        lineGutterRef.current.scrollTop = editorEl.scrollTop;
      }

      requestAnimationFrame(() => {
        isSyncScrolling.current = false;
      });
    }
  };

  // Sync view mode when header bar viewMode prop changes
  useEffect(() => {
    if (viewMode === 'edit' || viewMode === 'split' || viewMode === 'preview') {
      setActiveMode(viewMode);
    }
  }, [viewMode]);

  // Trackpad Pinch & Ctrl+Wheel Zoom Listener for Markdown Preview & Editor
  useEffect(() => {
    const handleWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1 : -1;
        setFontSize(prev => Math.min(32, Math.max(10, prev + delta)));
      }
    };

    const previewEl = previewRef.current;
    const textEl = textareaRef.current;

    if (previewEl) previewEl.addEventListener('wheel', handleWheelZoom, { passive: false });
    if (textEl) textEl.addEventListener('wheel', handleWheelZoom, { passive: false });

    return () => {
      if (previewEl) previewEl.removeEventListener('wheel', handleWheelZoom);
      if (textEl) textEl.removeEventListener('wheel', handleWheelZoom);
    };
  }, []);

  // Compute live rendered HTML & Outline
  const renderedHtml = useMemo(() => {
    return renderMarkdownToHtml(content, settings.bionicReading);
  }, [content, settings.bionicReading]);

  const wordCount = useMemo(() => {
    return content.trim() ? content.trim().split(/\s+/).length : 0;
  }, [content]);

  const readingTimeMinutes = useMemo(() => {
    return calculateReadingTime(content);
  }, [content]);

  const tocItems = useMemo(() => {
    return extractTableOfContents(content);
  }, [content]);

  const taskProgress = useMemo(() => {
    return getTaskProgress(content);
  }, [content]);

  const lineCount = useMemo(() => {
    return content.split('\n').length;
  }, [content]);

  const lineNumbers = useMemo(() => {
    return Array.from({ length: lineCount }, (_, i) => i + 1);
  }, [lineCount]);

  const scrollToHeading = (id: string) => {
    if (!previewRef.current) return;
    const headingEl = previewRef.current.querySelector(`#${id}`);
    if (headingEl) {
      headingEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

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
    onContentChange(newContent);
    setIsSaved(false);
    updateActiveLine();

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      setIsSaved(true);
    }, 600);
  };

  const insertFormatting = useCallback((prefix: string, suffix: string = '') => {
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
      updateActiveLine();
    }, 10);
  }, [content, onContentChange, updateActiveLine]);

  // Pro Editor Keydown Handlers (Auto-list continuation, Auto-pairs, Tab Indent, Shortcuts)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const key = e.key;

    // 1. Keyboard Shortcuts (Ctrl+B, Ctrl+I, Ctrl+K, Ctrl+Shift+C, Ctrl+Shift+M)
    if (e.ctrlKey || e.metaKey) {
      if (key.toLowerCase() === 'b') {
        e.preventDefault();
        insertFormatting('**', '**');
        return;
      }
      if (key.toLowerCase() === 'i') {
        e.preventDefault();
        insertFormatting('*', '*');
        return;
      }
      if (key.toLowerCase() === 'k') {
        e.preventDefault();
        const selected = content.substring(start, end) || 'link text';
        const linkMd = `[${selected}](https://)`;
        const newContent = content.substring(0, start) + linkMd + content.substring(end);
        setContent(newContent);
        onContentChange(newContent);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + selected.length + 3, start + selected.length + 11);
        }, 10);
        return;
      }
      if (e.shiftKey && key.toLowerCase() === 'c') {
        e.preventDefault();
        if (start !== end && content.substring(start, end).includes('\n')) {
          insertFormatting('```\n', '\n```');
        } else {
          insertFormatting('`', '`');
        }
        return;
      }
      if (e.shiftKey && key.toLowerCase() === 'm') {
        e.preventDefault();
        insertFormatting('$$\n', '\n$$');
        return;
      }
    }

    // 2. Tab & Shift+Tab Line Indentation
    if (key === 'Tab') {
      e.preventDefault();
      const lineStart = content.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = content.indexOf('\n', end);
      const effectiveEnd = lineEnd === -1 ? content.length : lineEnd;
      const selectedLines = content.substring(lineStart, effectiveEnd).split('\n');

      if (e.shiftKey) {
        // Outdent lines
        const unindented = selectedLines.map(l => l.startsWith('  ') ? l.substring(2) : l.replace(/^ /, '')).join('\n');
        const newContent = content.substring(0, lineStart) + unindented + content.substring(effectiveEnd);
        setContent(newContent);
        onContentChange(newContent);
      } else {
        // Indent lines
        const indented = selectedLines.map(l => '  ' + l).join('\n');
        const newContent = content.substring(0, lineStart) + indented + content.substring(effectiveEnd);
        setContent(newContent);
        onContentChange(newContent);
      }
      return;
    }

    // 3. Auto-List Continuation on Enter
    if (key === 'Enter') {
      const lineStart = content.lastIndexOf('\n', start - 1) + 1;
      const currentLine = content.substring(lineStart, start);

      // Task list item: - [ ] or - [x]
      const taskMatch = currentLine.match(/^(\s*)-\s+\[[ x]\]\s*(.*)$/);
      if (taskMatch) {
        e.preventDefault();
        const [, indent, itemText] = taskMatch;
        if (itemText.trim() === '') {
          // Exit empty list item
          const newContent = content.substring(0, lineStart) + content.substring(start);
          setContent(newContent);
          onContentChange(newContent);
        } else {
          const insertPrefix = `\n${indent}- [ ] `;
          const newContent = content.substring(0, start) + insertPrefix + content.substring(end);
          setContent(newContent);
          onContentChange(newContent);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + insertPrefix.length, start + insertPrefix.length);
            updateActiveLine();
          }, 10);
        }
        return;
      }

      // Unordered list item: - or * or +
      const listMatch = currentLine.match(/^(\s*)[-*+]\s+(.*)$/);
      if (listMatch) {
        e.preventDefault();
        const [, indent, itemText] = listMatch;
        if (itemText.trim() === '') {
          const newContent = content.substring(0, lineStart) + content.substring(start);
          setContent(newContent);
          onContentChange(newContent);
        } else {
          const insertPrefix = `\n${indent}- `;
          const newContent = content.substring(0, start) + insertPrefix + content.substring(end);
          setContent(newContent);
          onContentChange(newContent);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + insertPrefix.length, start + insertPrefix.length);
            updateActiveLine();
          }, 10);
        }
        return;
      }

      // Numbered list item: 1. or 2.
      const numMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (numMatch) {
        e.preventDefault();
        const [, indent, numStr, itemText] = numMatch;
        if (itemText.trim() === '') {
          const newContent = content.substring(0, lineStart) + content.substring(start);
          setContent(newContent);
          onContentChange(newContent);
        } else {
          const nextNum = parseInt(numStr, 10) + 1;
          const insertPrefix = `\n${indent}${nextNum}. `;
          const newContent = content.substring(0, start) + insertPrefix + content.substring(end);
          setContent(newContent);
          onContentChange(newContent);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + insertPrefix.length, start + insertPrefix.length);
            updateActiveLine();
          }, 10);
        }
        return;
      }
    }

    // 4. Auto-Closing Pair Characters
    const autoPairs: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}',
      '"': '"',
      '`': '`',
      '$': '$'
    };

    if (autoPairs[key]) {
      e.preventDefault();
      insertFormatting(key, autoPairs[key]);
      return;
    }
  };


  return (
    <div className="viewer-shell">
      {/* ── Toolbar Header Ribbon ────────────────────────────────────────── */}
      <div className="viewer-toolbar">
        {/* View Mode Switcher Pills */}
        <div className="mode-pill-container" style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 8 }}>
          <button 
            className={`mode-pill ${activeMode === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveMode('preview')}
            title="Preview Reader Mode"
          >
            <Eye size={13} /> Preview
          </button>

          <button 
            className={`mode-pill ${activeMode === 'split' ? 'active' : ''}`}
            onClick={() => setActiveMode('split')}
            title="Split Editor & Live Preview"
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

        {/* Formatting Actions */}
        <div className="toolbar-group formatting-group">
            <button className="tool-btn" onClick={() => insertFormatting('**', '**')} title="Bold (Ctrl+B)"><Bold size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('*', '*')} title="Italic (Ctrl+I)"><Italic size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('~~', '~~')} title="Strikethrough (~~text~~)"><Strikethrough size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('==', '==')} title="Highlight (==text==)"><Sparkles size={14} style={{ color: 'var(--accent-amber)' }} /></button>
            <span className="toolbar-sep" />
            <button className="tool-btn" onClick={() => insertFormatting('# ')} title="Heading 1"><Heading1 size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('## ')} title="Heading 2"><Heading2 size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('### ')} title="Heading 3"><Heading3 size={14} /></button>
            <span className="toolbar-sep" />
            <button className="tool-btn" onClick={() => insertFormatting('$$\n', '\n$$')} title="Display Formula (Ctrl+Shift+M)"><span className="math-sym">∑</span></button>
            <button className="tool-btn" onClick={() => insertFormatting('`', '`')} title="Inline Code (Ctrl+Shift+C)"><Code size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('- ')} title="Bullet List"><List size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('1. ')} title="Numbered List"><ListOrdered size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('- [ ] ')} title="Task Checklist"><CheckSquare size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('> [!NOTE]\n> ')} title="Study Callout Card"><AlertCircle size={14} style={{ color: 'var(--accent-cyan)' }} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('> ')} title="Quote Block"><Quote size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('\n---\n')} title="Section Divider"><Minus size={14} /></button>
            <button className="tool-btn" onClick={() => insertFormatting('[', '](url)')} title="Insert Link (Ctrl+K)"><LinkIcon size={14} /></button>
          </div>

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

        {/* Pro Code Editor Style Markdown Source Pane */}
        {(activeMode === 'edit' || activeMode === 'split') && (
          <div className="editor-pane" style={{ borderRight: activeMode === 'split' ? '1px solid var(--border-color)' : 'none', flex: 1, height: '100%' }}>
            <div className="code-editor-body">
              {/* Synchronized Line Numbers Column */}
              <div 
                ref={lineGutterRef} 
                className="code-editor-line-numbers"
                style={{ fontSize: `${fontSize}px`, overflowY: 'hidden' }}
              >
                {lineNumbers.map(num => (
                  <div key={num}>{num}</div>
                ))}
              </div>

              {/* Textarea Code Canvas */}
              <textarea
                ref={textareaRef}
                className="markdown-source-textarea"
                style={{ fontSize: `${fontSize}px` }}
                value={content}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onKeyUp={updateActiveLine}
                onClick={updateActiveLine}
                onScroll={handleEditorScroll}
                placeholder="// Start writing notes in Markdown... (Supports math $$ formula $$, ==highlights==, callouts > [!NOTE], and code blocks)"
              />
            </div>
          </div>
        )}

        {/* Rendered Preview Reader Pane */}
        {(activeMode === 'preview' || activeMode === 'split') && (
          <div 
            ref={previewRef}
            onScroll={handlePreviewScroll}
            className="preview-pane"
          >
            <div 
              className="preview-paper"
              style={{ 
                maxWidth: '880px', 
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
          <span>{lineCount} lines (Line {activeLine})</span>
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
