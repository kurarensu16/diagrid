import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { diagramService } from '../services/diagramService';
import { useCurrentUser } from '../services/mockAuth';
import { type Diagram, type CanvasNode, type CanvasEdge, type EdgeMarkerType } from '../services/mockDb';
import { type FreehandDrawing, getNodeDimensions } from '../utils/diagramExport';
import { decodeSharePayload } from '../utils/shareUtils';
import { ExportModal } from '../components/canvas/ExportModal';
import { ShareModal } from '../components/canvas/ShareModal';
import { Logo } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Share2,
  Copy,
  Info,
  Sun,
  Moon,
  Grid,
  RotateCcw
} from 'lucide-react';

const getPortCoords = (node: CanvasNode, port: 'top' | 'bottom' | 'left' | 'right') => {
  const { width, height } = getNodeDimensions(node);
  switch (port) {
    case 'top': return { x: node.x + width / 2, y: node.y };
    case 'bottom': return { x: node.x + width / 2, y: node.y + height };
    case 'left': return { x: node.x, y: node.y + height / 2 };
    case 'right': return { x: node.x + width, y: node.y + height / 2 };
  }
};

const getEdgePath = (edge: CanvasEdge, nodesList: CanvasNode[]) => {
  const sourceNode = nodesList.find(n => n.id === edge.source);
  const targetNode = nodesList.find(n => n.id === edge.target);
  if (!sourceNode || !targetNode) return '';

  const start = getPortCoords(sourceNode, edge.sourceHandle || 'right');
  const end = getPortCoords(targetNode, edge.targetHandle || 'left');

  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  if (edge.sourceHandle === 'bottom' && edge.targetHandle === 'top') {
    return `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
  }
  if (edge.sourceHandle === 'top' && edge.targetHandle === 'bottom') {
    return `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
  }
  if ((edge.sourceHandle === 'right' || !edge.sourceHandle) && (edge.targetHandle === 'left' || !edge.targetHandle)) {
    return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
  }
  if (edge.sourceHandle === 'left' && edge.targetHandle === 'right') {
    return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
  }
  return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
};

const getMarkerUrl = (
  markerType: CanvasEdge['sourceMarker'],
  fallbackArrow: CanvasEdge['arrow'],
  isStart: boolean,
  isSelected: boolean
): string => {
  const suffix = isSelected ? '-selected' : '';
  if (markerType) {
    if (markerType === 'none') return '';
    if (markerType === 'arrow') return `url(#arrow${suffix})`;
    return `url(#crows-${markerType}${suffix})`;
  }
  if (fallbackArrow === 'both') return `url(#arrow${suffix})`;
  if (fallbackArrow === 'none') return '';
  if (isStart) return '';
  return `url(#arrow${suffix})`;
};

