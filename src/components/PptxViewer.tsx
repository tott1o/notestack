import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Presentation, 
  ImageIcon,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Grid,
  Layers,
  Copy,
  Check,
  ExternalLink,
  FileCheck,
  Search,
  Quote,
  ArrowUp,
  X,
  List
} from 'lucide-react';
import JSZip from 'jszip';
import type { FileItem, ReadingSettings } from '../types';
import { getFileState, saveFileState } from '../utils/stateMemory';

interface PptxViewerProps {
  file: FileItem;
  settings?: ReadingSettings;
}

interface SlideTextNode {
  type: 'title' | 'subtitle' | 'paragraph' | 'bullet';
  text: string;
  level: number;
  fontSizePt?: number;
  isBold?: boolean;
}

interface SlideItem {
  id: number;
  title: string;
  titlePt: number;
  subtitle?: string;
  subtitlePt?: number;
  nodes: SlideTextNode[];
  notes?: string;
  tag?: string;
  images?: string[];
  wordCount: number;
}

export const PptxViewer: React.FC<PptxViewerProps> = ({ file }) => {
  const fileKey = file.fullPath || file.id;

  // Restore saved presentation state memory on mount
  const initialState = useMemo(() => getFileState(fileKey), [fileKey]);

  const [currentSlide, setCurrentSlide] = useState<number>(initialState.currentSlide || 1);
  const [inputSlide, setInputSlide] = useState<string>(String(initialState.currentSlide || 1));
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [zoomScale, setZoomScale] = useState<number>(initialState.zoom || 1.0);
  const [fontScaleRatio, setFontScaleRatio] = useState<number>(initialState.fontScaleRatio || 1.0);
  const [viewMode, setViewMode] = useState<'continuous' | 'grid' | 'presenter'>(
    (initialState.viewMode as any) || 'continuous'
  );
  const [showFilmstrip, setShowFilmstrip] = useState<boolean>(
    initialState.showFilmstrip !== undefined ? initialState.showFilmstrip : true
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedSlideId, setCopiedSlideId] = useState<number | null>(null);

  const [realSlides, setRealSlides] = useState<SlideItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredRef = useRef<boolean>(false);

  // Reset restoration flag when file changes
  useEffect(() => {
    hasRestoredRef.current = false;
  }, [fileKey]);

  // Helper to persist state updates to stateMemory.ts
  const persistState = useCallback((updates: Record<string, any>) => {
    saveFileState(fileKey, updates);
  }, [fileKey]);

  // Restore scroll position & slide AFTER slides finish loading into DOM
  useEffect(() => {
    if (loading) return;

    const saved = getFileState(fileKey);
    const targetSlide = saved.currentSlide || 1;
    setCurrentSlide(targetSlide);
    setInputSlide(String(targetSlide));

    const timer = setTimeout(() => {
      if (saved.scrollTop && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = saved.scrollTop;
      } else if (targetSlide > 1) {
        const el = slideRefs.current.get(targetSlide);
        if (el) {
          el.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
      }
      hasRestoredRef.current = true;
    }, 120);

    return () => clearTimeout(timer);
  }, [loading, fileKey]);

  // Parse real OpenXML presentation data
  useEffect(() => {
    let isMounted = true;

    async function parseRealPptx() {
      setLoading(true);
      try {
        let buffer: ArrayBuffer | null = file.arrayBuffer || null;

        if (!buffer && file.fullPath && window.electronAPI?.readFileBuffer) {
          buffer = await window.electronAPI.readFileBuffer(file.fullPath);
        }

        if (!buffer) {
          if (isMounted) setLoading(false);
          return;
        }

        const zip = await JSZip.loadAsync(buffer);
        const mediaFiles = Object.keys(zip.files).filter(name => /^ppt\/media\//i.test(name));
        const mediaMap: { [key: string]: string } = {};

        for (const mPath of mediaFiles) {
          try {
            const ext = mPath.split('.').pop()?.toLowerCase() || 'png';
            const base64 = await zip.files[mPath].async('base64');
            const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
            mediaMap[mPath] = `data:${mime};base64,${base64}`;
          } catch (e) {
            console.error("Error reading media image:", e);
          }
        }

        const slideFiles = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name));

        if (slideFiles.length === 0) {
          if (isMounted) setLoading(false);
          return;
        }

        slideFiles.sort((a, b) => {
          const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
          const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
          return numA - numB;
        });

        const parsedSlides: SlideItem[] = [];
        const parser = new DOMParser();

        for (let i = 0; i < slideFiles.length; i++) {
          const slidePath = slideFiles[i];
          const slideXmlStr = await zip.files[slidePath].async('string');
          const xmlDoc = parser.parseFromString(slideXmlStr, 'application/xml');

          const relsPath = `ppt/slides/_rels/slide${i + 1}.xml.rels`;
          const slideImages: string[] = [];
          if (zip.files[relsPath]) {
            try {
              const relsXmlStr = await zip.files[relsPath].async('string');
              const relsDoc = parser.parseFromString(relsXmlStr, 'application/xml');
              const relElements = Array.from(relsDoc.getElementsByTagName('Relationship'));

              for (const rel of relElements) {
                const target = rel.getAttribute('Target');
                if (target && /^..\/(media\/.*)$/i.test(target)) {
                  const mediaKey = 'ppt/' + target.replace(/^..\//, '');
                  if (mediaMap[mediaKey]) {
                    slideImages.push(mediaMap[mediaKey]);
                  }
                }
              }
            } catch (e) {
              console.error("Error reading slide rels:", e);
            }
          }

          const nodes: SlideTextNode[] = [];
          let slideTitle = '';
          let titleFontPt = 36;
          let slideSubtitle: string | undefined = undefined;
          let subtitleFontPt = 22;

          const pElements = Array.from(xmlDoc.getElementsByTagName('a:p'));

          for (const pEl of pElements) {
            const pPr = pEl.getElementsByTagName('a:pPr')[0];
            const hasBuNone = pPr ? pPr.getElementsByTagName('a:buNone').length > 0 : false;
            const hasBuChar = pPr ? pPr.getElementsByTagName('a:buChar').length > 0 : false;
            const hasBuAutoNum = pPr ? pPr.getElementsByTagName('a:buAutoNum').length > 0 : false;
            const lvl = pPr && pPr.hasAttribute('lvl') ? parseInt(pPr.getAttribute('lvl') || '0', 10) : 0;

            const isExplicitBullet = !hasBuNone && (hasBuChar || hasBuAutoNum || lvl > 0);

            const rElements = Array.from(pEl.getElementsByTagName('a:r'));
            let pText = '';
            let maxFontSzPt = 18;
            let isBold = false;

            for (const rEl of rElements) {
              const rPr = rEl.getElementsByTagName('a:rPr')[0];
              if (rPr) {
                if (rPr.getAttribute('b') === '1') isBold = true;
                const sz = rPr.getAttribute('sz');
                if (sz) {
                  const pt = parseInt(sz, 10) / 100;
                  if (pt > maxFontSzPt) maxFontSzPt = pt;
                }
              }
              const tEl = rEl.getElementsByTagName('a:t')[0];
              if (tEl && tEl.textContent) {
                pText += tEl.textContent;
              }
            }

            if (!pText.trim()) continue;

            const trimmed = pText.trim();

            if (!slideTitle && (maxFontSzPt >= 28 || nodes.length === 0)) {
              slideTitle = trimmed;
              titleFontPt = maxFontSzPt;
              nodes.push({ type: 'title', text: trimmed, level: 0, fontSizePt: maxFontSzPt, isBold: true });
            } else if (!slideSubtitle && maxFontSzPt >= 22 && nodes.length === 1) {
              slideSubtitle = trimmed;
              subtitleFontPt = maxFontSzPt;
              nodes.push({ type: 'subtitle', text: trimmed, level: 0, fontSizePt: maxFontSzPt, isBold });
            } else if (isExplicitBullet) {
              nodes.push({ type: 'bullet', text: trimmed, level: lvl, fontSizePt: maxFontSzPt, isBold });
            } else {
              nodes.push({ type: 'paragraph', text: trimmed, level: lvl, fontSizePt: maxFontSzPt, isBold });
            }
          }

          if (!slideTitle) slideTitle = `Slide ${i + 1}`;

          const wordCount = nodes.reduce((acc, n) => acc + n.text.split(/\s+/).length, 0);

          parsedSlides.push({
            id: i + 1,
            title: slideTitle,
            titlePt: titleFontPt,
            subtitle: slideSubtitle,
            subtitlePt: subtitleFontPt,
            nodes,
            tag: `SLIDE ${i + 1}`,
            images: slideImages.length > 0 ? slideImages : undefined,
            wordCount
          });
        }

        if (isMounted && parsedSlides.length > 0) {
          setRealSlides(parsedSlides);
        }
      } catch (err) {
        console.error("Failed to parse PPTX OpenXML:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    parseRealPptx();

    return () => {
      isMounted = false;
    };
  }, [file]);

  // Fallback demo slides if loading sample PPTX
  const rawSlides: SlideItem[] = useMemo(() => {
    if (realSlides.length > 0) return realSlides;
    return [
      {
        id: 1,
        title: file.name.replace(/\.[^/.]+$/, ''),
        titlePt: 38,
        subtitle: 'Interactive OpenXML Presentation Deck',
        subtitlePt: 22,
        tag: 'TITLE SLIDE',
        nodes: [
          { type: 'title', text: file.name.replace(/\.[^/.]+$/, ''), level: 0, fontSizePt: 38, isBold: true },
          { type: 'subtitle', text: 'Interactive OpenXML Presentation Deck', level: 0, fontSizePt: 22, isBold: false },
          { type: 'paragraph', text: 'Welcome to NoteStack PowerPoint Viewer Engine.', level: 0, fontSizePt: 18 }
        ],
        wordCount: 42
      },
      {
        id: 2,
        title: 'Core Concepts & Analytical Principles',
        titlePt: 32,
        subtitle: 'Fundamental Frameworks & Vocabulary',
        subtitlePt: 20,
        tag: 'MODULE 1',
        nodes: [
          { type: 'paragraph', text: 'Review the key principles below before continuing to the problem sets.', level: 0, fontSizePt: 18 },
          { type: 'bullet', text: 'Primary Principles, Axioms & System Models', level: 0, fontSizePt: 20 },
          { type: 'bullet', text: 'Key Definitions & Vocabulary Framework', level: 0, fontSizePt: 20 },
          { type: 'bullet', text: 'Applied Real-World Case Studies & Walkthroughs', level: 0, fontSizePt: 18 }
        ],
        wordCount: 38
      }
    ];
  }, [realSlides, file.name]);

  const slides = useMemo(() => {
    if (!searchQuery.trim()) return rawSlides;
    const q = searchQuery.toLowerCase();
    return rawSlides.filter(s => 
      s.title.toLowerCase().includes(q) || 
      (s.subtitle && s.subtitle.toLowerCase().includes(q)) ||
      s.nodes.some(n => n.text.toLowerCase().includes(q))
    );
  }, [rawSlides, searchQuery]);

  const totalSlides = rawSlides.length;
  const activeSlideData = rawSlides[Math.min(currentSlide - 1, totalSlides - 1)] || rawSlides[0];

  // IntersectionObserver for Continuous Reader Page Detection
  useEffect(() => {
    if (viewMode !== 'continuous' || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!hasRestoredRef.current) return;
          if (entry.isIntersecting) {
            const slideIdStr = entry.target.getAttribute('data-slide-id');
            if (slideIdStr) {
              const slideId = parseInt(slideIdStr, 10);
              setCurrentSlide(slideId);
              setInputSlide(String(slideId));
              persistState({ currentSlide: slideId });
            }
          }
        });
      },
      { root: scrollContainerRef.current, threshold: 0.5 }
    );

    slideRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [viewMode, loading, slides, persistState]);

  const handleSlideChange = useCallback((newSlide: number) => {
    const valid = Math.min(Math.max(1, newSlide), totalSlides);
    setCurrentSlide(valid);
    setInputSlide(String(valid));

    if (viewMode === 'continuous') {
      const targetEl = slideRefs.current.get(valid);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    persistState({ currentSlide: valid });
  }, [totalSlides, viewMode, persistState]);

  const handleViewModeChange = (mode: 'continuous' | 'grid' | 'presenter') => {
    setViewMode(mode);
    persistState({ viewMode: mode });
  };

  const handleZoomChange = (newZoom: number) => {
    setZoomScale(newZoom);
    persistState({ zoom: newZoom });
  };

  const handleFontScaleChange = (newScale: number) => {
    setFontScaleRatio(newScale);
    persistState({ fontScaleRatio: newScale });
  };

  const handleFilmstripToggle = () => {
    const nextVal = !showFilmstrip;
    setShowFilmstrip(nextVal);
    persistState({ showFilmstrip: nextVal });
  };


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        handleSlideChange(currentSlide + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        handleSlideChange(currentSlide - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, handleSlideChange]);

  const handleSlideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(inputSlide, 10);
    if (!isNaN(parsed)) {
      handleSlideChange(parsed);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      persistState({ scrollTop, currentSlide });
    }, 250);
  };

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCopySlideText = (slide: SlideItem) => {
    const textToCopy = `# ${slide.title}\n${slide.subtitle ? `## ${slide.subtitle}\n` : ''}\n${slide.nodes.map(n => n.type === 'bullet' ? `- ${n.text}` : n.text).join('\n\n')}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedSlideId(slide.id);
    setTimeout(() => setCopiedSlideId(null), 2000);
  };

  const handleOpenExternal = async () => {
    if (file.fullPath && window.electronAPI?.openExternalFile) {
      await window.electronAPI.openExternalFile(file.fullPath);
    }
  };

  // OpenXML Paragraph & Bullet Renderer
  const renderSlideContentNodes = (nodes: SlideTextNode[]) => {
    const bodyNodes = nodes.filter(n => n.type !== 'title' && n.type !== 'subtitle');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '12px 0' }}>
        {bodyNodes.map((node, idx) => {
          const pt = node.fontSizePt || 16;
          const computedFontSizeRem = (pt * 0.075 * fontScaleRatio * zoomScale).toFixed(2);

          if (node.type === 'bullet') {
            return (
              <div 
                key={idx} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: 8, 
                  paddingLeft: `${node.level * 20}px`,
                  fontSize: `${computedFontSizeRem}rem`,
                  lineHeight: 1.45,
                  color: 'var(--text-main)'
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', marginTop: 8, flexShrink: 0 }} />
                <span style={{ fontWeight: node.isBold ? 700 : 400 }}>{node.text}</span>
              </div>
            );
          } else {
            return (
              <p 
                key={idx} 
                style={{ 
                  fontSize: `${computedFontSizeRem}rem`, 
                  color: 'var(--text-main)', 
                  lineHeight: 1.45, 
                  fontWeight: node.isBold ? 700 : 400, 
                  margin: '2px 0',
                  paddingLeft: `${node.level * 20}px`
                }}
              >
                {node.text}
              </p>
            );
          }
        })}
      </div>
    );
  };

  return (
    <div 
      ref={containerRef}
      className="content-area" 
      style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        background: 'var(--bg-main)',
        color: 'var(--text-main)',
        ...(isFullscreen ? { position: 'fixed', inset: 0, zIndex: 9999 } : {})
      }}
    >
      {/* 1. Header Toolbar Ribbon */}
      <div className="editor-toolbar" style={{ padding: '8px 16px', background: 'var(--bg-surface)', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'var(--primary-light)', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
            <Presentation size={16} style={{ color: '#f97316' }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.88rem', fontFamily: 'var(--font-heading)', color: 'var(--text-main)' }}>{file.name}</div>
            <div style={{ fontSize: '0.66rem', color: '#f97316', fontWeight: 700, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
              <FileCheck size={10} /> OpenXML Presentation ({totalSlides} Slides)
            </div>
          </div>
        </div>

        {/* View Mode Switcher Pills */}
        <div style={{ display: 'flex', background: 'var(--bg-surface-elevated)', padding: 2, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', gap: 2, marginLeft: 8 }}>
          <button
            onClick={() => handleViewModeChange('continuous')}
            className={`mode-btn ${viewMode === 'continuous' ? 'active' : ''}`}
            title="Continuous Reader Stream"
          >
            <Monitor size={14} /> Stream
          </button>

          <button
            onClick={() => handleViewModeChange('grid')}
            className={`mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
            title="Slide Sorter Grid"
          >
            <Grid size={14} /> Grid
          </button>

          <button
            onClick={() => handleViewModeChange('presenter')}
            className={`mode-btn ${viewMode === 'presenter' ? 'active' : ''}`}
            title="Full Presenter Deck Stage"
          >
            <Layers size={14} /> Stage
          </button>
        </div>

        {/* Slide Jump Counter Form */}
        <form onSubmit={handleSlideSubmit} style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
          <button 
            type="button"
            className="btn-icon"
            style={{ width: 24, height: 24 }}
            onClick={() => handleSlideChange(currentSlide - 1)} 
            disabled={currentSlide <= 1}
            title="Previous Slide"
          >
            <ChevronLeft size={13} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--bg-surface-elevated)', padding: '2px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-dim)' }}>Slide</span>
            <input
              type="text"
              style={{ width: 28, padding: '1px 2px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary)', border: 'none', background: 'transparent', outline: 'none' }}
              value={inputSlide}
              onChange={e => setInputSlide(e.target.value)}
              onBlur={handleSlideSubmit}
            />
            <span style={{ fontWeight: 700, color: 'var(--text-dim)' }}>/ {totalSlides}</span>
          </div>

          <button 
            type="button"
            className="btn-icon"
            style={{ width: 24, height: 24 }}
            onClick={() => handleSlideChange(currentSlide + 1)} 
            disabled={currentSlide >= totalSlides}
            title="Next Slide"
          >
            <ChevronRight size={13} />
          </button>
        </form>

        {/* Search Input */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: 4 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-dim)' }} />
          <input
            type="text"
            className="csv-search-input"
            style={{ paddingLeft: 30, paddingRight: 26, width: 170, fontSize: '0.78rem' }}
            placeholder="Search slides..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <X size={14} style={{ position: 'absolute', right: 10, cursor: 'pointer', color: 'var(--text-dim)' }} onClick={() => setSearchQuery('')} />
          )}
        </div>

        {/* Typography Font Scale & Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 2 }}>
            <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={() => handleFontScaleChange(Math.max(0.7, parseFloat((fontScaleRatio - 0.1).toFixed(2))))} title="Decrease OpenXML Font Scale">
              <span style={{ fontSize: '0.68rem', fontWeight: 800 }}>A-</span>
            </button>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-main)', minWidth: 32, textAlign: 'center' }}>
              {Math.round(fontScaleRatio * 100)}%
            </span>
            <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={() => handleFontScaleChange(Math.min(1.8, parseFloat((fontScaleRatio + 0.1).toFixed(2))))} title="Increase OpenXML Font Scale">
              <span style={{ fontSize: '0.68rem', fontWeight: 800 }}>A+</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 2 }}>
            <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={() => handleZoomChange(Math.max(0.6, parseFloat((zoomScale - 0.15).toFixed(2))))} title="Zoom Out Slide Canvas">
              <span style={{ fontSize: '0.68rem', fontWeight: 800 }}>-</span>
            </button>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-main)', minWidth: 34, textAlign: 'center' }}>
              {Math.round(zoomScale * 100)}%
            </span>
            <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={() => handleZoomChange(Math.min(2.2, parseFloat((zoomScale + 0.15).toFixed(2))))} title="Zoom In Slide Canvas">
              <span style={{ fontSize: '0.68rem', fontWeight: 800 }}>+</span>
            </button>
          </div>
        </div>

        {/* Fullscreen & External PowerPoint Action */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>

          <button 
            className="tool-btn" 
            onClick={() => setIsFullscreen(!isFullscreen)} 
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Reading Mode'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>

          {file.fullPath && (
            <button 
              className="btn-primary" 
              onClick={handleOpenExternal}
              style={{ padding: '5px 12px', fontSize: '0.76rem', background: '#f97316', color: '#fff', gap: 6, fontWeight: 700, borderRadius: 'var(--radius-md)', border: 'none', boxShadow: 'var(--shadow-sm)' }}
              title="Open Presentation in Microsoft PowerPoint"
            >
              <ExternalLink size={14} />
              <span>PowerPoint</span>
            </button>
          )}
        </div>
      </div>

      {/* Slide Progress Line */}
      <div style={{ height: 3, background: 'var(--border-color)', width: '100%' }}>
        <div style={{ height: '100%', width: `${(currentSlide / totalSlides) * 100}%`, background: '#f97316', transition: 'width 0.2s ease' }} />
      </div>

      {/* 2. Main Reader Canvas Container */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <Presentation size={48} style={{ marginBottom: 16, opacity: 0.4, color: '#f97316' }} />
            <h3 style={{ color: 'var(--text-main)', fontWeight: 700 }}>Extracting OpenXML Font Sizes & Slide Content...</h3>
          </div>
        ) : viewMode === 'grid' ? (
          /* SLIDE SORTER LIGHT-TABLE GRID VIEW */
          <div style={{ flex: 1, padding: 32, overflowY: 'auto', background: 'var(--bg-main)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24, maxWidth: 1400, margin: '0 auto' }}>
              {slides.map((s) => {
                const isActive = currentSlide === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      handleSlideChange(s.id);
                      handleViewModeChange('continuous');
                    }}
                    style={{
                      background: 'var(--bg-surface)',
                      color: 'var(--text-main)',
                      borderRadius: 'var(--radius-md)',
                      border: isActive ? `2px solid var(--primary)` : '1px solid var(--border-color)',
                      boxShadow: isActive ? '0 10px 30px var(--primary-glow)' : 'var(--shadow-sm)',
                      padding: 20,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: 180,
                      transition: 'transform 0.2s ease, boxShadow 0.2s ease'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 4 }}>
                          SLIDE #{s.id}
                        </span>
                        {s.images && s.images.length > 0 && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#f97316', display: 'flex', alignItems: 'center', gap: 2 }}>
                            <ImageIcon size={11} /> {s.images.length} Media
                          </span>
                        )}
                      </div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0', lineHeight: 1.3 }}>{s.title}</h4>
                      {s.subtitle && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>{s.subtitle}</p>}
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10, marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                      <span>{s.nodes.length} content nodes</span>
                      <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Click to View →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : viewMode === 'continuous' ? (
          /* MAGAZINE CONTINUOUS DECK STREAM VIEW (DEFAULT) */
          <>
            {showFilmstrip && (
              <aside 
                style={{ 
                  width: 250, 
                  background: 'var(--bg-surface)', 
                  borderRight: '1px solid var(--border-color)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  padding: 14, 
                  gap: 10, 
                  overflowY: 'auto' 
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <List size={13} style={{ color: '#f97316' }} /> SLIDE INDEX ({slides.length})
                  </span>
                  <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={handleFilmstripToggle}>
                    <ChevronLeft size={14} />
                  </button>
                </div>

                {slides.map((s) => {
                  const isActive = currentSlide === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSlideChange(s.id)}
                      style={{
                        borderRadius: 'var(--radius-sm)',
                        border: isActive ? `2px solid var(--primary)` : '1px solid var(--border-color)',
                        background: isActive ? 'var(--primary-light)' : 'var(--bg-surface-elevated)',
                        padding: 10,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isActive ? 'var(--shadow-sm)' : 'none'
                      }}
                    >
                      <div style={{ minHeight: 64, background: 'var(--bg-surface)', borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-dim)', marginTop: 8 }}>
                          <span style={{ fontWeight: 800, color: isActive ? 'var(--primary)' : 'inherit' }}>#{s.id}</span>
                          {s.images && s.images.length > 0 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-surface-elevated)', color: 'var(--text-main)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                              <ImageIcon size={10} /> {s.images.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </aside>
            )}

            {!showFilmstrip && (
              <button
                className="btn-icon"
                onClick={handleFilmstripToggle}
                style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)' }}
              >
                <ChevronRight size={16} />
              </button>
            )}

            {/* Slide Stream Canvas */}
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              style={{ flex: 1, padding: '40px 20px 120px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40, background: 'var(--bg-main)', position: 'relative' }}
            >
              {slides.map((s) => (
                <div 
                  key={s.id}
                  data-slide-id={s.id}
                  ref={el => { if (el) slideRefs.current.set(s.id, el); }}
                  style={{
                    width: `${Math.round(980 * zoomScale)}px`,
                    maxWidth: '98%',
                    minHeight: 'fit-content',
                    height: 'auto',
                    overflow: 'visible',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    borderRadius: 24,
                    border: currentSlide === s.id ? `2px solid var(--primary)` : '1px solid var(--border-color)',
                    boxShadow: currentSlide === s.id 
                      ? `0 25px 80px rgba(0,0,0,0.3), 0 0 35px var(--primary-glow)` 
                      : '0 12px 40px rgba(0,0,0,0.15)',
                    padding: `${Math.round(48 * zoomScale)}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxSizing: 'border-box',
                    transition: 'all 0.22s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-surface-elevated)', padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                      {s.tag || `SLIDE ${s.id}`}
                    </span>

                    <button
                      onClick={() => handleCopySlideText(s)}
                      className="tool-btn"
                      style={{ padding: '4px 8px', fontSize: '0.72rem', gap: 4, fontWeight: 700 }}
                      title="Copy Slide Content to Clipboard"
                    >
                      {copiedSlideId === s.id ? <Check size={13} style={{ color: 'var(--accent-emerald)' }} /> : <Copy size={13} />}
                      <span>{copiedSlideId === s.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <div style={{ margin: '20px 0 16px 0' }}>
                    <h2 style={{ fontSize: `${(s.titlePt * 0.082 * fontScaleRatio * zoomScale).toFixed(2)}rem`, fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-heading)', margin: 0, lineHeight: 1.25, letterSpacing: '-0.02em' }}>
                      {s.title}
                    </h2>
                    {s.subtitle && (
                      <div style={{ marginTop: 12, paddingLeft: 16, borderLeft: `4px solid #f97316`, fontSize: `${((s.subtitlePt || 22) * 0.082 * fontScaleRatio * zoomScale).toFixed(2)}rem`, color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.4 }}>
                        {s.subtitle}
                      </div>
                    )}
                  </div>

                  {s.images && s.images.length > 0 && (
                    <div style={{ margin: '20px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', fontWeight: 800, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <ImageIcon size={14} /> EMBEDDED SLIDE MEDIA CANVAS ({s.images.length})
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, padding: 14, background: 'var(--bg-surface-elevated)', borderRadius: 14, border: '1px solid var(--border-color)' }}>
                        {s.images.map((imgSrc, imgIdx) => (
                          <div key={imgIdx} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', background: '#000', position: 'relative' }}>
                            <img src={imgSrc} alt={`Slide Image ${imgIdx + 1}`} style={{ width: '100%', maxHeight: '440px', display: 'block', objectFit: 'contain' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {renderSlideContentNodes(s.nodes)}

                  {s.notes && (
                    <div style={{ margin: '16px 0 8px 0', background: 'var(--bg-surface-elevated)', padding: '14px 18px', borderRadius: 12, borderLeft: `4px solid #f97316`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <Quote size={18} style={{ color: '#f97316', flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>SPEAKER NOTE</div>
                        <div style={{ fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: 1.5, fontWeight: 500 }}>
                          {s.notes}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Floating Quick Action Counter Bar */}
              <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-full)', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'var(--shadow-lg)', zIndex: 100 }}>
                <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={() => handleSlideChange(currentSlide - 1)} disabled={currentSlide <= 1} title="Previous Slide">
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Slide {currentSlide} of {totalSlides}
                </span>
                <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={() => handleSlideChange(currentSlide + 1)} disabled={currentSlide >= totalSlides} title="Next Slide">
                  <ChevronRight size={16} />
                </button>

                <div style={{ width: 1, height: 16, background: 'var(--border-color)' }} />

                <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={scrollToTop} title="Scroll to Top">
                  <ArrowUp size={16} />
                </button>
              </div>
            </div>
          </>
        ) : viewMode === 'presenter' ? (
          /* STAGE FOCUS PRESENTER DECK MODE */
          <>
            {showFilmstrip && (
              <aside 
                style={{ 
                  width: 250, 
                  background: 'var(--bg-surface)', 
                  borderRight: '1px solid var(--border-color)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  padding: 14, 
                  gap: 10, 
                  overflowY: 'auto' 
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>
                    SLIDE INDEX ({slides.length})
                  </span>
                  <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={handleFilmstripToggle}>
                    <ChevronLeft size={14} />
                  </button>
                </div>

                {slides.map((s) => {
                  const isActive = currentSlide === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSlideChange(s.id)}
                      style={{
                        borderRadius: 'var(--radius-sm)',
                        border: isActive ? `2px solid var(--primary)` : '1px solid var(--border-color)',
                        background: isActive ? 'var(--primary-light)' : 'var(--bg-surface-elevated)',
                        padding: 10,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ minHeight: 64, background: 'var(--bg-surface)', borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.title}
                        </div>
                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: isActive ? 'var(--primary)' : 'var(--text-dim)' }}>Slide #{s.id}</span>
                      </div>
                    </div>
                  );
                })}
              </aside>
            )}

            {!showFilmstrip && (
              <button
                className="btn-icon"
                onClick={handleFilmstripToggle}
                style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)' }}
              >
                <ChevronRight size={16} />
              </button>
            )}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                style={{ 
                  flex: 1, 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  justifyContent: 'center', 
                  padding: 40, 
                  overflow: 'auto', 
                  background: 'var(--bg-main)'
                }}
              >
                <div
                  key={currentSlide}
                  style={{
                    width: `${Math.round(980 * zoomScale)}px`,
                    maxWidth: '98%',
                    minHeight: 'fit-content',
                    height: 'auto',
                    overflow: 'visible',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    borderRadius: 24,
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 25px 80px rgba(0,0,0,0.25)',
                    padding: `${Math.round(48 * zoomScale)}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxSizing: 'border-box',
                    animation: 'fadeIn 0.2s ease-out'
                  }}
                >
                  <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 900, background: '#f97316', color: '#fff', padding: '4px 14px', borderRadius: 20 }}>
                      SLIDE {currentSlide} / {totalSlides}
                    </span>
                    <button
                      onClick={() => handleCopySlideText(activeSlideData)}
                      className="tool-btn"
                      style={{ padding: '4px 8px', fontSize: '0.72rem', gap: 4, fontWeight: 700 }}
                    >
                      {copiedSlideId === activeSlideData.id ? <Check size={13} style={{ color: 'var(--accent-emerald)' }} /> : <Copy size={13} />}
                      <span>{copiedSlideId === activeSlideData.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <div style={{ margin: '24px 0 16px 0' }}>
                    <h1 style={{ fontSize: `${(activeSlideData.titlePt * 0.082 * fontScaleRatio * zoomScale).toFixed(2)}rem`, fontWeight: 800, color: 'var(--text-main)', margin: 0, lineHeight: 1.25 }}>
                      {activeSlideData.title}
                    </h1>
                    {activeSlideData.subtitle && (
                      <div style={{ marginTop: 10, paddingLeft: 14, borderLeft: `3px solid #f97316`, fontSize: `${((activeSlideData.subtitlePt || 22) * 0.082 * fontScaleRatio * zoomScale).toFixed(2)}rem`, color: 'var(--text-muted)', fontWeight: 600 }}>
                        {activeSlideData.subtitle}
                      </div>
                    )}
                  </div>

                  {activeSlideData.images && activeSlideData.images.length > 0 && (
                    <div style={{ margin: '20px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, padding: 16, background: 'var(--bg-surface-elevated)', borderRadius: 16, border: '1px solid var(--border-color)' }}>
                      {activeSlideData.images.map((imgSrc, imgIdx) => (
                        <div key={imgIdx} style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-color)', background: '#000' }}>
                          <img src={imgSrc} alt={`Slide Image ${imgIdx + 1}`} style={{ width: '100%', maxHeight: '440px', display: 'block', objectFit: 'contain' }} />
                        </div>
                      ))}
                    </div>
                  )}

                  {renderSlideContentNodes(activeSlideData.nodes)}

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14, fontSize: '0.72rem', color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{file.name}</span>
                    <span>Focus Stage Presentation Mode</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
