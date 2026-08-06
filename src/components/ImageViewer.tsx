import React, { useState, useEffect, useLayoutEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Maximize, Image as ImageIcon } from 'lucide-react';
import type { FileItem } from '../types';
import { getFileState, saveFileState } from '../utils/stateMemory';

interface ImageViewerProps {
  file: FileItem;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ file }) => {
  const isDuplicateTab = Boolean(file.isDuplicate || (file.tabId && file.tabId.includes('_dup_')));
  const fileKey = file.fullPath || file.id;

  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  // Restore saved image zoom & rotation on load
  useLayoutEffect(() => {
    const saved = isDuplicateTab ? {} : getFileState(fileKey);
    if (saved.zoom) setZoom(saved.zoom);
    else setZoom(100);

    if (saved.rotation !== undefined) setRotation(saved.rotation);
    else setRotation(0);
  }, [file.id, fileKey, isDuplicateTab]);

  useEffect(() => {
    let url: string | null = null;
    if (file.url) {
      url = file.url;
    } else if (file.arrayBuffer) {
      const blob = new Blob([file.arrayBuffer], { type: `image/${file.extension || 'png'}` });
      url = URL.createObjectURL(blob);
    }
    setObjectUrl(url);

    return () => {
      if (url && !file.url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [file]);

  const handleZoomIn = () => {
    setZoom(prev => {
      const next = Math.min(500, prev + 25);
      if (!isDuplicateTab) saveFileState(fileKey, { zoom: next, rotation });
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoom(prev => {
      const next = Math.max(25, prev - 25);
      if (!isDuplicateTab) saveFileState(fileKey, { zoom: next, rotation });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoom(100);
    setRotation(0);
    if (!isDuplicateTab) saveFileState(fileKey, { zoom: 100, rotation: 0 });
  };

  const handleRotate = () => {
    setRotation(prev => {
      const next = (prev + 90) % 360;
      if (!isDuplicateTab) saveFileState(fileKey, { zoom, rotation: next });
      return next;
    });
  };

  return (
    <div className="media-canvas">
      {objectUrl ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 40 }}>
          <img
            src={objectUrl}
            alt={file.name}
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              maxWidth: zoom === 100 ? '90%' : 'none',
              maxHeight: zoom === 100 ? '85vh' : 'none',
              objectFit: 'contain',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)'
            }}
          />
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: 'var(--text-dim)' }}>
          <ImageIcon size={48} style={{ marginBottom: 12, opacity: 0.5 }} />
          <p>No image data available</p>
        </div>
      )}

      {/* Floating Toolbar */}
      <div className="floating-media-toolbar">
        <button className="tool-btn" onClick={handleZoomOut} title="Zoom Out (-25%)">
          <ZoomOut size={16} />
        </button>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', minWidth: 44, textAlign: 'center' }}>
          {zoom}%
        </span>
        <button className="tool-btn" onClick={handleZoomIn} title="Zoom In (+25%)">
          <ZoomIn size={16} />
        </button>
        <div style={{ width: 1, height: 16, background: 'var(--border-color)' }} />
        <button className="tool-btn" onClick={handleRotate} title="Rotate 90°">
          <RotateCw size={16} />
        </button>
        <button className="tool-btn" onClick={handleResetZoom} title="Reset Scale">
          <Maximize size={16} />
        </button>
      </div>
    </div>
  );
};
