import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  BookOpen, 
  FileText, 
  FilePlus, 
  Sparkles, 
  Code,
  ArrowRight,
  Search,
  X,
  Presentation,
  Calendar,
  Globe,
  Maximize2,
  RotateCcw,
  Zap,
  Layers,
  Activity,
  FolderOpen,
  FolderPlus,
  Star,
  FileSpreadsheet,
  File,
  Image as ImageIcon,
  Video as VideoIcon,
  Folder
} from 'lucide-react';
import type { FileItem, MainDirectory } from '../types';

interface DashboardOverviewProps {
  mainDir: MainDirectory;
  onSelectMainDirectory: () => void;
  onSelectFile: (file: FileItem) => void;
  onCreateNewNote: (folderPath?: string) => void;
  onCreateFolder: (parentFolderPath?: string) => void;
  onToggleFavorite: (fileId: string) => void;
}

interface GalaxyNode {
  id: string;
  name: string;
  type: 'folder' | 'md' | 'pdf' | 'pptx' | 'code' | 'csv' | 'docx' | 'image' | 'video' | 'other';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  glowColor: string;
  item?: FileItem;
  parentId?: string;
  isFavorite?: boolean;
  moduleName?: string;
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
}

interface ConstellationLine {
  sourceId: string;
  targetId: string;
  color: string;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  mainDir,
  onSelectMainDirectory,
  onSelectFile,
  onCreateNewNote,
  onCreateFolder,
  onToggleFavorite
}) => {
  const [activeTab, setActiveTab] = useState<'galaxy' | 'explorer' | 'analytics'>('galaxy');
  const [fileFilter, setFileFilter] = useState<'all' | 'notes' | 'pptx' | 'pdf' | 'code' | 'starred'>('all');
  const [dashSearch, setDashSearch] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<GalaxyNode | null>(null);
  
  // Galaxy Canvas State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GalaxyNode | null>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Time-based Greeting & Current Date (Strictly No Emojis)
  const { greeting, currentDate } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    let greet = 'Good Morning';
    if (hour >= 12 && hour < 18) greet = 'Good Afternoon';
    else if (hour >= 18) greet = 'Good Evening';

    const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return { greeting: greet, currentDate: dateStr };
  }, []);

  // Recursively collect all files and subfolders
  const { allFiles, allFolders } = useMemo(() => {
    const files: FileItem[] = [];
    const folders: FileItem[] = [];

    const traverse = (items: FileItem[]) => {
      for (const item of items) {
        if (item.type === 'folder') {
          folders.push(item);
          if (item.children) traverse(item.children);
        } else {
          files.push(item);
        }
      }
    };

    traverse(mainDir.files);
    return { allFiles: files, allFolders: folders };
  }, [mainDir.files]);

  const counts = useMemo(() => {
    let md = 0, code = 0, csv = 0, pdf = 0, docx = 0, pptx = 0, fav = 0;
    for (const file of allFiles) {
      if (file.isFavorite) fav++;
      if (file.type === 'md') md++;
      else if (file.type === 'code') code++;
      else if (file.type === 'csv') csv++;
      else if (file.type === 'pdf') pdf++;
      else if (file.type === 'docx') docx++;
      else if (file.type === 'pptx') pptx++;
    }
    return { md, code, csv, pdf, docx, pptx, fav, total: allFiles.length, folders: allFolders.length };
  }, [allFiles, allFolders]);

  const filteredFiles = useMemo(() => {
    let result = allFiles;
    if (fileFilter === 'notes') result = result.filter(f => f.type === 'md');
    else if (fileFilter === 'pptx') result = result.filter(f => f.type === 'pptx');
    else if (fileFilter === 'pdf') result = result.filter(f => f.type === 'pdf');
    else if (fileFilter === 'code') result = result.filter(f => f.type === 'code');
    else if (fileFilter === 'starred') result = result.filter(f => f.isFavorite);

    if (dashSearch.trim()) {
      const q = dashSearch.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(q) || (f.moduleName && f.moduleName.toLowerCase().includes(q)));
    }
    return result;
  }, [allFiles, fileFilter, dashSearch]);

  const percentages = useMemo(() => {
    const total = counts.total || 1;
    return {
      md: Math.round((counts.md / total) * 100),
      pptx: Math.round((counts.pptx / total) * 100),
      code: Math.round((counts.code / total) * 100),
      pdf: Math.round((counts.pdf / total) * 100),
      other: Math.round(((counts.csv + counts.docx) / total) * 100)
    };
  }, [counts]);

  // Color mapping helper for file types in Galaxy Brain
  const getFileTypeColors = (type: string) => {
    switch (type) {
      case 'md': return { color: '#818cf8', glow: 'rgba(129, 140, 248, 0.7)' };
      case 'pdf': return { color: '#fb7185', glow: 'rgba(251, 113, 133, 0.7)' };
      case 'pptx': return { color: '#f97316', glow: 'rgba(249, 115, 22, 0.7)' };
      case 'code': return { color: '#4ade80', glow: 'rgba(74, 222, 128, 0.7)' };
      case 'csv': return { color: '#34d399', glow: 'rgba(52, 211, 153, 0.7)' };
      case 'docx': return { color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.7)' };
      case 'image': return { color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.7)' };
      case 'video': return { color: '#c084fc', glow: 'rgba(192, 132, 252, 0.7)' };
      case 'folder': return { color: '#a855f7', glow: 'rgba(168, 85, 247, 0.8)' };
      default: return { color: '#94a3b8', glow: 'rgba(148, 163, 184, 0.6)' };
    }
  };

  // Build Hierarchical Galaxy Graph Nodes & Constellation Connections (Root -> Folders -> Subfolders -> Files)
  const { nodes, connections } = useMemo(() => {
    const nodeList: GalaxyNode[] = [];
    const connList: ConstellationLine[] = [];

    // Central Vault Nucleus Node
    nodeList.push({
      id: 'root-nucleus',
      name: mainDir.name || 'Vault Core',
      type: 'folder',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 26,
      color: '#c084fc',
      glowColor: 'rgba(192, 132, 252, 0.95)',
      orbitRadius: 0,
      orbitAngle: 0,
      orbitSpeed: 0
    });

    let indexCounter = 0;

    const processItems = (items: FileItem[], parentId: string, depth: number) => {
      items.forEach((item) => {
        indexCounter++;
        const currentIdx = indexCounter;

        if (item.type === 'folder') {
          // Subfolder / Nested Subfolder Hub
          const angle = (currentIdx / 8) * Math.PI * 2 + depth * (Math.PI / 6);
          const orbitDist = depth === 1 ? 160 + (currentIdx % 3) * 50 : 80 + (currentIdx % 3) * 35;
          const speed = (0.0008 / depth) * (currentIdx % 2 === 0 ? 1 : -1);

          nodeList.push({
            id: item.id,
            name: item.name,
            type: 'folder',
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            radius: Math.max(10, 18 - depth * 3),
            color: depth === 1 ? '#a855f7' : '#c084fc',
            glowColor: depth === 1 ? 'rgba(168, 85, 247, 0.8)' : 'rgba(192, 132, 252, 0.8)',
            parentId,
            moduleName: item.moduleName,
            orbitRadius: orbitDist,
            orbitAngle: angle,
            orbitSpeed: speed
          });

          connList.push({
            sourceId: parentId,
            targetId: item.id,
            color: depth === 1 ? 'rgba(168, 85, 247, 0.35)' : 'rgba(192, 132, 252, 0.35)'
          });

          if (item.children && item.children.length > 0) {
            processItems(item.children, item.id, depth + 1);
          }
        } else {
          // Document Star Node
          const { color, glow } = getFileTypeColors(item.type);
          const angle = (currentIdx / 10) * Math.PI * 2 + Math.PI / 4;
          const orbitDist = parentId === 'root-nucleus' ? 280 + (currentIdx % 5) * 40 : 65 + (currentIdx % 4) * 28;
          const speed = 0.0012 * (currentIdx % 2 === 0 ? 1 : -1);

          nodeList.push({
            id: item.id,
            name: item.name,
            type: item.type as any,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            radius: item.isFavorite ? 11 : 8,
            color,
            glowColor: glow,
            item,
            parentId,
            isFavorite: item.isFavorite,
            moduleName: item.moduleName,
            orbitRadius: orbitDist,
            orbitAngle: angle,
            orbitSpeed: speed
          });

          connList.push({
            sourceId: parentId,
            targetId: item.id,
            color: glow.replace('0.7', '0.3')
          });
        }
      });
    };

    processItems(mainDir.files, 'root-nucleus', 1);

    return { nodes: nodeList, connections: connList };
  }, [mainDir.name, mainDir.files]);

  // Canvas Physics & Render Loop
  useEffect(() => {
    if (activeTab !== 'galaxy') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const starDust = Array.from({ length: 140 }, () => ({
      x: (Math.random() - 0.5) * 2400,
      y: (Math.random() - 0.5) * 2400,
      size: Math.random() * 2.0 + 0.4,
      alpha: Math.random() * 0.75 + 0.25,
      twinkleSpeed: Math.random() * 0.02 + 0.005
    }));

    const render = () => {
      const width = canvas.parentElement?.clientWidth || 800;
      const height = canvas.parentElement?.clientHeight || 600;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.save();
      ctx.clearRect(0, 0, width, height);

      const bgGrad = ctx.createRadialGradient(
        width / 2, height / 2, 40,
        width / 2, height / 2, Math.max(width, height)
      );
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(0.5, '#090d16');
      bgGrad.addColorStop(1, '#020617');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2 + panOffset.x;
      const centerY = height / 2 + panOffset.y;

      ctx.translate(centerX, centerY);
      ctx.scale(zoomScale, zoomScale);

      starDust.forEach(star => {
        star.alpha += Math.sin(Date.now() * star.twinkleSpeed) * 0.01;
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, Math.min(0.9, star.alpha))})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Update Node Positions
      nodes.forEach(node => {
        if (node.id === 'root-nucleus') {
          node.x = 0;
          node.y = 0;
          return;
        }

        if (autoRotate) {
          node.orbitAngle += node.orbitSpeed;
        }

        const parent = nodes.find(n => n.id === node.parentId);
        const px = parent ? parent.x : 0;
        const py = parent ? parent.y : 0;

        node.x = px + Math.cos(node.orbitAngle) * node.orbitRadius;
        node.y = py + Math.sin(node.orbitAngle) * node.orbitRadius;
      });

      // Draw Orbit Rings for Folders
      nodes.filter(n => n.type === 'folder').forEach(folder => {
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(folder.x, folder.y, folder.orbitRadius || 130, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Draw Constellation Connection Lines
      connections.forEach(conn => {
        const src = nodes.find(n => n.id === conn.sourceId);
        const tgt = nodes.find(n => n.id === conn.targetId);
        if (!src || !tgt) return;

        const isSearchMatch = dashSearch.trim() && tgt.name.toLowerCase().includes(dashSearch.toLowerCase());
        const isHovered = hoveredNode?.id === tgt.id || hoveredNode?.id === src.id;
        const isSelected = selectedNode?.id === tgt.id || selectedNode?.id === src.id;

        ctx.strokeStyle = isSelected ? 'rgba(168, 85, 247, 0.9)' : isHovered ? 'rgba(56, 189, 248, 0.85)' : isSearchMatch ? 'rgba(250, 204, 21, 0.85)' : conn.color;
        ctx.lineWidth = isSelected ? 2.5 : isHovered ? 2 : isSearchMatch ? 1.8 : 1;
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.stroke();
      });

      // Draw Star Nodes
      nodes.forEach(node => {
        const isSearchMatch = dashSearch.trim() && node.name.toLowerCase().includes(dashSearch.toLowerCase());
        const isHovered = hoveredNode?.id === node.id;
        const isSelected = selectedNode?.id === node.id;

        const haloRadius = node.radius * (isHovered || isSelected || isSearchMatch ? 3.5 : 2.2);
        const radialGlow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, haloRadius);
        radialGlow.addColorStop(0, isSearchMatch ? 'rgba(250, 204, 21, 0.85)' : isSelected ? 'rgba(168, 85, 247, 0.9)' : node.glowColor);
        radialGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = radialGlow;
        ctx.beginPath();
        ctx.arc(node.x, node.y, haloRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isSearchMatch ? '#facc15' : isSelected ? '#a855f7' : node.color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * (isHovered || isSelected ? 1.4 : 1.0), 0, Math.PI * 2);
        ctx.fill();

        if (node.isFavorite) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (showLabels || isHovered || isSelected || isSearchMatch) {
          ctx.font = isHovered || isSelected ? 'bold 13px Inter, sans-serif' : '11px Inter, sans-serif';
          ctx.fillStyle = isHovered || isSelected ? '#ffffff' : isSearchMatch ? '#facc15' : 'rgba(226, 232, 240, 0.85)';
          ctx.textAlign = 'center';
          ctx.fillText(node.name, node.x, node.y + node.radius + 15);
        }
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [activeTab, nodes, connections, autoRotate, showLabels, zoomScale, panOffset, hoveredNode, selectedNode, dashSearch]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...panOffset };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPanOffset({
        x: panStartRef.current.x + dx,
        y: panStartRef.current.y + dy
      });
      return;
    }

    const centerX = canvas.width / 2 + panOffset.x;
    const centerY = canvas.height / 2 + panOffset.y;

    const worldX = (mouseX - centerX) / zoomScale;
    const worldY = (mouseY - centerY) / zoomScale;

    let found: GalaxyNode | null = null;
    for (const node of nodes) {
      const dist = Math.hypot(worldX - node.x, worldY - node.y);
      if (dist <= node.radius + 8) {
        found = node;
        break;
      }
    }
    setHoveredNode(found);
  };

  const handleCanvasMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleCanvasClick = () => {
    if (hoveredNode) {
      setSelectedNode(hoveredNode);
      if (hoveredNode.item) {
        onSelectFile(hoveredNode.item);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    setZoomScale(prev => Math.max(0.3, Math.min(3.5, prev * zoomFactor)));
  };

  const resetView = () => {
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
    setSelectedNode(null);
  };

  return (
    <div className="dashboard-container" style={{ padding: '24px 32px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-main)', boxSizing: 'border-box' }}>
      
      {/* 1. Header Banner (Strictly No Emojis) */}
      <div style={{
        background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-surface-elevated) 100%)',
        border: '1px solid var(--border-color)',
        borderRadius: 22,
        padding: '20px 26px',
        marginBottom: 20,
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 900, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'var(--primary-light)', padding: '4px 12px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={13} /> Knowledge Vault & Galaxy Hub
            </span>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-dim)', background: 'var(--bg-surface)', padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={13} /> {currentDate}
            </span>
          </div>

          <h1 style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--text-main)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.03em', margin: 0 }}>
            {greeting}, Scholar
          </h1>
        </div>

        {/* Navigation Tabs Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          
          <div style={{ display: 'flex', background: 'var(--bg-surface-elevated)', padding: 3, borderRadius: 14, border: '1px solid var(--border-color)', gap: 2 }}>
            <button
              onClick={() => setActiveTab('galaxy')}
              style={{
                padding: '8px 15px',
                borderRadius: 10,
                fontSize: '0.82rem',
                fontWeight: 800,
                border: 'none',
                background: activeTab === 'galaxy' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'galaxy' ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <Globe size={15} /> Knowledge Galaxy
            </button>

            <button
              onClick={() => setActiveTab('explorer')}
              style={{
                padding: '8px 15px',
                borderRadius: 10,
                fontSize: '0.82rem',
                fontWeight: 800,
                border: 'none',
                background: activeTab === 'explorer' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'explorer' ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <Layers size={15} /> Vault Feed
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              style={{
                padding: '8px 15px',
                borderRadius: 10,
                fontSize: '0.82rem',
                fontWeight: 800,
                border: 'none',
                background: activeTab === 'analytics' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'analytics' ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <Activity size={15} /> Vault Analytics
            </button>
          </div>

          {/* Quick Search */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, color: 'var(--text-dim)' }} />
            <input
              type="text"
              className="search-input"
              style={{ paddingLeft: 34, paddingRight: 28, width: '100%', padding: '8px 28px 8px 34px', fontSize: '0.82rem', borderRadius: 12 }}
              placeholder="Search documents..."
              value={dashSearch}
              onChange={e => setDashSearch(e.target.value)}
            />
            {dashSearch && (
              <X size={14} style={{ position: 'absolute', right: 10, cursor: 'pointer', color: 'var(--text-dim)' }} onClick={() => setDashSearch('')} />
            )}
          </div>

          <button 
            className="btn-primary" 
            onClick={() => onCreateNewNote()}
            style={{ padding: '9px 16px', borderRadius: 12, fontSize: '0.84rem', fontWeight: 800, boxShadow: 'var(--shadow-sm)' }}
          >
            <FilePlus size={15} /> + New Note
          </button>

          <button 
            className="tool-btn" 
            onClick={() => onCreateFolder()}
            style={{ padding: '9px 14px', borderRadius: 12, fontSize: '0.82rem', border: '1px solid var(--border-color)', fontWeight: 700 }}
          >
            <FolderPlus size={15} /> + Folder
          </button>

          <button 
            className="tool-btn" 
            onClick={onSelectMainDirectory}
            style={{ padding: '9px 14px', borderRadius: 12, fontSize: '0.82rem', border: '1px solid var(--border-color)', fontWeight: 700 }}
          >
            <FolderOpen size={15} /> Switch Vault
          </button>
        </div>
      </div>

      {/* 2. Main Active Tab Content */}
      {activeTab === 'galaxy' ? (
        <div 
          ref={containerRef}
          style={{
            flex: 1,
            borderRadius: 24,
            border: '1px solid var(--border-color)',
            position: 'relative',
            overflow: 'hidden',
            background: '#020617',
            boxShadow: 'inset 0 0 80px rgba(0,0,0,0.85)',
            display: 'flex'
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onClick={handleCanvasClick}
            onWheel={handleWheel}
            style={{ width: '100%', height: '100%', cursor: hoveredNode ? 'pointer' : isDraggingRef.current ? 'grabbing' : 'grab' }}
          />

          {/* Top HUD Overlay */}
          <div style={{
            position: 'absolute',
            top: 20,
            left: 20,
            right: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pointerEvents: 'none'
          }}>
            <div style={{
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 16,
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              color: '#e2e8f0',
              fontSize: '0.78rem',
              fontWeight: 800,
              pointerEvents: 'auto'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c084fc' }}>
                <Zap size={14} /> Total Nodes: <strong style={{ color: '#ffffff' }}>{counts.total}</strong>
              </span>
              <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>|</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8' }}>
                <Activity size={14} /> Connections: <strong style={{ color: '#ffffff' }}>{connections.length}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }}>
              <button
                onClick={() => setAutoRotate(!autoRotate)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 12,
                  background: autoRotate ? 'rgba(168, 85, 247, 0.25)' : 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: autoRotate ? '#c084fc' : '#94a3b8',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  backdropFilter: 'blur(16px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <RotateCcw size={14} /> {autoRotate ? 'Orbit: Active' : 'Orbit: Paused'}
              </button>

              <button
                onClick={() => setShowLabels(!showLabels)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 12,
                  background: showLabels ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: showLabels ? '#38bdf8' : '#94a3b8',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  backdropFilter: 'blur(16px)'
                }}
              >
                {showLabels ? 'Labels: Visible' : 'Labels: Hidden'}
              </button>

              <button
                onClick={resetView}
                style={{
                  padding: '8px 12px',
                  borderRadius: 12,
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  backdropFilter: 'blur(16px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Maximize2 size={13} /> Reset View ({Math.round(zoomScale * 100)}%)
              </button>
            </div>
          </div>

          {/* Bottom Star File Type Color Legend */}
          <div style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 16,
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap'
          }}>
            {[
              { label: 'Markdown', color: '#818cf8' },
              { label: 'PDF', color: '#fb7185' },
              { label: 'PPTX', color: '#f97316' },
              { label: 'Code', color: '#4ade80' },
              { label: 'CSV', color: '#34d399' },
              { label: 'DOCX', color: '#38bdf8' },
              { label: 'Image', color: '#f59e0b' },
              { label: 'Video', color: '#c084fc' },
              { label: 'Folder Hub', color: '#a855f7' }
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', fontWeight: 800, color: '#e2e8f0' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: item.color, boxShadow: `0 0 8px ${item.color}` }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          {/* Hovered/Selected Star Detail Card */}
          {(hoveredNode || selectedNode) && (hoveredNode?.item || selectedNode?.item) && (
            <div style={{
              position: 'absolute',
              bottom: 20,
              right: 20,
              width: 300,
              background: 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${(hoveredNode || selectedNode)?.color}`,
              borderRadius: 20,
              padding: 20,
              color: '#ffffff',
              boxShadow: `0 12px 36px ${(hoveredNode || selectedNode)?.glowColor}`,
              zIndex: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: (hoveredNode || selectedNode)?.color, boxShadow: `0 0 10px ${(hoveredNode || selectedNode)?.color}` }} />
                  <span style={{ fontSize: '0.74rem', fontWeight: 900, textTransform: 'uppercase', color: (hoveredNode || selectedNode)?.color, letterSpacing: '0.05em' }}>
                    {(hoveredNode || selectedNode)?.type.toUpperCase()} DOCUMENT
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const targetFile = hoveredNode?.item || selectedNode?.item;
                    if (targetFile) onToggleFavorite(targetFile.id);
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: (hoveredNode || selectedNode)?.isFavorite ? '#f59e0b' : '#94a3b8' }}
                >
                  <Star size={16} fill={(hoveredNode || selectedNode)?.isFavorite ? '#f59e0b' : 'none'} />
                </button>
              </div>

              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#ffffff', marginBottom: 8 }}>
                {(hoveredNode || selectedNode)?.name}
              </div>

              <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div>Directory: <strong style={{ color: '#e2e8f0' }}>{(hoveredNode || selectedNode)?.moduleName || 'Root Vault'}</strong></div>
                <div>Status: <strong style={{ color: (hoveredNode || selectedNode)?.isFavorite ? '#f59e0b' : '#cbd5e1' }}>{(hoveredNode || selectedNode)?.isFavorite ? 'Starred Favorite' : 'Standard Document'}</strong></div>
              </div>

              <button
                onClick={() => {
                  const targetFile = hoveredNode?.item || selectedNode?.item;
                  if (targetFile) onSelectFile(targetFile);
                }}
                style={{
                  marginTop: 14,
                  width: '100%',
                  padding: '10px 0',
                  borderRadius: 12,
                  background: (hoveredNode || selectedNode)?.color,
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                Open Document <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      ) : activeTab === 'explorer' ? (
        /* Revamped Vault Feed UI (Strictly Emoji Free) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          
          {/* Top Quick Category Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <div 
              onClick={() => setFileFilter('notes')}
              style={{ padding: '16px 20px', borderRadius: 18, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'transform 0.15s ease' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ background: 'rgba(129, 140, 248, 0.15)', color: '#818cf8', padding: 8, borderRadius: 10 }}><FileText size={18} /></div>
                <span style={{ fontSize: '0.74rem', fontWeight: 900, color: '#818cf8' }}>{counts.md} items</span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>Markdown Notes</div>
            </div>

            <div 
              onClick={() => setFileFilter('pdf')}
              style={{ padding: '16px 20px', borderRadius: 18, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'transform 0.15s ease' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ background: 'rgba(251, 113, 133, 0.15)', color: '#fb7185', padding: 8, borderRadius: 10 }}><BookOpen size={18} /></div>
                <span style={{ fontSize: '0.74rem', fontWeight: 900, color: '#fb7185' }}>{counts.pdf} items</span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>PDF Books</div>
            </div>

            <div 
              onClick={() => setFileFilter('pptx')}
              style={{ padding: '16px 20px', borderRadius: 18, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'transform 0.15s ease' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ background: 'rgba(249, 115, 22, 0.15)', color: '#f97316', padding: 8, borderRadius: 10 }}><Presentation size={18} /></div>
                <span style={{ fontSize: '0.74rem', fontWeight: 900, color: '#f97316' }}>{counts.pptx} items</span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>PowerPoint Decks</div>
            </div>

            <div 
              onClick={() => setFileFilter('code')}
              style={{ padding: '16px 20px', borderRadius: 18, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'transform 0.15s ease' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', padding: 8, borderRadius: 10 }}><Code size={18} /></div>
                <span style={{ fontSize: '0.74rem', fontWeight: 900, color: '#4ade80' }}>{counts.code} items</span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>Code Scripts</div>
            </div>

            <div 
              onClick={() => setFileFilter('starred')}
              style={{ padding: '16px 20px', borderRadius: 18, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'transform 0.15s ease' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: 8, borderRadius: 10 }}><Star size={18} fill="#f59e0b" /></div>
                <span style={{ fontSize: '0.74rem', fontWeight: 900, color: '#f59e0b' }}>{counts.fav} items</span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>Starred Favorites</div>
            </div>
          </div>

          {/* Main Feed Explorer Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, flex: 1, minHeight: 0 }}>
            
            {/* Feed List Container */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 22, padding: 22, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ fontSize: '1.0rem', fontWeight: 900, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={18} style={{ color: 'var(--primary)' }} />
                  <span>Vault Document Feed ({filteredFiles.length})</span>
                </div>
                
                {/* Category Filter Pills */}
                <div style={{ display: 'flex', background: 'var(--bg-surface-elevated)', padding: 3, borderRadius: 10, border: '1px solid var(--border-color)', gap: 2 }}>
                  {[
                    { id: 'all', label: 'All Files' },
                    { id: 'notes', label: 'Notes' },
                    { id: 'pptx', label: 'PPT Decks' },
                    { id: 'pdf', label: 'PDF Books' },
                    { id: 'code', label: 'Code' },
                    { id: 'starred', label: 'Starred' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setFileFilter(tab.id as any)}
                      style={{
                        padding: '5px 11px',
                        borderRadius: 8,
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        border: 'none',
                        background: fileFilter === tab.id ? 'var(--primary)' : 'transparent',
                        color: fileFilter === tab.id ? '#ffffff' : 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      {tab.id === 'starred' && <Star size={12} fill={fileFilter === 'starred' ? '#ffffff' : '#f59e0b'} />}
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feed Card List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', flex: 1, paddingRight: 4 }}>
                {filteredFiles.length > 0 ? (
                  filteredFiles.map(file => (
                    <div
                      key={file.id}
                      onClick={() => onSelectFile(file)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 18px',
                        borderRadius: 14,
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      className="breadcrumb-item"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                          padding: 10,
                          borderRadius: 12,
                          background: file.type === 'md' ? 'rgba(129, 140, 248, 0.15)' : file.type === 'pdf' ? 'rgba(251, 113, 133, 0.15)' : file.type === 'pptx' ? 'rgba(249, 115, 22, 0.15)' : file.type === 'code' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                          color: file.type === 'md' ? '#818cf8' : file.type === 'pdf' ? '#fb7185' : file.type === 'pptx' ? '#f97316' : file.type === 'code' ? '#4ade80' : '#38bdf8'
                        }}>
                          {file.type === 'md' && <FileText size={20} />}
                          {file.type === 'pdf' && <BookOpen size={20} />}
                          {file.type === 'pptx' && <Presentation size={20} />}
                          {file.type === 'code' && <Code size={20} />}
                          {file.type === 'csv' && <FileSpreadsheet size={20} />}
                          {file.type === 'docx' && <File size={20} />}
                          {file.type === 'image' && <ImageIcon size={20} />}
                          {file.type === 'video' && <VideoIcon size={20} />}
                        </div>

                        <div>
                          <div style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {file.name}
                            {file.isFavorite && <Star size={13} fill="#f59e0b" color="#f59e0b" />}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            Folder: <strong style={{ color: 'var(--text-main)' }}>{file.moduleName || 'Root Vault'}</strong>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(file.id);
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: file.isFavorite ? '#f59e0b' : 'var(--text-dim)', padding: 4 }}
                          title={file.isFavorite ? "Unstar File" : "Star File"}
                        >
                          <Star size={16} fill={file.isFavorite ? '#f59e0b' : 'none'} />
                        </button>
                        <span style={{ fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                          {file.extension || file.type}
                        </span>
                        <ArrowRight size={16} style={{ color: 'var(--text-dim)' }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No matching files found in vault feed.
                  </div>
                )}
              </div>
            </div>

            {/* Subfolders Tree Sidebar Column */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 22, padding: 20, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: '0.96rem', fontWeight: 900, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FolderOpen size={17} style={{ color: 'var(--accent-amber)' }} />
                  <span>Subfolders ({allFolders.length})</span>
                </div>
                <button className="btn-icon" onClick={() => onCreateFolder()} title="Create Subfolder" style={{ width: 28, height: 28 }}>
                  <FolderPlus size={14} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1, paddingRight: 2 }}>
                {allFolders.map(folder => (
                  <div
                    key={folder.id}
                    onClick={() => onCreateNewNote(folder.path.replace(/^\//, ''))}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      color: 'var(--text-main)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer'
                    }}
                    className="breadcrumb-item"
                    title={`Click to create note inside ${folder.name}`}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Folder size={15} style={{ color: 'var(--accent-amber)' }} /> {folder.name}
                    </span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-dim)', background: 'var(--bg-surface)', padding: '2px 7px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                      {folder.children?.length || 0} items
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Vault Analytics View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            <div className="metric-card" style={{ padding: '22px', borderRadius: 20, background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '2.0rem', fontWeight: 900, color: 'var(--text-main)' }}>{counts.md}</div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 700 }}>Markdown Notes ({percentages.md}%)</div>
            </div>

            <div className="metric-card" style={{ padding: '22px', borderRadius: 20, background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '2.0rem', fontWeight: 900, color: 'var(--text-main)' }}>{counts.pdf}</div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 700 }}>PDF Books ({percentages.pdf}%)</div>
            </div>

            <div className="metric-card" style={{ padding: '22px', borderRadius: 20, background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '2.0rem', fontWeight: 900, color: 'var(--text-main)' }}>{counts.pptx}</div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 700 }}>PowerPoint Decks ({percentages.pptx}%)</div>
            </div>

            <div className="metric-card" style={{ padding: '22px', borderRadius: 20, background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '2.0rem', fontWeight: 900, color: 'var(--text-main)' }}>{counts.code}</div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 700 }}>Code Scripts ({percentages.code}%)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
