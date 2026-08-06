import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { 
  FileText, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Layers, 
  Cpu, 
  ZoomIn, 
  ZoomOut, 
  Search, 
  X, 
  ChevronUp, 
  ChevronDown 
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import type { FileItem } from '../types';
import { getFileState, saveFileState } from '../utils/stateMemory';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfViewerProps {
  file: FileItem;
}

interface PdfMatch {
  pageNumber: number;
  matchIndex: number;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ file }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [engineMode, setEngineMode] = useState<'canvas' | 'edge'>('canvas');
  const isDuplicateTab = Boolean(file.isDuplicate || (file.tabId && file.tabId.includes('_dup_')));
  const fileKey = file.fullPath || file.id;

  const [pageNumber, setPageNumber] = useState<number>(1);
  const [inputPage, setInputPage] = useState<string>('1');
  const [numPages, setNumPages] = useState<number>(0);
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);

  // Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<PdfMatch[]>([]);
  const [currentMatchIdx, setCurrentMatchIdx] = useState<number>(0);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isRestoringRef = useRef<boolean>(true);

  // Reset pageRefs & load initial saved page on file change
  useEffect(() => {
    pageRefs.current.clear();
    isRestoringRef.current = true;
    const saved = isDuplicateTab ? {} : getFileState(fileKey);
    const initialPage = saved.pageNumber || 1;
    setPageNumber(initialPage);
    setInputPage(String(initialPage));
    setSearchQuery('');
    setSearchResults([]);
    setCurrentMatchIdx(0);
  }, [fileKey, isDuplicateTab]);

  // Trackpad Pinch & Ctrl+Wheel Zoom Listener for PDF Viewer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.06 : 0.94;
        setZoomScale(prev => parseFloat(Math.min(3.0, Math.max(0.4, prev * zoomFactor)).toFixed(2)));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    let url: string | null = null;

    if (file.fullPath) {
      const normalized = file.fullPath.replace(/\\/g, '/');
      url = `file:///${normalized}`;
    } else if (file.url) {
      url = file.url;
    } else if (file.arrayBuffer) {
      const blob = new Blob([file.arrayBuffer], { type: 'application/pdf' });
      url = URL.createObjectURL(blob);
    }

    setPdfUrl(url);

    return () => {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    };
  }, [file]);

  // Load PDF Document
  useEffect(() => {
    if (!pdfUrl) return;

    let isMounted = true;
    async function loadPdf() {
      try {
        setLoading(true);
        const loadingTask = pdfjsLib.getDocument({ url: pdfUrl! });
        const pdf = await loadingTask.promise;
        if (!isMounted) return;

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load PDF via pdfjs:', err);
        if (isMounted) setLoading(false);
      }
    }

    loadPdf();

    return () => {
      isMounted = false;
    };
  }, [pdfUrl]);

  // PDF Text Search Engine across pages
  useEffect(() => {
    if (!searchQuery.trim() || !pdfDocRef.current || numPages === 0) {
      setSearchResults([]);
      setCurrentMatchIdx(0);
      setIsSearching(false);
      return;
    }

    let isCancelled = false;
    setIsSearching(true);

    const searchTimer = setTimeout(async () => {
      const pdf = pdfDocRef.current;
      if (!pdf) return;

      const query = searchQuery.trim().toLowerCase();
      const matches: PdfMatch[] = [];

      try {
        for (let pNum = 1; pNum <= pdf.numPages; pNum++) {
          if (isCancelled) break;
          const page = await pdf.getPage(pNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str || '').join(' ').toLowerCase();

          let pos = 0;
          let matchIndex = 0;
          while ((pos = pageText.indexOf(query, pos)) !== -1) {
            matches.push({ pageNumber: pNum, matchIndex: matchIndex++ });
            pos += query.length;
          }
        }

        if (!isCancelled) {
          setSearchResults(matches);
          setCurrentMatchIdx(0);
          setIsSearching(false);

          if (matches.length > 0) {
            handlePageJump(matches[0].pageNumber);
          }
        }
      } catch (err) {
        console.error("PDF search error:", err);
        if (!isCancelled) setIsSearching(false);
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(searchTimer);
    };
  }, [searchQuery, numPages]);

  const handleNextMatch = () => {
    if (searchResults.length === 0) return;
    const nextIdx = (currentMatchIdx + 1) % searchResults.length;
    setCurrentMatchIdx(nextIdx);
    handlePageJump(searchResults[nextIdx].pageNumber);
  };

  const handlePrevMatch = () => {
    if (searchResults.length === 0) return;
    const prevIdx = (currentMatchIdx - 1 + searchResults.length) % searchResults.length;
    setCurrentMatchIdx(prevIdx);
    handlePageJump(searchResults[prevIdx].pageNumber);
  };

  // Render PDF Pages into ready DOM placeholders
  const renderAllPages = useCallback(async () => {
    if (!pdfDocRef.current || !containerRef.current) return;
    const pdf = pdfDocRef.current;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const wrapper = pageRefs.current.get(pageNum);
      if (!wrapper || wrapper.getAttribute('data-rendered') === 'true') continue;

      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvas.style.borderRadius = 'var(--radius-md)';
        canvas.style.boxShadow = '0 8px 30px rgba(0,0,0,0.3)';

        wrapper.innerHTML = '';
        wrapper.appendChild(canvas);
        wrapper.setAttribute('data-rendered', 'true');
        wrapper.style.minHeight = 'auto';

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          canvas: canvas
        };
        await page.render(renderContext).promise;
      } catch (err) {
        console.error(`Error rendering page ${pageNum}:`, err);
      }
    }
  }, []);

  useEffect(() => {
    if (engineMode === 'canvas' && !loading && numPages > 0) {
      renderAllPages();
    }
  }, [engineMode, loading, numPages, renderAllPages]);

  // Jump to saved page or scroll position when numPages & container are ready
  useLayoutEffect(() => {
    if (engineMode === 'canvas' && !loading && numPages > 0 && containerRef.current) {
      const saved = isDuplicateTab ? {} : getFileState(fileKey);
      const targetPage = saved.pageNumber || 1;
      const savedScrollTop = saved.scrollTop;

      const performJump = () => {
        if (!containerRef.current) return;

        if (targetPage > 1) {
          const targetEl = pageRefs.current.get(targetPage);
          if (targetEl) {
            const offset = Math.max(0, targetEl.offsetTop - containerRef.current.offsetTop - 10);
            containerRef.current.scrollTop = offset;
          }
        } else if (savedScrollTop && savedScrollTop > 0) {
          containerRef.current.scrollTop = savedScrollTop;
        }

        setTimeout(() => {
          isRestoringRef.current = false;
        }, 300);
      };

      performJump();
      requestAnimationFrame(performJump);
      const t1 = setTimeout(performJump, 150);
      const t2 = setTimeout(performJump, 450);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [engineMode, loading, numPages, fileKey, isDuplicateTab]);

  useEffect(() => {
    return () => {
      if (!isDuplicateTab && !isRestoringRef.current && containerRef.current && containerRef.current.scrollTop >= 0) {
        saveFileState(fileKey, { 
          scrollTop: containerRef.current.scrollTop, 
          pageNumber 
        });
      }
    };
  }, [fileKey, pageNumber, isDuplicateTab]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;

    if (isRestoringRef.current) return;

    let activePage = pageNumber;
    let minDistance = Infinity;

    pageRefs.current.forEach((el, pNum) => {
      if (el && containerRef.current) {
        const elOffset = el.offsetTop - containerRef.current.offsetTop;
        const dist = Math.abs(elOffset - scrollTop);
        if (dist < minDistance) {
          minDistance = dist;
          activePage = pNum;
        }
      }
    });

    if (activePage !== pageNumber) {
      setPageNumber(activePage);
      setInputPage(String(activePage));
    }

    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      if (!isRestoringRef.current && !isDuplicateTab) {
        saveFileState(fileKey, { scrollTop, pageNumber: activePage });
      }
    }, 30000);
  };

  const handlePageJump = (targetPage: number) => {
    const valid = Math.min(Math.max(1, targetPage), numPages || 999);
    setPageNumber(valid);
    setInputPage(String(valid));

    const wrapper = pageRefs.current.get(valid);
    if (wrapper && containerRef.current) {
      containerRef.current.scrollTop = wrapper.offsetTop - containerRef.current.offsetTop - 10;
      saveFileState(fileKey, { scrollTop: containerRef.current.scrollTop, pageNumber: valid });
    }
  };

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(inputPage, 10);
    if (!isNaN(parsed)) {
      handlePageJump(parsed);
    }
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = file.name || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="content-area" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      {/* Header Bar with Dual Engine Switcher, Search, Zoom & Page Controls */}
      <div className="editor-toolbar" style={{ padding: '8px 16px', background: 'var(--bg-surface)', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', color: 'var(--text-main)' }}>
          <FileText size={16} style={{ color: '#ef4444' }} />
          <span style={{ fontWeight: 700 }}>{file.name}</span>
        </div>

        {/* Engine Mode Switcher */}
        <div style={{ display: 'flex', background: 'var(--bg-surface-elevated)', padding: 2, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', gap: 2 }}>
          <button
            onClick={() => setEngineMode('canvas')}
            className={`tool-btn ${engineMode === 'canvas' ? 'active' : ''}`}
            style={{ padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700 }}
            title="Continuous Reader"
          >
            <Layers size={13} style={{ color: 'var(--accent-emerald)' }} />
            <span>Continuous Reader</span>
          </button>

          <button
            onClick={() => setEngineMode('edge')}
            className={`tool-btn ${engineMode === 'edge' ? 'active' : ''}`}
            style={{ padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700 }}
            title="Native MS Edge Engine Mode"
          >
            <Cpu size={13} />
            <span>MS Edge Native</span>
          </button>
        </div>

        {/* Page Jump Controls */}
        <form onSubmit={handlePageSubmit} style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
          <button 
            type="button"
            className="tool-btn" 
            onClick={() => handlePageJump(pageNumber - 1)} 
            disabled={pageNumber <= 1}
            title="Previous Page"
            style={{ padding: '4px 6px' }}
          >
            <ChevronLeft size={15} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>Page:</span>
            <input
              type="text"
              className="search-input"
              style={{ width: 44, padding: '2px 6px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 700 }}
              value={inputPage}
              onChange={e => setInputPage(e.target.value)}
              onBlur={handlePageSubmit}
            />
            {numPages > 0 && <span>/ {numPages}</span>}
          </div>

          <button 
            type="button"
            className="tool-btn" 
            onClick={() => handlePageJump(pageNumber + 1)} 
            disabled={numPages > 0 && pageNumber >= numPages}
            title="Next Page"
            style={{ padding: '4px 6px' }}
          >
            <ChevronRight size={15} />
          </button>
        </form>

        {/* Live Word Search Input for PDF */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: 8 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-dim)' }} />
          <input
            type="text"
            className="csv-search-input"
            style={{ paddingLeft: 30, paddingRight: searchQuery ? 80 : 26, width: 220, fontSize: '0.8rem' }}
            placeholder="Search PDF text..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />

          {searchQuery && (
            <div style={{ position: 'absolute', right: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: searchResults.length > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                {isSearching ? '...' : searchResults.length > 0 ? `${currentMatchIdx + 1}/${searchResults.length}` : '0/0'}
              </span>
              <button 
                type="button" 
                className="btn-icon" 
                style={{ width: 18, height: 18 }} 
                onClick={handlePrevMatch} 
                disabled={searchResults.length === 0}
                title="Previous Match"
              >
                <ChevronUp size={12} />
              </button>
              <button 
                type="button" 
                className="btn-icon" 
                style={{ width: 18, height: 18 }} 
                onClick={handleNextMatch} 
                disabled={searchResults.length === 0}
                title="Next Match"
              >
                <ChevronDown size={12} />
              </button>
              <X 
                size={13} 
                style={{ cursor: 'pointer', color: 'var(--text-dim)', marginLeft: 2 }} 
                onClick={() => setSearchQuery('')} 
              />
            </div>
          )}
        </div>

        {/* Zoom Controls */}
        {engineMode === 'canvas' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
            <button className="btn-icon" style={{ width: 26, height: 26 }} onClick={() => setZoomScale(z => Math.max(0.6, parseFloat((z - 0.15).toFixed(2))))} title="Zoom Out">
              <ZoomOut size={14} />
            </button>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', minWidth: 44, textAlign: 'center' }}>
              {Math.round(zoomScale * 100)}%
            </span>
            <button className="btn-icon" style={{ width: 26, height: 26 }} onClick={() => setZoomScale(z => Math.min(2.5, parseFloat((z + 0.15).toFixed(2))))} title="Zoom In">
              <ZoomIn size={14} />
            </button>
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="tool-btn" onClick={handleDownload} title="Download PDF">
            <Download size={15} />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--bg-main)' }}>
        {engineMode === 'canvas' ? (
          <div 
            ref={containerRef}
            onScroll={handleScroll}
            style={{ 
              width: '100%', 
              height: '100%', 
              overflowY: 'auto', 
              padding: '32px 16px', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: 24,
              boxSizing: 'border-box'
            }}
          >
            {loading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 100 }}>
                <FileText size={48} style={{ marginBottom: 16, opacity: 0.4, color: '#ef4444' }} />
                <h3 style={{ color: 'var(--text-main)', fontWeight: 700 }}>Rendering Continuous PDF Stream...</h3>
              </div>
            ) : (
              Array.from({ length: numPages }, (_, i) => i + 1).map(pNum => {
                const isMatchPage = searchResults.some(m => m.pageNumber === pNum);
                const currentMatch = searchResults[currentMatchIdx];
                const isCurrentMatchPage = currentMatch?.pageNumber === pNum;

                return (
                  <div 
                    key={`${file.id}-page-${pNum}`}
                    ref={el => { if (el) pageRefs.current.set(pNum, el); }}
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      width: `${Math.round(780 * zoomScale)}px`, 
                      maxWidth: '95%',
                      minHeight: '1100px',
                      transition: 'width 0.15s ease',
                      border: isCurrentMatchPage ? '3px solid #f97316' : isMatchPage ? '2px solid rgba(249, 115, 22, 0.4)' : 'none',
                      borderRadius: 8,
                      position: 'relative'
                    }}
                  >
                    {isMatchPage && (
                      <div 
                        style={{ 
                          position: 'absolute', 
                          top: -12, 
                          right: 16, 
                          background: isCurrentMatchPage ? '#f97316' : 'rgba(249, 115, 22, 0.8)', 
                          color: '#fff', 
                          fontSize: '0.68rem', 
                          fontWeight: 800, 
                          padding: '2px 8px', 
                          borderRadius: 4,
                          zIndex: 10
                        }}
                      >
                        SEARCH MATCH (PAGE {pNum})
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <iframe 
            src={pdfUrl || ''} 
            style={{ width: '100%', height: '100%', border: 'none' }} 
            title={file.name}
          />
        )}
      </div>
    </div>
  );
};
