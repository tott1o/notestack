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
  Folder,
  ZoomIn,
  ZoomOut,
  Eye,
  EyeOff
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
  isDragged?: boolean;
  isPinned?: boolean;
  isMagnetLocked?: boolean;
  hoverStartTimestamp?: number;
  latchProgress?: number;
}

interface ConstellationLine {
  sourceId: string;
  targetId: string;
  color: string;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  mainDir,
  onSelectMainDirectory: _onSelectMainDirectory,
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
  const [zoomScale, setZoomScale] = useState<number>(0.85);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseWorldPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const rotationSpeedFactorRef = useRef<number>(1.0);

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
    return { md, code, csv, pdf, docx, pptx, fav, favorites: fav, total: allFiles.length, folders: allFolders.length };
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
      case 'md': return { color: '#6366f1', glow: 'rgba(99, 102, 241, 0.9)' };        // Deep indigo
      case 'pdf': return { color: '#e11d48', glow: 'rgba(225, 29, 72, 0.9)' };        // Deep rose
      case 'pptx': return { color: '#ea580c', glow: 'rgba(234, 88, 12, 0.9)' };       // Burnt orange
      case 'code': return { color: '#059669', glow: 'rgba(5, 150, 105, 0.9)' };       // Deep emerald
      case 'csv': return { color: '#0d9488', glow: 'rgba(13, 148, 136, 0.9)' };       // Deep teal
      case 'docx': return { color: '#0284c7', glow: 'rgba(2, 132, 199, 0.9)' };       // Deep sky blue
      case 'image': return { color: '#d97706', glow: 'rgba(217, 119, 6, 0.9)' };      // Deep amber
      case 'video': return { color: '#db2777', glow: 'rgba(219, 39, 119, 0.9)' };     // Deep magenta
      case 'folder': return { color: '#cd7f32', glow: 'rgba(205, 127, 50, 0.9)' };    // Warm bronze
      default: return { color: '#94a3b8', glow: 'rgba(148, 163, 184, 0.7)' };         // Slate
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
      color: '#7dd3fc',
      glowColor: 'rgba(125, 211, 252, 0.95)',
      orbitRadius: 0,
      orbitAngle: 0,
      orbitSpeed: 0
    });

    let indexCounter = 0;

    // Screen Responsive Scale Factor to fit 100% of nodes cleanly inside visible view
    const responsiveScale = typeof window !== 'undefined' ? Math.min(Math.max(0.55, window.innerWidth / 1450), 1.0) : 0.8;

    const processItems = (
      items: FileItem[], 
      parentId: string, 
      depth: number, 
      startAngle: number = 0, 
      endAngle: number = Math.PI * 2
    ) => {
      const count = items.length;
      if (count === 0) return;

      const angleSpan = endAngle - startAngle;
      const angleStep = count > 1 ? angleSpan / count : angleSpan;

      items.forEach((item, idx) => {
        indexCounter++;

        // Calculate dedicated non-crossing angle inside parent's angular cone
        const nodeAngle = depth === 1 
          ? startAngle + idx * (angleSpan / count) + (angleSpan / count) / 2
          : startAngle + idx * (count > 1 ? angleSpan / (count - 1) : 0);

        if (item.type === 'folder') {
          // Subfolder Hub (Staggered Concentric Orbit Radii to Prevent Overlap)
          const childCount = item.children ? item.children.length : 0;
          const baseDist = depth === 1 ? 210 : 110;
          const orbitDist = (baseDist + (idx * 38) + Math.min(childCount * 14, 120)) * responsiveScale;
          const speed = (0.0032 / Math.sqrt(Math.max(60, orbitDist))) * (depth % 2 === 0 ? 1 : -1);

          nodeList.push({
            id: item.id,
            name: item.name,
            type: 'folder',
            x: Math.cos(nodeAngle) * orbitDist,
            y: Math.sin(nodeAngle) * orbitDist,
            vx: 0,
            vy: 0,
            radius: Math.max(10, Math.min(24, 14 + childCount * 1.5)),
            color: depth === 1 ? '#cd7f32' : '#d4944a',
            glowColor: depth === 1 ? 'rgba(205, 127, 50, 0.7)' : 'rgba(212, 148, 74, 0.7)',
            parentId,
            moduleName: item.moduleName,
            orbitRadius: orbitDist,
            orbitAngle: nodeAngle,
            orbitSpeed: speed
          });

          connList.push({
            sourceId: parentId,
            targetId: item.id,
            color: depth === 1 ? 'rgba(205, 127, 50, 0.35)' : 'rgba(212, 148, 74, 0.35)'
          });

          if (item.children && item.children.length > 0) {
            // Allocate sub-sector cone for children so child lines never cross adjacent subfolders
            const subConeHalf = Math.min(angleStep / 2, Math.PI / 4);
            processItems(item.children, item.id, depth + 1, nodeAngle - subConeHalf, nodeAngle + subConeHalf);
          }
        } else {
          // Document Star Node (Staggered Concentric Orbit Radii to Prevent Overlap)
          const { color, glow } = getFileTypeColors(item.type);
          const orbitDist = (parentId === 'root-nucleus' ? 190 + (idx * 28) : 80 + (idx * 22)) * responsiveScale;
          const speed = (0.0038 / Math.sqrt(Math.max(50, orbitDist))) * (idx % 2 === 0 ? 1 : -1);

          nodeList.push({
            id: item.id,
            name: item.name,
            type: item.type as any,
            x: Math.cos(nodeAngle) * orbitDist,
            y: Math.sin(nodeAngle) * orbitDist,
            vx: 0,
            vy: 0,
            radius: item.isFavorite ? 10 : 7,
            color,
            glowColor: glow,
            item,
            parentId,
            isFavorite: item.isFavorite,
            moduleName: item.moduleName,
            orbitRadius: orbitDist,
            orbitAngle: nodeAngle,
            orbitSpeed: speed
          });

          connList.push({
            sourceId: parentId,
            targetId: item.id,
            color: 'rgba(255, 255, 255, 0.15)'
          });
        }
      });
    };

    processItems(mainDir.files, 'root-nucleus', 1, 0, Math.PI * 2);

    return { nodes: nodeList, connections: connList };
  }, [mainDir.name, mainDir.files]);

  // Node Dragging State Refs
  const draggedNodeRef = useRef<GalaxyNode | null>(null);
  const dragNodeOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasDraggedNodeRef = useRef<boolean>(false);

  // Compute Connected Neighbor Node IDs for Smart Hover Highlighting
  const activeNeighborIds = useMemo(() => {
    if (!hoveredNode) return null;
    const set = new Set<string>([hoveredNode.id]);
    connections.forEach(conn => {
      if (conn.sourceId === hoveredNode.id) set.add(conn.targetId);
      if (conn.targetId === hoveredNode.id) set.add(conn.sourceId);
    });
    return set;
  }, [hoveredNode, connections]);

  // Canvas Physics & Minimal Render Loop
  useEffect(() => {
    if (activeTab !== 'galaxy') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const starDust = Array.from({ length: 160 }, () => ({
      x: (Math.random() - 0.5) * 3200,
      y: (Math.random() - 0.5) * 3200,
      size: Math.random() * 1.8 + 0.3,
      alpha: Math.random() * 0.6 + 0.2,
      twinkleSpeed: Math.random() * 0.02 + 0.005
    }));

    const render = () => {
      const parent = canvas.parentElement;
      if (parent) {
        const rect = parent.getBoundingClientRect();
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);
        if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
          canvas.width = width;
          canvas.height = height;
        }
      }

      const width = canvas.width || 800;
      const height = canvas.height || 600;

      ctx.save();
      ctx.clearRect(0, 0, width, height);

      // Always Dark Cosmic Black Canvas Fill for Obsidian Space Brain in every theme
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2 + panOffset.x;
      const centerY = height / 2 + panOffset.y;

      ctx.translate(centerX, centerY);
      ctx.scale(zoomScale, zoomScale);

      // 1. Render Subtle Star Dust
      starDust.forEach(star => {
        star.alpha += Math.sin(Date.now() * star.twinkleSpeed) * 0.006;
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.08, Math.min(0.65, star.alpha))})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // 2. Timed Magnetic Latch Physics (2s File Nodes, 3s Folder Nodes) & Multi-Trigger Detachment
      let closestNode: GalaxyNode | null = null;
      let minDistance = Infinity;

      // Track mouse movement velocity for fast movement detachment
      const mX = mouseWorldPosRef.current ? mouseWorldPosRef.current.x : 0;
      const mY = mouseWorldPosRef.current ? mouseWorldPosRef.current.y : 0;
      const mouseVel = lastMousePosRef.current ? Math.hypot(mX - lastMousePosRef.current.x, mY - lastMousePosRef.current.y) : 0;
      lastMousePosRef.current = { x: mX, y: mY };

      if (mouseWorldPosRef.current) {
        nodes.forEach(node => {
          if (node.id === 'root-nucleus') return;
          const distToMouse = Math.hypot(mX - node.x, mY - node.y);
          if (distToMouse < 65 && distToMouse < minDistance) {
            minDistance = distToMouse;
            closestNode = node;
          }
        });
      }

      // Smooth inertial orbital rotation velocity ramping
      const targetSpeedMult = autoRotate ? 1.0 : 0.0;
      rotationSpeedFactorRef.current += (targetSpeedMult - rotationSpeedFactorRef.current) * 0.05;
      const speedMult = rotationSpeedFactorRef.current;
      const now = Date.now();

      nodes.forEach(node => {
        if (node.id === 'root-nucleus') return;

        if (speedMult > 0.001) {
          node.orbitAngle += node.orbitSpeed * speedMult;
        }

        const parent = nodes.find(n => n.id === node.parentId);
        const px = parent ? parent.x : 0;
        const py = parent ? parent.y : 0;

        let targetX = px + Math.cos(node.orbitAngle) * node.orbitRadius;
        let targetY = py + Math.sin(node.orbitAngle) * node.orbitRadius;

        const isClosest = closestNode && node.id === closestNode.id;
        const distToMouse = mouseWorldPosRef.current ? Math.hypot(mX - node.x, mY - node.y) : Infinity;

        // Timed Magnetic Latch logic (File nodes: 2000ms, Folder nodes: 3000ms)
        const requiredTime = node.type === 'folder' ? 3000 : 2000;

        if (isClosest && !node.isMagnetLocked) {
          if (!node.hoverStartTimestamp) {
            node.hoverStartTimestamp = now;
          }
          const elapsed = now - node.hoverStartTimestamp;
          node.latchProgress = Math.min(1.0, elapsed / requiredTime);

          if (elapsed >= requiredTime) {
            // Attach magnetically after press/hover time threshold reached!
            node.isMagnetLocked = true;
            node.latchProgress = 1.0;
          }
        } else if (!isClosest && !node.isMagnetLocked) {
          node.hoverStartTimestamp = undefined;
          node.latchProgress = 0;
        }

        // Fast mouse movement (> 38px/frame) or extended distance detachment (> 240px)
        if (node.isMagnetLocked) {
          if (distToMouse > 240 || mouseVel > 38) {
            node.isMagnetLocked = false;
            node.hoverStartTimestamp = undefined;
            node.latchProgress = 0;
          }
        }

        if (node.isMagnetLocked || node.isDragged) {
          if (mouseWorldPosRef.current) {
            targetX = mX;
            targetY = mY;
          }
        }

        // Smooth fluid flow interpolation toward orbital target or magnetic pointer
        node.x += (targetX - node.x) * 0.22;
        node.y += (targetY - node.y) * 0.22;
      });

      // Circle Anti-Overlap Boundary Constraint (Guarantees zero node overlap without jitter)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          if (a.id === 'root-nucleus' || b.id === 'root-nucleus') continue;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.1;
          const minDist = a.radius + b.radius + 14; // 14px clear boundary cushion

          if (dist < minDist) {
            const overlap = (minDist - dist) * 0.5;
            const nx = dx / dist;
            const ny = dy / dist;

            if (!a.isMagnetLocked && !a.isDragged) {
              a.x -= nx * overlap;
              a.y -= ny * overlap;
            }
            if (!b.isMagnetLocked && !b.isDragged) {
              b.x += nx * overlap;
              b.y += ny * overlap;
            }
          }
        }
      }


      // 3. Draw Orbit Guide Rings for Folders
      nodes.filter(n => n.type === 'folder' && n.id !== 'root-nucleus').forEach(folder => {
        ctx.strokeStyle = activeNeighborIds && !activeNeighborIds.has(folder.id) ? 'rgba(205, 127, 50, 0.03)' : 'rgba(205, 127, 50, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(folder.x, folder.y, folder.orbitRadius || 180, 0, Math.PI * 2);
        ctx.stroke();
      });

      // 4. Draw Constellation Connections
      connections.forEach(conn => {
        const src = nodes.find(n => n.id === conn.sourceId);
        const tgt = nodes.find(n => n.id === conn.targetId);
        if (!src || !tgt) return;

        const isSearchMatch = dashSearch.trim() && tgt.name.toLowerCase().includes(dashSearch.toLowerCase());
        const isNeighbor = activeNeighborIds ? (activeNeighborIds.has(src.id) && activeNeighborIds.has(tgt.id)) : false;

        let strokeColor = conn.color || 'rgba(129, 140, 248, 0.45)';
        let lineWidth = 1.8;

        if (activeNeighborIds) {
          if (isNeighbor) {
            strokeColor = 'rgba(129, 140, 248, 0.95)';
            lineWidth = 3.0;
          } else {
            strokeColor = 'rgba(255, 255, 255, 0.05)';
          }
        } else if (isSearchMatch) {
          strokeColor = 'rgba(250, 204, 21, 0.95)';
          lineWidth = 2.5;
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.stroke();
      });

      // 5. Draw Realistic Shining Stars with Crown Light Rays
      nodes.forEach(node => {
        const isSearchMatch = dashSearch.trim() && node.name.toLowerCase().includes(dashSearch.toLowerCase());
        const isHovered = hoveredNode?.id === node.id;
        const isSelected = selectedNode?.id === node.id;

        const baseRadius = node.radius * (isHovered || isSelected ? 1.4 : 1.0);
        const nodeColor = isSearchMatch ? '#e6d591' : isSelected ? '#b9aac9' : node.color;
        const nodeGlow = node.glowColor || 'rgba(129, 140, 248, 0.9)';

        // Parse the glow color's RGB for reuse
        const rgbMatch = nodeGlow.match(/[\d.]+/g) || ['129', '140', '248'];
        const [gr, gg, gb] = rgbMatch;

        ctx.globalAlpha = 1.0;

        // --- Layer 1: Wide colored atmospheric haze ---
        const hazeRadius = baseRadius * (isHovered || isSelected ? 6.0 : 4.5);
        const hazeGrad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, hazeRadius);
        hazeGrad.addColorStop(0, `rgba(${gr}, ${gg}, ${gb}, 0.35)`);
        hazeGrad.addColorStop(0.25, `rgba(${gr}, ${gg}, ${gb}, 0.15)`);
        hazeGrad.addColorStop(0.55, `rgba(${gr}, ${gg}, ${gb}, 0.05)`);
        hazeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = hazeGrad;
        ctx.beginPath();
        ctx.arc(node.x, node.y, hazeRadius, 0, Math.PI * 2);
        ctx.fill();

        // --- Layer 2: 6-Point Crown Light Rays ---
        // Alternating long (primary) and short (secondary) rays like a real shining star crown
        const primaryLen = baseRadius * (isHovered || isSelected ? 5.0 : 3.5);
        const secondaryLen = primaryLen * 0.55;
        const rayCount = 6;

        ctx.save();
        ctx.translate(node.x, node.y);

        for (let r = 0; r < rayCount; r++) {
          const isLong = r % 2 === 0; // alternate long/short
          const len = isLong ? primaryLen : secondaryLen;
          const width = isLong ? baseRadius * 0.18 : baseRadius * 0.12;
          const angle = (r * Math.PI) / (rayCount / 2); // evenly spaced

          ctx.save();
          ctx.rotate(angle);

          // Sharp bright core ray (white → star color → transparent)
          const rayGrad = ctx.createLinearGradient(0, 0, len, 0);
          rayGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
          rayGrad.addColorStop(0.08, `rgba(${gr}, ${gg}, ${gb}, 0.6)`);
          rayGrad.addColorStop(0.35, `rgba(${gr}, ${gg}, ${gb}, 0.2)`);
          rayGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.fillStyle = rayGrad;
          ctx.beginPath();
          ctx.moveTo(baseRadius * 0.4, 0);
          ctx.lineTo(len, -0.5);
          ctx.lineTo(len, 0.5);
          ctx.closePath();
          ctx.fill();

          // Soft colored glow halo around each ray
          const softGrad = ctx.createLinearGradient(0, 0, len * 0.65, 0);
          softGrad.addColorStop(0, `rgba(${gr}, ${gg}, ${gb}, 0.3)`);
          softGrad.addColorStop(0.5, `rgba(${gr}, ${gg}, ${gb}, 0.08)`);
          softGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.fillStyle = softGrad;
          ctx.beginPath();
          ctx.moveTo(baseRadius * 0.25, 0);
          ctx.lineTo(len * 0.65, -width);
          ctx.lineTo(len * 0.65, width);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        }
        ctx.restore();

        // --- Layer 3: Bright colored corona bloom ---
        const coronaRadius = baseRadius * 2.2;
        const coronaGrad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, coronaRadius);
        coronaGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        coronaGrad.addColorStop(0.15, `rgba(255, 255, 255, 0.55)`);
        coronaGrad.addColorStop(0.4, `rgba(${gr}, ${gg}, ${gb}, 0.3)`);
        coronaGrad.addColorStop(0.7, `rgba(${gr}, ${gg}, ${gb}, 0.08)`);
        coronaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = coronaGrad;
        ctx.beginPath();
        ctx.arc(node.x, node.y, coronaRadius, 0, Math.PI * 2);
        ctx.fill();

        // --- Layer 4: Spectral core body (white-hot center fading to star color) ---
        const coreGrad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, baseRadius);
        coreGrad.addColorStop(0, '#ffffff');
        coreGrad.addColorStop(0.4, nodeColor);
        coreGrad.addColorStop(1, nodeColor);
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(node.x, node.y, baseRadius, 0, Math.PI * 2);
        ctx.fill();

        // --- Layer 5: Overexposed white-hot nucleus ---
        const nucleusGrad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, baseRadius * 0.45);
        nucleusGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        nucleusGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.7)');
        nucleusGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = nucleusGrad;
        ctx.beginPath();
        ctx.arc(node.x, node.y, baseRadius * 0.45, 0, Math.PI * 2);
        ctx.fill();

        // Favorite Gold Ring
        if (node.isFavorite) {
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(node.x, node.y, baseRadius + 5, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Typography Labels
        const shouldRenderLabel = showLabels || isHovered || isSelected || isSearchMatch;
        if (shouldRenderLabel) {
          ctx.font = isHovered || isSelected ? 'bold 12px Inter, sans-serif' : '11px Inter, sans-serif';
          ctx.fillStyle = isHovered || isSelected ? '#ffffff' : isSearchMatch ? '#facc15' : 'rgba(226, 232, 240, 0.9)';
          ctx.textAlign = 'center';
          ctx.fillText(node.name, node.x, node.y + baseRadius + 16);
        }
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [activeTab, nodes, connections, autoRotate, showLabels, zoomScale, panOffset, hoveredNode, selectedNode, dashSearch, activeNeighborIds]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Release any magnetically locked nodes on click (Left or Right Click Detach)
    nodes.forEach(n => {
      if (n.isMagnetLocked) {
        n.isMagnetLocked = false;
        n.hoverStartTimestamp = undefined;
        n.latchProgress = 0;
      }
    });

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const centerX = canvas.width / 2 + panOffset.x;
    const centerY = canvas.height / 2 + panOffset.y;

    const worldX = (mouseX - centerX) / zoomScale;
    const worldY = (mouseY - centerY) / zoomScale;

    // Check hit test for node dragging
    let hitNode: GalaxyNode | null = null;
    for (const node of nodes) {
      const dist = Math.hypot(worldX - node.x, worldY - node.y);
      if (dist <= node.radius + 12) {
        hitNode = node;
        break;
      }
    }

    if (hitNode) {
      draggedNodeRef.current = hitNode;
      dragNodeOffsetRef.current = { x: hitNode.x - worldX, y: hitNode.y - worldY };
      hitNode.isDragged = true;
      hitNode.isPinned = true;
      hasDraggedNodeRef.current = false;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

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

    const centerX = canvas.width / 2 + panOffset.x;
    const centerY = canvas.height / 2 + panOffset.y;

    const worldX = (mouseX - centerX) / zoomScale;
    const worldY = (mouseY - centerY) / zoomScale;
    mouseWorldPosRef.current = { x: worldX, y: worldY };

    // Interactive Node Dragging (Smooth Grab & Lock in Placed Position)
    if (draggedNodeRef.current) {
      const dx = Math.abs(e.clientX - dragStartRef.current.x);
      const dy = Math.abs(e.clientY - dragStartRef.current.y);
      if (dx > 3 || dy > 3) {
        hasDraggedNodeRef.current = true;
      }
      draggedNodeRef.current.x = worldX + dragNodeOffsetRef.current.x;
      draggedNodeRef.current.y = worldY + dragNodeOffsetRef.current.y;
      draggedNodeRef.current.isPinned = true;
      return;
    }

    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPanOffset({
        x: panStartRef.current.x + dx,
        y: panStartRef.current.y + dy
      });
      return;
    }

    let found: GalaxyNode | null = null;
    for (const node of nodes) {
      const dist = Math.hypot(worldX - node.x, worldY - node.y);
      if (dist <= node.radius + 10) {
        found = node;
        break;
      }
    }
    setHoveredNode(found);
  };

  const handleCanvasMouseUp = () => {
    if (draggedNodeRef.current) {
      draggedNodeRef.current.isDragged = false;
      draggedNodeRef.current = null;
    }
    isDraggingRef.current = false;
  };

  const handleCanvasClick = () => {
    if (hasDraggedNodeRef.current) {
      hasDraggedNodeRef.current = false;
      return; // Prevent opening file if user was dragging node
    }

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
                background: activeTab === 'galaxy' ? '#1d4ed8' : 'transparent',
                color: activeTab === 'galaxy' ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <Globe size={15} style={{ color: activeTab === 'galaxy' ? '#ffffff' : '#60a5fa' }} /> Knowledge Galaxy
            </button>

            <button
              onClick={() => setActiveTab('explorer')}
              style={{
                padding: '8px 15px',
                borderRadius: 10,
                fontSize: '0.82rem',
                fontWeight: 800,
                border: 'none',
                background: activeTab === 'explorer' ? '#1d4ed8' : 'transparent',
                color: activeTab === 'explorer' ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <Layers size={15} style={{ color: activeTab === 'explorer' ? '#ffffff' : '#60a5fa' }} /> Vault Feed
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
            background: '#050508',
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

          {/* Minimalist Top HUD Header */}
          <div style={{
            position: 'absolute',
            top: 16,
            left: 16,
            right: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pointerEvents: 'none'
          }}>
            <div style={{
              background: 'rgba(7, 11, 22, 0.82)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: '#e2e8f0',
              fontSize: '0.76rem',
              fontWeight: 700,
              pointerEvents: 'auto'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c084fc' }}>
                <Zap size={13} /> Vault: <strong style={{ color: '#ffffff' }}>{counts.total} Nodes</strong>
              </span>
              <span style={{ color: 'rgba(255, 255, 255, 0.15)' }}>|</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8' }}>
                <Activity size={13} /> Connections: <strong style={{ color: '#ffffff' }}>{connections.length}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'auto' }}>
              <button
                onClick={() => setAutoRotate(!autoRotate)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 12,
                  background: autoRotate ? 'rgba(59, 130, 246, 0.22)' : 'rgba(7, 11, 22, 0.82)',
                  border: autoRotate ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: autoRotate ? '#60a5fa' : '#94a3b8',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backdropFilter: 'blur(20px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5
                }}
                title="Toggle Auto Orbit Rotation"
              >
                <RotateCcw size={13} /> {autoRotate ? 'Orbit' : 'Paused'}
              </button>

              <button
                onClick={() => setShowLabels(!showLabels)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 12,
                  background: showLabels ? 'rgba(59, 130, 246, 0.22)' : 'rgba(7, 11, 22, 0.82)',
                  border: showLabels ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: showLabels ? '#60a5fa' : '#94a3b8',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backdropFilter: 'blur(20px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5
                }}
                title="Toggle Node Text Labels"
              >
                {showLabels ? <Eye size={13} /> : <EyeOff size={13} />} Labels
              </button>
            </div>
          </div>

          {/* Dedicated Bottom-Left Zoom Adjuster Controls Widget */}
          <div style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            background: 'rgba(7, 11, 22, 0.85)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 14,
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            pointerEvents: 'auto'
          }}>
            <button
              onClick={() => setZoomScale(prev => Math.max(0.4, Math.round((prev - 0.1) * 100) / 100))}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>

            <input
              type="range"
              min={0.4}
              max={2.0}
              step={0.05}
              value={zoomScale}
              onChange={(e) => setZoomScale(parseFloat(e.target.value))}
              style={{ width: 90, accentColor: 'var(--primary)', cursor: 'pointer', height: 4 }}
              title={`Zoom Scale: ${Math.round(zoomScale * 100)}%`}
            />

            <button
              onClick={() => setZoomScale(prev => Math.min(2.0, Math.round((prev + 0.1) * 100) / 100))}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>

            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#e2e8f0', minWidth: 38, textAlign: 'center' }}>
              {Math.round(zoomScale * 100)}%
            </span>

            <button
              onClick={resetView}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 8,
                color: '#ffffff',
                fontSize: '0.70rem',
                fontWeight: 700,
                padding: '3px 8px',
                cursor: 'pointer',
                marginLeft: 2
              }}
              title="Reset Zoom & Fit Nodes On Screen"
            >
              Reset
            </button>
          </div>

          {/* Hovered/Selected Star Minimalist Detail Card */}
          {(hoveredNode || selectedNode) && (hoveredNode?.item || selectedNode?.item) && (
            <div style={{
              position: 'absolute',
              bottom: 20,
              right: 20,
              width: 240,
              background: 'rgba(7, 11, 22, 0.85)',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${(hoveredNode || selectedNode)?.color}`,
              borderRadius: 16,
              padding: '14px 16px',
              color: '#ffffff',
              boxShadow: `0 8px 32px rgba(0, 0, 0, 0.6), 0 0 16px ${(hoveredNode || selectedNode)?.glowColor}`,
              zIndex: 10,
              pointerEvents: 'auto'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: (hoveredNode || selectedNode)?.color, boxShadow: `0 0 8px ${(hoveredNode || selectedNode)?.color}` }} />
                  <span style={{ fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase', color: (hoveredNode || selectedNode)?.color, letterSpacing: '0.06em' }}>
                    {(hoveredNode || selectedNode)?.type.toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const targetFile = hoveredNode?.item || selectedNode?.item;
                    if (targetFile) onToggleFavorite(targetFile.id);
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: (hoveredNode || selectedNode)?.isFavorite ? '#f59e0b' : '#64748b', padding: 0 }}
                  title="Toggle Favorite"
                >
                  <Star size={14} fill={(hoveredNode || selectedNode)?.isFavorite ? '#f59e0b' : 'none'} />
                </button>
              </div>

              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ffffff', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(hoveredNode || selectedNode)?.name}
              </div>

              <div style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Vault Folder:</span>
                <strong style={{ color: '#e2e8f0', fontWeight: 700 }}>{(hoveredNode || selectedNode)?.moduleName || 'Root Vault'}</strong>
              </div>
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
                  <span>Recently Opened Documents ({Math.min(15, filteredFiles.length)})</span>
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

              {/* Feed Card List - Limited strictly to top 15 recent documents */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', flex: 1, paddingRight: 4 }}>
                {filteredFiles.length > 0 ? (
                  filteredFiles.slice(0, 15).map(file => (
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
