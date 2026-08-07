import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Presentation, 
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  ExternalLink,
  Search,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import type { FileItem, ReadingSettings } from '../types';
import { getFileState, saveFileState, getSaveStateSettings } from '../utils/stateMemory';
import { renderPPTXjsToHtml, type PPTXjsResult } from '../utils/pptxjsRenderer';

interface PptxViewerProps {
  file: FileItem;
  settings?: ReadingSettings;
}

export const PptxViewer: React.FC<PptxViewerProps> = ({ file }) => {
  const isDuplicateTab = Boolean(file.isDuplicate || (file.tabId && file.tabId.includes('_dup_')));
  const fileKey = file.fullPath || file.id;
  const savedState = useMemo(() => (isDuplicateTab ? {} : getFileState(fileKey)), [fileKey, isDuplicateTab]);

  const [pptxResult, setPptxResult] = useState<PPTXjsResult | null>(null);
  const [currentSlide, setCurrentSlide] = useState<number>(savedState.currentSlide ? savedState.currentSlide : 1);
  const [inputSlide, setInputSlide] = useState<string>(String(savedState.currentSlide ? savedState.currentSlide : 1));
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Viewport Controls
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(true);
  const [textScale, setTextScale] = useState<number>(100); // % text size multiplier

  // Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeMatchIdx, setActiveMatchIdx] = useState<number>(0);

  const stageRef = useRef<HTMLDivElement>(null);

  // Trackpad Pinch & Ctrl+Wheel Zoom Listener for PPTX Viewer
  useEffect(() => {
    const el = stageRef.current;
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

  // 1. Fetch & Render PPTX using PPTXjs Core Engine
  useEffect(() => {
    let isMounted = true;
    const loadPPTXjs = async () => {
      try {
        setLoading(true);
        setError(null);

        let arrayBuf: ArrayBuffer | null = file.arrayBuffer || null;

        if (!arrayBuf && file.fullPath && window.electronAPI?.readFileBuffer) {
          try {
            const buf = await window.electronAPI.readFileBuffer(file.fullPath);
            if (buf) {
              const u8 = new Uint8Array(buf as any);
              arrayBuf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
            }
          } catch (e) {
            console.warn("Electron readFileBuffer failed for PPTX, falling back to fetch:", e);
          }
        }

        if (!arrayBuf && file.url) {
          const resp = await fetch(file.url);
          arrayBuf = await resp.arrayBuffer();
        }

        if (!arrayBuf) {
          throw new Error("Unable to read PowerPoint file bytes for PPTXjs.");
        }

        const res = await renderPPTXjsToHtml(arrayBuf, {
          containerId: 'pptx-container',
          slideWidth: 1280,
          slideHeight: 720
        });

        if (!isMounted) return;

        setPptxResult(res);
        const count = res.slideCount;
        const saveSet = getSaveStateSettings();
        const initialSlide = (!isDuplicateTab && saveSet.pptxEnabled && savedState.currentSlide) ? Math.min(Math.max(1, savedState.currentSlide), count || 1) : 1;
        setCurrentSlide(initialSlide);
        setInputSlide(String(initialSlide));
        setLoading(false);
      } catch (err: any) {
        console.error("PPTXjs render failed:", err);
        if (isMounted) {
          setError(err.message || "Failed to render PowerPoint presentation via PPTXjs.");
          setLoading(false);
        }
      }
    };

    loadPPTXjs();

    return () => {
      isMounted = false;
    };
  }, [fileKey, file.url, file.fullPath, file.arrayBuffer]);

  const currentSlideRef = useRef<number>(currentSlide);

  // Sync Input Slide when currentSlide updates
  useEffect(() => {
    setInputSlide(String(currentSlide));
    currentSlideRef.current = currentSlide;
  }, [currentSlide]);

  // Save slide state ONLY on tab close / unmount
  useEffect(() => {
    return () => {
      if (!isDuplicateTab && currentSlideRef.current >= 1) {
        saveFileState(fileKey, { currentSlide: currentSlideRef.current });
      }
    };
  }, [fileKey, isDuplicateTab]);

  // Handle HTML5 Fullscreen sync
  useEffect(() => {
    const onFSChange = () => {
      const isFS = Boolean(document.fullscreenElement);
      setIsFullscreen(isFS);
    };
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  // Navigation Handlers
  const handleJumpToSlide = (slideNum: number) => {
    if (!pptxResult) return;
    const valid = Math.min(Math.max(1, slideNum), pptxResult.slideCount || 1);
    setCurrentSlide(valid);
    setInputSlide(String(valid));
    currentSlideRef.current = valid;
  };

  const handleNextSlide = () => {
    if (!pptxResult || pptxResult.slideCount === 0) return;
    const next = (currentSlide % pptxResult.slideCount) + 1;
    handleJumpToSlide(next);
  };

  const handlePrevSlide = () => {
    if (!pptxResult || pptxResult.slideCount === 0) return;
    const prev = ((currentSlide - 2 + pptxResult.slideCount) % pptxResult.slideCount) + 1;
    handleJumpToSlide(prev);
  };

  const handleToggleFullscreen = () => {
    if (!isFullscreen) {
      if (stageRef.current?.requestFullscreen) {
        stageRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx = (activeMatchIdx - 1 + searchMatches.length) % searchMatches.length;
    setActiveMatchIdx(prevIdx);
    handleJumpToSlide(searchMatches[prevIdx]);
  };

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (activeMatchIdx + 1) % searchMatches.length;
    setActiveMatchIdx(nextIdx);
    handleJumpToSlide(searchMatches[nextIdx]);
  };

  const handlePageFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(inputSlide, 10);
    if (!isNaN(parsed)) {
      handleJumpToSlide(parsed);
    }
  };

  // Keyboard Navigation Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        handleNextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrevSlide();
      } else if (e.key === 'Home') {
        e.preventDefault();
        handleJumpToSlide(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        if (pptxResult) handleJumpToSlide(pptxResult.slideCount);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pptxResult, currentSlide]);

  // Compute Search Matches across slide text
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim() || !pptxResult) return [];
    const q = searchQuery.toLowerCase().trim();
    const matches: number[] = [];
    pptxResult.slidesHtml.forEach((html, idx) => {
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const text = tmp.textContent?.toLowerCase() || '';
      if (text.includes(q)) {
        matches.push(idx + 1);
      }
    });
    return matches;
  }, [searchQuery, pptxResult]);

  const handleDownload = () => {
    if (!file.arrayBuffer && !file.fullPath) return;
    const blob = new Blob([file.arrayBuffer || ''], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name || 'presentation.pptx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenExternal = async () => {
    if (file.fullPath && window.electronAPI?.openExternalFile) {
      try {
        await window.electronAPI.openExternalFile(file.fullPath);
      } catch (err) {
        console.error("Failed to open PPTX externally:", err);
      }
    }
  };

  const activeSlideHtml = pptxResult?.slidesHtml[currentSlide - 1] || '';

  return (
    <div className="content-area" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      {/* 1. PPTXjs Control Header Ribbon */}
      <div className="editor-toolbar" style={{ padding: '8px 16px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)', fontSize: '0.88rem' }}>
          <Presentation size={18} style={{ color: '#f97316' }} />
          <span style={{ fontWeight: 800 }}>{file.name}</span>
          <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 4, background: 'rgba(249, 115, 22, 0.15)', color: '#f97316', fontWeight: 700 }}>
            PPTXjs
          </span>
        </div>

        {/* Viewport & Presentation Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
          <button
            className={`tool-btn ${isFullscreen ? 'active' : ''}`}
            onClick={handleToggleFullscreen}
            title="📽 Present Fullscreen Mode"
            style={{ padding: '4px 10px', fontSize: '0.76rem' }}
          >
            {isFullscreen ? <Minimize2 size={14} style={{ color: '#f97316' }} /> : <Maximize2 size={14} style={{ color: '#f97316' }} />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>
        </div>

        {/* Slide Page Jump Navigation */}
        <form onSubmit={handlePageFormSubmit} style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
          <button type="button" className="tool-btn" style={{ padding: '4px 6px' }} onClick={handlePrevSlide} disabled={currentSlide <= 1} title="Previous Slide">
            <ChevronLeft size={15} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>Slide:</span>
            <input
              type="text"
              className="search-input"
              style={{ width: 44, padding: '2px 6px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 700 }}
              value={inputSlide}
              onChange={e => setInputSlide(e.target.value)}
              onBlur={handlePageFormSubmit}
            />
            {pptxResult && <span>/ {pptxResult.slideCount}</span>}
          </div>

          <button type="button" className="tool-btn" style={{ padding: '4px 6px' }} onClick={handleNextSlide} disabled={!pptxResult || currentSlide >= pptxResult.slideCount} title="Next Slide">
            <ChevronRight size={15} />
          </button>
        </form>

        {/* Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
          <button className="btn-icon" style={{ width: 26, height: 26 }} onClick={() => setZoomScale(z => Math.max(0.5, parseFloat((z - 0.15).toFixed(2))))} title="Zoom Out Slide Canvas">
            <ZoomOut size={14} />
          </button>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', minWidth: 44, textAlign: 'center' }}>
            {Math.round(zoomScale * 100)}%
          </span>
          <button className="btn-icon" style={{ width: 26, height: 26 }} onClick={() => setZoomScale(z => Math.min(2.0, parseFloat((z + 0.15).toFixed(2))))} title="Zoom In Slide Canvas">
            <ZoomIn size={14} />
          </button>
        </div>

        {/* Text Size Scale Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8, background: 'var(--bg-surface-elevated)', padding: '2px 6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <button
            className="btn-icon"
            style={{ width: 24, height: 24, fontSize: '0.72rem', fontWeight: 800 }}
            onClick={() => setTextScale(ts => Math.max(60, ts - 10))}
            title="Reduce Slide Text Size (A-)"
          >
            A-
          </button>
          <span
            onClick={() => setTextScale(100)}
            style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer', minWidth: 46, textAlign: 'center' }}
            title="Click to Reset Text Size to 100%"
          >
            {textScale}% Text
          </span>
          <button
            className="btn-icon"
            style={{ width: 24, height: 24, fontSize: '0.72rem', fontWeight: 800 }}
            onClick={() => setTextScale(ts => Math.min(180, ts + 10))}
            title="Increase Slide Text Size (A+)"
          >
            A+
          </button>
        </div>

        {/* Live Search Input Box */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: 8 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-dim)' }} />
          <input
            type="text"
            className="csv-search-input"
            style={{ paddingLeft: 30, paddingRight: 26, width: 170, fontSize: '0.8rem' }}
            placeholder="Search slide text..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setActiveMatchIdx(0); }}
          />
          {searchQuery && (
            <X size={14} style={{ position: 'absolute', right: 10, cursor: 'pointer', color: 'var(--text-dim)' }} onClick={() => setSearchQuery('')} />
          )}
        </div>

        {searchQuery && searchMatches.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: '0.76rem', color: '#fb923c', fontWeight: 700 }}>
              Match {activeMatchIdx + 1} of {searchMatches.length}
            </span>
            <button className="tool-btn" style={{ padding: 4 }} onClick={handlePrevMatch} title="Previous Search Match">
              <ChevronUp size={14} />
            </button>
            <button className="tool-btn" style={{ padding: 4 }} onClick={handleNextMatch} title="Next Search Match">
              <ChevronDown size={14} />
            </button>
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {file.fullPath && window.electronAPI?.openExternalFile && (
            <button className="tool-btn" onClick={handleOpenExternal} title="Open in Microsoft PowerPoint / Default App">
              <ExternalLink size={15} style={{ color: '#f97316' }} />
              <span>Open External</span>
            </button>
          )}
          <button className="tool-btn" onClick={handleDownload} title="Download Original PowerPoint File">
            <Download size={15} />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* 2. Main Presentation Stage (Thumbnails Sidebar + PPTXjs HTML Render Stage) */}
      <div ref={stageRef} style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', background: isFullscreen ? '#000000' : 'var(--bg-main)' }}>
        {/* Floating Sidebar Opener Tab when Sidebar is Collapsed */}
        {!showThumbnails && !isFullscreen && pptxResult && pptxResult.slideCount > 0 && (
          <button
            onClick={() => setShowThumbnails(true)}
            title="Expand Slides Sidebar"
            style={{
              position: 'absolute',
              left: 14,
              top: 14,
              zIndex: 30,
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-md)',
              fontSize: '0.78rem',
              fontWeight: 700
            }}
          >
            <PanelLeftOpen size={15} style={{ color: '#f97316' }} />
            <span>Slides ({pptxResult.slideCount})</span>
          </button>
        )}

        {/* Left Thumbnails Sidebar */}
        {showThumbnails && !isFullscreen && pptxResult && pptxResult.slideCount > 0 && (
          <aside
            style={{
              width: 220,
              background: 'var(--bg-surface)',
              borderRight: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              padding: 12,
              gap: 10,
              overflowY: 'auto',
              zIndex: 10
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#f97316', paddingBottom: 6, borderBottom: '1px solid var(--border-color)' }}>
              <span>SLIDES ({pptxResult.slideCount})</span>
              <button
                className="tool-btn"
                onClick={() => setShowThumbnails(false)}
                title="Collapse Sidebar"
                style={{ padding: '2px 4px', border: 'none', background: 'transparent' }}
              >
                <PanelLeftClose size={15} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            {pptxResult.slidesHtml.map((sHtml, idx) => {
              const slideNum = idx + 1;
              const isActive = currentSlide === slideNum;
              const isMatch = searchMatches.includes(slideNum);

              // Strip HTML tags for clean thumbnail label
              const tmp = document.createElement('div');
              tmp.innerHTML = sHtml;
              const slideText = tmp.textContent?.trim().slice(0, 40) || `Slide ${slideNum}`;

              return (
                <div
                  key={`pptxjs-thumb-${slideNum}`}
                  onClick={() => handleJumpToSlide(slideNum)}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    background: isActive ? 'var(--primary-light)' : 'var(--bg-surface-elevated)',
                    border: `1.5px solid ${isActive ? '#f97316' : 'var(--border-color)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isActive ? '0 4px 12px rgba(249,115,22,0.2)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: isActive ? '#f97316' : 'var(--text-muted)' }}>
                      SLIDE {slideNum}
                    </span>
                    {isMatch && (
                      <span style={{ fontSize: '0.64rem', background: '#f59e0b', color: '#000', padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>
                        MATCH
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: isActive ? '#fff' : 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {slideText}
                  </div>
                </div>
              );
            })}
          </aside>
        )}

        {/* Floating Fullscreen Controls HUD Overlay */}
        {isFullscreen && (
          <div style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(249, 115, 22, 0.4)',
            borderRadius: 30,
            padding: '8px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
          }}>
            <button className="tool-btn" onClick={handlePrevSlide} disabled={currentSlide <= 1} title="Previous Slide">
              <ChevronLeft size={18} style={{ color: '#f97316' }} />
            </button>

            <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.9rem' }}>
              Slide {currentSlide} / {pptxResult?.slideCount || 1}
            </span>

            <button className="tool-btn" onClick={handleNextSlide} disabled={!pptxResult || currentSlide >= pptxResult.slideCount} title="Next Slide">
              <ChevronRight size={18} style={{ color: '#f97316' }} />
            </button>

            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />

            <button className="tool-btn" onClick={handleToggleFullscreen} title="Exit Fullscreen Presentation (ESC)">
              <Minimize2 size={16} style={{ color: '#ef4444' }} />
              <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.78rem' }}>Exit</span>
            </button>
          </div>
        )}

        {/* Center PPTXjs HTML Slide Render Stage */}
        <div ref={stageRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 36, boxSizing: 'border-box' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <Sparkles size={44} className="spin-icon" style={{ color: '#f97316', marginBottom: 16 }} />
              <h3 style={{ color: '#fff', fontWeight: 800 }}>Rendering PPTXjs Presentation HTML...</h3>
            </div>
          ) : error ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
              <p>{error}</p>
            </div>
          ) : (
            <div
              style={{
                transform: `scale(${zoomScale})`,
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: `${textScale}%`
              }}
              dangerouslySetInnerHTML={{ __html: activeSlideHtml }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
