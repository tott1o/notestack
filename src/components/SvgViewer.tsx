import React, { useState, useEffect, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RefreshCw, 
  Copy, 
  Check, 
  Code, 
  Eye, 
  FlipHorizontal, 
  FlipVertical, 
  Download,
  Sun,
  Moon,
  Grid,
  Maximize2,
  Layers,
  FileCode2,
  Sparkles
} from 'lucide-react';
import type { FileItem } from '../types';

interface SvgViewerProps {
  file: FileItem;
}

export const SvgViewer: React.FC<SvgViewerProps> = ({ file }) => {
  const [svgText, setSvgText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Studio Interactive State
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [flipX, setFlipX] = useState<boolean>(false);
  const [flipY, setFlipY] = useState<boolean>(false);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [engineMode, setEngineMode] = useState<'vector' | 'object' | 'code'>('vector');
  const [bgMode, setBgMode] = useState<'checkerboard' | 'dark' | 'light'>('checkerboard');
  const [copied, setCopied] = useState<boolean>(false);

  // Load SVG content via safe Electron IPC or File Reader
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadSvg = async () => {
      try {
        if (file.content) {
          if (isMounted) {
            setSvgText(file.content);
            setLoading(false);
          }
          return;
        }

        const filePath = file.fullPath || file.path;
        if (filePath && window.electronAPI?.readFileText) {
          const rawText = await window.electronAPI.readFileText(filePath);
          if (isMounted) {
            setSvgText(rawText || '');
            setLoading(false);
          }
        } else {
          const targetUrl = file.url || file.fullPath || '';
          if (targetUrl) {
            const res = await fetch(targetUrl);
            const rawText = await res.text();
            if (isMounted) {
              setSvgText(rawText);
              setLoading(false);
            }
          } else {
            if (isMounted) {
              setError('Unable to load SVG file contents.');
              setLoading(false);
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error loading SVG file:', err);
          setError('Failed to parse SVG file.');
          setLoading(false);
        }
      }
    };

    loadSvg();
    return () => {
      isMounted = false;
    };
  }, [file.id, file.fullPath, file.content]);

  // Vector Metadata & Node Statistics
  const svgMeta = useMemo(() => {
    if (!svgText) return { viewBox: 'None', width: 'Auto', height: 'Auto', nodes: 0, size: '0 KB' };

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const svgEl = doc.querySelector('svg');
      const viewBox = svgEl?.getAttribute('viewBox') || 'None';
      const width = svgEl?.getAttribute('width') || 'Auto';
      const height = svgEl?.getAttribute('height') || 'Auto';
      const nodes = doc.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon, text, g').length;
      const sizeKb = (new Blob([svgText]).size / 1024).toFixed(1) + ' KB';
      return { viewBox, width, height, nodes, size: sizeKb };
    } catch {
      return { viewBox: 'None', width: 'Auto', height: 'Auto', nodes: 0, size: '0 KB' };
    }
  }, [svgText]);

  // DOMParser Normalized Vector Engine (Synthesizes missing viewBox & enforces ratio scaling)
  const normalizedVectorHtml = useMemo(() => {
    if (!svgText) return '';

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const svgEl = doc.querySelector('svg');

      if (svgEl) {
        if (!svgEl.getAttribute('viewBox')) {
          const w = svgEl.getAttribute('width') ? parseFloat(svgEl.getAttribute('width')!) : 300;
          const h = svgEl.getAttribute('height') ? parseFloat(svgEl.getAttribute('height')!) : 150;
          svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
        }
        svgEl.setAttribute('width', '100%');
        svgEl.setAttribute('height', '100%');
        svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }

      const serialized = new XMLSerializer().serializeToString(doc);
      return DOMPurify.sanitize(serialized, { USE_PROFILES: { svg: true, svgFilters: true } });
    } catch (e) {
      return DOMPurify.sanitize(svgText, { USE_PROFILES: { svg: true, svgFilters: true } });
    }
  }, [svgText]);

  // Blob Data URL for Isolated Object Engine
  const blobObjectUrl = useMemo(() => {
    if (!svgText) return '';
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    return URL.createObjectURL(blob);
  }, [svgText]);

  useEffect(() => {
    return () => {
      if (blobObjectUrl) {
        URL.revokeObjectURL(blobObjectUrl);
      }
    };
  }, [blobObjectUrl]);

  // Mouse Drag-to-Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (engineMode === 'code') return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (engineMode === 'code') return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 15 : -15;
      setZoom(prev => Math.min(600, Math.max(20, prev + delta)));
    }
  };

  // Copy SVG Source Code Handler
  const handleCopyCode = () => {
    if (!svgText) return;
    navigator.clipboard.writeText(svgText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Download SVG File Handler
  const handleDownload = () => {
    if (!blobObjectUrl) return;
    const link = document.createElement('a');
    link.href = blobObjectUrl;
    link.download = file.name || 'vector_graphic.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset Transformations
  const handleReset = () => {
    setZoom(100);
    setRotation(0);
    setFlipX(false);
    setFlipY(false);
    setPan({ x: 0, y: 0 });
  };

  if (loading) {
    return (
      <div className="svg-viewer-loading">
        <RefreshCw className="spin-animation" size={28} />
        <p>Loading Vector Graphic Canvas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="svg-viewer-error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="svg-viewer-root">
      {/* ── Studio Command Ribbon ─────────────────────────────────────── */}
      <header className="svg-toolbar">
        <div className="svg-toolbar-left">
          {/* Mode Switcher */}
          <div className="svg-mode-pills">
            <button 
              className={`mode-pill ${engineMode === 'vector' ? 'active' : ''}`}
              onClick={() => setEngineMode('vector')}
              title="Vector DOM Engine (Normalized viewBox & DOMPurify Sanitized)"
            >
              <Eye size={14} />
              <span>Vector Canvas</span>
            </button>

            <button 
              className={`mode-pill ${engineMode === 'object' ? 'active' : ''}`}
              onClick={() => setEngineMode('object')}
              title="Blob Object Engine (CSS Animations & Custom Fonts)"
            >
              <Grid size={14} />
              <span>Object Frame</span>
            </button>

            <button 
              className={`mode-pill ${engineMode === 'code' ? 'active' : ''}`}
              onClick={() => setEngineMode('code')}
              title="SVG XML Source Code Viewer"
            >
              <Code size={14} />
              <span>XML Source</span>
            </button>
          </div>

          <span className="toolbar-sep" />

          {/* Zoom Controls */}
          <div className="zoom-controls">
            <button className="tool-btn" onClick={() => setZoom(Math.max(20, zoom - 20))} title="Zoom Out"><ZoomOut size={14} /></button>
            <span className="zoom-val">{zoom}%</span>
            <button className="tool-btn" onClick={() => setZoom(Math.min(600, zoom + 20))} title="Zoom In"><ZoomIn size={14} /></button>
            <button className="tool-btn" onClick={() => setZoom(100)} title="Reset to 100%"><Maximize2 size={13} /></button>
          </div>

          <span className="toolbar-sep" />

          {/* Orientation Controls */}
          <button className="tool-btn" onClick={() => setRotation((prev) => (prev + 90) % 360)} title="Rotate 90°"><RotateCw size={14} /></button>
          <button className={`tool-btn ${flipX ? 'active' : ''}`} onClick={() => setFlipX(!flipX)} title="Flip Horizontal"><FlipHorizontal size={14} /></button>
          <button className={`tool-btn ${flipY ? 'active' : ''}`} onClick={() => setFlipY(!flipY)} title="Flip Vertical"><FlipVertical size={14} /></button>
          <button className="tool-btn" onClick={handleReset} title="Reset Pan & Zoom"><RefreshCw size={14} /></button>
        </div>

        <div className="svg-toolbar-right">
          {/* Backdrop Mode Switcher */}
          <div className="bg-mode-pills">
            <button 
              className={`bg-pill ${bgMode === 'checkerboard' ? 'active' : ''}`}
              onClick={() => setBgMode('checkerboard')}
              title="Checkerboard Transparent Backdrop"
            >
              🏁 Grid
            </button>
            <button 
              className={`bg-pill ${bgMode === 'dark' ? 'active' : ''}`}
              onClick={() => setBgMode('dark')}
              title="Deep Slate Backdrop"
            >
              <Moon size={13} /> Dark
            </button>
            <button 
              className={`bg-pill ${bgMode === 'light' ? 'active' : ''}`}
              onClick={() => setBgMode('light')}
              title="Light Paper Backdrop"
            >
              <Sun size={13} /> Light
            </button>
          </div>

          <span className="toolbar-sep" />

          <button className="tool-btn" onClick={handleCopyCode} title="Copy SVG Source Code">
            {copied ? <Check size={14} style={{ color: 'var(--accent-emerald)' }} /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy Code'}</span>
          </button>

          <button className="tool-btn primary" onClick={handleDownload} title="Download SVG File">
            <Download size={14} />
            <span>Download</span>
          </button>
        </div>
      </header>

      {/* ── Main Interactive Studio Stage ────────────────────────────── */}
      <main 
        className={`svg-canvas-stage bg-${bgMode} ${isDragging ? 'is-dragging' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {engineMode === 'code' ? (
          <div className="svg-code-container">
            <div className="svg-code-header">
              <FileCode2 size={14} style={{ color: 'var(--accent-cyan)' }} />
              <span>XML Markup Code</span>
              <span className="svg-code-badge">{svgMeta.size}</span>
            </div>
            <pre className="svg-code-pre">
              <code>{svgText}</code>
            </pre>
          </div>
        ) : engineMode === 'object' ? (
          <div 
            className="svg-viewport-wrapper"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100}) rotate(${rotation}deg) scaleX(${flipX ? -1 : 1}) scaleY(${flipY ? -1 : 1})`,
              transition: isDragging ? 'none' : 'transform 0.15s ease-out'
            }}
          >
            <object 
              data={blobObjectUrl} 
              type="image/svg+xml"
              className="svg-object-frame"
              title={file.name}
            />
          </div>
        ) : (
          <div 
            className="svg-viewport-wrapper"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100}) rotate(${rotation}deg) scaleX(${flipX ? -1 : 1}) scaleY(${flipY ? -1 : 1})`,
              transition: isDragging ? 'none' : 'transform 0.15s ease-out'
            }}
          >
            <div 
              className="svg-inline-container"
              dangerouslySetInnerHTML={{ __html: normalizedVectorHtml }}
            />
          </div>
        )}
      </main>

      {/* ── Studio Vector Footer Metadata Ribbon ─────────────────────── */}
      <footer className="svg-footer">
        <div className="footer-left">
          <Sparkles size={13} style={{ color: 'var(--primary)' }} />
          <span className="footer-filename">{file.name}</span>
          <span className="footer-sep">•</span>
          <span>{svgMeta.size}</span>
          <span className="footer-sep">•</span>
          <span className="footer-badge">
            <Layers size={11} style={{ marginRight: 4 }} />
            {svgMeta.nodes} Vector Elements
          </span>
        </div>

        <div className="footer-right">
          <span>viewBox: {svgMeta.viewBox}</span>
          <span className="footer-sep">•</span>
          <span>Mode: {engineMode.toUpperCase()}</span>
          <span className="footer-sep">•</span>
          <span>Scale: {zoom}%</span>
        </div>
      </footer>
    </div>
  );
};