export const PublicViewer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();

  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [drawings, setDrawings] = useState<FreehandDrawing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Viewport State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [theme, setTheme] = useState<'paper' | 'dark'>('paper');
  const [showGrid, setShowGrid] = useState(true);

  // Modals & Selection
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isForking, setIsForking] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const drawingsRef = useRef(drawings);
  drawingsRef.current = drawings;

  // Center diagram in viewport matching Editor.tsx logic
  const centerDiagramInView = useCallback((targetNodes?: CanvasNode[], targetDrawings?: FreehandDrawing[]) => {
    const effectiveNodes = targetNodes ?? nodesRef.current;
    const effectiveDrawings = targetDrawings ?? drawingsRef.current;
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewportWidth = rect.width > 0 ? rect.width : window.innerWidth;
    const viewportHeight = rect.height > 0 ? rect.height : (window.innerHeight - 56);

    if (effectiveNodes.length === 0 && effectiveDrawings.length === 0) {
      setPan({ x: 100, y: 100 });
      setZoom(1);
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    effectiveNodes.forEach((n) => {
      const dim = getNodeDimensions(n);
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x + dim.width);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y + dim.height);
    });

    effectiveDrawings.forEach((d) => {
      const coords = d.path.match(/[-+]?\d*\.?\d+/g);
      if (coords) {
        for (let i = 0; i < coords.length; i += 2) {
          const x = parseFloat(coords[i]);
          const y = parseFloat(coords[i + 1]);
          if (!isNaN(x) && !isNaN(y)) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      }
    });

    if (minX === Infinity) {
      minX = 0; maxX = 400; minY = 0; maxY = 300;
    }

    const contentWidth = Math.max(maxX - minX, 100);
    const contentHeight = Math.max(maxY - minY, 100);
    const contentCenterX = minX + contentWidth / 2;
    const contentCenterY = minY + contentHeight / 2;

    const padding = 120;
    const scaleX = (viewportWidth - padding) / contentWidth;
    const scaleY = (viewportHeight - padding) / contentHeight;
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.35), 1.25);

    const targetPanX = Math.round(viewportWidth / 2 - contentCenterX * newZoom);
    const targetPanY = Math.round(viewportHeight / 2 - contentCenterY * newZoom);

    console.log('[PublicViewer] Centered diagram:', { viewportWidth, viewportHeight, contentCenterX, contentCenterY, newZoom, targetPanX, targetPanY });

    setZoom(newZoom);
    setPan({ x: targetPanX, y: targetPanY });
  }, []);

  // Load Diagram from Hash or API
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const triggerCenter = (parsedNodes: CanvasNode[], parsedDrawings: FreehandDrawing[]) => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          centerDiagramInView(parsedNodes, parsedDrawings);
        }, 60);
      });
    };

    // 1. Try decoding instant payload from URL hash first
    const hash = window.location.hash;
    if (hash && hash.startsWith('#d=')) {
      const decoded = decodeSharePayload(hash);
      if (decoded && isMounted) {
        const d: Diagram = {
          id: decoded.id || id || 'shared-diagram',
          project_id: 'shared',
          title: decoded.title || 'Shared Diagram',
          type: decoded.type as Diagram['type'],
          content: decoded.content,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        setDiagram(d);
        try {
          const parsed = typeof d.content === 'string' ? JSON.parse(d.content) : d.content;
          const parsedNodes: CanvasNode[] = parsed.nodes || [];
          const parsedEdges: CanvasEdge[] = parsed.edges || [];
          const parsedDrawings: FreehandDrawing[] = parsed.drawings || [];

          console.log('[PublicViewer] Loaded diagram from hash:', { title: d.title, nodes: parsedNodes.length, edges: parsedEdges.length, drawings: parsedDrawings.length });

          setNodes(parsedNodes);
          setEdges(parsedEdges);
          setDrawings(parsedDrawings);
          setIsLoading(false);

          triggerCenter(parsedNodes, parsedDrawings);
          return;
        } catch (e) {
          console.warn('[PublicViewer] Error parsing hash content, falling back to API:', e);
        }
      }
    }

    // 2. Fetch from Database / Storage Service
    if (id) {
      diagramService.getPublicDiagram(id).then((d) => {
        if (!isMounted) return;
        if (d) {
          setDiagram(d);
          try {
            const parsed = typeof d.content === 'string' ? JSON.parse(d.content) : d.content;
            const parsedNodes: CanvasNode[] = parsed.nodes || [];
            const parsedEdges: CanvasEdge[] = parsed.edges || [];
            const parsedDrawings: FreehandDrawing[] = parsed.drawings || [];

            setNodes(parsedNodes);
            setEdges(parsedEdges);
            setDrawings(parsedDrawings);

            triggerCenter(parsedNodes, parsedDrawings);
          } catch (err) {
            console.error('[PublicViewer] Error parsing diagram content:', err);
            setError('Failed to parse diagram schema data.');
          }
        } else {
          setError('Diagram not found or link has expired.');
        }
        setIsLoading(false);
      });
    } else {
      setError('No diagram ID provided.');
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Window resize observer
  useEffect(() => {
    const handleResize = () => {
      centerDiagramInView();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [centerDiagramInView]);

  // Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Wheel Zoom & 2D Pan
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Pinch / Ctrl-Wheel Zoom
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.2), 3);

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
        const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

        setZoom(newZoom);
        setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
      } else {
        setZoom(newZoom);
      }
    } else {
      // 2D Scroll
      let deltaX = e.deltaX;
      let deltaY = e.deltaY;
      if (e.shiftKey && deltaX === 0) {
        deltaX = deltaY;
        deltaY = 0;
      }
      setPan(prev => ({
        x: Math.round(prev.x - deltaX),
        y: Math.round(prev.y - deltaY)
      }));
    }
  };

  // Handle Fork / Clone
  const handleCloneDiagram = async () => {
    if (!diagram) return;
    setIsForking(true);
    try {
      if (!currentUser) {
        const payload = JSON.stringify({ nodes, edges, drawings });
        sessionStorage.setItem('diagrid_clone_diagram', JSON.stringify({
          title: `${diagram.title} (Fork)`,
          type: diagram.type,
          content: payload
        }));
        navigate('/auth');
        return;
      }

      const projects = await diagramService.getProjects();
      const targetProjectId = projects.length > 0 ? projects[0].id : 'default';
      const cloned = await diagramService.createDiagram({
        project_id: targetProjectId,
        title: `${diagram.title} (Fork)`,
        type: diagram.type,
        content: JSON.stringify({ nodes, edges, drawings })
      });
      navigate(`/editor/${cloned.id}`);
    } catch (err) {
      console.error('Failed to fork diagram:', err);
    } finally {
      setIsForking(false);
    }
  };

  const activeSelectedNode = useMemo(() => {
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const isDark = theme === 'dark';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center font-mono text-[13px] text-ink-muted">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blueprint border-t-transparent rounded-full animate-spin"></div>
          <span className="font-bold text-ink">loading_blueprint_specification...</span>
        </div>
      </div>
    );
  }

  if (error || !diagram) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center font-mono p-6">
        <div className="max-w-md w-full p-8 border-2 border-ink bg-paper-raised shadow-hard-ink text-center flex flex-col gap-4">
          <Logo variant="ink" size="md" />
          <div className="text-signal font-bold text-[14px]">404 // DIAGRAM_NOT_FOUND</div>
          <p className="text-ink-soft text-[12px] leading-relaxed">
            {error || 'This diagram does not exist or may have been deleted by its author.'}
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link to="/">
              <Button variant="primary" className="text-[12px] px-4 py-2">
                Return to Diagrid
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col ${isDark ? 'bg-[#15191C] text-paper' : 'bg-paper text-ink'} select-none overflow-hidden`}>
      {/* Top Read-Only Navigation Bar */}
      <header className={`h-14 border-b-2 border-ink px-4 sm:px-6 flex items-center justify-between font-mono shrink-0 z-20 shadow-sm ${isDark ? 'bg-[#101417]' : 'bg-[#15191C] text-paper'}`}>
        <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Logo variant="paper" size="sm" />
          </Link>

          <div className="h-4 w-[1px] bg-[#333C42] hidden sm:block" />

          <div className="flex items-center gap-2 truncate">
            <span className="font-bold text-white text-[13.5px] sm:text-[14px] truncate">
              {diagram.title}
            </span>
            <span className="px-1.5 py-0.5 text-[9.5px] uppercase font-bold bg-blueprint/20 text-blueprint border border-blueprint shrink-0">
              {diagram.type}
            </span>
            <span className="text-[#8B98A0] text-[11px] hidden md:inline">
              // View-Only
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3 text-[12px]">
          {/* Share Button */}
          <button
            type="button"
            onClick={() => setIsShareOpen(true)}
            className="px-2.5 py-1.5 border border-[#333C42] hover:border-paper bg-transparent text-paper hover:bg-paper hover:text-ink transition-colors cursor-pointer flex items-center gap-1.5"
            title="Share & Embed"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>

          {/* Export Button */}
          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="px-2.5 py-1.5 border border-[#333C42] hover:border-paper bg-transparent text-paper hover:bg-paper hover:text-ink transition-colors cursor-pointer flex items-center gap-1.5"
            title="Export PNG, SVG, PDF, or Mermaid"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Clone / Open in Diagrid */}
          <Button
            variant="primary"
            onClick={handleCloneDiagram}
            disabled={isForking}
            className="py-1.5 px-3 text-[11.5px] flex items-center gap-1.5 font-bold shadow-hard-ink"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{currentUser ? 'Fork to Workspace' : 'Open in Diagrid'}</span>
          </Button>
        </div>
      </header>

      {/* Main Interactive Canvas Area */}
      <main className="flex-1 relative overflow-hidden flex min-h-0">
        {/* Canvas Viewport Container */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onClick={() => setSelectedNodeId(null)}
          className={`flex-1 w-full h-full relative overflow-hidden cursor-grab active:cursor-grabbing ${
            isDark ? 'bg-[#15191C]' : 'bg-[#F6F7F5]'
          }`}
        >
          {/* Blueprint Grid Background Pattern */}
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: isDark
                  ? 'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)'
                  : 'radial-gradient(rgba(21, 25, 28, 0.12) 1px, transparent 1px)',
                backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                backgroundPosition: `${pan.x}px ${pan.y}px`
              }}
            />
          )}

          {/* Transformed Stage Viewport */}
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
            className="absolute inset-0 pointer-events-none"
          >
            {/* SVG Connector & Drawing Layer */}
            <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-auto overflow-visible">
              <defs>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={isDark ? '#E1E5E3' : '#15191C'} />
                </marker>
                <marker
                  id="arrow-selected"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#1E5C8C" />
                </marker>

                {/* Crow's Foot: One (|) */}
                <marker
                  id="crows-one"
                  viewBox="0 0 16 16"
                  refX="16"
                  refY="8"
                  markerWidth="16"
                  markerHeight="16"
                  orient="auto-start-reverse"
                >
                  <line x1="0" y1="8" x2="16" y2="8" stroke={isDark ? '#E1E5E3' : '#15191C'} strokeWidth="1.5" />
                  <line x1="12" y1="2" x2="12" y2="14" stroke={isDark ? '#E1E5E3' : '#15191C'} strokeWidth="1.5" strokeLinecap="round" />
                </marker>

                {/* Crow's Foot: One and only one (||) */}
                <marker
                  id="crows-one-only"
                  viewBox="0 0 16 16"
                  refX="16"
                  refY="8"
                  markerWidth="16"
                  markerHeight="16"
                  orient="auto-start-reverse"
                >
                  <line x1="0" y1="8" x2="16" y2="8" stroke={isDark ? '#E1E5E3' : '#15191C'} strokeWidth="1.5" />
                  <line x1="7" y1="2" x2="7" y2="14" stroke={isDark ? '#E1E5E3' : '#15191C'} strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="12" y1="2" x2="12" y2="14" stroke={isDark ? '#E1E5E3' : '#15191C'} strokeWidth="1.5" strokeLinecap="round" />
                </marker>

                {/* Crow's Foot: Zero or One (o|) */}
                <marker
                  id="crows-zero-one"
                  viewBox="0 0 16 16"
                  refX="16"
                  refY="8"
                  markerWidth="16"
                  markerHeight="16"
                  orient="auto-start-reverse"
                >
                  <line x1="0" y1="8" x2="16" y2="8" stroke={isDark ? '#E1E5E3' : '#15191C'} strokeWidth="1.5" />
                  <circle cx="10" cy="8" r="3.75" fill={isDark ? '#1C2226' : '#FFFFFF'} stroke={isDark ? '#E1E5E3' : '#15191C'} strokeWidth="1.5" />
                </marker>

                {/* Crow's Foot: Many (3-prong fork) */}
                <marker
                  id="crows-many"
                  viewBox="0 0 16 16"
                  refX="16"
                  refY="8"
                  markerWidth="16"
                  markerHeight="16"
                  orient="auto-start-reverse"
                >
                  <line x1="0" y1="8" x2="16" y2="8" stroke={isDark ? '#E1E5E3' : '#15191C'} strokeWidth="1.5" />
                  <line x1="5" y1="8" x2="15.5" y2="2" stroke={isDark ? '#E1E5E3' : '#15191C'} strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="5" y1="8" x2="15.5" y2="14" stroke={isDark ? '#E1E5E3' : '#15191C'} strokeWidth="1.5" strokeLinecap="round" />
                </marker>

                {/* Crow's Foot: One or Many (|{) */}
                <marker
                  id="crows-one-many"
                  viewBox="0 0 16 16"
                  refX="16"
                  refY="8"
                  markerWidth="16"
                  markerHeight="16"
                  orient="auto-start-reverse"
                >
                  <line x1="0" y1="8" x2="16" y2="8" stroke={isDark ? '#E1E5E3' : '#15191C'} strokeWidth="1.5" />
                  <line x1="4" y1="2" x2="4" y2="14" stroke={isDark ? '#E1E5E3' : '#15191C'} strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="5" y1="8" x2="15.5" y2="2" stroke={isDark ? '#E1E5E3' : '#15191C'} strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="5" y1="8" x2="15.5" y2="14" stroke={isDark ? '#E1E5E3' : '#15191C'} strokeWidth="1.5" strokeLinecap="round" />
                </marker>

                {/* Crow's Foot: Zero or Many (o{) */}
                <marker
                  id="crows-zero-many"
                  viewBox="0 0 16 16"
                  refX="16"
                  refY="8"
                  markerWidth="16"
                  markerHeight="16"
                  orient="auto-start-reverse"
                >
                  <line x1="0" y1="8" x2="16" y2="8" stroke={isDark ? '#E1E5E3' : '#15191C'} strokeWidth="1.5" />
                  <circle cx="4" cy="8" r="3" fill={isDark ? '#1C2226' : '#FFFFFF'} stroke={isDark ? '#E1E5E3' : '#15191C'} strokeWidth="1.5" />
                  <line x1="7" y1="8" x2="15.5" y2="2" stroke={isDark ? '#E1E5E3' : '#15191C'} strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="7" y1="8" x2="15.5" y2="14" stroke={isDark ? '#E1E5E3' : '#15191C'} strokeWidth="1.5" strokeLinecap="round" />
                </marker>
              </defs>

              {/* Freehand Pencil Drawings */}
              {drawings.map((draw) => (
                <path
                  key={draw.id}
                  d={draw.path}
                  fill="none"
                  stroke={draw.color || '#D45B33'}
                  strokeWidth={draw.width || 2}
                  strokeOpacity={draw.opacity ?? 1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="pointer-events-none"
                />
              ))}

              {/* Connector Edges */}
              {edges.map((edge) => {
                const path = getEdgePath(edge, nodes);
                if (!path) return null;

                const srcNode = nodes.find(n => n.id === edge.source);
                const tgtNode = nodes.find(n => n.id === edge.target);
                let labelX = 0;
                let labelY = 0;
                if (srcNode && tgtNode) {
                  const start = getPortCoords(srcNode, edge.sourceHandle || 'right');
                  const end = getPortCoords(tgtNode, edge.targetHandle || 'left');
                  labelX = (start.x + end.x) / 2;
                  labelY = (start.y + end.y) / 2 - 8;
                }

                const markerStartUrl = getMarkerUrl(edge.sourceMarker, edge.arrow, true, false);
                const markerEndUrl = getMarkerUrl(edge.targetMarker, edge.arrow, false, false);

                return (
                  <g key={edge.id} className="pointer-events-none">
                    <path
                      d={path}
                      fill="none"
                      stroke={isDark ? '#E1E5E3' : '#15191C'}
                      strokeWidth="1.5"
                      strokeDasharray={edge.style === 'dashed' ? '5 5' : undefined}
                      markerStart={markerStartUrl}
                      markerEnd={markerEndUrl}
                    />
                    {edge.label && (
                      <g className="pointer-events-none">
                        <rect
                          x={labelX - (edge.label.length * 3.5 + 8)}
                          y={labelY - 9}
                          width={edge.label.length * 7 + 16}
                          height="18"
                          fill={isDark ? '#1C2226' : '#FFFFFF'}
                          stroke={isDark ? '#E1E5E3' : '#15191C'}
                          strokeWidth="1.5"
                          rx="2"
                        />
                        <text
                          x={labelX}
                          y={labelY + 3.5}
                          fill={isDark ? '#FFFFFF' : '#15191C'}
                          className="font-mono text-[10px] font-bold select-none text-center"
                          textAnchor="middle"
                        >
                          {edge.label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Interactive Canvas Nodes Layer */}
            {nodes.map((node) => {
              const { width, height } = getNodeDimensions(node);
              const isSelected = selectedNodeId === node.id;
              const isDiamond = node.type === 'decision' || node.type === 'activity-decision';

              // Shadow calculation
              let customBoxShadow = '3px 3px 0px 0px #15191C';
              if (node.shadowAccent === 'none') {
                customBoxShadow = 'none';
              } else if (node.shadowAccent) {
                customBoxShadow = `3px 3px 0px 0px ${node.shadowAccent}`;
              }

              // Shape specific classes
              let shapeClasses = isDark
                ? "bg-[#1C2226] text-white border-2 border-[#E1E5E3] flex items-center justify-center text-center p-2"
                : "bg-paper-raised text-ink border-2 border-ink flex items-center justify-center text-center p-2";

              if (node.type === 'terminal') {
                shapeClasses = isDark
                  ? "bg-[#1C2226] text-white border-2 border-[#E1E5E3] rounded-full flex items-center justify-center text-center px-4"
                  : "bg-paper-raised text-ink border-2 border-ink rounded-full flex items-center justify-center text-center px-4";
              } else if (node.type === 'table') {
                shapeClasses = isDark
                  ? "bg-[#1C2226] text-white border-2 border-[#E1E5E3] flex flex-col p-0 text-left items-stretch"
                  : "bg-paper-raised text-ink border-2 border-ink flex flex-col p-0 text-left items-stretch";
              } else if (node.type === 'text') {
                shapeClasses = "bg-transparent text-ink border-0 flex items-center justify-center p-1";
                customBoxShadow = 'none';
              } else if (isDiamond) {
                shapeClasses = "bg-transparent border-0 p-0 flex items-center justify-center";
                customBoxShadow = 'none';
              } else if (node.type === 'dfd-store') {
                shapeClasses = isDark
                  ? "bg-[#1C2226] text-white border-y-2 border-x-0 border-[#E1E5E3] flex items-center justify-center text-center px-3"
                  : "bg-paper-raised text-ink border-y-2 border-x-0 border-ink flex items-center justify-center text-center px-3";
              } else if (node.type === 'usecase-boundary') {
                shapeClasses = "bg-transparent border-2 border-dashed border-blueprint flex flex-col p-3 text-left";
                customBoxShadow = 'none';
              }

              const fontSizeClass = node.fontSize === 'sm' ? 'text-[11px]' : node.fontSize === 'lg' ? 'text-[15px]' : 'text-[12.5px]';
              const textStyleObj: React.CSSProperties = {
                fontSize: node.customFontSize ? `${node.customFontSize}px` : undefined,
                fontWeight: node.isBold === false ? 'normal' : 'bold',
                textAlign: node.textAlign || 'center',
              };

              return (
                <div
                  key={node.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId(node.id === selectedNodeId ? null : node.id);
                  }}
                  style={{
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${width}px`,
                    height: `${height}px`,
                    backgroundColor: node.fillColor && !isDiamond && node.type !== 'usecase-actor' ? (node.fillColor === 'transparent' ? 'transparent' : node.fillColor) : undefined,
                    boxShadow: customBoxShadow || undefined,
                  }}
                  className={`absolute pointer-events-auto select-none cursor-pointer transition-shadow hover:brightness-105 ${shapeClasses} ${
                    isSelected ? '!ring-2 !ring-blueprint !ring-offset-2' : ''
                  }`}
                >
                  {/* Shape Renderers */}
                  {isDiamond ? (
                    <div className="relative w-full h-full flex items-center justify-center pointer-events-none select-none">
                      <svg
                        className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
                        viewBox={`0 0 ${width} ${height}`}
                      >
                        {node.shadowAccent !== 'none' && (
                          <polygon
                            points={`${width / 2 + 3},3 ${width + 3},${height / 2 + 3} ${width / 2 + 3},${height + 3} 3,${height / 2 + 3}`}
                            fill={node.shadowAccent || (isDark ? '#000000' : '#15191C')}
                          />
                        )}
                        <polygon
                          points={`${width / 2},0 ${width},${height / 2} ${width / 2},${height} 0,${height / 2}`}
                          fill={node.fillColor && node.fillColor !== 'transparent' ? node.fillColor : (isDark ? '#1C2226' : '#FFFFFF')}
                          stroke={isDark ? '#E1E5E3' : '#15191C'}
                          strokeWidth="2"
                        />
                      </svg>
                      <div
                        className={`relative z-10 font-mono ${fontSizeClass} px-2.5 leading-tight ${isDark ? 'text-white' : 'text-ink'} max-w-[80px] break-words select-none text-center`}
                        style={textStyleObj}
                      >
                        {node.label}
                      </div>
                    </div>
                  ) : node.type === 'table' ? (
                    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
                      {/* Colored Header Banner */}
                      <div
                        className="py-1.5 px-3 border-b-2 border-ink font-mono font-bold text-white uppercase select-none truncate text-center tracking-wider shrink-0"
                        style={{
                          backgroundColor: (node.shadowAccent && node.shadowAccent !== 'none' && node.shadowAccent.startsWith('#'))
                            ? node.shadowAccent
                            : '#1E5C8C',
                          ...textStyleObj
                        }}
                      >
                        {node.label}
                      </div>
                      {/* Table Fields Body */}
                      <div className="flex-1 p-2.5 flex flex-col gap-1.5 select-none font-mono text-[11px]">
                        {(node.fields || []).map((f, idx) => {
                          const parts = f.split(' ');
                          const fieldName = parts[0] || '';
                          const fieldType = parts.slice(1).join(' ') || '';
                          const isPk = f.toLowerCase().includes('pk');
                          const isFk = f.toLowerCase().includes('fk');
                          const rawType = fieldType.replace(/\b(pk|fk)\b/gi, '').trim();
                          return (
                            <div key={idx} className={`flex justify-between items-center gap-2 border-b border-dashed ${isDark ? 'border-[#333C42]' : 'border-line'} last:border-0 pb-1`}>
                              <span className={`font-bold truncate ${isDark ? 'text-white' : 'text-ink'}`}>{fieldName}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {rawType && <span className={`${isDark ? 'text-[#9BA3A9]' : 'text-ink-soft'} text-[10px]`}>{rawType}</span>}
                                {isPk && (
                                  <span className="px-1 py-0.5 text-[8px] font-bold bg-blueprint text-white rounded-[2px] leading-none uppercase">
                                    PK
                                  </span>
                                )}
                                {isFk && (
                                  <span className="px-1 py-0.5 text-[8px] font-bold border border-blueprint text-blueprint rounded-[2px] leading-none uppercase">
                                    FK
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : node.type === 'usecase-actor' ? (
                    <div className="flex flex-col items-center justify-center w-full h-full select-none">
                      <svg className={`w-8 h-12 ${isDark ? 'stroke-white' : 'stroke-ink'} fill-none`} strokeWidth="1.5" viewBox="0 0 24 36">
                        <circle cx="12" cy="6" r="4" />
                        <line x1="12" y1="10" x2="12" y2="22" />
                        <line x1="4" y1="14" x2="20" y2="14" />
                        <line x1="12" y1="22" x2="6" y2="32" />
                        <line x1="12" y1="22" x2="18" y2="32" />
                      </svg>
                      <div
                        className={`font-mono ${fontSizeClass} pt-1 select-none truncate w-full leading-tight text-center`}
                        style={textStyleObj}
                      >
                        {node.label}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`font-mono ${fontSizeClass} select-none w-full truncate leading-normal px-2`}
                      style={textStyleObj}
                    >
                      {node.label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating Node Details HUD */}
        {activeSelectedNode && (
          <aside className={`absolute top-4 right-4 w-72 border-2 border-ink font-mono shadow-hard-ink z-20 ${isDark ? 'bg-[#101417]' : 'bg-paper'}`}>
            <div className="h-10 border-b-2 border-ink bg-ink text-paper px-3 flex items-center justify-between">
              <span className="font-bold text-[12px] flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blueprint" />
                Shape Details
              </span>
              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className="text-[10px] text-paper-muted hover:text-white cursor-pointer"
              >
                esc
              </button>
            </div>

            <div className="p-3 flex flex-col gap-2.5 text-[11px]">
              <div>
                <span className="text-ink-soft text-[10px]">LABEL</span>
                <div className="font-bold text-ink text-[12px]">{activeSelectedNode.label}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-line pt-2">
                <div>
                  <span className="text-ink-soft">TYPE:</span>
                  <div className="font-bold text-blueprint uppercase">{activeSelectedNode.type}</div>
                </div>
                <div>
                  <span className="text-ink-soft">POSITION:</span>
                  <div className="font-bold text-ink">X {activeSelectedNode.x}, Y {activeSelectedNode.y}</div>
                </div>
              </div>

              {activeSelectedNode.fields && activeSelectedNode.fields.length > 0 && (
                <div className="border-t border-line pt-2 flex flex-col gap-1">
                  <span className="text-ink-soft text-[10px]">SCHEMA COLUMNS ({activeSelectedNode.fields.length})</span>
                  <div className="max-h-36 overflow-y-auto flex flex-col gap-1 bg-paper-raised p-1.5 border border-line">
                    {activeSelectedNode.fields.map((f, i) => (
                      <div key={i} className="text-[10px] flex justify-between font-mono">
                        <span className="font-bold text-ink">{f.split(' ')[0]}</span>
                        <span className="text-ink-soft">{f.split(' ').slice(1).join(' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Bottom Floating Control Bar */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 border-2 border-ink bg-paper shadow-hard-ink px-3 py-2 flex items-center gap-2 sm:gap-3 font-mono text-[12px] z-20">
          <button
            type="button"
            onClick={() => setZoom(z => Math.min(z * 1.2, 3))}
            className="p-1 hover:bg-paper-raised border border-transparent hover:border-ink transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <span className="text-[11px] font-bold text-ink min-w-[42px] text-center">
            {Math.round(zoom * 100)}%
          </span>

          <button
            type="button"
            onClick={() => setZoom(z => Math.max(z / 1.2, 0.2))}
            className="p-1 hover:bg-paper-raised border border-transparent hover:border-ink transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-line" />

          <button
            type="button"
            onClick={() => centerDiagramInView()}
            className="p-1 hover:bg-paper-raised border border-transparent hover:border-ink transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
            title="Fit Diagram to Viewport"
          >
            <Maximize2 className="w-3.5 h-3.5 text-blueprint" />
            <span className="hidden sm:inline">Fit</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setZoom(1);
              centerDiagramInView();
            }}
            className="p-1 hover:bg-paper-raised border border-transparent hover:border-ink transition-colors cursor-pointer"
            title="Reset Zoom & Center"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-[1px] bg-line" />

          <button
            type="button"
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1 border transition-colors cursor-pointer ${showGrid ? 'border-blueprint text-blueprint bg-blueprint/10' : 'border-transparent text-ink-soft'}`}
            title="Toggle Grid"
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setTheme(t => t === 'paper' ? 'dark' : 'paper')}
            className="p-1 hover:bg-paper-raised border border-transparent hover:border-ink transition-colors cursor-pointer"
            title="Switch Dark / Light Theme"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-yellow-400" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </main>

      {/* Export Modal */}
      {diagram && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          diagram={diagram}
          nodes={nodes}
          edges={edges}
          drawings={drawings}
        />
      )}

      {/* Share & Embed Modal */}
      {diagram && (
        <ShareModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          diagram={diagram}
          nodes={nodes}
          edges={edges}
          drawings={drawings}
        />
      )}
    </div>
  );
};
