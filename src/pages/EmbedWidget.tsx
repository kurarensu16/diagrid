import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { diagramService } from '../services/diagramService';
import { type Diagram, type CanvasNode, type CanvasEdge } from '../services/mockDb';
import { type FreehandDrawing, getNodeDimensions } from '../utils/diagramExport';
import { decodeSharePayload } from '../utils/shareUtils';
import { getPortCoords, calculateEdgePath } from '../utils/edgeRouting';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  ExternalLink
} from 'lucide-react';

const getMarkerUrl = (
  markerType: CanvasEdge['sourceMarker'],
  fallbackArrow: CanvasEdge['arrow'],
  isStart: boolean
): string => {
  if (markerType) {
    if (markerType === 'none') return '';
    if (markerType === 'arrow') return 'url(#arrow-embed)';
    return `url(#crows-${markerType}-embed)`;
  }
  if (fallbackArrow === 'both') return 'url(#arrow-embed)';
  if (fallbackArrow === 'none') return '';
  if (isStart) return '';
  return 'url(#arrow-embed)';
};

export const EmbedWidget: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  const themeParam = searchParams.get('theme') || 'paper';
  const showGridParam = searchParams.get('grid') !== 'false';
  const showControlsParam = searchParams.get('controls') !== 'false';

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
    const viewportHeight = rect.height > 0 ? rect.height : window.innerHeight;

    if (effectiveNodes.length === 0 && effectiveDrawings.length === 0) {
      setPan({ x: 50, y: 50 });
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

    const padding = 60;
    const scaleX = (viewportWidth - padding) / contentWidth;
    const scaleY = (viewportHeight - padding) / contentHeight;
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.3), 1.5);

    const targetPanX = Math.round(viewportWidth / 2 - contentCenterX * newZoom);
    const targetPanY = Math.round(viewportHeight / 2 - contentCenterY * newZoom);

    setZoom(newZoom);
    setPan({ x: targetPanX, y: targetPanY });
  }, []);

  // Load Diagram
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
          id: decoded.id || id || 'embed-diagram',
          project_id: 'shared',
          title: decoded.title || 'Embedded Diagram',
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

          setNodes(parsedNodes);
          setEdges(parsedEdges);
          setDrawings(parsedDrawings);
          setIsLoading(false);

          triggerCenter(parsedNodes, parsedDrawings);
          return;
        } catch (e) {
          console.warn('[EmbedWidget] Error parsing hash content:', e);
        }
      }
    }

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
            console.error('[EmbedWidget] Failed to parse embed diagram content:', err);
            setError('Failed to parse diagram.');
          }
        } else {
          setError('Diagram not found.');
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

  // Resize listener
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

  const isDark = themeParam === 'dark';
  const isWhite = themeParam === 'white';
  const isTransparent = themeParam === 'transparent';

  let bgClass = 'bg-[#F6F7F5] text-ink';
  if (isDark) bgClass = 'bg-[#15191C] text-paper';
  else if (isWhite) bgClass = 'bg-white text-ink';
  else if (isTransparent) bgClass = 'bg-transparent text-ink';

  if (isLoading) {
    return (
      <div className={`w-full h-screen ${bgClass} flex items-center justify-center font-mono text-[11px]`}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blueprint border-t-transparent rounded-full animate-spin"></div>
          <span>loading_diagram...</span>
        </div>
      </div>
    );
  }

  if (error || !diagram) {
    return (
      <div className={`w-full h-screen ${bgClass} flex flex-col items-center justify-center font-mono p-4 text-center`}>
        <div className="text-[12px] font-bold text-signal mb-1">diagrid // diagram_not_found</div>
        <div className="text-[10px] text-ink-soft mb-3">{error || 'Unable to load diagram embed.'}</div>
        <a
          href={window.location.origin}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-bold text-blueprint underline"
        >
          diagrid.app
        </a>
      </div>
    );
  }

  return (
    <div className={`w-full h-screen relative overflow-hidden select-none font-mono ${bgClass}`}>
      {/* Canvas Viewport Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full relative overflow-hidden cursor-grab active:cursor-grabbing"
      >
        {/* Blueprint Grid Background Pattern */}
        {showGridParam && !isTransparent && (
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
                id="arrow-embed"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={isDark ? '#E1E5E3' : '#15191C'} />
              </marker>

              {/* Crow's Foot: One (|) */}
              <marker
                id="crows-one-embed"
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
                id="crows-one-only-embed"
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
                id="crows-zero-one-embed"
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
                id="crows-many-embed"
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
                id="crows-one-many-embed"
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
                id="crows-zero-many-embed"
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

            {/* Render sequence diagram lifelines */}
            {diagram.type === 'sequence' && nodes
              .filter(node => node.type !== 'sequence-activation')
              .map(node => {
                const { width, height } = getNodeDimensions(node);
                const startX = node.x + width / 2;
                const startY = node.y + height;
                const endY = startY + 600;
                return (
                  <line
                    key={`lifeline-${node.id}`}
                    x1={startX}
                    y1={startY}
                    x2={startX}
                    y2={endY}
                    stroke={isDark ? '#8B98A0' : '#8B98A0'}
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                );
              })}

            {/* Freehand Drawings */}
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
              const path = calculateEdgePath(edge, nodes);
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

              const markerStartUrl = getMarkerUrl(edge.sourceMarker, edge.arrow, true);
              const markerEndUrl = getMarkerUrl(edge.targetMarker, edge.arrow, false);

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

          {/* Canvas Nodes Layer */}
          <div className="absolute inset-0 pointer-events-none">
            {nodes.map((node) => {
              const { width, height } = getNodeDimensions(node);
              const isDiamond = node.type === 'decision' || node.type === 'activity-decision';

              const colorVal = node.width || 1;
              const applyShadow = !isDiamond && node.type !== 'usecase-actor' && node.type !== 'activity-start' && node.type !== 'activity-end' && node.type !== 'activity-fork';

              let customBoxShadow = '';
              if (applyShadow) {
                if (node.shadowAccent === 'none') {
                  customBoxShadow = 'none';
                } else if (node.shadowAccent) {
                  customBoxShadow = `3px 3px 0px 0px ${node.shadowAccent}`;
                } else {
                  customBoxShadow = colorVal === 1 ? '3px 3px 0px 0px #1E5C8C' : colorVal === 2 ? '3px 3px 0px 0px #D45B33' : '3px 3px 0px 0px #15191C';
                }
              }

              const nodeBorderStyle = node.borderStyle || (node.type === 'text' ? 'none' : node.type === 'usecase-boundary' ? 'dashed' : 'solid');
              const nodeBorderWidth = nodeBorderStyle === 'none' ? '0px' : (node.borderWidth ? `${node.borderWidth}px` : (node.type === 'activity-end' ? '2.5px' : '1.5px'));
              const effectiveFontSize = node.customFontSize || (node.fontSize === 'sm' ? 11 : node.fontSize === 'lg' ? 16 : 13);
              const textStyleObj: React.CSSProperties = { fontSize: `${effectiveFontSize}px` };
              const textClass = `${node.textAlign === 'left' ? 'text-left' : node.textAlign === 'right' ? 'text-right' : 'text-center'} ${node.isBold === false ? 'font-normal' : 'font-bold'}`;

              let shapeClasses = isDark
                ? "bg-[#1C2226] text-white border-[#E1E5E3] flex flex-col justify-between p-4"
                : "bg-paper-raised text-ink border-ink flex flex-col justify-between p-4";

              if (isDiamond) {
                shapeClasses = "bg-transparent border-0 flex items-center justify-center p-0 relative shadow-none";
              } else if (node.type === 'text') {
                shapeClasses = "bg-transparent flex items-center justify-center p-2";
              } else if (node.type === 'table') {
                shapeClasses = isDark ? "border-[#E1E5E3] bg-[#1C2226] flex flex-col p-0" : "border-ink bg-paper-raised flex flex-col p-0";
              } else if (node.type === 'terminal') {
                shapeClasses = isDark
                  ? "rounded-[20px] bg-[#1C2226] text-white border-[#E1E5E3] flex items-center justify-center p-2"
                  : "rounded-[20px] bg-paper-raised text-ink border-ink flex items-center justify-center p-2";
              } else if (node.type === 'dfd-store') {
                shapeClasses = isDark
                  ? "border-y border-x-0 border-[#E1E5E3] bg-[#1C2226] flex flex-col justify-center p-2"
                  : "border-y border-x-0 border-ink bg-paper-raised flex flex-col justify-center p-2";
              } else if (node.type === 'dfd-entity') {
                shapeClasses = isDark
                  ? "border-[#E1E5E3] bg-[#1C2226] flex flex-col justify-between p-4 relative"
                  : "border-ink bg-paper-raised flex flex-col justify-between p-4 relative";
              } else if (node.type === 'dfd-process') {
                shapeClasses = isDark
                  ? "border-[#E1E5E3] bg-[#1C2226] flex flex-col p-0"
                  : "border-ink bg-paper-raised flex flex-col p-0";
              } else if (node.type === 'usecase-actor') {
                shapeClasses = "flex flex-col items-center justify-center p-1 bg-transparent border-0 select-none shadow-none";
              } else if (node.type === 'usecase-oval') {
                shapeClasses = isDark
                  ? "rounded-[50%] bg-[#1C2226] text-white border-[#E1E5E3] flex items-center justify-center p-3 text-center"
                  : "rounded-[50%] bg-paper-raised text-ink border-ink flex items-center justify-center p-3 text-center";
              } else if (node.type === 'usecase-boundary') {
                shapeClasses = isDark
                  ? "border-dashed border-[#333C42] bg-[#15191C] bg-opacity-40 flex flex-col justify-start p-3"
                  : "border-dashed border-ink bg-paper bg-opacity-20 flex flex-col justify-start p-3";
              } else if (node.type === 'sequence-activation') {
                shapeClasses = isDark ? "border-[#E1E5E3] bg-[#1C2226] flex items-center justify-center p-0" : "border-ink bg-paper-raised flex items-center justify-center p-0";
              } else if (node.type === 'activity-start') {
                shapeClasses = `rounded-full ${isDark ? 'bg-white' : 'bg-ink'} flex items-center justify-center p-0 border-0`;
              } else if (node.type === 'activity-end') {
                shapeClasses = isDark ? "rounded-full bg-transparent border-[#E1E5E3] flex items-center justify-center p-0" : "rounded-full bg-transparent border-ink flex items-center justify-center p-0";
              } else if (node.type === 'activity-action') {
                shapeClasses = isDark
                  ? "rounded-xl bg-[#1C2226] text-white border-[#E1E5E3] flex items-center justify-center p-2"
                  : "rounded-xl bg-paper-raised text-ink border-ink flex items-center justify-center p-2";
              } else if (node.type === 'activity-fork') {
                shapeClasses = `${isDark ? 'bg-white' : 'bg-ink'} flex items-center justify-center p-0 border-0 rounded-[1px]`;
              }

              return (
                <div
                  key={node.id}
                  style={{
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${width}px`,
                    height: `${height}px`,
                    backgroundColor: node.fillColor && !isDiamond && node.type !== 'usecase-actor' && node.type !== 'activity-start' && node.type !== 'activity-end' && node.type !== 'activity-fork' ? (node.fillColor === 'transparent' ? 'transparent' : node.fillColor) : undefined,
                    boxShadow: customBoxShadow || undefined,
                    borderStyle: !isDiamond && node.type !== 'usecase-actor' && node.type !== 'activity-start' && node.type !== 'activity-fork' ? (nodeBorderStyle === 'none' ? 'none' : nodeBorderStyle) : undefined,
                    borderWidth: !isDiamond && node.type !== 'usecase-actor' && node.type !== 'activity-start' && node.type !== 'activity-fork' ? nodeBorderWidth : undefined,
                  }}
                  className={`absolute pointer-events-auto select-none ${shapeClasses}`}
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
                            points={`${width / 2 + 3},${3} ${width + 3},${height / 2 + 3} ${width / 2 + 3},${height + 3} ${3},${height / 2 + 3}`}
                            fill={node.shadowAccent || (colorVal === 1 ? '#1E5C8C' : colorVal === 2 ? '#E65A28' : '#15191C')}
                          />
                        )}
                        <polygon
                          points={`${width / 2},0 ${width},${height / 2} ${width / 2},${height} 0,${height / 2}`}
                          fill={node.fillColor && node.fillColor !== 'transparent' ? node.fillColor : (isDark ? '#1C2226' : '#FFFFFF')}
                          stroke={isDark ? '#E1E5E3' : '#15191C'}
                          strokeWidth={node.borderWidth || 1.5}
                          strokeDasharray={node.borderStyle === 'dashed' ? '5 5' : node.borderStyle === 'dotted' ? '2 2' : undefined}
                        />
                      </svg>
                      <div
                        className={`relative z-10 font-mono ${textClass} px-2.5 leading-tight ${isDark ? 'text-white' : 'text-ink'} max-w-[80px] break-words select-none pointer-events-none`}
                        style={textStyleObj}
                      >
                        {node.label}
                      </div>
                    </div>
                  ) : node.type === 'text' ? (
                    <div
                      className={`font-mono select-none w-full h-full flex items-center justify-center leading-normal px-2 ${textClass}`}
                      style={textStyleObj}
                    >
                      {node.label}
                    </div>
                  ) : node.type === 'terminal' ? (
                    <div
                      className={`font-mono ${textClass} select-none w-full truncate px-2`}
                      style={textStyleObj}
                    >
                      {node.label}
                    </div>
                  ) : node.type === 'dfd-entity' ? (
                    <div className="flex-1 flex flex-col h-full overflow-hidden select-none justify-center items-center">
                      <div className={`absolute inset-1 border ${isDark ? 'border-[#E1E5E3]' : 'border-ink'} pointer-events-none`} />
                      <div
                        className={`font-mono ${textClass} px-2 select-none truncate w-full`}
                        style={textStyleObj}
                      >
                        {node.label}
                      </div>
                    </div>
                  ) : node.type === 'dfd-process' ? (
                    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
                      {(() => {
                        const splitIdx = node.label.indexOf(' ');
                        const processId = splitIdx !== -1 ? node.label.substring(0, splitIdx) : '1.0';
                        const processName = splitIdx !== -1 ? node.label.substring(splitIdx + 1) : node.label;
                        return (
                          <>
                            <div className={`${isDark ? 'bg-[#15191C] border-[#E1E5E3] text-[#9BA3A9]' : 'bg-paper border-ink text-ink-soft'} border-b py-1 text-center font-bold font-mono text-[9px] select-none truncate`}>
                              {processId}
                            </div>
                            <div
                              className={`p-2 flex-1 flex items-center justify-center ${textClass} font-mono select-none truncate leading-snug`}
                              style={textStyleObj}
                            >
                              {processName}
                            </div>
                          </>
                        );
                      })()}
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
                        className={`font-mono ${textClass} pt-1 select-none truncate w-full leading-tight`}
                        style={textStyleObj}
                      >
                        {node.label}
                      </div>
                    </div>
                  ) : node.type === 'usecase-oval' ? (
                    <div
                      className={`font-mono ${textClass} select-none w-full truncate leading-tight px-3`}
                      style={textStyleObj}
                    >
                      {node.label}
                    </div>
                  ) : node.type === 'usecase-boundary' ? (
                    <div className="flex flex-col h-full w-full select-none text-left">
                      <div
                        className={`font-mono ${textClass} ${isDark ? 'text-[#9BA3A9]' : 'text-ink-soft'} border-b border-dashed ${isDark ? 'border-[#333C42]' : 'border-line'} pb-1 mb-1 truncate`}
                        style={textStyleObj}
                      >
                        // boundary: {node.label}
                      </div>
                    </div>
                  ) : node.type === 'sequence-activation' ? (
                    <div className="absolute inset-0 bg-paper-raised pointer-events-none animate-pulse-subtle" />
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
                  ) : node.type === 'activity-start' ? (
                    <div className="w-full h-full select-none" />
                  ) : node.type === 'activity-end' ? (
                    <div className={`w-[18px] h-[18px] rounded-full ${isDark ? 'bg-white' : 'bg-ink'} select-none`} />
                  ) : node.type === 'activity-action' ? (
                    <div
                      className={`font-mono ${textClass} select-none w-full truncate leading-tight px-2`}
                      style={textStyleObj}
                    >
                      {node.label}
                    </div>
                  ) : node.type === 'activity-fork' ? (
                    <div className="w-full h-full select-none" />
                  ) : (
                    <div
                      className={`font-mono ${textClass} select-none h-full flex items-center justify-center px-2`}
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
      </div>

      {/* Mini Controls & Branding Footer */}
      {showControlsParam && (
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 bg-paper/90 backdrop-blur-sm border-2 border-ink px-2 py-1 shadow-sm text-[11px] z-20">
          <button
            type="button"
            onClick={() => setZoom(z => Math.min(z * 1.2, 3))}
            className="p-1 hover:bg-paper-raised text-ink cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setZoom(z => Math.max(z / 1.2, 0.2))}
            className="p-1 hover:bg-paper-raised text-ink cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => centerDiagramInView()}
            className="p-1 hover:bg-paper-raised text-ink cursor-pointer"
            title="Fit Canvas"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <div className="h-3 w-[1px] bg-line mx-0.5" />

          {diagram && (
            <a
              href={`${window.location.origin}/view/${diagram.id}${window.location.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-bold text-blueprint hover:underline px-1"
              title="Open in Diagrid Canvas"
            >
              <span>Diagrid</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      )}
    </div>
  );
};
