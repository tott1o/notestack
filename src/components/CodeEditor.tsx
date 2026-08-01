import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { Code2, Copy, Check, Save } from 'lucide-react';
import type { FileItem } from '../types';

import { getFileState, saveFileState } from '../utils/stateMemory';
import { highlightCodeSyntax } from '../utils/syntaxHighlighter';

interface CodeEditorProps {
  file: FileItem;
  onContentChange: (newContent: string) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ file, onContentChange }) => {
  const [code, setCode] = useState<string>(file.content || '');
  const [fontSize, setFontSize] = useState<number>(14);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileKey = file.fullPath || file.id;

  const highlightedHtml = useMemo(() => {
    return highlightCodeSyntax(code, file.extension || file.type || 'code');
  }, [code, file.extension, file.type]);

  // Restore scroll position instantly before paint when active file changes
  useLayoutEffect(() => {
    setCode(file.content || '');
    setIsSaved(true);

    const saved = getFileState(fileKey);
    if (saved.scrollTop) {
      if (textareaRef.current) textareaRef.current.scrollTop = saved.scrollTop;
      if (preRef.current) preRef.current.scrollTop = saved.scrollTop;
      if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = saved.scrollTop;
      requestAnimationFrame(() => {
        if (textareaRef.current) textareaRef.current.scrollTop = saved.scrollTop!;
        if (preRef.current) preRef.current.scrollTop = saved.scrollTop!;
        if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = saved.scrollTop!;
      });
    }
  }, [file.id, fileKey]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Synchronize Line Numbers & Highlighted Pre scroll with Textarea scroll
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollTop;
    }
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop;
      preRef.current.scrollLeft = scrollLeft;
    }
    saveFileState(fileKey, { scrollTop });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCode(val);
    setIsSaved(false);
    onContentChange(val);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setIsSaved(true), 600);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const lineCount = code.split('\n').length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);
  const language = file.extension || 'code';

  return (
    <div className="code-editor-container">
      {/* Code Header Bar */}
      <div className="code-editor-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Code2 size={16} style={{ color: 'var(--primary)' }} />
          <span style={{ fontWeight: 600, color: '#e6edf3' }}>{file.name}</span>
          <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 4, background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>
            {language}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Font Size Adjuster */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: '#8b949e' }}>
            <span>Size:</span>
            <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={() => setFontSize(prev => Math.max(11, prev - 1))}>-</button>
            <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center', color: '#e6edf3' }}>{fontSize}px</span>
            <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={() => setFontSize(prev => Math.min(22, prev + 1))}>+</button>
          </div>

          <button className="tool-btn" onClick={handleCopy} title="Copy Code">
            {isCopied ? <Check size={14} style={{ color: 'var(--accent-emerald)' }} /> : <Copy size={14} />}
            <span>{isCopied ? 'Copied' : 'Copy'}</span>
          </button>

          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: isSaved ? 'var(--accent-emerald)' : 'var(--accent-amber)', fontSize: '0.78rem', fontWeight: 600 }}>
            {isSaved ? <Check size={14} /> : <Save size={14} />}
            {isSaved ? 'Saved' : 'Saving...'}
          </span>
        </div>
      </div>

      {/* Editor Body */}
      <div className="code-editor-body">
        {/* Synchronized Line Numbers Column */}
        <div 
          ref={lineNumbersRef}
          className="code-editor-line-numbers" 
          style={{ fontSize: `${fontSize}px`, overflowY: 'hidden' }}
        >
          {lineNumbers.map(num => (
            <div key={num}>{num}</div>
          ))}
        </div>

        {/* Syntax Highlighted Viewport */}
        <div className="code-editor-viewport">
          <pre 
            ref={preRef}
            className="code-editor-pre"
            style={{ fontSize: `${fontSize}px` }}
            dangerouslySetInnerHTML={{ __html: highlightedHtml + '\n' }}
          />
          <textarea
            ref={textareaRef}
            className="code-editor-textarea"
            style={{ fontSize: `${fontSize}px` }}
            placeholder="// Type your code here..."
            value={code}
            onChange={handleChange}
            onScroll={handleScroll}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
};
