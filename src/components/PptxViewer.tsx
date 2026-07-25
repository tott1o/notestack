import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Presentation, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink, 
  Maximize2, 
  Minimize2, 
  BookOpen, 
  Layers,
  Monitor,
  MessageSquare,
  ChevronDown,
  Play,
  FileCheck,
  Image as ImageIcon,
  ArrowUp,
  Search,
  Clock,
  Quote,
  Copy,
  Check,
  Grid,
  Columns,
  PenTool,
  RotateCcw
} from 'lucide-react';
import JSZip from 'jszip';
import type { FileItem, ReadingSettings } from '../types';
import { getFileState, saveFileState } from '../utils/stateMemory';

interface PptxViewerProps {
  file: FileItem;
  settings?: ReadingSettings;
}

export interface SlideTextNode {
  type: 'paragraph' | 'bullet';
  text: string;
  level: number;
  fontSizePt: number;
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

export const PptxViewer: React.FC<PptxViewerProps> = ({ file, settings }) => {
  const fileKey = file.fullPath || file.id;

  // Restore 100% of saved presentation state memory on initial mount
  const initialState = useMemo(() => getFileState(fileKey), [fileKey]);

  const [currentSlide, setCurrentSlide] = useState<number>(initialState.currentSlide || 1);
  const [inputSlide, setInputSlide] = useState<string>(String(initialState.currentSlide || 1));
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [zoomScale, setZoomScale] = useState<number>(initialState.zoom || 1.0);
  const [fontScaleRatio, setFontScaleRatio] = useState<number>(initialState.fontScaleRatio || 1.0);
  const [viewMode, setViewMode] = useState<'grid' | 'presenter' | 'continuous' | 'split' | 'outline'>(
    (initialState.viewMode as any) || 'continuous'
  );
  const [showFilmstrip, setShowFilmstrip] = useState<boolean>(
    initialState.showFilmstrip !== undefined ? initialState.showFilmstrip : true
  );
  const [showNotes, setShowNotes] = useState<boolean>(
    initialState.showNotes !== undefined ? initialState.showNotes : true
  );
  const activeThemeName = settings?.theme || 'dark';

  const [studyNoteText, setStudyNoteText] = useState<string>(
    initialState.studyNotes || `# Notes for ${file.name}\n\n- Key Takeaways:\n- `
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
    }, 60);

