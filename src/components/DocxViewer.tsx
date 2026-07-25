import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import mammoth from 'mammoth';
import { 
  FileText, 
  Printer, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  Sun, 
  Moon, 
  Search,
  List,
  ChevronLeft,
  ChevronRight,
  X,
  BookOpen,
  Layers,
  Book,
  Bookmark
} from 'lucide-react';
import type { FileItem } from '../types';
import { getFileState, saveFileState } from '../utils/stateMemory';

interface DocxViewerProps {
  file: FileItem;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export const DocxViewer: React.FC<DocxViewerProps> = ({ file }) => {
  const [rawHtml, setRawHtml] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Interactive View Controls - Defaulting to Continuous Stream Reader
  const [zoom, setZoom] = useState<number>(100);
  const [fontSize] = useState<number>(16);
  const [lightPaperTheme, setLightPaperTheme] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'continuous' | 'paginated'>('continuous');
  const [showOutline, setShowOutline] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [activeChapterId, setActiveChapterId] = useState<string>('');

  // Search State
  const [searchQuery, setSearchQuery] = useState<string>('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileKey = file.fullPath || file.id;

  // Instant scroll position restoration
  useLayoutEffect(() => {
    if (!loading && rawHtml) {
      const saved = getFileState(fileKey);
      if (saved.scrollTop && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = saved.scrollTop;
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = saved.scrollTop!;
          }
        });
      }
    }
  }, [loading, rawHtml, fileKey]);

  const handleDocxScroll = (e: React.UIEvent<HTMLDivElement>) => {
    saveFileState(fileKey, { scrollTop: e.currentTarget.scrollTop });
  };

  useEffect(() => {
    let isMounted = true;

    async function parseDocx() {
      try {
        setLoading(true);
        let buffer: ArrayBuffer | null = file.arrayBuffer || null;

        if (!buffer && file.fullPath && window.electronAPI?.readFileBuffer) {
          buffer = await window.electronAPI.readFileBuffer(file.fullPath);
        }

        if (!buffer) {
          if (isMounted) {
            setError('No Word document data available.');
            setLoading(false);
          }
          return;
        }

        // Convert Word DOCX to clean HTML with base64 inline images
        const result = await mammoth.convertToHtml(
          { arrayBuffer: buffer },
          {
            convertImage: mammoth.images.imgElement((image) => {
              return image.read("base64").then((imageBuffer) => {
                return {
                  src: `data:${image.contentType};base64,${imageBuffer}`
                };
              });
            })
          }
        );

        if (isMounted) {
          setRawHtml(result.value || '<p>Empty Word document.</p>');
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Failed to parse DOCX:", err);
          setError('Failed to render Word document content.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    parseDocx();

    return () => {
      isMounted = false;
    };
  }, [file]);

  // Inject Heading IDs and Extract Document Chapters (Table of Contents)
  const { processedRawHtml, tocItems } = useMemo(() => {
    if (!rawHtml) return { processedRawHtml: '', tocItems: [] };

    let headingCount = 0;
    const items: TocItem[] = [];

    // Inject unique ID to every H1-H4 tag for 1-click smooth navigation
    const htmlWithIds = rawHtml.replace(/<(h[1-4])([^>]*)>([\s\S]*?)<\/\1>/gi, (_match, tag, attrs, content) => {
      const id = `docx-chapter-${headingCount++}`;
      const plainText = content.replace(/<[^>]*>/g, '').trim() || `Chapter ${headingCount}`;
      const level = parseInt(tag.substring(1), 10);
      items.push({ id, text: plainText, level });
      return `<${tag}${attrs} id="${id}">${content}</${tag}>`;
    });

    return { processedRawHtml: htmlWithIds, tocItems: items };
  }, [rawHtml]);

  // Smart Page Chunking: Split elements into continuous A4 Page Sheets (~320 words or major chapter boundary per page)
  const pages = useMemo<string[]>(() => {
    if (!processedRawHtml) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(processedRawHtml, 'text/html');
    const bodyElements = Array.from(doc.body.children);

    if (bodyElements.length === 0) return [processedRawHtml];

    const pageChunks: string[] = [];
    let currentChunk: string[] = [];
    let currentWordCount = 0;

    bodyElements.forEach((el) => {
      const elText = el.textContent || '';
      const words = elText.trim() ? elText.trim().split(/\s+/).length : 0;
      const isMajorHeading = ['H1', 'H2'].includes(el.tagName);

      if ((currentWordCount + words > 320 || (isMajorHeading && currentWordCount > 100)) && currentChunk.length > 0) {
        pageChunks.push(currentChunk.join(''));
        currentChunk = [];
        currentWordCount = 0;
      }

      currentChunk.push(el.outerHTML);
      currentWordCount += words;
    });

    if (currentChunk.length > 0) {
      pageChunks.push(currentChunk.join(''));
    }

    return pageChunks.length > 0 ? pageChunks : [processedRawHtml];
  }, [processedRawHtml]);

  // Apply Search Highlight overlay
  const renderHighlightedHtml = (htmlContent: string) => {
    if (!searchQuery.trim()) return htmlContent;
    let html = htmlContent;
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return html.replace(/>([^<]+)</g, (_match, textNode) => {
      return '>' + textNode.replace(regex, '<mark class="docx-search-highlight">$1</mark>') + '<';
    });
  };

  const scrollToChapter = (chapterId: string) => {
    setActiveChapterId(chapterId);
    if (viewMode !== 'continuous') setViewMode('continuous');
    setTimeout(() => {
      const el = document.getElementById(chapterId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const handlePrevPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(pages.length, prev + 1));

  const totalWords = useMemo(() => {
    if (!rawHtml) return 0;
    const text = rawHtml.replace(/<[^>]*>/g, ' ');
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }, [rawHtml]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${file.name}</title>
            <style>
              body { 
                font-family: 'Inter', -apple-system, sans-serif; 
                line-height: 1.7; 
                padding: 40px 60px; 
                color: #0f172a; 
                max-width: 850px; 
                margin: 0 auto; 
              }
              h1, h2, h3 { color: #0284c7; margin-top: 24px; }
              table { border-collapse: collapse; width: 100%; margin: 20px 0; }
              th, td { border: 1px solid #cbd5e1; padding: 8px 12px; }
              img { max-width: 100%; height: auto; border-radius: 6px; }
            </style>
          </head>
          <body>${processedRawHtml}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownload = () => {
    if (!file.arrayBuffer && !file.fullPath) return;
    const blob = new Blob([file.arrayBuffer || ''], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name || 'document.docx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="content-area" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      {/* 1. Microsoft Word Ribbon Header Bar */}
      <div className="editor-toolbar" style={{ padding: '8px 16px', background: 'var(--bg-surface)', gap: 12, borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', color: 'var(--text-main)' }}>
          <FileText size={18} style={{ color: '#0284c7' }} />
          <span style={{ fontWeight: 800 }}>{file.name}</span>
          <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 4, background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', fontWeight: 700 }}>
            {pages.length} PAGES
          </span>
        </div>

        {/* Live Search Box */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: 8 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-dim)' }} />
          <input
            type="text"
            className="csv-search-input"
            style={{ paddingLeft: 30, paddingRight: 26, width: 210, fontSize: '0.8rem' }}
            placeholder="Search document text..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <X size={14} style={{ position: 'absolute', right: 10, cursor: 'pointer', color: 'var(--text-dim)' }} onClick={() => setSearchQuery('')} />
          )}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Chapter Outline Sidebar Toggle */}
          {tocItems.length > 0 && (
            <button 
              className={`tool-btn ${showOutline ? 'active' : ''}`}
              onClick={() => setShowOutline(!showOutline)}
              title="Toggle Document Chapters Sidebar"
            >
              <List size={15} />
              <span>Chapters ({tocItems.length})</span>
            </button>
          )}

          <div style={{ width: 1, height: 16, background: 'var(--border-color)' }} />

          {/* Continuous Stream (Default) vs Page Flip Toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-surface-elevated)', padding: 2, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', gap: 2 }}>
            <button 
              className={`mode-btn ${viewMode === 'continuous' ? 'active' : ''}`}
              onClick={() => setViewMode('continuous')}
              title="Continuous Multi-Page Reading Stream (Default)"
            >
              <Layers size={14} /> Continuous
            </button>
            <button 
              className={`mode-btn ${viewMode === 'paginated' ? 'active' : ''}`}
              onClick={() => setViewMode('paginated')}
              title="Single Page Flip Reader View"
            >
              <Book size={14} /> Page Flip
            </button>
          </div>

          {viewMode === 'paginated' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-surface-elevated)', padding: '2px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={handlePrevPage} disabled={currentPage === 1}>
                <ChevronLeft size={13} />
              </button>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, minWidth: 55, textAlign: 'center', color: 'var(--text-main)' }}>
                {currentPage} / {pages.length}
              </span>
              <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={handleNextPage} disabled={currentPage === pages.length}>
                <ChevronRight size={13} />
              </button>
            </div>
          )}

          <div style={{ width: 1, height: 16, background: 'var(--border-color)' }} />

          {/* Zoom Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={() => setZoom(prev => Math.max(60, prev - 15))}>
              <ZoomOut size={13} />
            </button>
            <span style={{ fontWeight: 700, minWidth: 38, textAlign: 'center', color: 'var(--text-main)' }}>{zoom}%</span>
            <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={() => setZoom(prev => Math.min(160, prev + 15))}>
              <ZoomIn size={13} />
            </button>
          </div>

          {/* Light / Dark Paper Theme */}
          <button 
            className={`tool-btn ${lightPaperTheme ? 'active' : ''}`}
            onClick={() => setLightPaperTheme(!lightPaperTheme)}
            title="Toggle Light Paper vs Dark Reading Canvas"
          >
            {lightPaperTheme ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          <div style={{ width: 1, height: 16, background: 'var(--border-color)' }} />

          <button className="tool-btn" onClick={handlePrint} title="Print Document">
            <Printer size={15} />
          </button>

          <button className="tool-btn" onClick={handleDownload} title="Download Original .DOCX File">
            <Download size={15} />
          </button>
        </div>
      </div>

      {/* 2. Main Reader Canvas (Document Chapters Sidebar + Continuous Reading View) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Document Chapters Sidebar */}
        {showOutline && tocItems.length > 0 && (
          <aside 
            style={{ 
              width: 260, 
              borderRight: '1px solid var(--border-color)', 
              background: 'var(--bg-surface)', 
              overflowY: 'auto', 
              padding: '16px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-dim)', padding: '0 8px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bookmark size={14} style={{ color: '#0284c7' }} /> Document Chapters
            </div>

            {tocItems.map(item => (
              <div
                key={item.id}
                onClick={() => scrollToChapter(item.id)}
                style={{
                  padding: '7px 10px',
                  paddingLeft: `${(item.level - 1) * 12 + 10}px`,
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: item.level === 1 ? 700 : 500,
                  color: activeChapterId === item.id ? '#0284c7' : item.level === 1 ? 'var(--text-main)' : 'var(--text-muted)',
                  background: activeChapterId === item.id ? 'rgba(2, 132, 199, 0.12)' : 'transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  transition: 'var(--transition)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
                className="breadcrumb-item"
              >
                {item.level === 1 ? <BookOpen size={13} style={{ color: '#0284c7' }} /> : null}
                <span>{item.text}</span>
              </div>
            ))}
          </aside>
        )}

        {/* Continuous Stream Scroll Area (Default View) */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleDocxScroll}
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '40px 20px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: 32, 
            background: 'var(--bg-main)' 
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 100 }}>
              <FileText size={48} style={{ marginBottom: 16, opacity: 0.4, color: '#0284c7' }} />
              <h3 style={{ color: 'var(--text-main)', fontWeight: 700 }}>Optimizing Document Stream...</h3>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', color: 'var(--accent-rose)', paddingTop: 100 }}>
              <p style={{ fontWeight: 700 }}>{error}</p>
            </div>
          ) : viewMode === 'continuous' ? (
            /* --- CONTINUOUS MULTI-PAGE STREAM VIEW (DEFAULT) --- */
            pages.map((pageHtml, index) => (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <div 
                  style={{ 
                    width: '100%', 
                    maxWidth: '850px', 
                    minHeight: '1000px',
                    background: lightPaperTheme ? '#ffffff' : 'var(--bg-surface)', 
                    color: lightPaperTheme ? '#0f172a' : 'var(--text-main)',
                    border: '1px solid var(--border-color)', 
                    borderRadius: 'var(--radius-lg)', 
                    padding: '60px 72px 80px 72px', 
                    boxShadow: '0 15px 35px -5px rgba(0, 0, 0, 0.35)',
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'top center',
                    fontSize: `${fontSize}px`,
                    lineHeight: 1.75,
                    position: 'relative'
                  }}
                  className="rendered-markdown docx-rendered-content"
                  dangerouslySetInnerHTML={{ __html: renderHighlightedHtml(pageHtml) }}
                />

                {/* Page Break Divider */}
                <div style={{ margin: '16px 0', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: 1, textTransform: 'uppercase' }}>
                  — PAGE {index + 1} OF {pages.length} —
                </div>
              </div>
            ))
          ) : (
            /* --- SINGLE PAGE FLIP READER VIEW --- */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <div 
                style={{ 
                  width: '100%', 
                  maxWidth: '850px', 
                  minHeight: '1040px',
                  background: lightPaperTheme ? '#ffffff' : 'var(--bg-surface)', 
                  color: lightPaperTheme ? '#0f172a' : 'var(--text-main)',
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-lg)', 
                  padding: '60px 72px 80px 72px', 
                  boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.4)',
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'top center',
                  fontSize: `${fontSize}px`,
                  lineHeight: 1.75,
                  position: 'relative'
                }}
                className="rendered-markdown docx-rendered-content"
                dangerouslySetInnerHTML={{ __html: renderHighlightedHtml(pages[currentPage - 1] || '') }}
              />

              <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                <button className="tool-btn" onClick={handlePrevPage} disabled={currentPage === 1}>
                  <ChevronLeft size={16} /> Previous
                </button>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Page {currentPage} of {pages.length}
                </span>
                <button className="tool-btn" onClick={handleNextPage} disabled={currentPage === pages.length}>
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Footer Bar */}
      <div style={{ padding: '6px 20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface)', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <span>📄 {file.name}</span>
          <span>{totalWords} total words</span>
          <span>{pages.length} A4 pages</span>
          {tocItems.length > 0 && <span>{tocItems.length} chapters</span>}
        </div>

        <div style={{ color: 'var(--text-dim)' }}>
          Default Mode: Continuous Document Stream · Mammoth Engine
        </div>
      </div>
    </div>
  );
};
