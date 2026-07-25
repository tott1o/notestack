import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { FileText, Download, ChevronLeft, ChevronRight, Layers, Cpu, ZoomIn, ZoomOut } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import type { FileItem } from '../types';
import { getFileState, saveFileState } from '../utils/stateMemory';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfViewerProps {
  file: FileItem;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ file }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [engineMode, setEngineMode] = useState<'canvas' | 'edge'>('canvas');
  const fileKey = file.fullPath || file.id;

  const [pageNumber, setPageNumber] = useState<number>(1);
  const [inputPage, setInputPage] = useState<string>('1');
  const [numPages, setNumPages] = useState<number>(0);
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset pageRefs & load initial saved page on file change
  useEffect(() => {
    pageRefs.current.clear();
    const saved = getFileState(fileKey);
    const initialPage = saved.pageNumber || 1;
    setPageNumber(initialPage);
    setInputPage(String(initialPage));
  }, [fileKey]);

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
        console.error("Failed to load PDF:", err);
        if (isMounted) setLoading(false);
      }
    }

    loadPdf();
    return () => { isMounted = false; };
  }, [pdfUrl]);

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
        wrapper.style.minHeight = 'auto'; // Remove placeholder min-height once canvas is attached

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

  // Instant 0 ms Scroll Restoration once page placeholders exist
  useLayoutEffect(() => {
    if (engineMode === 'canvas' && !loading && numPages > 0 && containerRef.current) {
      const saved = getFileState(fileKey);
      if (saved.scrollTop && saved.scrollTop > 0) {
        containerRef.current.scrollTop = saved.scrollTop;
      } else if (saved.pageNumber && saved.pageNumber > 1) {
        const targetEl = pageRefs.current.get(saved.pageNumber);
        if (targetEl && containerRef.current) {
          containerRef.current.scrollTop = targetEl.offsetTop - containerRef.current.offsetTop;
        }
      }
    }
  }, [engineMode, loading, numPages, fileKey]);

  // Save scroll position when unmounting or switching file
  useEffect(() => {
    return () => {
      if (containerRef.current && containerRef.current.scrollTop >= 0) {
        saveFileState(fileKey, { 
          scrollTop: containerRef.current.scrollTop, 
          pageNumber 
        });
      }
    };
  }, [fileKey, pageNumber]);

  // Automatic Continuous Scroll & Active Page Tracking
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;

    // Determine currently visible center page
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
      saveFileState(fileKey, { scrollTop, pageNumber: activePage });
    }, 200);
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
    <div className="content-area" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
      {/* Header Bar with Dual Engine Switcher, Zoom & Auto-Save Indicator */}
      <div className="editor-toolbar" style={{ padding: '8px 16px', background: 'var(--bg-surface)', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', color: 'var(--text-main)' }}>
          <FileText size={16} style={{ color: '#ef4444' }} />
          <span style={{ fontWeight: 600 }}>{file.name}</span>
        </div>

        {/* Engine Mode Switcher */}
        <div style={{ display: 'flex', background: 'var(--bg-surface-elevated)', padding: 2, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', gap: 2 }}>
          <button
            onClick={() => setEngineMode('canvas')}
            className={`tool-btn ${engineMode === 'canvas' ? 'active' : ''}`}
            style={{ padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700 }}
            title="100% Exact Continuous Scroll Reader with Auto-Save (Default)"
          >
            <Layers size={13} style={{ color: 'var(--accent-emerald)' }} />
            <span>Continuous Reader (Default)</span>
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
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#090d16' }}>
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
              Array.from({ length: numPages }, (_, i) => i + 1).map(pNum => (
                <div 
                  key={`${file.id}-page-${pNum}`}
                  ref={el => { if (el) pageRefs.current.set(pNum, el); }}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    width: `${Math.round(780 * zoomScale)}px`, 
                    maxWidth: '95%',
                    minHeight: '1100px', // Placeholder height so scrollHeight is immediately full
                    transition: 'width 0.15s ease'
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 700, marginBottom: 6 }}>
                    — PAGE {pNum} OF {numPages} —
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          pdfUrl ? (
            <embed
              key={`${file.id}-page-${pageNumber}`}
              src={`${pdfUrl}#page=${pageNumber}&toolbar=1&navpanes=1&scrollbar=1`}
              type="application/pdf"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>
              Loading MS Edge PDF document...
            </div>
          )
        )}
      </div>
    </div>
  );
};