    return () => clearTimeout(timer);
  }, [loading, fileKey]);

  // Parse OpenXML PPTX ZIP
  useEffect(() => {
    let isMounted = true;

    async function parseRealPptx() {
      try {
        setLoading(true);
        let buffer: ArrayBuffer | null = file.arrayBuffer || null;

        if (!buffer && file.fullPath) {
          const normalized = file.fullPath.replace(/\\/g, '/');
          const resp = await fetch(`file:///${normalized}`);
          buffer = await resp.arrayBuffer();
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
          const fileName = slideFiles[i];
          const xmlText = await zip.files[fileName].async('text');
          const doc = parser.parseFromString(xmlText, 'text/xml');

          const paragraphs = Array.from(doc.getElementsByTagName('a:p'));
          let title = '';
          let titlePt = 36;
          let subtitle = '';
          let subtitlePt = 22;
          const nodes: SlideTextNode[] = [];

          paragraphs.forEach((p) => {
            const textRuns = Array.from(p.getElementsByTagName('a:r'));
            let pText = '';
            let detectedPt = 0;
            let isBold = false;

            textRuns.forEach((r) => {
              const tEl = r.getElementsByTagName('a:t')[0];
              if (!tEl || !tEl.textContent) return;
              pText += tEl.textContent;

              const rPr = r.getElementsByTagName('a:rPr')[0];
              if (rPr) {
                const sz = rPr.getAttribute('sz');
                if (sz) {
                  const pt = parseInt(sz, 10) / 100;
                  if (pt > detectedPt) detectedPt = pt;
                }
                if (rPr.getAttribute('b') === '1') isBold = true;
              }
            });

            if (!pText) {
              const directT = Array.from(p.getElementsByTagName('a:t')).map(t => t.textContent || '').join('').trim();
              if (directT) pText = directT;
            }

            const cleanText = pText.trim();
            if (!cleanText) return;

            const pPr = p.getElementsByTagName('a:pPr')[0];
            if (!detectedPt && pPr) {
              const defRPr = pPr.getElementsByTagName('a:defRPr')[0];
              const sz = defRPr?.getAttribute('sz');
              if (sz) detectedPt = parseInt(sz, 10) / 100;
            }

            const hasBuChar = pPr?.getElementsByTagName('a:buChar').length > 0;
            const hasBuAutoNum = pPr?.getElementsByTagName('a:buAutoNum').length > 0;
            const hasBuNone = pPr?.getElementsByTagName('a:buNone').length > 0;
            const lvlAttr = pPr?.getAttribute('lvl');
            const level = lvlAttr ? parseInt(lvlAttr, 10) : 0;

            const startsWithBulletSymbol = /^[•\-*\u2022\u2013\u2014]\s*/.test(cleanText) || /^\d+\.\s*/.test(cleanText);
            const isExplicitBullet = (hasBuChar || hasBuAutoNum || startsWithBulletSymbol || level > 0) && !hasBuNone;
            const formattedText = cleanText.replace(/^[•\-*\u2022\u2013\u2014]\s*/, '');

            if (!title) {
              title = formattedText;
              titlePt = detectedPt || 36;
            } else if (!subtitle && nodes.length === 0 && !isExplicitBullet && formattedText.length < 80) {
              subtitle = formattedText;
              subtitlePt = detectedPt || 22;
            } else {
              const defaultNodePt = isExplicitBullet ? (level === 0 ? 20 : 16) : 18;
              nodes.push({
                type: isExplicitBullet ? 'bullet' : 'paragraph',
                text: formattedText,
                level,
                fontSizePt: detectedPt || defaultNodePt,
                isBold
              });
            }
          });

          if (!title) title = `Slide ${i + 1}`;
          if (nodes.length === 0) {
            nodes.push({ type: 'paragraph', text: 'Presentation slide content', level: 0, fontSizePt: 18 });
          }

          const relsFileName = fileName.replace(/ppt\/slides\/slide(\d+)\.xml/i, 'ppt/slides/_rels/slide$1.xml.rels');
          const slideImages: string[] = [];

          if (zip.files[relsFileName]) {
            try {
              const relsXml = await zip.files[relsFileName].async('text');
              const relsDoc = parser.parseFromString(relsXml, 'text/xml');
              const relationships = Array.from(relsDoc.getElementsByTagName('Relationship'));

              relationships.forEach((rel) => {
                const target = rel.getAttribute('Target') || '';
                const type = rel.getAttribute('Type') || '';

                if (type.includes('image') || /\.(png|jpe?g|gif|svg|webp|bmp)$/i.test(target)) {
                  const cleanTarget = target.replace(/^\.\.\//, '');
                  const fullMediaPath = `ppt/${cleanTarget}`;

                  if (mediaMap[fullMediaPath]) {
                    slideImages.push(mediaMap[fullMediaPath]);
                  } else {
                    const foundKey = Object.keys(mediaMap).find(k => k.toLowerCase() === fullMediaPath.toLowerCase());
                    if (foundKey) slideImages.push(mediaMap[foundKey]);
                  }
                }
              });
            } catch (err) {
              console.error(`Error reading rels for ${fileName}:`, err);
            }
          }

          const fullText = `${title} ${subtitle} ${nodes.map(n => n.text).join(' ')}`;
          const wordCount = fullText.split(/\s+/).filter(Boolean).length;

          parsedSlides.push({
            id: i + 1,
            title,
            titlePt,
            subtitle,
            subtitlePt,
            nodes,
            images: slideImages,
            tag: i === 0 ? 'TITLE SLIDE' : `PART ${Math.ceil((i + 1) / 3)}`,
            wordCount
          });
        }

        if (isMounted && parsedSlides.length > 0) {
          setRealSlides(parsedSlides);
        }
      } catch (err) {
        console.error("Error parsing real PPTX file:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    parseRealPptx();
    return () => { isMounted = false; };
  }, [file]);

  const rawSlides = useMemo<SlideItem[]>(() => {
    if (realSlides.length > 0) return realSlides;

    const presentationName = file.name.replace(/\.[^/.]+$/, '');
    return [
      {
        id: 1,
        title: presentationName,
        titlePt: 36,
        subtitle: 'Academic Lecture Deck & Seminar Materials',
        subtitlePt: 22,
        tag: 'TITLE SLIDE',
        nodes: [
          { type: 'paragraph', text: 'This presentation contains course curriculum details, analytical frameworks, and theoretical case studies.', level: 0, fontSizePt: 18 },
          { type: 'bullet', text: 'Course Curriculum & Chapter Overview', level: 0, fontSizePt: 20 },
          { type: 'bullet', text: 'Primary Theoretical Frameworks & Applied Case Studies', level: 0, fontSizePt: 20 },
          { type: 'bullet', text: 'Use Arrow Keys or Filmstrip Sidebar to Navigate', level: 0, fontSizePt: 18 }
        ],
        notes: 'Speaker Note: Introduce chapter goals, course syllabus weightage, and core exam topics.',
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
        notes: 'Speaker Note: Emphasize definition #2 as it frequently appears on midterms.',
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
      {
        root: scrollContainerRef.current,
        threshold: 0.35
      }
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

  const handleViewModeChange = (mode: 'grid' | 'presenter' | 'continuous' | 'split' | 'outline') => {
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

  const handleNotesToggle = () => {
    const nextVal = !showNotes;
    setShowNotes(nextVal);
    persistState({ showNotes: nextVal });
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
      } else if (e.key === 'f' || e.key === 'F') {
        setIsFullscreen(prev => !prev);
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

  const handleStudyNotesChange = (val: string) => {
    setStudyNoteText(val);
    persistState({ studyNotes: val });
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

  const getThemeStyles = () => {
    switch (activeThemeName) {
      case 'light':
        return {
          viewportBg: '#f1f5f9',
          slideBg: '#ffffff',
          accent: '#0284c7',
          accentGradient: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
          border: '1px solid #e2e8f0',
          cardBg: '#f8fafc',
          cardBorder: '1px solid #e2e8f0',
          textMain: '#0f172a',
          textMuted: '#334155',
          textDim: '#64748b',
          badgeBg: '#e0f2fe',
          badgeText: '#0369a1'
        };
      case 'sepia':
        return {
          viewportBg: '#f4ecd8',
          slideBg: '#fbf0d9',
          accent: '#d97706',
          accentGradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
          border: '1px solid #fcd34d',
          cardBg: '#fef3c7',
          cardBorder: '1px solid #fde68a',
          textMain: '#451a03',
          textMuted: '#78350f',
          textDim: '#92400e',
          badgeBg: '#fef3c7',
          badgeText: '#92400e'
        };
      case 'nord':
        return {
          viewportBg: '#232831',
          slideBg: 'linear-gradient(135deg, #3b4252 0%, #2e3440 100%)',
          accent: '#88c0d0',
          accentGradient: 'linear-gradient(135deg, #88c0d0 0%, #81a1c1 100%)',
          border: '1px solid #4c566a',
          cardBg: 'rgba(46, 52, 64, 0.8)',
          cardBorder: '1px solid #434c5e',
          textMain: '#eceff4',
          textMuted: '#e5e9f0',
          textDim: '#d8dee9',
          badgeBg: 'rgba(136, 192, 208, 0.18)',
          badgeText: '#88c0d0'
        };
      default: // Dark theme default
        return {
          viewportBg: '#040711',
          slideBg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          accent: '#f97316',
          accentGradient: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          cardBg: 'rgba(30, 41, 59, 0.65)',
          cardBorder: '1px solid rgba(255, 255, 255, 0.08)',
          textMain: '#f8fafc',
          textMuted: '#cbd5e1',
          textDim: '#94a3b8',
          badgeBg: 'rgba(249, 115, 22, 0.18)',
          badgeText: '#f97316'
        };
    }
  };

  const theme = getThemeStyles();

  const renderSlideContentNodes = (nodes: SlideTextNode[]) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: `${Math.round(14 * zoomScale)}px`, margin: '20px 0' }}>
        {nodes.map((node, idx) => {
          const computedFontSizeRem = (node.fontSizePt * 0.082 * fontScaleRatio * zoomScale).toFixed(2);

          if (node.type === 'bullet') {
            return (
              <div 
                key={idx} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: 14, 
                  paddingLeft: `${node.level * 24}px` 
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: theme.accent, marginTop: 8, flexShrink: 0, boxShadow: `0 0 10px ${theme.accent}` }} />
                <span style={{ fontSize: `${computedFontSizeRem}rem`, color: theme.textMain, lineHeight: 1.55, fontWeight: node.isBold ? 700 : 500 }}>
                  {node.text}
                </span>
              </div>
            );
          } else {
            return (
              <p 
                key={idx} 
                style={{ 
                  fontSize: `${computedFontSizeRem}rem`, 
                  color: theme.textMain, 
                  lineHeight: 1.6, 
                  fontWeight: node.isBold ? 700 : 400, 
                  margin: '8px 0',
                  paddingLeft: `${node.level * 24}px`
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
        background: theme.viewportBg,
        color: theme.textMain,
        ...(isFullscreen ? { position: 'fixed', inset: 0, zIndex: 9999 } : {})
      }}
    >
      {/* Studio Header Toolbar */}
      <div className="editor-toolbar" style={{ padding: '10px 20px', background: 'var(--bg-surface)', gap: 14, flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: theme.accentGradient, padding: 8, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${theme.accent}44` }}>
            <Presentation size={18} style={{ color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.92rem', fontFamily: 'var(--font-heading)', color: theme.textMain }}>{file.name}</div>
            <div style={{ fontSize: '0.68rem', color: theme.accent, fontWeight: 700, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
              <FileCheck size={11} /> OpenXML State Memory Engine ({totalSlides} Slides)
            </div>
          </div>
        </div>

        {/* 5 View Modes */}
        <div style={{ display: 'flex', background: 'var(--bg-surface-elevated)', padding: 3, borderRadius: 10, border: '1px solid var(--border-color)', gap: 2, marginLeft: 8 }}>
          <button
            onClick={() => handleViewModeChange('continuous')}
            className={`tool-btn ${viewMode === 'continuous' ? 'active' : ''}`}
            style={{ padding: '5px 10px', fontSize: '0.76rem', fontWeight: 700, borderRadius: 8 }}
            title="Magazine Stream (All Slides)"
          >
            <Monitor size={14} style={{ color: 'var(--accent-emerald)' }} />
            <span>Stream</span>
          </button>

          <button
            onClick={() => handleViewModeChange('grid')}
            className={`tool-btn ${viewMode === 'grid' ? 'active' : ''}`}
            style={{ padding: '5px 10px', fontSize: '0.76rem', fontWeight: 700, borderRadius: 8 }}
            title="Slide Sorter Grid"
          >
            <Grid size={14} style={{ color: theme.accent }} />
            <span>Grid</span>
          </button>

          <button
            onClick={() => handleViewModeChange('presenter')}
            className={`tool-btn ${viewMode === 'presenter' ? 'active' : ''}`}
            style={{ padding: '5px 10px', fontSize: '0.76rem', fontWeight: 700, borderRadius: 8 }}
            title="Full Presenter Deck Stage"
          >
            <Layers size={14} style={{ color: '#38bdf8' }} />
            <span>Stage</span>
          </button>

          <button
            onClick={() => handleViewModeChange('split')}
            className={`tool-btn ${viewMode === 'split' ? 'active' : ''}`}
            style={{ padding: '5px 10px', fontSize: '0.76rem', fontWeight: 700, borderRadius: 8 }}
            title="Split Notes & PPT View"
          >
            <Columns size={14} style={{ color: '#a855f7' }} />
            <span>Split Notes</span>
          </button>

          <button
            onClick={() => handleViewModeChange('outline')}
            className={`tool-btn ${viewMode === 'outline' ? 'active' : ''}`}
            style={{ padding: '5px 10px', fontSize: '0.76rem', fontWeight: 700, borderRadius: 8 }}
            title="Outline Mode"
          >
            <BookOpen size={14} />
            <span>Outline</span>
          </button>
        </div>

        {/* Slide Jump Form */}
        <form onSubmit={handleSlideSubmit} style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          <button 
            type="button"
            className="tool-btn" 
            onClick={() => handleSlideChange(currentSlide - 1)} 
            disabled={currentSlide <= 1}
            title="Previous Slide"
            style={{ padding: '4px 8px' }}
          >
            <ChevronLeft size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', color: theme.textMuted, background: 'var(--bg-surface-elevated)', padding: '3px 10px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <span style={{ fontWeight: 700, color: theme.textDim }}>Slide</span>
            <input
              type="text"
              className="search-input"
              style={{ width: 34, padding: '2px 4px', textAlign: 'center', fontSize: '0.82rem', fontWeight: 800, color: theme.accent, border: 'none', background: 'transparent' }}
              value={inputSlide}
              onChange={e => setInputSlide(e.target.value)}
              onBlur={handleSlideSubmit}
            />
            <span style={{ fontWeight: 700, color: theme.textDim }}>/ {totalSlides}</span>
          </div>

          <button 
            type="button"
            className="tool-btn" 
            onClick={() => handleSlideChange(currentSlide + 1)} 
            disabled={currentSlide >= totalSlides}
            title="Next Slide"
            style={{ padding: '4px 8px' }}
          >
            <ChevronRight size={16} />
          </button>
        </form>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '4px 10px', gap: 6, marginLeft: 4 }}>
          <Search size={14} style={{ color: theme.textDim }} />
          <input
            type="text"
            placeholder="Search slides..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: theme.textMain, fontSize: '0.78rem', width: 120, outline: 'none' }}
          />
        </div>

        {/* Font Scale Multiplier & Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 2 }}>
            <button className="btn-icon" style={{ width: 24, height: 24 }} onClick={() => handleFontScaleChange(Math.max(0.7, parseFloat((fontScaleRatio - 0.1).toFixed(2))))} title="Decrease OpenXML Font Scale">
              <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>A-</span>
            </button>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: theme.textMain, minWidth: 34, textAlign: 'center' }}>
              {Math.round(fontScaleRatio * 100)}%
            </span>
            <button className="btn-icon" style={{ width: 24, height: 24 }} onClick={() => handleFontScaleChange(Math.min(1.8, parseFloat((fontScaleRatio + 0.1).toFixed(2))))} title="Increase OpenXML Font Scale">
              <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>A+</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 2 }}>
            <button className="btn-icon" style={{ width: 24, height: 24 }} onClick={() => handleZoomChange(Math.max(0.6, parseFloat((zoomScale - 0.15).toFixed(2))))} title="Zoom Out Slide Canvas">
              <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>-</span>
            </button>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: theme.textMain, minWidth: 36, textAlign: 'center' }}>
              {Math.round(zoomScale * 100)}%
            </span>
            <button className="btn-icon" style={{ width: 24, height: 24 }} onClick={() => handleZoomChange(Math.min(2.2, parseFloat((zoomScale + 0.15).toFixed(2))))} title="Zoom In Slide Canvas">
              <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>+</span>
            </button>
          </div>
        </div>

        {/* Actions */}
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
              style={{ padding: '6px 14px', fontSize: '0.78rem', background: theme.accentGradient, color: '#fff', gap: 6, fontWeight: 700, borderRadius: 8, border: 'none', boxShadow: `0 4px 14px ${theme.accent}44` }}
              title="Open Presentation in Microsoft PowerPoint"
            >
              <ExternalLink size={14} />
              <span>PowerPoint</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ height: 3, background: 'rgba(0,0,0,0.08)', width: '100%' }}>
        <div style={{ height: '100%', width: `${(currentSlide / totalSlides) * 100}%`, background: theme.accentGradient, transition: 'width 0.2s ease' }} />
      </div>

      {/* Main Viewport Container */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: theme.textMuted }}>
            <Presentation size={52} style={{ marginBottom: 16, opacity: 0.4, color: theme.accent }} />
            <h3 style={{ color: theme.textMain, fontWeight: 700 }}>Extracting OpenXML Font Sizes & Slide Content...</h3>
          </div>
        ) : viewMode === 'grid' ? (
          /* SLIDE SORTER GRID VIEW */
          <div style={{ flex: 1, padding: 32, overflowY: 'auto', background: theme.viewportBg }}>
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
                      background: theme.slideBg,
                      borderRadius: 16,
                      border: isActive ? `2px solid ${theme.accent}` : theme.border,
                      boxShadow: isActive ? `0 12px 30px ${theme.accent}44` : '0 8px 24px rgba(0,0,0,0.1)',
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
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, background: theme.badgeBg, color: theme.badgeText, padding: '2px 8px', borderRadius: 4 }}>
                          SLIDE #{s.id}
                        </span>
                        {s.images && s.images.length > 0 && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: theme.accent, display: 'flex', alignItems: 'center', gap: 2 }}>
                            <ImageIcon size={11} /> {s.images.length} Media
                          </span>
                        )}
                      </div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 800, color: theme.textMain, margin: '0 0 6px 0', lineHeight: 1.3 }}>{s.title}</h4>
                      {s.subtitle && <p style={{ fontSize: '0.78rem', color: theme.textMuted, margin: 0 }}>{s.subtitle}</p>}
                    </div>

                    <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 10, marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem', color: theme.textDim }}>
                      <span>{s.nodes.length} content nodes</span>
                      <span style={{ fontWeight: 700, color: theme.accent }}>Click to View →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : viewMode === 'split' ? (
          /* SPLIT NOTES & PPT STUDY VIEW */
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Left Half: Active Slide Presentation Canvas */}
            <div style={{ flex: '1 1 55%', padding: 24, overflowY: 'auto', background: theme.viewportBg, borderRight: '1px solid var(--border-color)' }}>
              <div
                style={{
                  background: theme.slideBg,
                  borderRadius: 20,
                  border: theme.border,
                  boxShadow: '0 16px 50px rgba(0,0,0,0.2)',
                  padding: 32,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 20
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${theme.accent}33`, paddingBottom: 14 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, background: theme.accentGradient, color: '#fff', padding: '3px 12px', borderRadius: 20 }}>
                    SLIDE {currentSlide} / {totalSlides}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: theme.textDim }}>{activeSlideData.tag || 'CHAPTER STUDY'}</span>
                </div>

                <h2 style={{ fontSize: `${(activeSlideData.titlePt * 0.082 * fontScaleRatio * zoomScale).toFixed(2)}rem`, fontWeight: 800, color: theme.textMain, margin: 0 }}>
                  {activeSlideData.title}
                </h2>

                {activeSlideData.images && activeSlideData.images.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, padding: 12, background: 'rgba(0,0,0,0.1)', borderRadius: 12 }}>
                    {activeSlideData.images.map((imgSrc, iIdx) => (
                      <img key={iIdx} src={imgSrc} alt={`Slide Image ${iIdx + 1}`} style={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 8 }} />
                    ))}
                  </div>
                )}

                {renderSlideContentNodes(activeSlideData.nodes)}
              </div>
            </div>

            {/* Right Half: Integrated Markdown Study Notes Editor */}
            <div style={{ flex: '1 1 45%', padding: 24, display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  <PenTool size={16} style={{ color: theme.accent }} />
                  <span>Integrated Study Notes</span>
                </div>
                <button className="tool-btn" style={{ padding: '3px 8px', fontSize: '0.72rem' }} onClick={() => handleStudyNotesChange(`# Notes for ${file.name}\n\n- Key Takeaways:\n- `)}>
                  <RotateCcw size={12} /> Reset
                </button>
              </div>

              <textarea
                value={studyNoteText}
                onChange={e => handleStudyNotesChange(e.target.value)}
                placeholder="Type your study notes, summary points, and key takeaways for this presentation here..."
                style={{
                  flex: 1,
                  width: '100%',
                  background: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10,
                  padding: 16,
                  fontSize: '0.92rem',
                  fontFamily: 'monospace',
                  lineHeight: 1.6,
                  resize: 'none',
                  outline: 'none'
                }}
              />
            </div>
          </div>
        ) : viewMode === 'continuous' ? (
          /* MAGAZINE READER DECK MODE */
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
                  gap: 12, 
                  overflowY: 'auto' 
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: theme.textDim, letterSpacing: '0.06em' }}>
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
                        borderRadius: 10,
                        border: isActive ? `2px solid ${theme.accent}` : '1px solid var(--border-color)',
                        background: isActive ? theme.badgeBg : 'var(--bg-surface-elevated)',
                        padding: 10,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: isActive ? `0 4px 20px ${theme.accent}33` : 'none'
                      }}
                    >
                      <div style={{ minHeight: 68, background: theme.slideBg, borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid rgba(0,0,0,0.08)' }}>
                        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: theme.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.62rem', color: theme.textDim, marginTop: 8 }}>
                          <span style={{ fontWeight: 800, color: isActive ? theme.accent : 'inherit' }}>#{s.id}</span>
                          {s.images && s.images.length > 0 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 2, background: theme.badgeBg, color: theme.badgeText, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
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

            {/* Continuous Cards Workspace */}
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              style={{ flex: 1, padding: '40px 24px 120px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 48, background: theme.viewportBg, position: 'relative' }}
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
                    background: theme.slideBg,
                    borderRadius: 24,
                    border: currentSlide === s.id ? `2px solid ${theme.accent}` : theme.border,
                    boxShadow: currentSlide === s.id 
                      ? `0 35px 100px rgba(0,0,0,0.35), 0 0 45px ${theme.accent}33` 
                      : '0 16px 50px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.1)',
                    padding: `${Math.round(48 * zoomScale)}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxSizing: 'border-box',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    position: 'relative'
                  }}
                >
                  <div style={{ borderBottom: `2px solid ${theme.accent}33`, paddingBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 900, background: theme.accentGradient, color: '#fff', padding: '4px 14px', borderRadius: 20, boxShadow: `0 4px 14px ${theme.accent}44`, letterSpacing: '0.04em' }}>
                        SLIDE #{s.id}
                      </div>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: theme.badgeText, background: theme.badgeBg, padding: '3px 10px', borderRadius: 6 }}>
                        {s.tag || `MODULE ${s.id}`}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textDim, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /> ~{Math.max(15, Math.round(s.wordCount * 0.4))}s read
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
                  </div>

                  <div style={{ margin: '26px 0 18px 0' }}>
                    <h2 style={{ fontSize: `${(s.titlePt * 0.082 * fontScaleRatio * zoomScale).toFixed(2)}rem`, fontWeight: 800, color: theme.textMain, fontFamily: 'var(--font-heading)', margin: 0, lineHeight: 1.25, letterSpacing: '-0.02em' }}>
                      {s.title}
                    </h2>
                    {s.subtitle && (
                      <div style={{ marginTop: 12, paddingLeft: 16, borderLeft: `4px solid ${theme.accent}`, fontSize: `${((s.subtitlePt || 22) * 0.082 * fontScaleRatio * zoomScale).toFixed(2)}rem`, color: theme.textMuted, fontWeight: 600, lineHeight: 1.4 }}>
                        {s.subtitle}
                      </div>
                    )}
                  </div>

                  {s.images && s.images.length > 0 && (
                    <div style={{ margin: '22px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 800, color: theme.accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <ImageIcon size={14} /> EMBEDDED SLIDE MEDIA CANVAS ({s.images.length})
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, padding: 16, background: 'rgba(0,0,0,0.15)', borderRadius: 16, border: '1px solid rgba(0,0,0,0.1)' }}>
                        {s.images.map((imgSrc, imgIdx) => (
                          <div key={imgIdx} style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.18)', boxShadow: '0 12px 30px rgba(0,0,0,0.25)', background: '#000', position: 'relative' }}>
                            <img src={imgSrc} alt={`Slide Image ${imgIdx + 1}`} style={{ width: '100%', maxHeight: '440px', display: 'block', objectFit: 'contain' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {renderSlideContentNodes(s.nodes)}

                  {s.notes && (
                    <div style={{ margin: '16px 0 8px 0', background: theme.badgeBg, padding: '14px 18px', borderRadius: 14, borderLeft: `4px solid ${theme.accent}`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <Quote size={18} style={{ color: theme.accent, flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: theme.accent, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>SPEAKER NOTE</div>
                        <div style={{ fontSize: '0.88rem', color: theme.textMain, lineHeight: 1.5, fontWeight: 500 }}>
                          {s.notes}
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 14, marginTop: 8, fontSize: '0.72rem', color: theme.textDim, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{file.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Play size={10} style={{ color: theme.accent }} />
                      <span>NoteStack Presentation Canvas</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Floating Controls Pill */}
            <div 
              style={{
                position: 'absolute',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--bg-surface-elevated)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border-color)',
                borderRadius: 40,
                padding: '6px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow: 'var(--shadow-lg)',
                zIndex: 100
              }}
            >
              <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={() => handleSlideChange(currentSlide - 1)} disabled={currentSlide <= 1} title="Previous Slide">
                <ChevronLeft size={16} />
              </button>

              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: theme.accent }}>
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
          </>
        ) : viewMode === 'presenter' ? (
          /* SINGLE SLIDE STAGE FOCUS MODE */
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
                  gap: 12, 
                  overflowY: 'auto' 
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: theme.textDim, letterSpacing: '0.06em' }}>
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
                        borderRadius: 10,
                        border: isActive ? `2px solid ${theme.accent}` : '1px solid var(--border-color)',
                        background: isActive ? theme.badgeBg : 'var(--bg-surface-elevated)',
                        padding: 10,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ minHeight: 68, background: theme.slideBg, borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: theme.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.title}
                        </div>
                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: isActive ? theme.accent : theme.textDim }}>Slide #{s.id}</span>
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
                  background: theme.viewportBg
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
                    background: theme.slideBg,
                    borderRadius: 24,
                    border: theme.border,
                    boxShadow: '0 30px 90px rgba(0,0,0,0.25)',
                    padding: `${Math.round(48 * zoomScale)}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxSizing: 'border-box',
                    animation: 'fadeIn 0.2s ease-out'
                  }}
                >
                  <div style={{ borderBottom: `2px solid ${theme.accent}33`, paddingBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 900, background: theme.accentGradient, color: '#fff', padding: '4px 14px', borderRadius: 20 }}>
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
                    <h1 style={{ fontSize: `${(activeSlideData.titlePt * 0.082 * fontScaleRatio * zoomScale).toFixed(2)}rem`, fontWeight: 800, color: theme.textMain, margin: 0, lineHeight: 1.25 }}>
                      {activeSlideData.title}
                    </h1>
                    {activeSlideData.subtitle && (
                      <div style={{ marginTop: 10, paddingLeft: 14, borderLeft: `3px solid ${theme.accent}`, fontSize: `${((activeSlideData.subtitlePt || 22) * 0.082 * fontScaleRatio * zoomScale).toFixed(2)}rem`, color: theme.textMuted, fontWeight: 600 }}>
                        {activeSlideData.subtitle}
                      </div>
                    )}
                  </div>

                  {activeSlideData.images && activeSlideData.images.length > 0 && (
                    <div style={{ margin: '20px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, padding: 16, background: 'rgba(0,0,0,0.12)', borderRadius: 16 }}>
                      {activeSlideData.images.map((imgSrc, imgIdx) => (
                        <div key={imgIdx} style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.15)', background: '#000' }}>
                          <img src={imgSrc} alt={`Slide Image ${imgIdx + 1}`} style={{ width: '100%', maxHeight: '440px', display: 'block', objectFit: 'contain' }} />
                        </div>
                      ))}
                    </div>
                  )}

                  {renderSlideContentNodes(activeSlideData.nodes)}

                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 14, fontSize: '0.72rem', color: theme.textDim, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{file.name}</span>
                    <span>Focus Presentation Mode</span>
                  </div>
                </div>
              </div>

              {showNotes && activeSlideData.notes && (
                <div style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border-color)', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: theme.accent, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MessageSquare size={13} /> PRESENTER NOTES (SLIDE #{currentSlide})
                    </span>
                    <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={handleNotesToggle}>
                      <ChevronDown size={14} />
                    </button>
                  </div>
                  <p style={{ fontSize: '0.88rem', color: theme.textMain, margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                    {activeSlideData.notes}
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          /* OUTLINE MODE */
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            style={{ flex: 1, padding: 32, overflowY: 'auto', background: 'var(--bg-main)' }}
          >
            <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    {file.name} — Condensed Outline
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    Extracted slide headings, paragraphs, and high-resolution diagrams.
                  </p>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: theme.accent, background: theme.badgeBg, padding: '4px 12px', borderRadius: 20 }}>
                  {slides.length} Slides
                </span>
              </div>

              {slides.map((s) => (
                <div 
                  key={s.id} 
                  style={{ 
                    background: 'var(--bg-surface)', 
                    padding: 24, 
                    borderRadius: 'var(--radius-md)', 
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ background: theme.accent, color: '#fff', fontWeight: 800, fontSize: '0.75rem', padding: '3px 10px', borderRadius: 4 }}>
                      Slide {s.id}
                    </span>
                    <h3 style={{ fontSize: `${(s.titlePt * 0.065).toFixed(2)}rem`, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{s.title}</h3>
                  </div>

                  {s.images && s.images.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {s.images.map((imgSrc, iIdx) => (
                        <img key={iIdx} src={imgSrc} alt={`Slide Image ${iIdx + 1}`} style={{ width: '100%', maxHeight: '300px', borderRadius: 8 }} />
                      ))}
                    </div>
                  )}

                  {renderSlideContentNodes(s.nodes)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
