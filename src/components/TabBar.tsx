import React, { useState, useRef, useEffect } from 'react';
import type { PointerEvent } from 'react';
import { 
  FileText, 
  BookOpen, 
  File, 
  Code, 
  FileSpreadsheet, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  X, 
  Plus,
  LayoutDashboard,
  Columns,
  Square
} from 'lucide-react';
import type { FileItem, SplitLayoutMode } from '../types';

interface TabBarProps {
  openTabs: FileItem[];
  activeFile: FileItem | null;
  onSelectTab: (file: FileItem) => void;
  onCloseTab: (fileId: string, e: React.MouseEvent) => void;
  onCloseAllTabs?: () => void;
  onGoToDashboard: () => void;
  isDashboardActive: boolean;
  onNewNoteClick: () => void;
  onReorderTabs?: (reorderedTabs: FileItem[]) => void;
  splitCount?: SplitLayoutMode;
  onChangeSplitCount?: (count: SplitLayoutMode) => void;
}

const ESTIMATED_TAB_WIDTH = 180;

export const TabBar: React.FC<TabBarProps> = ({
  openTabs,
  activeFile,
  onSelectTab,
  onCloseTab,
  onCloseAllTabs,
  onGoToDashboard,
  isDashboardActive,
  onNewNoteClick,
  onReorderTabs,
  splitCount = 1,
  onChangeSplitCount
}) => {
  // 60 FPS Chrome Pointer-Event Dragging Physics State
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragDeltaX, setDragDeltaX] = useState<number>(0);
  const [targetIdx, setTargetIdx] = useState<number | null>(null);

  const startMouseXRef = useRef<number>(0);

  const getFileIcon = (type?: string) => {
    switch (type) {
      case 'md': return <FileText size={14} style={{ color: '#818cf8' }} />;
      case 'pdf': return <BookOpen size={14} style={{ color: '#fb7185' }} />;
      case 'pptx': return <File size={14} style={{ color: '#f97316' }} />;
      case 'docx': return <File size={14} style={{ color: '#38bdf8' }} />;
      case 'code': return <Code size={14} style={{ color: '#4ade80' }} />;
      case 'csv': return <FileSpreadsheet size={14} style={{ color: '#34d399' }} />;
      case 'image': return <ImageIcon size={14} style={{ color: '#f59e0b' }} />;
      case 'video': return <VideoIcon size={14} style={{ color: '#c084fc' }} />;
      default: return <FileText size={14} style={{ color: 'var(--primary)' }} />;
    }
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>, idx: number, file: FileItem) => {
    // Only capture primary mouse button clicks
    if (e.button !== 0) return;
    // Don't capture pointer if close button was clicked
    if ((e.target as HTMLElement).closest('.tab-close-btn')) return;

    // Instant 0ms Tab Selection on Mouse Down
    onSelectTab(file);

    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {}

    startMouseXRef.current = e.clientX;
    setDraggingIdx(idx);
    setTargetIdx(idx);
    setDragDeltaX(0);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (draggingIdx === null) return;

    const deltaX = e.clientX - startMouseXRef.current;
    setDragDeltaX(deltaX);

    // Calculate dynamic neighbor displacement target index
    const rawTargetIdx = draggingIdx + Math.round(deltaX / ESTIMATED_TAB_WIDTH);
    const clampedTargetIdx = Math.max(0, Math.min(openTabs.length - 1, rawTargetIdx));

    if (clampedTargetIdx !== targetIdx) {
      setTargetIdx(clampedTargetIdx);
    }
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (draggingIdx === null) return;

    const target = e.currentTarget as HTMLElement;
    try {
      target.releasePointerCapture(e.pointerId);
    } catch (err) {}

    if (targetIdx !== null && draggingIdx !== targetIdx && onReorderTabs) {
      const updated = [...openTabs];
      const [movedTab] = updated.splice(draggingIdx, 1);
      updated.splice(targetIdx, 0, movedTab);
      onReorderTabs(updated);
    }

    // Reset offsets and drag states smoothly
    setDraggingIdx(null);
    setTargetIdx(null);
    setDragDeltaX(0);
  };

  const activeTabKey = activeFile ? (activeFile.tabId || activeFile.id) : null;
  const activeTabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
    }
  }, [activeTabKey]);

  return (
    <div className="browser-tab-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div className="tab-scroll-container" style={{ flex: 1, display: 'flex', alignItems: 'center', overflowX: 'auto' }}>
        {/* Dashboard Fixed Primary Tab */}
        <button
          className={`app-tab dashboard-tab ${isDashboardActive ? 'active' : ''}`}
          onClick={onGoToDashboard}
          title="Vault Overview & Galaxy Brain"
        >
          <LayoutDashboard size={14} style={{ color: isDashboardActive ? 'var(--primary)' : 'var(--text-muted)' }} />
          <span className="tab-title">Dashboard</span>
        </button>

        {/* 60 FPS Chrome Browser Tab Bar with Neighbor Displacement Physics */}
        {openTabs.map((file, idx) => {
          const tabKey = file.tabId || `${file.id}_${idx}`;
          const isActive = !isDashboardActive && (
            activeFile?.tabId 
              ? file.tabId === activeFile.tabId 
              : activeTabKey === (file.tabId || file.id)
          );
          const isDragging = idx === draggingIdx;

          // Chrome Neighbor Tab Displacement Offset Calculation
          let shiftX = 0;
          if (!isDragging && draggingIdx !== null && targetIdx !== null) {
            if (draggingIdx < targetIdx && idx > draggingIdx && idx <= targetIdx) {
              shiftX = -ESTIMATED_TAB_WIDTH;
            } else if (draggingIdx > targetIdx && idx < draggingIdx && idx >= targetIdx) {
              shiftX = ESTIMATED_TAB_WIDTH;
            }
          }

          const translateX = isDragging ? dragDeltaX : shiftX;

          // Check if there are multiple open tabs with the exact same filename
          const duplicateNameCount = openTabs.filter(t => t.name === file.name).length;
          const parentFolder = (file.path && file.path.includes('/'))
            ? file.path.split('/').filter(Boolean).slice(-2, -1)[0] || ''
            : (file.moduleName || '');

          const displayTitle = (duplicateNameCount > 1 && parentFolder)
            ? `${file.name} (${parentFolder})`
            : file.name;
          const fullPathTooltip = file.fullPath || file.path || file.name;

          return (
            <div
              key={tabKey}
              ref={isActive ? activeTabRef : null}
              onPointerDown={(e) => handlePointerDown(e, idx, file)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`app-tab ${isActive ? 'active' : ''}`}
              title={`Drag to reorder • ${fullPathTooltip}`}
              style={{ 
                cursor: 'pointer',
                transform: translateX ? `translateX(${translateX}px)` : undefined,
                transition: isDragging
                  ? 'none'
                  : draggingIdx !== null
                  ? 'transform 0.12s ease'
                  : undefined,
                zIndex: isDragging ? 100 : 1,
                boxShadow: isDragging ? '0 4px 16px rgba(0,0,0,0.4)' : undefined,
                background: isDragging ? 'var(--bg-surface-elevated)' : undefined,
                userSelect: 'none',
                touchAction: 'none'
              }}
            >
              <span className="tab-icon">{getFileIcon(file.type)}</span>
              <span className="tab-title" title={fullPathTooltip}>{displayTitle}</span>
              <button
                className="tab-close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(file.tabId || file.id, e);
                }}
                onPointerDown={(e) => e.stopPropagation()} // Prevent triggering drag when clicking close
                title="Close Tab"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}

        {/* Quick Vault File Search / New Tab Action Button */}
        <button
          className="new-tab-btn"
          onClick={onNewNoteClick}
          title="Quick Vault File Search (Ctrl+P / +)"
        >
          <Plus size={15} />
        </button>
      </div>

      {/* Close All Open Tabs Button */}
      {onCloseAllTabs && openTabs.length > 0 && (
        <button
          className="tool-btn"
          onClick={onCloseAllTabs}
          style={{
            padding: '4px 8px',
            fontSize: '0.72rem',
            fontWeight: 700,
            color: 'var(--accent-rose, #f43f5e)',
            background: 'rgba(244, 63, 94, 0.08)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            borderRadius: 'var(--radius-md)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            marginRight: 8,
            cursor: 'pointer',
            flexShrink: 0
          }}
          title="Close All Open Tabs"
        >
          <X size={13} />
          Close All ({openTabs.length})
        </button>
      )}

      {/* Dual Screen Split View Controls (1 Pane vs 2 Panes Split Screen) */}
      {onChangeSplitCount && (
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 4, 
            background: 'var(--bg-surface-elevated)', 
            padding: 3, 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--border-color)',
            marginRight: 8,
            flexShrink: 0
          }}
        >
          <button
            className={`btn-icon ${splitCount === 1 ? 'active' : ''}`}
            onClick={() => onChangeSplitCount(1)}
            style={{ width: 26, height: 26, color: splitCount === 1 ? 'var(--primary)' : 'var(--text-muted)' }}
            title="Single Main View (1 Pane)"
          >
            <Square size={13} />
          </button>

          <button
            className={`btn-icon ${splitCount === 2 ? 'active' : ''}`}
            onClick={() => {
              if (openTabs.length > 1) {
                onChangeSplitCount(2);
              }
            }}
            disabled={openTabs.length <= 1}
            style={{ 
              width: 26, 
              height: 26, 
              color: splitCount === 2 ? 'var(--primary)' : 'var(--text-muted)',
              opacity: openTabs.length <= 1 ? 0.35 : 1,
              cursor: openTabs.length <= 1 ? 'not-allowed' : 'pointer'
            }}
            title={openTabs.length <= 1 ? "Open at least 2 tabs to enable dual split view" : "Dual Split View (2 Panes: Side-by-Side)"}
          >
            <Columns size={13} />
          </button>

        </div>
      )}
    </div>
  );
};
