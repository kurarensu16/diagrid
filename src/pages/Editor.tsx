import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import type { Diagram, CanvasNode, CanvasEdge, EdgeMarkerType } from '../services/mockDb';
import { diagramService } from '../services/diagramService';
import { cloudSaveStatus } from '../services/cloudSaveStatus';
import { ExportModal } from '../components/canvas/ExportModal';
import { ShareModal } from '../components/canvas/ShareModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { FeedbackModal } from '../components/ui/FeedbackModal';
import { useCurrentUser } from '../services/mockAuth';
import { authService } from '../services/authService';
import { parseCodeToDiagram, diagramToMermaid, CODE_PRESETS_LIST, type LayoutDirection } from '../utils/codeToDiagram';
import { calculateEdgePath, getEdgeLabelPosition, getPortCoords } from '../utils/edgeRouting';
import { 
  ArrowLeft, 
  Download, 
  Share2,
  MessageSquare,
  ZoomIn, 
  ZoomOut, 
  Check, 
  Trash2,
  MousePointer,
  Pencil,
  Hand,
  Undo,
  Redo,
  PanelLeftClose,
  PanelLeftOpen,
  Square,
  Diamond,
  Circle,
  Database,
  Wand2,
  Code,
  Sliders,
  Plus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  ChevronsUp,
  ChevronsDown,
  ChevronUp,
  ChevronDown,
  Palette,
  Type,
  Copy,
  FileCode,
  Sparkles,
  Eraser,
  Highlighter,
  Maximize2,
  Edit3,
  Grid,
  Magnet,
  AlertTriangle
} from 'lucide-react';

interface FreehandDrawing {
  id: string;
  path: string; // SVG Path string: M x y Q ...
  color?: string;
  width?: number;
  opacity?: number;
  tool?: 'pen' | 'highlighter';
}

// Convert discrete points to a smooth SVG Bézier curve path using midpoint quadratic Bézier interpolation
const pointsToSmoothSvgPath = (points: { x: number; y: number }[]): string => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    path += ` Q ${points[i].x} ${points[i].y}, ${xc} ${yc}`;
  }
  const last = points[points.length - 1];
  const secondLast = points[points.length - 2];
  path += ` Q ${secondLast.x} ${secondLast.y}, ${last.x} ${last.y}`;
  return path;
};

const PENCIL_COLOR_PRESETS = [
  { label: 'Signal Orange', value: '#D45B33' },
  { label: 'Blueprint Ink', value: '#15191C' },
  { label: 'Technical Blue', value: '#1E5C8C' },
  { label: 'Accent Teal', value: '#1A6B54' },
  { label: 'Alert Red', value: '#C0392B' },
  { label: 'Highlight Yellow', value: '#F59E0B' },
];

const PENCIL_WIDTH_PRESETS = [
  { label: 'Fine', value: 1.5 },
  { label: 'Medium', value: 2.5 },
  { label: 'Thick', value: 4.5 },
  { label: 'Marker', value: 8 },
];

const AVAILABLE_SHAPE_TYPES: { type: CanvasNode['type']; label: string }[] = [
  { type: 'process', label: 'Process (Rectangle)' },
  { type: 'decision', label: 'Decision (Diamond)' },
  { type: 'terminal', label: 'Terminal (Pill)' },
  { type: 'text', label: 'Text Box / Note' },
  { type: 'table', label: 'Table (ERD)' },
  { type: 'dfd-store', label: 'Data Store (DFD)' },
  { type: 'dfd-entity', label: 'Entity (DFD)' },
  { type: 'dfd-process', label: 'Process (DFD)' },
  { type: 'usecase-actor', label: 'Actor (Stick)' },
  { type: 'usecase-oval', label: 'Use Case (Oval)' },
  { type: 'usecase-boundary', label: 'Boundary (Box)' },
  { type: 'activity-action', label: 'Action (Rounded)' },
];

const FILL_COLOR_PRESETS = [
  { label: 'Paper', value: '#FFFFFF', bg: '#FFFFFF' },
  { label: 'Blueprint', value: '#EFF6FF', bg: '#EFF6FF' },
  { label: 'Signal', value: '#FEF2F2', bg: '#FEF2F2' },
  { label: 'Amber', value: '#FFFBEB', bg: '#FFFBEB' },
  { label: 'Emerald', value: '#F0FDF4', bg: '#F0FDF4' },
  { label: 'Purple', value: '#FAF5FF', bg: '#FAF5FF' },
  { label: 'Clear', value: 'transparent', bg: 'transparent' },
];

const SHADOW_COLOR_PRESETS = [
  { label: 'Blue', value: '#1E5C8C', bg: '#1E5C8C' },
  { label: 'Red', value: '#D45B33', bg: '#D45B33' },
  { label: 'Dark', value: '#15191C', bg: '#15191C' },
  { label: 'Green', value: '#059669', bg: '#059669' },
  { label: 'Purple', value: '#7C3AED', bg: '#7C3AED' },
  { label: 'Amber', value: '#D97706', bg: '#D97706' },
  { label: 'None', value: 'none', bg: '#D1D5DB' },
];

/** Standard blueprint drafting color tokens for diagrams (diagrams remain clean & unaffected by UI themes) */
const dc = {
  ink: '#15191C',
  inkSoft: '#4A5359',
  paper: '#F6F7F5',
  paperRaised: '#FFFFFF',
  blueprint: '#1E5C8C',
  signal: '#D45B33',
  borderLine: '#D7DBD8',
};

export const CrowsFootVisualIcon: React.FC<{ type: EdgeMarkerType; isSelected?: boolean }> = ({ type, isSelected }) => {
  // Use CSS currentColor so parent's text color determines the stroke (inherits theme)
  const svgClass = `w-10 h-3.5 ${isSelected ? 'text-paper' : 'text-ink'}`;
  const stroke = 'currentColor';
  const circleFill = isSelected ? 'currentColor' : 'var(--bg-paper-raised)';

  if (type === 'none') {
    return (
      <svg className={svgClass} viewBox="0 0 40 14">
        <line x1="2" y1="7" x2="38" y2="7" stroke={stroke} strokeWidth="1.75" />
      </svg>
    );
  }
  if (type === 'arrow') {
    return (
      <svg className={svgClass} viewBox="0 0 40 14">
        <line x1="2" y1="7" x2="36" y2="7" stroke={stroke} strokeWidth="1.75" />
        <path d="M 28 2.5 L 37 7 L 28 11.5 z" fill={stroke} />
      </svg>
    );
  }
  if (type === 'zero-one') {
    // Zero or one: horizontal line with an open circle
    return (
      <svg className={svgClass} viewBox="0 0 40 14">
        <line x1="2" y1="7" x2="38" y2="7" stroke={stroke} strokeWidth="1.75" />
        <circle cx="28" cy="7" r="4" fill={circleFill} stroke={stroke} strokeWidth="1.75" />
      </svg>
    );
  }
  if (type === 'many') {
    // Many: line branching into 3 prongs
    return (
      <svg className={svgClass} viewBox="0 0 40 14">
        <line x1="2" y1="7" x2="38" y2="7" stroke={stroke} strokeWidth="1.75" />
        <line x1="22" y1="7" x2="38" y2="1.5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
        <line x1="22" y1="7" x2="38" y2="12.5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'one') {
    // One: single vertical crossbar
    return (
      <svg className={svgClass} viewBox="0 0 40 14">
        <line x1="2" y1="7" x2="38" y2="7" stroke={stroke} strokeWidth="1.75" />
        <line x1="30" y1="1.5" x2="30" y2="12.5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'one-only') {
    // One (and only one): two vertical crossbars
    return (
      <svg className={svgClass} viewBox="0 0 40 14">
        <line x1="2" y1="7" x2="38" y2="7" stroke={stroke} strokeWidth="1.75" />
        <line x1="24" y1="1.5" x2="24" y2="12.5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
        <line x1="31" y1="1.5" x2="31" y2="12.5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'zero-many') {
    // Zero or many: circle followed by 3 prongs
    return (
      <svg className={svgClass} viewBox="0 0 40 14">
        <line x1="2" y1="7" x2="38" y2="7" stroke={stroke} strokeWidth="1.75" />
        <circle cx="19" cy="7" r="3.5" fill={circleFill} stroke={stroke} strokeWidth="1.75" />
        <line x1="22.5" y1="7" x2="38" y2="1.5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
        <line x1="22.5" y1="7" x2="38" y2="12.5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'one-many') {
    // One or many: vertical bar followed by 3 prongs
    return (
      <svg className={svgClass} viewBox="0 0 40 14">
        <line x1="2" y1="7" x2="38" y2="7" stroke={stroke} strokeWidth="1.75" />
        <line x1="21" y1="1.5" x2="21" y2="12.5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
        <line x1="22" y1="7" x2="38" y2="1.5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
        <line x1="22" y1="7" x2="38" y2="12.5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  return null;
};

export const CARDINALITY_OPTIONS: { value: EdgeMarkerType; label: string; title: string }[] = [
  { value: 'zero-one', label: 'Zero or one', title: 'Zero or One (Circle)' },
  { value: 'many', label: 'Many', title: 'Many (Crow\'s Foot Prongs)' },
  { value: 'one', label: 'One', title: 'One (Single Bar)' },
  { value: 'one-only', label: 'One (only)', title: 'One and only one (Two Bars)' },
  { value: 'zero-many', label: 'Zero or many', title: 'Zero or Many (Circle + Prongs)' },
  { value: 'one-many', label: 'One or many', title: 'One or Many (Bar + Prongs)' },
  { value: 'none', label: 'Plain line', title: 'Plain Line' },
  { value: 'arrow', label: 'Arrow', title: 'Directed Arrow' },
];

export const getMarkerUrl = (
  markerType: EdgeMarkerType | undefined,
  fallbackArrow: 'end' | 'none' | 'both' | undefined,
  isStart: boolean,
  isSelected: boolean
): string | undefined => {
  const suffix = isSelected ? '-selected' : '';

  if (markerType) {
    if (markerType === 'none') return undefined;
    if (markerType === 'arrow') return `url(#arrow${suffix})`;
    if (markerType === 'one') return `url(#crows-one${suffix})`;
    if (markerType === 'one-only') return `url(#crows-one-only${suffix})`;
    if (markerType === 'zero-one') return `url(#crows-zero-one${suffix})`;
    if (markerType === 'many') return `url(#crows-many${suffix})`;
    if (markerType === 'one-many') return `url(#crows-one-many${suffix})`;
    if (markerType === 'zero-many') return `url(#crows-zero-many${suffix})`;
  }

  if (fallbackArrow === 'both') {
    return `url(#arrow${suffix})`;
  }
  if (fallbackArrow === 'none') {
    return undefined;
  }
  if (isStart) {
    return undefined;
  }
  return `url(#arrow${suffix})`;
};

// Default dimensions per shape type
export const getDefaultDimensions = (node: CanvasNode): { width: number; height: number } => {
  if (node.type === 'table') {
    const fieldCount = node.fields?.length || 0;
    return { width: 180, height: Math.max(48, 32 + fieldCount * 24) };
  }
  if (node.type === 'decision') return { width: 96, height: 96 };
  if (node.type === 'terminal') return { width: 120, height: 38 };
  if (node.type === 'dfd-store') return { width: 140, height: 48 };
  if (node.type === 'dfd-entity') return { width: 120, height: 56 };
  if (node.type === 'dfd-process') return { width: 130, height: 64 };
  if (node.type === 'usecase-actor') return { width: 70, height: 90 };
  if (node.type === 'usecase-oval') return { width: 130, height: 52 };
  if (node.type === 'usecase-boundary') return { width: 360, height: 300 };
  if (node.type === 'sequence-activation') return { width: 20, height: 80 };
  if (node.type === 'activity-start') return { width: 32, height: 32 };
  if (node.type === 'activity-end') return { width: 36, height: 36 };
  if (node.type === 'activity-action') return { width: 150, height: 48 };
  if (node.type === 'activity-decision') return { width: 96, height: 96 };
  if (node.type === 'activity-fork') return { width: 200, height: 8 };
  if (node.type === 'text') return { width: 140, height: 40 };
  return { width: 140, height: 48 };
};

// Minimum dimensions per shape type
export const getMinDimensions = (node: CanvasNode): { width: number; height: number } => {
  if (node.type === 'table') {
    const fieldCount = node.fields?.length || 0;
    return { width: 120, height: Math.max(48, 32 + fieldCount * 24) };
  }
  if (node.type === 'decision' || node.type === 'activity-decision') return { width: 48, height: 48 };
  if (node.type === 'activity-start') return { width: 20, height: 20 };
  if (node.type === 'activity-end') return { width: 24, height: 24 };
  if (node.type === 'activity-fork') return { width: 60, height: 6 };
  if (node.type === 'usecase-actor') return { width: 40, height: 50 };
  if (node.type === 'sequence-activation') return { width: 14, height: 40 };
  if (node.type === 'text') return { width: 40, height: 24 };
  return { width: 60, height: 28 };
};

// Check if shape type supports resizing
export const isResizable = (type: string): boolean => {
  return !['activity-start', 'activity-end'].includes(type);
};

export const getNodeDimensions = (node: CanvasNode): { width: number; height: number } => {
  const defaults = getDefaultDimensions(node);
  if (node.type === 'table') {
    const fieldCount = node.fields?.length || 0;
    const minRequiredHeight = 32 + fieldCount * 24;
    return {
      width: node.customWidth ?? defaults.width,
      height: Math.max(node.customHeight ?? 0, minRequiredHeight)
    };
  }
  return {
    width: node.customWidth ?? defaults.width,
    height: node.customHeight ?? defaults.height
  };
};

export const Editor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [drawings, setDrawings] = useState<FreehandDrawing[]>([]);

  // Clipboard state for nodes and edges
  const [clipboard, setClipboard] = useState<{
    nodes: CanvasNode[];
    edges: CanvasEdge[];
  } | null>(null);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    canvasX: number;
    canvasY: number;
    targetNodeId: string | null;
  } | null>(null);

  // Interaction modes: select (V), mark marquee (M), draw pencil (P), pan canvas (H)
  const [activeMode, setActiveMode] = useState<'select' | 'mark' | 'draw' | 'pan'>('select');

  // Multi-selection state
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);

  // Pencil Tool Submodes & Styles
  const [pencilTool, setPencilTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [pencilColor, setPencilColor] = useState<string>('#D45B33');
  const [pencilWidth, setPencilWidth] = useState<number>(2.5);

  // Dragging states (Figma-inspired click vs drag handling)
  const DRAG_THRESHOLD = 4; // px distance threshold before drag begins
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

  interface NodeDragState {
    isDown: boolean;
    isDragging: boolean;
    startClientPos: { x: number; y: number };
    primaryNodeId: string;
    initialPositions: Record<string, { x: number; y: number }>;
    activeSelectionIds: string[];
    wasAlreadySelected: boolean;
    isShift: boolean;
  }
  const nodeDragStateRef = useRef<NodeDragState | null>(null);
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Resize state
  const resizeStateRef = useRef<{
    nodeId: string;
    handle: string; // 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
    startClientX: number;
    startClientY: number;
    initialX: number;
    initialY: number;
    initialW: number;
    initialH: number;
  } | null>(null);
  
  const [isPanning, setIsPanning] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Scrollbar Dragging State
  const scrollbarDragRef = useRef<{
    axis: 'x' | 'y';
    startClientPos: number;
    startPan: number;
    trackLength: number;
    worldLength: number;
  } | null>(null);
  const [isScrollbarDragging, setIsScrollbarDragging] = useState(false);

  // Helper to center and fit the diagram into the canvas viewport
  const centerDiagramInView = useCallback((targetNodes: CanvasNode[] = nodesRef.current, targetDrawings: FreehandDrawing[] = drawings) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const viewportWidth = rect.width > 0 ? rect.width : (window.innerWidth - 300);
    const viewportHeight = rect.height > 0 ? rect.height : (window.innerHeight - 60);

    if (targetNodes.length === 0 && targetDrawings.length === 0) {
      setPan({ x: 100, y: 100 });
      setZoom(1);
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    targetNodes.forEach((n) => {
      const dim = getNodeDimensions(n);
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x + dim.width);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y + dim.height);
    });

    targetDrawings.forEach((d) => {
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
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.45), 1.15);

    const targetPanX = Math.round(viewportWidth / 2 - contentCenterX * newZoom);
    const targetPanY = Math.round(viewportHeight / 2 - contentCenterY * newZoom);

    setZoom(newZoom);
    setPan({ x: targetPanX, y: targetPanY });
  }, [drawings]);

  // Marquee selection bounds
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null);

  // Freehand pencil path state
  const [activeDrawingPoints, setActiveDrawingPoints] = useState<{ x: number; y: number }[] | null>(null);

  // Handle Connecting states
  const [connectingPort, setConnectingPort] = useState<{
    nodeId: string;
    port: 'top' | 'bottom' | 'left' | 'right';
  } | null>(null);
  const [snappedPort, setSnappedPort] = useState<{
    nodeId: string;
    port: 'top' | 'bottom' | 'left' | 'right';
  } | null>(null);
  const [tempEdgeEnd, setTempEdgeEnd] = useState({ x: 0, y: 0 });

  // Refs for tracking mouse offsets
  const panStart = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const mouseCanvasPos = useRef({ x: 100, y: 100 });
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Dual Sidebar States
  const [leftSidebarTab, setLeftSidebarTab] = useState<'toolbox' | 'code'>('toolbox');
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);

  useEffect(() => {
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setIsSidebarOpen(false);
      setIsRightSidebarOpen(false);
    }
  }, []);

  // Code to Diagram editor state
  const [codeTabSubmode, setCodeTabSubmode] = useState<'import' | 'export'>('import');
  const [codeText, setCodeText] = useState(CODE_PRESETS_LIST[0].code);
  const [codeDirection, setCodeDirection] = useState<LayoutDirection>('LR');
  const [codeMode, setCodeMode] = useState<'replace' | 'append'>('replace');
  const [codeStatus, setCodeStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filter presets to strictly show only the preset for the chosen diagram template (e.g. ERD preset for ERD, Flowchart preset for Flowchart)
  const templatePresets = useMemo(() => {
    if (!diagram?.type) return CODE_PRESETS_LIST.filter(p => p.type === 'flowchart');
    const matched = CODE_PRESETS_LIST.filter(p => p.type === diagram.type);
    return matched.length > 0 ? matched : CODE_PRESETS_LIST.filter(p => p.type === 'flowchart');
  }, [diagram?.type]);

  // Live Canvas to Mermaid export state
  const [exportMermaidDirection, setExportMermaidDirection] = useState<LayoutDirection>('LR');
  const [exportMermaidFormat, setExportMermaidFormat] = useState<'flowchart' | 'er'>('flowchart');
  const [mermaidCopiedSuccess, setMermaidCopiedSuccess] = useState(false);

  // Generate live Mermaid representation from canvas
  const generatedMermaidCode = useMemo(() => {
    return diagramToMermaid(nodes, edges, exportMermaidDirection, exportMermaidFormat === 'er');
  }, [nodes, edges, exportMermaidDirection, exportMermaidFormat]);

  const handleCopyMermaidCode = async () => {
    try {
      await navigator.clipboard.writeText(generatedMermaidCode);
      setMermaidCopiedSuccess(true);
      setTimeout(() => setMermaidCopiedSuccess(false), 2200);
    } catch (err) {
      console.error('Failed to copy mermaid code:', err);
    }
  };

  const handleDownloadMermaidFile = () => {
    const cleanTitle = diagram?.title.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'diagram';
    const blob = new Blob([generatedMermaidCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanTitle}.mmd`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Generate shapes and connections from Mermaid or text code
  const handleGenerateFromCode = () => {
    try {
      const startOffset = codeMode === 'append' ? { x: 80 + nodes.length * 30, y: 80 + nodes.length * 30 } : { x: 80, y: 80 };
      const result = parseCodeToDiagram(codeText, codeDirection, startOffset);
      if (result.nodes.length === 0) {
        setCodeStatus({ type: 'error', message: 'No valid shapes found in code.' });
        return;
      }

      let nextNodes = result.nodes;
      let nextEdges = result.edges;

      if (codeMode === 'append') {
        nextNodes = [...nodes, ...result.nodes];
        nextEdges = [...edges, ...result.edges];
      }

      setNodes(nextNodes);
      setEdges(nextEdges);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      saveHistoryState(nextNodes, nextEdges, drawings);
      setCodeStatus({
        type: 'success',
        message: `Generated ${result.nodes.length} shapes & ${result.edges.length} connections!`
      });
      setTimeout(() => setCodeStatus(null), 4000);
    } catch (err: any) {
      setCodeStatus({ type: 'error', message: err?.message || 'Failed to parse code.' });
    }
  };

  // Clear all canvas contents
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  const handleClearCanvas = () => {
    if (nodes.length === 0 && edges.length === 0 && drawings.length === 0) return;
    setIsConfirmClearOpen(true);
  };

  const handleClearCanvasConfirm = () => {
    setNodes([]);
    setEdges([]);
    setDrawings([]);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    saveHistoryState([], [], []);
  };

  // Diagram Title inline editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  const handleStartEditTitle = () => {
    if (!diagram) return;
    setTitleInput(diagram.title);
    setIsEditingTitle(true);
  };

  const handleSaveTitle = async () => {
    if (!diagram || !titleInput.trim()) {
      setIsEditingTitle(false);
      return;
    }
    const newTitle = titleInput.trim();
    if (newTitle !== diagram.title) {
      setDiagram(prev => prev ? { ...prev, title: newTitle } : null);
      await diagramService.updateDiagramMetadata(diagram.id, { title: newTitle });
    }
    setIsEditingTitle(false);
  };

  // User Preferences
  const currentUser = useCurrentUser();
  const [canvasGridStyle, setCanvasGridStyle] = useState<'lines' | 'dots' | 'blank'>('lines');
  const [isSnapToGrid, setIsSnapToGrid] = useState<boolean>(true);

  useEffect(() => {
    if (currentUser) {
      if (currentUser.gridStyle) setCanvasGridStyle(currentUser.gridStyle);
      if (currentUser.snapToGrid !== undefined) setIsSnapToGrid(currentUser.snapToGrid);
    }
  }, [currentUser]);

  const handleToggleGridStyle = () => {
    const nextStyle = canvasGridStyle === 'lines' ? 'dots' : canvasGridStyle === 'dots' ? 'blank' : 'lines';
    setCanvasGridStyle(nextStyle);
    authService.updateProfile({ gridStyle: nextStyle }).catch(() => {});
  };

  const handleToggleSnap = () => {
    const nextSnap = !isSnapToGrid;
    setIsSnapToGrid(nextSnap);
    authService.updateProfile({ snapToGrid: nextSnap }).catch(() => {});
  };

  // Magnetic alignment guide lines during node drag
  const [alignmentGuides, setAlignmentGuides] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([]);

  // Save status
  const [saveStatus, setSaveStatus] = useState<'ready' | 'saving' | 'cloud-saved' | 'local-only' | 'cloud-failed' | 'failed'>('ready');
  const activeDiagramIdRef = useRef<string | null>(null);
  const latestContentRef = useRef<string | null>(null);
  const lastAttemptedContentRef = useRef<string | null>(null);
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    const onSync = () => {
      const user = authService.getUserSync();
      const diagramId = activeDiagramIdRef.current;
      if (user && diagramId && !cloudSaveStatus.isPending(user.id, diagramId)) {
        setSaveStatus(current => current === 'cloud-failed' ? 'cloud-saved' : current);
      }
    };
    window.addEventListener('diagrid:sync-complete', onSync);
    return () => window.removeEventListener('diagrid:sync-complete', onSync);
  }, []);

  // Export & Share & Feedback suite modals
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // History Undo/Redo States
  const [historyState, setHistoryState] = useState<{
    list: { nodes: CanvasNode[]; edges: CanvasEdge[]; drawings: FreehandDrawing[] }[];
    index: number;
  }>({ list: [], index: -1 });

  const saveHistoryState = (
    nextNodes: CanvasNode[],
    nextEdges: CanvasEdge[],
    nextDrawings: FreehandDrawing[]
  ) => {
    const newSnapshot = {
      nodes: JSON.parse(JSON.stringify(nextNodes)),
      edges: JSON.parse(JSON.stringify(nextEdges)),
      drawings: JSON.parse(JSON.stringify(nextDrawings))
    };

    setHistoryState((prev) => {
      // Check if identical to the current snapshot
      const current = prev.list[prev.index];
      if (current) {
        if (JSON.stringify(current.nodes) === JSON.stringify(newSnapshot.nodes) &&
            JSON.stringify(current.edges) === JSON.stringify(newSnapshot.edges) &&
            JSON.stringify(current.drawings) === JSON.stringify(newSnapshot.drawings)) {
          return prev;
        }
      }

      const trimmed = prev.list.slice(0, prev.index + 1);
      const updated = [...trimmed, newSnapshot];
      if (updated.length > 50) {
        updated.shift();
      }
      return {
        list: updated,
        index: updated.length - 1
      };
    });
  };

  const undo = useCallback(() => {
    setHistoryState((prev) => {
      if (prev.index > 0) {
        const nextIndex = prev.index - 1;
        const snapshot = prev.list[nextIndex];
        setNodes(JSON.parse(JSON.stringify(snapshot.nodes)));
        setEdges(JSON.parse(JSON.stringify(snapshot.edges)));
        setDrawings(JSON.parse(JSON.stringify(snapshot.drawings)));
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
        return {
          ...prev,
          index: nextIndex
        };
      }
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setHistoryState((prev) => {
      if (prev.index < prev.list.length - 1) {
        const nextIndex = prev.index + 1;
        const snapshot = prev.list[nextIndex];
        setNodes(JSON.parse(JSON.stringify(snapshot.nodes)));
        setEdges(JSON.parse(JSON.stringify(snapshot.edges)));
        setDrawings(JSON.parse(JSON.stringify(snapshot.drawings)));
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
        return {
          ...prev,
          index: nextIndex
        };
      }
      return prev;
    });
  }, []);

  const copySelection = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    const selectedEdges = edges.filter(e => selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target));
    setClipboard({
      nodes: JSON.parse(JSON.stringify(selectedNodes)),
      edges: JSON.parse(JSON.stringify(selectedEdges))
    });
  }, [nodes, edges, selectedNodeIds]);

  const cutSelection = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    const selectedEdges = edges.filter(e => selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target));
    setClipboard({
      nodes: JSON.parse(JSON.stringify(selectedNodes)),
      edges: JSON.parse(JSON.stringify(selectedEdges))
    });
    // Delete them
    const nextNodes = nodes.filter(n => !selectedNodeIds.includes(n.id));
    const nextEdges = edges.filter(e => !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target));
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeIds([]);
    saveHistoryState(nextNodes, nextEdges, drawings);
  }, [nodes, edges, drawings, selectedNodeIds, saveHistoryState]);

  const pasteClipboard = useCallback((targetCoords?: { x: number; y: number }) => {
    if (!clipboard || clipboard.nodes.length === 0) return;

    // Calculate bounding box center of copied nodes
    const minX = Math.min(...clipboard.nodes.map(n => n.x));
    const minY = Math.min(...clipboard.nodes.map(n => n.y));
    
    // Target position is either targetCoords, the active mouse pointer, or centered
    const pasteX = targetCoords ? targetCoords.x : mouseCanvasPos.current.x;
    const pasteY = targetCoords ? targetCoords.y : mouseCanvasPos.current.y;
    
    // Map of old IDs to new IDs
    const idMap: Record<string, string> = {};
    const newNodes: CanvasNode[] = clipboard.nodes.map((oldNode) => {
      const newId = `n-${Math.random().toString(36).substr(2, 9)}`;
      idMap[oldNode.id] = newId;

      const gridSnap = 20;
      const relativeX = oldNode.x - minX;
      const relativeY = oldNode.y - minY;
      const targetX = Math.round((pasteX + relativeX) / gridSnap) * gridSnap;
      const targetY = Math.round((pasteY + relativeY) / gridSnap) * gridSnap;

      return {
        ...oldNode,
        id: newId,
        x: targetX,
        y: targetY
      };
    });

    const newEdges: CanvasEdge[] = clipboard.edges.map((oldEdge) => {
      const newSource = idMap[oldEdge.source];
      const newTarget = idMap[oldEdge.target];
      if (newSource && newTarget) {
        return {
          ...oldEdge,
          id: `e-${Math.random().toString(36).substr(2, 9)}`,
          source: newSource,
          target: newTarget
        };
      }
      return null;
    }).filter(Boolean) as CanvasEdge[];

    const updatedNodes = [...nodes, ...newNodes];
    const updatedEdges = [...edges, ...newEdges];
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    setSelectedNodeIds(newNodes.map(n => n.id));
    setSelectedEdgeId(null);
    saveHistoryState(updatedNodes, updatedEdges, drawings);
  }, [clipboard, nodes, edges, drawings, saveHistoryState]);

  const duplicateSelection = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    const selectedEdges = edges.filter(e => selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target));

    const idMap: Record<string, string> = {};
    const newNodes: CanvasNode[] = selectedNodes.map((oldNode) => {
      const newId = `n-${Math.random().toString(36).substr(2, 9)}`;
      idMap[oldNode.id] = newId;
      return {
        ...oldNode,
        id: newId,
        x: oldNode.x + 20, // Offset by 20px grid snap
        y: oldNode.y + 20
      };
    });

    const newEdges: CanvasEdge[] = selectedEdges.map((oldEdge) => {
      const newSource = idMap[oldEdge.source];
      const newTarget = idMap[oldEdge.target];
      if (newSource && newTarget) {
        return {
          ...oldEdge,
          id: `e-${Math.random().toString(36).substr(2, 9)}`,
          source: newSource,
          target: newTarget
        };
      }
      return null;
    }).filter(Boolean) as CanvasEdge[];

    const updatedNodes = [...nodes, ...newNodes];
    const updatedEdges = [...edges, ...newEdges];
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    setSelectedNodeIds(newNodes.map(n => n.id));
    setSelectedEdgeId(null);
    saveHistoryState(updatedNodes, updatedEdges, drawings);
  }, [nodes, edges, drawings, selectedNodeIds, saveHistoryState]);

  const deleteSelectedNodes = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    const nextNodes = nodes.filter(n => !selectedNodeIds.includes(n.id));
    const nextEdges = edges.filter(e => !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target));
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeIds([]);
    saveHistoryState(nextNodes, nextEdges, drawings);
  }, [nodes, edges, drawings, selectedNodeIds, saveHistoryState]);

  const deleteSelectedEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    const nextEdges = edges.filter(e => e.id !== selectedEdgeId);
    setEdges(nextEdges);
    setSelectedEdgeId(null);
    saveHistoryState(nodes, nextEdges, drawings);
  }, [nodes, edges, drawings, selectedEdgeId, saveHistoryState]);

  const deleteSelectedDrawing = useCallback(() => {
    if (!selectedDrawingId) return;
    const nextDrawings = drawings.filter(d => d.id !== selectedDrawingId);
    setDrawings(nextDrawings);
    setSelectedDrawingId(null);
    saveHistoryState(nodes, edges, nextDrawings);
  }, [drawings, selectedDrawingId, nodes, edges, saveHistoryState]);

  const deleteDrawing = useCallback((drawingId: string) => {
    const nextDrawings = drawings.filter(d => d.id !== drawingId);
    setDrawings(nextDrawings);
    if (selectedDrawingId === drawingId) setSelectedDrawingId(null);
    saveHistoryState(nodes, edges, nextDrawings);
  }, [drawings, selectedDrawingId, nodes, edges, saveHistoryState]);

  const updateSelectedDrawingColor = (color: string) => {
    if (!selectedDrawingId) return;
    const next = drawings.map(d => d.id === selectedDrawingId ? { ...d, color } : d);
    setDrawings(next);
    saveHistoryState(nodes, edges, next);
  };

  const updateSelectedDrawingWidth = (width: number) => {
    if (!selectedDrawingId) return;
    const next = drawings.map(d => d.id === selectedDrawingId ? { ...d, width } : d);
    setDrawings(next);
    saveHistoryState(nodes, edges, next);
  };

  const selectAllNodes = useCallback(() => {
    setSelectedNodeIds(nodes.map(n => n.id));
    setSelectedEdgeId(null);
  }, [nodes]);

  // Serialize saves so a slower earlier request cannot overwrite newer edits.
  const flushSave = useCallback(async () => {
    const diagramId = activeDiagramIdRef.current;
    if (!diagramId || saveInFlightRef.current) return;

    saveInFlightRef.current = true;
    try {
      while (activeDiagramIdRef.current === diagramId &&
        latestContentRef.current !== null &&
        latestContentRef.current !== lastAttemptedContentRef.current) {
        const content = latestContentRef.current;
        const result = await diagramService.saveDiagram(diagramId, content);
        lastAttemptedContentRef.current = content;

        if (activeDiagramIdRef.current !== diagramId) return;
        if (content === latestContentRef.current) {
          setSaveStatus(result.status);
          if (result.status !== 'failed') {
            setDiagram(prev => prev?.id === diagramId ? { ...prev, content } : prev);
          }
        } else {
          setSaveStatus('saving');
        }
      }
    } finally {
      saveInFlightRef.current = false;
    }
  }, []);

  const retrySave = () => {
    lastAttemptedContentRef.current = null;
    setSaveStatus('saving');
    void flushSave();
  };

  // Load Diagram
  useEffect(() => {
    if (id) {
      let isMounted = true;
      diagramService.getDiagram(id).then((d) => {
        if (!isMounted) return;
        if (d) {
          activeDiagramIdRef.current = d.id;
          setDiagram(d);

          // Align starter preset with diagram's template type
          const matchingPreset = CODE_PRESETS_LIST.find(p => p.type === d.type) || CODE_PRESETS_LIST[0];
          setCodeText(matchingPreset.code);
          setCodeDirection(matchingPreset.direction);
          if (d.type === 'erd') {
            setExportMermaidFormat('er');
          } else {
            setExportMermaidFormat('flowchart');
          }

          try {
            const parsed = JSON.parse(d.content);
            const initialNodes = parsed.nodes || [];
            const initialEdges = parsed.edges || [];
            const initialDrawings = parsed.drawings || [];
            const initialContent = JSON.stringify({ nodes: initialNodes, edges: initialEdges, drawings: initialDrawings });
            latestContentRef.current = initialContent;
            lastAttemptedContentRef.current = initialContent;
            const user = authService.getUserSync();
            setSaveStatus(user && cloudSaveStatus.isPending(user.id, d.id)
              ? (authService.isConfigured() ? 'cloud-failed' : 'local-only')
              : 'ready');
            setNodes(initialNodes);
            setEdges(initialEdges);
            setDrawings(initialDrawings);

            // Setup initial undo stack
            setHistoryState({
              list: [{
                nodes: JSON.parse(JSON.stringify(initialNodes)),
                edges: JSON.parse(JSON.stringify(initialEdges)),
                drawings: JSON.parse(JSON.stringify(initialDrawings))
              }],
              index: 0
            });

            // Focus viewport directly on the diagram shapes
            setTimeout(() => {
              centerDiagramInView(initialNodes, initialDrawings);
            }, 60);
          } catch (e) {
            console.error("Failed to parse visual content:", e);
            const emptyContent = JSON.stringify({ nodes: [], edges: [], drawings: [] });
            latestContentRef.current = emptyContent;
            lastAttemptedContentRef.current = emptyContent;
            setSaveStatus('ready');
            setNodes([]);
            setEdges([]);
            setDrawings([]);
          }
        } else {
          navigate('/dashboard');
        }
      });
      return () => {
        isMounted = false;
        activeDiagramIdRef.current = null;
      };
    }
  }, [id, navigate]);

  // Debounced auto-save diagram state
  useEffect(() => {
    if (!diagram) return;
    const currentJson = JSON.stringify({ nodes, edges, drawings });
    latestContentRef.current = currentJson;
    if (lastAttemptedContentRef.current === null || currentJson === lastAttemptedContentRef.current) return;

    setSaveStatus('saving');
    const timer = setTimeout(() => { void flushSave(); }, 1000);

    return () => clearTimeout(timer);
  }, [nodes, edges, drawings, diagram, flushSave]);

  // Listen to keyboard shortcuts (V, M, H, P, Ctrl+Z, Ctrl+Y, Clipboard, Selection)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      // Check for Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (key === 'y') {
          e.preventDefault();
          redo();
        } else if (key === 'c') {
          e.preventDefault();
          copySelection();
        } else if (key === 'x') {
          e.preventDefault();
          cutSelection();
        } else if (key === 'v') {
          e.preventDefault();
          pasteClipboard();
        } else if (key === 'd') {
          e.preventDefault();
          duplicateSelection();
        } else if (key === 'a') {
          e.preventDefault();
          selectAllNodes();
        }
        return;
      }

      // Single key actions
      const key = e.key.toLowerCase();
      if (key === 'v') {
        setActiveMode('select');
      } else if (key === 'm') {
        setActiveMode('mark');
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
      } else if (key === 'h') {
        setActiveMode('pan');
      } else if (key === 'p') {
        setActiveMode('draw');
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
      } else if (e.key === 'Escape') {
        // Cancel active resize
        if (resizeStateRef.current) {
          const rs = resizeStateRef.current;
          const revertedNodes = nodesRef.current.map(n =>
            n.id === rs.nodeId ? { ...n, x: rs.initialX, y: rs.initialY, customWidth: undefined, customHeight: undefined } : n
          );
          setNodes(revertedNodes);
          nodesRef.current = revertedNodes;
          resizeStateRef.current = null;
        }
        if (nodeDragStateRef.current?.isDragging) {
          const initial = nodeDragStateRef.current.initialPositions;
          const revertedNodes = nodesRef.current.map(node => {
            if (initial[node.id]) {
              return { ...node, x: initial[node.id].x, y: initial[node.id].y };
            }
            return node;
          });
          setNodes(revertedNodes);
          nodesRef.current = revertedNodes;
        }
        nodeDragStateRef.current = null;
        setConnectingPort(null);
        setSnappedPort(null);
        setDraggedNodeId(null);
        setMarqueeStart(null);
        setMarqueeEnd(null);
        setAlignmentGuides([]);
        setContextMenu(null);
        setSelectedDrawingId(null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds.length > 0) {
          e.preventDefault();
          deleteSelectedNodes();
        } else if (selectedEdgeId) {
          e.preventDefault();
          deleteSelectedEdge();
        } else if (selectedDrawingId) {
          e.preventDefault();
          deleteSelectedDrawing();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo, copySelection, cutSelection, pasteClipboard, duplicateSelection, selectAllNodes, selectedNodeIds, selectedEdgeId, selectedDrawingId, deleteSelectedNodes, deleteSelectedEdge, deleteSelectedDrawing]);

  // Helper to find closest connection port on a given node relative to a canvas coordinate
  const getClosestPortOnNode = (
    node: CanvasNode, 
    point: { x: number; y: number }
  ): { port: 'top' | 'bottom' | 'left' | 'right'; coords: { x: number; y: number }; dist: number } => {
    const ports: ('top' | 'bottom' | 'left' | 'right')[] = ['top', 'bottom', 'left', 'right'];
    let closestPort: 'top' | 'bottom' | 'left' | 'right' = 'left';
    let closestCoords = getPortCoords(node, 'left');
    let minDist = Infinity;

    for (const p of ports) {
      const coords = getPortCoords(node, p);
      const dist = Math.hypot(coords.x - point.x, coords.y - point.y);
      if (dist < minDist) {
        minDist = dist;
        closestPort = p;
        closestCoords = coords;
      }
    }

    return { port: closestPort, coords: closestCoords, dist: minDist };
  };

  // All diagram surfaces use the same port geometry and obstacle-aware routing.
  const getEdgePath = (edge: CanvasEdge) => calculateEdgePath(edge, nodes);

  // Viewport / drag actions
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.15, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.15, 0.25));
  const handleFitToScreen = () => {
    centerDiagramInView();
  };
  const handleResetZoom = () => {
    centerDiagramInView();
  };

  // Content bounding box for scrollbar extent calculations
  const contentBounds = useMemo(() => {
    if (nodes.length === 0 && drawings.length === 0) {
      return { minX: 0, maxX: 800, minY: 0, maxY: 600, width: 800, height: 600 };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    nodes.forEach((n) => {
      const dim = getNodeDimensions(n);
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x + dim.width);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y + dim.height);
    });

    drawings.forEach((d) => {
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
      minX = 0; maxX = 800; minY = 0; maxY = 600;
    }

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: Math.max(maxX - minX, 100),
      height: Math.max(maxY - minY, 100)
    };
  }, [nodes, drawings]);

  // Compute real-time scrollbar dimensions and positions
  const scrollbarMetrics = useMemo(() => {
    const defaultW = 800;
    const defaultH = 600;
    const rect = canvasRef.current ? canvasRef.current.getBoundingClientRect() : { width: defaultW, height: defaultH };
    const width = rect.width > 0 ? rect.width : defaultW;
    const height = rect.height > 0 ? rect.height : defaultH;

    // Horizontal scrollbar metrics
    const trackW = Math.max(width - 24, 100);
    const visibleMinX = -pan.x / zoom;
    const visibleMaxX = (width - pan.x) / zoom;
    const worldMinX = Math.min(contentBounds.minX - 600, visibleMinX - 200);
    const worldMaxX = Math.max(contentBounds.maxX + 600, visibleMaxX + 200);
    const worldW = Math.max(worldMaxX - worldMinX, 100);
    const thumbRatioX = Math.min(Math.max((width / zoom) / worldW, 0.05), 0.95);
    const thumbW = Math.max(thumbRatioX * trackW, 36);
    const thumbLeft = Math.max(0, Math.min(((visibleMinX - worldMinX) / worldW) * trackW, trackW - thumbW));

    // Vertical scrollbar metrics
    const trackH = Math.max(height - 24, 100);
    const visibleMinY = -pan.y / zoom;
    const visibleMaxY = (height - pan.y) / zoom;
    const worldMinY = Math.min(contentBounds.minY - 500, visibleMinY - 200);
    const worldMaxY = Math.max(contentBounds.maxY + 500, visibleMaxY + 200);
    const worldH = Math.max(worldMaxY - worldMinY, 100);
    const thumbRatioY = Math.min(Math.max((height / zoom) / worldH, 0.05), 0.95);
    const thumbH = Math.max(thumbRatioY * trackH, 36);
    const thumbTop = Math.max(0, Math.min(((visibleMinY - worldMinY) / worldH) * trackH, trackH - thumbH));

    return {
      horiz: { trackWidth: trackW, thumbWidth: thumbW, thumbLeft: Math.round(thumbLeft), worldMinX, worldW },
      vert: { trackHeight: trackH, thumbHeight: thumbH, thumbTop: Math.round(thumbTop), worldMinY, worldH }
    };
  }, [pan, zoom, contentBounds]);

  const handleScrollbarThumbMouseDown = (e: React.MouseEvent, axis: 'x' | 'y') => {
    e.stopPropagation();
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const trackLength = axis === 'x' ? Math.max(rect.width - 24, 100) : Math.max(rect.height - 24, 100);

    const visibleMin = axis === 'x' ? -pan.x / zoom : -pan.y / zoom;
    const visibleSpan = axis === 'x' ? rect.width / zoom : rect.height / zoom;
    const contentMin = axis === 'x' ? contentBounds.minX : contentBounds.minY;
    const contentMax = axis === 'x' ? contentBounds.maxX : contentBounds.maxY;
    const worldMin = Math.min(contentMin - 600, visibleMin - 200);
    const worldMax = Math.max(contentMax + 600, visibleMin + visibleSpan + 200);
    const worldLength = Math.max(worldMax - worldMin, 100);

    scrollbarDragRef.current = {
      axis,
      startClientPos: axis === 'x' ? e.clientX : e.clientY,
      startPan: axis === 'x' ? pan.x : pan.y,
      trackLength,
      worldLength
    };
    setIsScrollbarDragging(true);
  };

  // Wheel Zoom & 2D Pan Scroll
  const handleCanvasWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom at mouse location
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.25), 3);

      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
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

  // Add Node from Sidebar Palette
  const addNode = (type: CanvasNode['type']) => {
    const gridSnap = 20;
    const x = Math.round((200 - pan.x) / gridSnap) * gridSnap;
    const y = Math.round((150 - pan.y) / gridSnap) * gridSnap;

    let defaultLabel = 'Process step';
    if (type === 'table') defaultLabel = 'new_table';
    else if (type === 'decision') defaultLabel = 'Branch?';
    else if (type === 'dfd-entity') defaultLabel = 'External Entity';
    else if (type === 'dfd-process') defaultLabel = '1.0 DFD Process';
    else if (type === 'dfd-store') defaultLabel = 'Data Store';
    else if (type === 'usecase-actor') defaultLabel = 'User Actor';
    else if (type === 'usecase-oval') defaultLabel = 'Perform Action';
    else if (type === 'usecase-boundary') defaultLabel = 'System Boundary';
    else if (type === 'activity-start') defaultLabel = 'Start';
    else if (type === 'activity-end') defaultLabel = 'End';
    else if (type === 'activity-action') defaultLabel = 'Perform Action';
    else if (type === 'activity-decision') defaultLabel = 'Condition?';
    else if (type === 'activity-fork') defaultLabel = 'Fork/Join';
    else if (type === 'text') defaultLabel = 'Text annotation...';

    const newNode: CanvasNode = {
      id: `n-${Math.random().toString(36).substr(2, 9)}`,
      type,
      label: defaultLabel,
      x,
      y,
      fillColor: type === 'text' ? 'transparent' : undefined,
      borderStyle: type === 'text' ? 'none' : undefined,
      borderWidth: type === 'text' ? 1 : undefined,
      shadowAccent: type === 'text' ? 'none' : undefined,
      fields: type === 'table' ? ['id uuid pk', 'title text'] : undefined
    };

    const nextNodes = [...nodes, newNode];
    setNodes(nextNodes);
    setSelectedNodeIds([newNode.id]);
    setSelectedEdgeId(null);
    saveHistoryState(nextNodes, edges, drawings);
  };

  // Node and canvas mouse events
  const handleNodeMouseDown = (e: React.MouseEvent, node: CanvasNode) => {
    e.stopPropagation();

    // Click-to-connect: if already connecting from another node, clicking this node completes connection
    if (connectingPort) {
      if (connectingPort.nodeId !== node.id) {
        const rect = canvasRef.current?.getBoundingClientRect();
        const canvasMouseX = rect ? (e.clientX - rect.left - pan.x) / zoom : node.x;
        const canvasMouseY = rect ? (e.clientY - rect.top - pan.y) / zoom : node.y;
        const closest = getClosestPortOnNode(node, { x: canvasMouseX, y: canvasMouseY });
        completePortConnection(node.id, closest.port);
      } else {
        setConnectingPort(null);
        setSnappedPort(null);
      }
      return;
    }

    if (activeMode === 'pan') {
      // In panning mode, node events defer to panning down
      handleCanvasMouseDown(e);
      return;
    }

    if (activeMode === 'select') {
      if (e.button !== 0) return; // Left click only
      setSelectedEdgeId(null);
      setSelectedDrawingId(null);

      const isShift = e.shiftKey;
      const wasAlreadySelected = selectedNodeIds.includes(node.id);

      let activeSelectionIds: string[];
      if (!wasAlreadySelected) {
        if (isShift) {
          activeSelectionIds = [...selectedNodeIds, node.id];
        } else {
          activeSelectionIds = [node.id];
        }
        setSelectedNodeIds(activeSelectionIds);
      } else {
        // In Figma: if already selected, keep selection intact on mousedown
        // so multi-selection can be dragged together. Selection refinement happens on mouseup if no drag occurred.
        activeSelectionIds = selectedNodeIds;
      }

      // Snapshot initial canvas positions for all nodes in the active selection
      const initialPositions: Record<string, { x: number; y: number }> = {};
      nodesRef.current.forEach((n) => {
        if (activeSelectionIds.includes(n.id)) {
          initialPositions[n.id] = { x: n.x, y: n.y };
        }
      });

      // Initialize pending drag state - DO NOT start dragging or moving nodes yet
      nodeDragStateRef.current = {
        isDown: true,
        isDragging: false,
        startClientPos: { x: e.clientX, y: e.clientY },
        primaryNodeId: node.id,
        initialPositions,
        activeSelectionIds,
        wasAlreadySelected,
        isShift
      };
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (activeMode === 'select') {
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setSelectedDrawingId(null);

      if (e.button === 1) { // Middle click pans
        setIsPanning(true);
        panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      } else if (e.button === 0 && canvasRef.current) { // Left click drag draws marquee selection box
        const rect = canvasRef.current.getBoundingClientRect();
        const canvasMouseX = (e.clientX - rect.left - pan.x) / zoom;
        const canvasMouseY = (e.clientY - rect.top - pan.y) / zoom;
        setMarqueeStart({ x: canvasMouseX, y: canvasMouseY });
        setMarqueeEnd({ x: canvasMouseX, y: canvasMouseY });
      }
    } else if (activeMode === 'pan') {
      setIsPanning(true);
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    } else if (activeMode === 'mark' && canvasRef.current) {
      // Initiate marquee bounding box
      const rect = canvasRef.current.getBoundingClientRect();
      const canvasMouseX = (e.clientX - rect.left - pan.x) / zoom;
      const canvasMouseY = (e.clientY - rect.top - pan.y) / zoom;
      setMarqueeStart({ x: canvasMouseX, y: canvasMouseY });
      setMarqueeEnd({ x: canvasMouseX, y: canvasMouseY });
    } else if (activeMode === 'draw' && canvasRef.current) {
      if (pencilTool !== 'eraser') {
        // Start freehand line
        const rect = canvasRef.current.getBoundingClientRect();
        const canvasMouseX = (e.clientX - rect.left - pan.x) / zoom;
        const canvasMouseY = (e.clientY - rect.top - pan.y) / zoom;
        setActiveDrawingPoints([{ x: canvasMouseX, y: canvasMouseY }]);
        setSelectedDrawingId(null);
      }
    }
  };

  // Figma-style node dragging handler with threshold & base coordinates
  const handleNodeDragMouseMove = (clientX: number, clientY: number) => {
    const dragState = nodeDragStateRef.current;
    if (!dragState || !dragState.isDown || activeMode !== 'select') return;

    // Check drag threshold (deadzone)
    if (!dragState.isDragging) {
      const distance = Math.hypot(
        clientX - dragState.startClientPos.x,
        clientY - dragState.startClientPos.y
      );
      if (distance < DRAG_THRESHOLD) {
        return; // Threshold not reached: remain in click-pending state
      }
      dragState.isDragging = true;
      setDraggedNodeId(dragState.primaryNodeId);
    }

    const primaryInitial = dragState.initialPositions[dragState.primaryNodeId];
    if (!primaryInitial) return;

    const currentNodes = nodesRef.current;
    const primaryNode = currentNodes.find(n => n.id === dragState.primaryNodeId);
    if (!primaryNode) return;

    const primaryDim = getNodeDimensions(primaryNode);

    // Delta from initial mouse down in canvas coordinate space
    const deltaCanvasX = (clientX - dragState.startClientPos.x) / zoom;
    const deltaCanvasY = (clientY - dragState.startClientPos.y) / zoom;

    const rawX = primaryInitial.x + deltaCanvasX;
    const rawY = primaryInitial.y + deltaCanvasY;

    // Check alignment guides against other non-selected nodes
    const otherNodes = currentNodes.filter(n => !dragState.activeSelectionIds.includes(n.id));
    const guides: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const snapThreshold = 8;

    const draggedCenterX = rawX + primaryDim.width / 2;
    const draggedCenterY = rawY + primaryDim.height / 2;

    let snappedX = rawX;
    let snappedY = rawY;
    let xSnapped = false;
    let ySnapped = false;

    for (const other of otherNodes) {
      const otherDim = getNodeDimensions(other);
      const otherCenterX = other.x + otherDim.width / 2;
      const otherCenterY = other.y + otherDim.height / 2;

      // Snap Center X
      if (!xSnapped && Math.abs(draggedCenterX - otherCenterX) <= snapThreshold) {
        snappedX = otherCenterX - primaryDim.width / 2;
        xSnapped = true;
        const minY = Math.min(rawY, other.y) - 60;
        const maxY = Math.max(rawY + primaryDim.height, other.y + otherDim.height) + 60;
        guides.push({ x1: otherCenterX, y1: minY, x2: otherCenterX, y2: maxY });
      }

      // Snap Center Y
      if (!ySnapped && Math.abs(draggedCenterY - otherCenterY) <= snapThreshold) {
        snappedY = otherCenterY - primaryDim.height / 2;
        ySnapped = true;
        const minX = Math.min(rawX, other.x) - 60;
        const maxX = Math.max(rawX + primaryDim.width, other.x + otherDim.width) + 60;
        guides.push({ x1: minX, y1: otherCenterY, x2: maxX, y2: otherCenterY });
      }
    }

    // If not magnetically snapped to center, snap to 20px grid or allow fluid freeform
    if (!xSnapped) snappedX = isSnapToGrid ? Math.round(rawX / 20) * 20 : Math.round(rawX);
    if (!ySnapped) snappedY = isSnapToGrid ? Math.round(rawY / 20) * 20 : Math.round(rawY);

    setAlignmentGuides(isSnapToGrid ? guides : []);

    const effectiveDeltaX = snappedX - primaryInitial.x;
    const effectiveDeltaY = snappedY - primaryInitial.y;

    const nextNodes = currentNodes.map(node => {
      const init = dragState.initialPositions[node.id];
      if (init) {
        return {
          ...node,
          x: Math.round(init.x + effectiveDeltaX),
          y: Math.round(init.y + effectiveDeltaY)
        };
      }
      return node;
    });

    setNodes(nextNodes);
    nodesRef.current = nextNodes;
  };

  // Resize interaction handlers
  const handleResizeMouseDown = (e: React.MouseEvent, nodeId: string, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const { width, height } = getNodeDimensions(node);
    resizeStateRef.current = {
      nodeId,
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialX: node.x,
      initialY: node.y,
      initialW: width,
      initialH: height
    };
  };

  const handleResizeMouseMove = (clientX: number, clientY: number) => {
    const rs = resizeStateRef.current;
    if (!rs) return;
    const node = nodesRef.current.find(n => n.id === rs.nodeId);
    if (!node) return;

    const deltaX = (clientX - rs.startClientX) / zoom;
    const deltaY = (clientY - rs.startClientY) / zoom;
    const mins = getMinDimensions(node);

    let newX = rs.initialX;
    let newY = rs.initialY;
    let newW = rs.initialW;
    let newH = rs.initialH;

    const h = rs.handle;

    // Width changes
    if (h.includes('e')) {
      newW = Math.max(mins.width, rs.initialW + deltaX);
    } else if (h.includes('w')) {
      newW = Math.max(mins.width, rs.initialW - deltaX);
      newX = rs.initialX + (rs.initialW - newW);
    }

    // Height changes
    if (h.includes('s')) {
      newH = Math.max(mins.height, rs.initialH + deltaY);
    } else if (h.includes('n')) {
      newH = Math.max(mins.height, rs.initialH - deltaY);
      newY = rs.initialY + (rs.initialH - newH);
    }

    // For diamond shapes, maintain square aspect ratio
    const isDiamondType = node.type === 'decision' || node.type === 'activity-decision';
    if (isDiamondType) {
      const maxDim = Math.max(newW, newH);
      if (h.includes('w')) {
        newX = rs.initialX + (rs.initialW - maxDim);
      }
      if (h.includes('n')) {
        newY = rs.initialY + (rs.initialH - maxDim);
      }
      newW = maxDim;
      newH = maxDim;
    }

    newW = Math.round(newW);
    newH = Math.round(newH);
    newX = Math.round(newX);
    newY = Math.round(newY);

    const nextNodes = nodesRef.current.map(n =>
      n.id === rs.nodeId ? { ...n, x: newX, y: newY, customWidth: newW, customHeight: newH } : n
    );
    setNodes(nextNodes);
    nodesRef.current = nextNodes;
  };

  // Mouse Move Event Listener
  const handleMouseMove = (e: React.MouseEvent) => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const canvasMouseX = (e.clientX - rect.left - pan.x) / zoom;
      const canvasMouseY = (e.clientY - rect.top - pan.y) / zoom;
      mouseCanvasPos.current = { x: canvasMouseX, y: canvasMouseY };
    }

    // Handle resize dragging first
    if (resizeStateRef.current) {
      handleResizeMouseMove(e.clientX, e.clientY);
      return;
    }

    if (nodeDragStateRef.current?.isDown && activeMode === 'select') {
      handleNodeDragMouseMove(e.clientX, e.clientY);
      return;
    }

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y
      });
      return;
    }

    if (marqueeStart && canvasRef.current && (activeMode === 'mark' || activeMode === 'select')) {
      const rect = canvasRef.current.getBoundingClientRect();
      const canvasMouseX = (e.clientX - rect.left - pan.x) / zoom;
      const canvasMouseY = (e.clientY - rect.top - pan.y) / zoom;
      setMarqueeEnd({ x: canvasMouseX, y: canvasMouseY });
      return;
    }

    if (activeDrawingPoints && canvasRef.current && activeMode === 'draw') {
      const rect = canvasRef.current.getBoundingClientRect();
      const canvasMouseX = (e.clientX - rect.left - pan.x) / zoom;
      const canvasMouseY = (e.clientY - rect.top - pan.y) / zoom;
      setActiveDrawingPoints(prev => prev ? [...prev, { x: canvasMouseX, y: canvasMouseY }] : null);
      return;
    }

    if (connectingPort && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const canvasMouseX = (e.clientX - rect.left - pan.x) / zoom;
      const canvasMouseY = (e.clientY - rect.top - pan.y) / zoom;

      // Smart magnetic port snapping to nearby candidate shapes (generous 36px radius)
      let nearestCandidate: { nodeId: string; port: 'top' | 'bottom' | 'left' | 'right'; coords: { x: number; y: number } } | null = null;
      let minSnapDist = 36;

      const candidateNodes = nodes.filter(n => n.id !== connectingPort.nodeId);
      for (const node of candidateNodes) {
        const { width, height } = getNodeDimensions(node);
        const isNearNode = (
          canvasMouseX >= node.x - 30 &&
          canvasMouseX <= node.x + width + 30 &&
          canvasMouseY >= node.y - 30 &&
          canvasMouseY <= node.y + height + 30
        );

        if (isNearNode) {
          const closest = getClosestPortOnNode(node, { x: canvasMouseX, y: canvasMouseY });
          if (closest.dist < minSnapDist) {
            minSnapDist = closest.dist;
            nearestCandidate = { nodeId: node.id, port: closest.port, coords: closest.coords };
          }
        }
      }

      if (nearestCandidate) {
        setSnappedPort({ nodeId: nearestCandidate.nodeId, port: nearestCandidate.port });
        setTempEdgeEnd(nearestCandidate.coords);
      } else {
        setSnappedPort(null);
        setTempEdgeEnd({ x: canvasMouseX, y: canvasMouseY });
      }
    }
  };

  const handleMouseUp = () => {
    // Process marquee bounds check
    if (marqueeStart && marqueeEnd && (activeMode === 'mark' || activeMode === 'select')) {
      const x1 = Math.min(marqueeStart.x, marqueeEnd.x);
      const x2 = Math.max(marqueeStart.x, marqueeEnd.x);
      const y1 = Math.min(marqueeStart.y, marqueeEnd.y);
      const y2 = Math.max(marqueeStart.y, marqueeEnd.y);

      // Find nodes falling inside
      const selectedIds: string[] = [];
      nodes.forEach((node) => {
        const { width, height } = getNodeDimensions(node);
        const nodeCenterX = node.x + width / 2;
        const nodeCenterY = node.y + height / 2;
        if (nodeCenterX >= x1 && nodeCenterX <= x2 && nodeCenterY >= y1 && nodeCenterY <= y2) {
          selectedIds.push(node.id);
        }
      });

      setSelectedNodeIds(selectedIds);
      setMarqueeStart(null);
      setMarqueeEnd(null);
      if (activeMode === 'mark') {
        setActiveMode('select'); // Automatically revert back to select
      }
    }

    // Process freehand line check
    if (activeDrawingPoints && activeMode === 'draw') {
      if (activeDrawingPoints.length > 1) {
        const isHighlighter = pencilTool === 'highlighter';
        const newDrawing: FreehandDrawing = {
          id: `d-${Math.random().toString(36).substr(2, 9)}`,
          path: pointsToSmoothSvgPath(activeDrawingPoints),
          color: pencilColor,
          width: isHighlighter ? Math.max(pencilWidth, 8) : pencilWidth,
          opacity: isHighlighter ? 0.4 : 1,
          tool: isHighlighter ? 'highlighter' : 'pen'
        };
        const nextDrawings = [...drawings, newDrawing];
        setDrawings(nextDrawings);
        saveHistoryState(nodes, edges, nextDrawings);
      }
      setActiveDrawingPoints(null);
      // Continuous drawing: do not revert to 'select' mode so user can sketch multiple strokes fluidly!
    }

    const dragState = nodeDragStateRef.current;
    if (dragState && dragState.isDown) {
      if (dragState.isDragging) {
        // Drag occurred! Persist new positions into undo history
        saveHistoryState(nodesRef.current, edges, drawings);
      } else {
        // Pure click without dragging (distance was below DRAG_THRESHOLD)
        // Figma selection refinement:
        if (dragState.wasAlreadySelected) {
          if (dragState.isShift) {
            // Shift + click on an already selected node toggles it OFF
            setSelectedNodeIds(prev => prev.filter(id => id !== dragState.primaryNodeId));
          } else if (dragState.activeSelectionIds.length > 1) {
            // Clicking an item in a multi-selection narrows selection to only that item
            setSelectedNodeIds([dragState.primaryNodeId]);
          }
        }
      }
      nodeDragStateRef.current = null;
    }

    setDraggedNodeId(null);
    setAlignmentGuides([]);
    setIsPanning(false);

    // Complete resize
    if (resizeStateRef.current) {
      resizeStateRef.current = null;
      saveHistoryState(nodesRef.current, edges, drawings);
    }

    if (connectingPort) {
      if (snappedPort) {
        completePortConnection(snappedPort.nodeId, snappedPort.port);
      } else {
        setConnectingPort(null);
        setSnappedPort(null);
      }
    }
  };

  const handleMouseUpRef = useRef(handleMouseUp);
  useEffect(() => {
    handleMouseUpRef.current = handleMouseUp;
  });

  // Global window listeners to ensure drag move & mouseup are tracked even if pointer leaves canvas
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (scrollbarDragRef.current) {
        const s = scrollbarDragRef.current;
        const currentClientPos = s.axis === 'x' ? e.clientX : e.clientY;
        const deltaClient = currentClientPos - s.startClientPos;
        const deltaWorld = deltaClient * (s.worldLength / s.trackLength);
        const newPanValue = Math.round(s.startPan - deltaWorld * zoom);
        if (s.axis === 'x') {
          setPan(prev => ({ ...prev, x: newPanValue }));
        } else {
          setPan(prev => ({ ...prev, y: newPanValue }));
        }
        return;
      }

      if (resizeStateRef.current) {
        handleResizeMouseMove(e.clientX, e.clientY);
      } else if (nodeDragStateRef.current?.isDown && activeMode === 'select') {
        handleNodeDragMouseMove(e.clientX, e.clientY);
      }
    };

    const handleWindowMouseUp = () => {
      if (scrollbarDragRef.current) {
        scrollbarDragRef.current = null;
        setIsScrollbarDragging(false);
      }
      if (resizeStateRef.current) {
        handleMouseUpRef.current();
      } else if (nodeDragStateRef.current?.isDown) {
        handleMouseUpRef.current();
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [activeMode, zoom, pan]);

  // Complete an edge connection cleanly and reliably
  const completePortConnection = (targetNodeId: string, targetPort: 'top' | 'bottom' | 'left' | 'right') => {
    if (!connectingPort || connectingPort.nodeId === targetNodeId) {
      setConnectingPort(null);
      setSnappedPort(null);
      return;
    }

    const isErd = diagram?.type === 'erd';
    const newEdge: CanvasEdge = {
      id: `e-${Math.random().toString(36).substr(2, 9)}`,
      source: connectingPort.nodeId,
      target: targetNodeId,
      sourceHandle: connectingPort.port,
      targetHandle: targetPort,
      style: 'solid',
      arrow: isErd ? undefined : 'end',
      sourceMarker: isErd ? 'one' : undefined,
      targetMarker: isErd ? 'many' : 'arrow'
    };

    const nextEdges = [...edges, newEdge];
    setEdges(nextEdges);
    setSelectedEdgeId(newEdge.id);
    setSelectedNodeIds([]);
    setConnectingPort(null);
    setSnappedPort(null);
    saveHistoryState(nodes, nextEdges, drawings);
  };

  // Dropping a connection anywhere over a target shape's body
  const handleNodeMouseUp = (e: React.MouseEvent, targetNode: CanvasNode) => {
    if (connectingPort && connectingPort.nodeId !== targetNode.id) {
      e.stopPropagation();
      const rect = canvasRef.current?.getBoundingClientRect();
      const canvasMouseX = rect ? (e.clientX - rect.left - pan.x) / zoom : targetNode.x;
      const canvasMouseY = rect ? (e.clientY - rect.top - pan.y) / zoom : targetNode.y;

      const targetPort = (snappedPort?.nodeId === targetNode.id)
        ? snappedPort.port
        : getClosestPortOnNode(targetNode, { x: canvasMouseX, y: canvasMouseY }).port;

      completePortConnection(targetNode.id, targetPort);
    }
  };

  // Global window mouseup listener to guarantee connection cleanup
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (connectingPort) {
        if (snappedPort) {
          completePortConnection(snappedPort.nodeId, snappedPort.port);
        } else {
          setConnectingPort(null);
          setSnappedPort(null);
        }
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [connectingPort, snappedPort, edges, nodes, drawings]);

  // Connect Handles Anchors
  const handlePortMouseDown = (e: React.MouseEvent, nodeId: string, port: 'top' | 'bottom' | 'left' | 'right') => {
    e.stopPropagation();
    e.preventDefault();
    const sourceNode = nodes.find(n => n.id === nodeId);
    if (!sourceNode) return;

    const start = getPortCoords(sourceNode, port);
    setConnectingPort({ nodeId, port });
    setSnappedPort(null);
    setTempEdgeEnd(start);
  };

  const handlePortMouseUp = (e: React.MouseEvent, targetNodeId: string, targetPort: 'top' | 'bottom' | 'left' | 'right') => {
    e.stopPropagation();
    completePortConnection(targetNodeId, targetPort);
  };

  // Context Menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent, targetNodeId: string | null = null) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const menuX = e.clientX - rect.left;
    const menuY = e.clientY - rect.top;
    const canvasMouseX = (e.clientX - rect.left - pan.x) / zoom;
    const canvasMouseY = (e.clientY - rect.top - pan.y) / zoom;

    // If targetNodeId is specified, ensure it is selected!
    if (targetNodeId && !selectedNodeIds.includes(targetNodeId)) {
      setSelectedNodeIds([targetNodeId]);
      setSelectedEdgeId(null);
    } else if (!targetNodeId) {
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
    }

    setContextMenu({
      x: menuX,
      y: menuY,
      canvasX: canvasMouseX,
      canvasY: canvasMouseY,
      targetNodeId
    });
  }, [pan, zoom, selectedNodeIds]);

  // Clickaway listener to close context menu
  useEffect(() => {
    const handleCloseMenu = (e: MouseEvent) => {
      if (contextMenu && contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener('mousedown', handleCloseMenu);
    return () => window.removeEventListener('mousedown', handleCloseMenu);
  }, [contextMenu]);

  // Sidebar controls mutations

  const updateSelectedNodeLabel = (label: string) => {
    if (selectedNodeIds.length !== 1) return;
    const targetId = selectedNodeIds[0];
    const nextNodes = nodes.map(n => n.id === targetId ? { ...n, label } : n);
    setNodes(nextNodes);
    saveHistoryState(nextNodes, edges, drawings);
  };

  const updateSelectedNodeFields = (fields: string[]) => {
    if (selectedNodeIds.length !== 1) return;
    const targetId = selectedNodeIds[0];
    const nextNodes = nodes.map(n => {
      if (n.id === targetId) {
        const requiredHeight = 32 + fields.length * 24;
        const newCustomHeight = n.customHeight ? Math.max(n.customHeight, requiredHeight) : undefined;
        return { ...n, fields, customHeight: newCustomHeight };
      }
      return n;
    });
    setNodes(nextNodes);
    saveHistoryState(nextNodes, edges, drawings);
  };

  const updateSelectedNodeProperties = (updates: Partial<CanvasNode>) => {
    if (selectedNodeIds.length === 0) return;
    const nextNodes = nodes.map(n => {
      if (selectedNodeIds.includes(n.id)) {
        return { ...n, ...updates };
      }
      return n;
    });
    setNodes(nextNodes);
    saveHistoryState(nextNodes, edges, drawings);
  };

  const updateSelectedNodeProperty = <K extends keyof CanvasNode>(key: K, value: CanvasNode[K]) => {
    updateSelectedNodeProperties({ [key]: value });
  };

  const morphSelectedNodeType = (newType: CanvasNode['type']) => {
    if (selectedNodeIds.length === 0) return;
    const nextNodes = nodes.map(n => {
      if (selectedNodeIds.includes(n.id)) {
        return { ...n, type: newType };
      }
      return n;
    });
    setNodes(nextNodes);
    saveHistoryState(nextNodes, edges, drawings);
  };

  const bringToFront = () => {
    if (selectedNodeIds.length === 0) return;
    const unselected = nodes.filter(n => !selectedNodeIds.includes(n.id));
    const selected = nodes.filter(n => selectedNodeIds.includes(n.id));
    const nextNodes = [...unselected, ...selected];
    setNodes(nextNodes);
    saveHistoryState(nextNodes, edges, drawings);
  };

  const sendToBack = () => {
    if (selectedNodeIds.length === 0) return;
    const unselected = nodes.filter(n => !selectedNodeIds.includes(n.id));
    const selected = nodes.filter(n => selectedNodeIds.includes(n.id));
    const nextNodes = [...selected, ...unselected];
    setNodes(nextNodes);
    saveHistoryState(nextNodes, edges, drawings);
  };

  const bringForward = () => {
    if (selectedNodeIds.length === 0) return;
    const nextNodes = [...nodes];
    for (let i = nextNodes.length - 2; i >= 0; i--) {
      if (selectedNodeIds.includes(nextNodes[i].id) && !selectedNodeIds.includes(nextNodes[i + 1].id)) {
        const temp = nextNodes[i];
        nextNodes[i] = nextNodes[i + 1];
        nextNodes[i + 1] = temp;
      }
    }
    setNodes(nextNodes);
    saveHistoryState(nextNodes, edges, drawings);
  };

  const sendBackward = () => {
    if (selectedNodeIds.length === 0) return;
    const nextNodes = [...nodes];
    for (let i = 1; i < nextNodes.length; i++) {
      if (selectedNodeIds.includes(nextNodes[i].id) && !selectedNodeIds.includes(nextNodes[i - 1].id)) {
        const temp = nextNodes[i];
        nextNodes[i] = nextNodes[i - 1];
        nextNodes[i - 1] = temp;
      }
    }
    setNodes(nextNodes);
    saveHistoryState(nextNodes, edges, drawings);
  };



  const updateSelectedEdgeLabel = (label: string) => {
    if (!selectedEdgeId) return;
    const nextEdges = edges.map(e => e.id === selectedEdgeId ? { ...e, label } : e);
    setEdges(nextEdges);
    saveHistoryState(nodes, nextEdges, drawings);
  };

  const updateSelectedEdgeStyle = (style: 'solid' | 'dashed') => {
    if (!selectedEdgeId) return;
    const nextEdges = edges.map(e => e.id === selectedEdgeId ? { ...e, style } : e);
    setEdges(nextEdges);
    saveHistoryState(nodes, nextEdges, drawings);
  };

  const updateSelectedEdgeArrow = (arrow: 'end' | 'none' | 'both') => {
    if (!selectedEdgeId) return;
    const nextEdges: CanvasEdge[] = edges.map(e => e.id === selectedEdgeId ? { 
      ...e, 
      arrow,
      sourceMarker: (arrow === 'both' ? 'arrow' : arrow === 'none' ? 'none' : undefined) as EdgeMarkerType | undefined,
      targetMarker: (arrow === 'none' ? 'none' : 'arrow') as EdgeMarkerType
    } : e);
    setEdges(nextEdges);
    saveHistoryState(nodes, nextEdges, drawings);
  };

  const updateSelectedEdgeSourceMarker = (sourceMarker: EdgeMarkerType) => {
    if (!selectedEdgeId) return;
    const nextEdges = edges.map(e => e.id === selectedEdgeId ? { ...e, sourceMarker } : e);
    setEdges(nextEdges);
    saveHistoryState(nodes, nextEdges, drawings);
  };

  const updateSelectedEdgeTargetMarker = (targetMarker: EdgeMarkerType) => {
    if (!selectedEdgeId) return;
    const nextEdges = edges.map(e => e.id === selectedEdgeId ? { ...e, targetMarker } : e);
    setEdges(nextEdges);
    saveHistoryState(nodes, nextEdges, drawings);
  };

  const updateSelectedEdgeErdPreset = (preset: '1:N' | 'N:1' | '1:1' | 'M:N' | '0..1:N') => {
    if (!selectedEdgeId) return;
    let sourceMarker: EdgeMarkerType = 'one-only';
    let targetMarker: EdgeMarkerType = 'many';
    let label = '';
    if (preset === '1:N') {
      sourceMarker = 'one-only';
      targetMarker = 'many';
      label = '1:N';
    } else if (preset === 'N:1') {
      sourceMarker = 'many';
      targetMarker = 'one-only';
      label = 'N:1';
    } else if (preset === '1:1') {
      sourceMarker = 'one-only';
      targetMarker = 'one-only';
      label = '1:1';
    } else if (preset === 'M:N') {
      sourceMarker = 'many';
      targetMarker = 'many';
      label = 'M:N';
    } else if (preset === '0..1:N') {
      sourceMarker = 'zero-one';
      targetMarker = 'zero-many';
      label = '0..1:N';
    }
    const nextEdges = edges.map(e => e.id === selectedEdgeId ? { ...e, sourceMarker, targetMarker, label } : e);
    setEdges(nextEdges);
    saveHistoryState(nodes, nextEdges, drawings);
  };

  const clearAllDrawings = () => {
    setDrawings([]);
    saveHistoryState(nodes, edges, []);
  };

  // Open Export Modal
  const triggerExport = () => {
    setIsExportOpen(true);
  };

  // 1-Click Auto Align / Tidy Up utility
  const autoAlignNodes = () => {
    if (nodes.length <= 1) return;

    const nextNodes = [...nodes];
    const nodeMap = new Map(nextNodes.map(n => [n.id, n]));

    edges.forEach(edge => {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) return;

      const isVert = (edge.sourceHandle === 'bottom' && edge.targetHandle === 'top') ||
                     (edge.sourceHandle === 'top' && edge.targetHandle === 'bottom');

      if (isVert) {
        const srcDim = getNodeDimensions(src);
        const tgtDim = getNodeDimensions(tgt);
        const srcCenterX = src.x + srcDim.width / 2;
        const tgtCenterX = tgt.x + tgtDim.width / 2;

        if (Math.abs(srcCenterX - tgtCenterX) <= 40) {
          tgt.x = Math.round(srcCenterX - tgtDim.width / 2);
        }
      }

      const isHoriz = (edge.sourceHandle === 'right' && edge.targetHandle === 'left') ||
                      (edge.sourceHandle === 'left' && edge.targetHandle === 'right');

      if (isHoriz) {
        const srcDim = getNodeDimensions(src);
        const tgtDim = getNodeDimensions(tgt);
        const srcCenterY = src.y + srcDim.height / 2;
        const tgtCenterY = tgt.y + tgtDim.height / 2;

        if (Math.abs(srcCenterY - tgtCenterY) <= 40) {
          tgt.y = Math.round(srcCenterY - tgtDim.height / 2);
        }
      }
    });

    setNodes([...nextNodes]);
    saveHistoryState(nextNodes, edges, drawings);
  };

  if (!diagram) return null;

  const hasSelection = selectedNodeIds.length > 0;
  const isSingleNodeSelected = selectedNodeIds.length === 1;
  const activeNode = isSingleNodeSelected ? nodes.find(n => n.id === selectedNodeIds[0]) : null;
  const activeEdge = edges.find(e => e.id === selectedEdgeId);
  const selectedDrawing = selectedDrawingId ? drawings.find(d => d.id === selectedDrawingId) : null;

  return (
    <div className="h-screen bg-paper flex flex-col text-ink font-sans overflow-hidden select-none" onMouseUp={handleMouseUp}>
      {/* Header bar */}
      <nav className="h-[60px] border-b-2 border-ink flex items-center justify-between px-3 sm:px-6 bg-paper-raised z-30 shrink-0 select-none">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Sidebar Toggle Button */}
          <button 
            type="button"
            onClick={() => setIsSidebarOpen(prev => !prev)}
            className="p-1.5 border-2 border-ink bg-paper hover:bg-paper-raised text-ink transition-colors flex items-center justify-center cursor-pointer shadow-sm"
            title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isSidebarOpen ? <PanelLeftClose className="w-4 h-4 text-blueprint" /> : <PanelLeftOpen className="w-4 h-4 text-blueprint" />}
          </button>

          <Link 
            to={`/project/${diagram.project_id}`} 
            className="p-1.5 hover:bg-paper border border-line text-ink-soft hover:text-ink transition-colors flex items-center justify-center"
            title="Back to project"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          
          <div className="min-w-0 flex flex-col">
            {isEditingTitle ? (
              <form 
                onSubmit={(e) => { 
                  e.preventDefault(); 
                  handleSaveTitle(); 
                }} 
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                  className="px-2 py-0.5 border border-ink bg-paper text-[13px] sm:text-[15px] font-bold font-sans text-ink focus:outline-none focus:border-blueprint max-w-[160px] sm:max-w-[280px] md:max-w-[360px]"
                />
              </form>
            ) : (
              <div 
                className="flex items-center gap-1.5 group cursor-pointer" 
                onClick={handleStartEditTitle} 
                title="Click to rename diagram"
              >
                <h1 className="text-[14px] sm:text-[16px] font-bold tracking-tight truncate max-w-[140px] sm:max-w-[260px] md:max-w-[400px] group-hover:text-blueprint transition-colors">
                  {diagram.title}
                </h1>
                <Edit3 className="w-3.5 h-3.5 text-ink-soft opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            )}
            <div className="font-mono text-[9.5px] sm:text-[10px] text-ink-soft uppercase hidden sm:block">
              Visual Blueprint Canvas
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 font-mono text-[12px]">
          {/* 1-Click Auto-Align / Tidy Up */}
          <button
            type="button"
            onClick={autoAlignNodes}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 border border-line hover:border-ink bg-paper text-[11px] text-ink hover:text-blueprint transition-colors cursor-pointer"
            title="Auto-align and tidy connected shapes"
          >
            <Wand2 className="w-3.5 h-3.5 text-blueprint" />
            <span>Auto-Align</span>
          </button>

          <div className="text-ink-soft flex items-center gap-1.5 text-[11px] sm:text-[12px]" role="status" aria-live="polite">
            {saveStatus === 'saving' ? (
              <><span className="w-1.5 h-1.5 rounded-full bg-signal animate-ping" /><span>Saving…</span></>
            ) : saveStatus === 'cloud-saved' ? (
              <><Check className="w-3.5 h-3.5 text-emerald-600" /><span className="hidden sm:inline">Saved</span></>
            ) : saveStatus === 'local-only' ? (
              <><Check className="w-3.5 h-3.5 text-blueprint" /><span className="hidden sm:inline">Saved on this device</span></>
            ) : saveStatus === 'cloud-failed' || saveStatus === 'failed' ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-signal shrink-0" />
                <span title={saveStatus === 'cloud-failed' ? 'Saved on this device; account save failed' : 'Could not save this diagram'}>
                  {saveStatus === 'cloud-failed' ? 'Saved on device; account save failed' : 'Save failed'}
                </span>
                <button type="button" onClick={retrySave} className="text-blueprint underline font-bold cursor-pointer">Retry</button>
              </>
            ) : (
              <span className="hidden sm:inline">Ready</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsShareOpen(true)}
            className="py-1.5 px-2.5 sm:px-3 text-[11.5px] sm:text-[12px] border-2 border-ink bg-paper hover:bg-paper-raised text-ink transition-colors flex items-center gap-1.5 font-bold cursor-pointer shadow-sm"
            title="Share & Embed Diagram"
          >
            <Share2 className="w-3.5 h-3.5 text-signal" />
            <span className="hidden sm:inline">Share</span>
          </button>
          <Button variant="primary" onClick={triggerExport} className="py-1.5 px-2.5 sm:px-3 text-[11.5px] sm:text-[12px] flex items-center gap-1">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>

          {/* Feedback & Diagnostics Trigger */}
          <button
            type="button"
            onClick={() => setIsFeedbackOpen(true)}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 border border-line hover:border-ink bg-paper text-[11px] text-ink-soft hover:text-ink transition-colors cursor-pointer"
            title="Submit Feedback or Report an Issue"
          >
            <MessageSquare className="w-3.5 h-3.5 text-blueprint" />
            <span>Feedback</span>
          </button>

          {/* Properties Inspector Toggle */}
          <button
            type="button"
            onClick={() => setIsRightSidebarOpen(prev => !prev)}
            className={`p-1.5 border-2 border-ink bg-paper hover:bg-paper-raised transition-colors flex items-center justify-center cursor-pointer shadow-sm ${
              isRightSidebarOpen ? 'border-blueprint text-blueprint' : 'text-ink-soft'
            }`}
            title={isRightSidebarOpen ? "Hide Properties Inspector" : "Show Properties Inspector"}
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Main workspace layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Drawer Backdrop */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 z-30 bg-ink bg-opacity-40 backdrop-blur-[1px] lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Left Side: Creation Tools (Toolbox & Code to Diagram) */}
        <aside 
          className={`
            fixed lg:static inset-y-0 left-0 z-40 lg:z-10
            h-full border-r-2 border-ink bg-paper flex flex-col shrink-0 select-none overflow-hidden
            transition-all duration-200 ease-in-out shadow-hard-ink lg:shadow-none
            ${isSidebarOpen ? 'w-[300px] translate-x-0' : 'w-0 -translate-x-full lg:translate-x-0 lg:w-0 border-r-0'}
          `}
        >
          {/* Dual Tabs Header */}
          <div className="h-11 border-b-2 border-ink flex bg-paper-raised shrink-0">
            <button
              type="button"
              onClick={() => setLeftSidebarTab('toolbox')}
              className={`flex-1 flex items-center justify-center gap-1.5 font-mono text-[11px] font-bold border-r border-ink transition-colors cursor-pointer ${
                leftSidebarTab === 'toolbox'
                  ? 'bg-ink text-paper'
                  : 'text-ink-soft hover:text-ink hover:bg-paper'
              }`}
            >
              <Square className="w-3.5 h-3.5 text-blueprint" />
              <span>Toolbox</span>
            </button>
            <button
              type="button"
              onClick={() => setLeftSidebarTab('code')}
              className={`flex-1 flex items-center justify-center gap-1.5 font-mono text-[11px] font-bold transition-colors cursor-pointer ${
                leftSidebarTab === 'code'
                  ? 'bg-ink text-paper'
                  : 'text-ink-soft hover:text-ink hover:bg-paper'
              }`}
            >
              <Code className="w-3.5 h-3.5 text-signal" />
              <span>Code to Diagram</span>
            </button>
          </div>

          {/* Tab 1: Shape Toolbox */}
          {leftSidebarTab === 'toolbox' && (
            <div className="p-4 flex-1 flex flex-col justify-between overflow-y-auto">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="font-mono text-[10.5px] text-blueprint uppercase tracking-wider font-bold">
                    Shape Toolbox
                  </div>
                  <button 
                    onClick={() => setIsSidebarOpen(false)}
                    className="lg:hidden text-ink-soft hover:text-ink text-[11px] font-mono cursor-pointer"
                  >
                    [close]
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {diagram.type === 'erd' || diagram.type === 'class' ? (
                    <button
                      onClick={() => addNode('table')}
                      className="w-full border-2 border-ink py-2 px-3 font-mono text-[12px] text-left bg-paper-raised hover:bg-paper hover:border-blueprint select-none transition-colors cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-blueprint" />
                        <span>Database Table</span>
                      </div>
                      <div className="w-4 h-4 rounded-full bg-blueprint border border-ink flex items-center justify-center shrink-0">
                        <Plus size={10} strokeWidth={3} className="text-white" />
                      </div>
                    </button>
                  ) : diagram.type === 'dfd' ? (
                    <>
                      <button
                        onClick={() => addNode('dfd-entity')}
                        className="w-full border-2 border-ink py-2 px-3 font-mono text-[12px] text-left bg-paper-raised hover:bg-paper select-none transition-colors cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <Square className="w-3.5 h-3.5 text-blueprint" />
                          <span>External Entity</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-blueprint border border-ink flex items-center justify-center shrink-0">
                          <Plus size={10} strokeWidth={3} className="text-white" />
                        </div>
                      </button>
                      <button
                        onClick={() => addNode('dfd-process')}
                        className="w-full border-2 border-ink py-2 px-3 font-mono text-[12px] text-left bg-paper-raised hover:bg-paper select-none transition-colors cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <Circle className="w-3.5 h-3.5 text-blueprint" />
                          <span>Transform Process</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-blueprint border border-ink flex items-center justify-center shrink-0">
                          <Plus size={10} strokeWidth={3} className="text-white" />
                        </div>
                      </button>
                      <button
                        onClick={() => addNode('dfd-store')}
                        className="w-full border-2 border-ink py-2 px-3 font-mono text-[12px] text-left bg-paper-raised hover:bg-paper select-none transition-colors cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-2.5 border-y border-ink" />
                          <span>Data Store</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-blueprint border border-ink flex items-center justify-center shrink-0">
                          <Plus size={10} strokeWidth={3} className="text-white" />
                        </div>
                      </button>
                    </>
                  ) : diagram.type === 'usecase' ? (
                    <>
                      <button
                        onClick={() => addNode('usecase-actor')}
                        className="w-full border-2 border-ink py-2 px-3 font-mono text-[12px] text-left bg-paper-raised hover:bg-paper select-none transition-colors cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <span>👤</span>
                          <span>User Actor</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-blueprint border border-ink flex items-center justify-center shrink-0">
                          <Plus size={10} strokeWidth={3} className="text-white" />
                        </div>
                      </button>
                      <button
                        onClick={() => addNode('usecase-oval')}
                        className="w-full border-2 border-ink py-2 px-3 font-mono text-[12px] text-left bg-paper-raised hover:bg-paper select-none transition-colors cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <Circle className="w-3.5 h-3.5 text-blueprint" />
                          <span>Use Case Oval</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-blueprint border border-ink flex items-center justify-center shrink-0">
                          <Plus size={10} strokeWidth={3} className="text-white" />
                        </div>
                      </button>
                      <button
                        onClick={() => addNode('usecase-boundary')}
                        className="w-full border-2 border-ink py-2 px-3 font-mono text-[12px] text-left bg-paper-raised hover:bg-paper select-none transition-colors cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <Square className="w-3.5 h-3.5 text-ink-soft" />
                          <span>System Boundary</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-blueprint border border-ink flex items-center justify-center shrink-0">
                          <Plus size={10} strokeWidth={3} className="text-white" />
                        </div>
                      </button>
                    </>
                  ) : diagram.type === 'activity' ? (
                    <>
                      <button
                        onClick={() => addNode('activity-start')}
                        className="w-full border-2 border-ink py-2 px-3 font-mono text-[12px] text-left bg-paper-raised hover:bg-paper select-none transition-colors cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <Circle className="w-3.5 h-3.5 fill-ink" />
                          <span>Start State</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-blueprint border border-ink flex items-center justify-center shrink-0">
                          <Plus size={10} strokeWidth={3} className="text-white" />
                        </div>
                      </button>
                      <button
                        onClick={() => addNode('activity-action')}
                        className="w-full border-2 border-ink py-2 px-3 font-mono text-[12px] text-left bg-paper-raised hover:bg-paper select-none transition-colors cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <Square className="w-3.5 h-3.5 text-blueprint" />
                          <span>Action Step</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-blueprint border border-ink flex items-center justify-center shrink-0">
                          <Plus size={10} strokeWidth={3} className="text-white" />
                        </div>
                      </button>
                      <button
                        onClick={() => addNode('activity-decision')}
                        className="w-full border-2 border-ink py-2 px-3 font-mono text-[12px] text-left bg-paper-raised hover:bg-paper select-none transition-colors cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <Diamond className="w-3.5 h-3.5 text-signal" />
                          <span>Decision Diamond</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-blueprint border border-ink flex items-center justify-center shrink-0">
                          <Plus size={10} strokeWidth={3} className="text-white" />
                        </div>
                      </button>
                      <button
                        onClick={() => addNode('activity-fork')}
                        className="w-full border-2 border-ink py-2 px-3 font-mono text-[12px] text-left bg-paper-raised hover:bg-paper select-none transition-colors cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-1 bg-ink" />
                          <span>Fork / Join Bar</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-blueprint border border-ink flex items-center justify-center shrink-0">
                          <Plus size={10} strokeWidth={3} className="text-white" />
                        </div>
                      </button>
                      <button
                        onClick={() => addNode('activity-end')}
                        className="w-full border-2 border-ink py-2 px-3 font-mono text-[12px] text-left bg-paper-raised hover:bg-paper select-none transition-colors cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <Circle className="w-3.5 h-3.5 text-ink" />
                          <span>Final State</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-blueprint border border-ink flex items-center justify-center shrink-0">
                          <Plus size={10} strokeWidth={3} className="text-white" />
                        </div>
                      </button>
                    </>
                  ) : diagram.type === 'sequence' ? (
                    <>
                      <button
                        onClick={() => addNode('process')}
                        className="w-full border-2 border-ink py-2 px-3 font-mono text-[12px] text-left bg-paper-raised hover:bg-paper select-none transition-colors cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <Square className="w-3.5 h-3.5 text-blueprint" />
                          <span>Participant</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-blueprint border border-ink flex items-center justify-center shrink-0">
                          <Plus size={10} strokeWidth={3} className="text-white" />
                        </div>
                      </button>
                      <button
                        onClick={() => addNode('sequence-activation')}
                        className="w-full border-2 border-ink py-2 px-3 font-mono text-[12px] text-left bg-paper-raised hover:bg-paper select-none transition-colors cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-3.5 border border-ink" />
                          <span>Activation Bar</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-blueprint border border-ink flex items-center justify-center shrink-0">
                          <Plus size={10} strokeWidth={3} className="text-white" />
                        </div>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => addNode('process')}
                        className="w-full border-2 border-ink py-2.5 px-3 font-mono text-[12px] text-left bg-paper-raised hover:bg-paper hover:border-blueprint select-none transition-colors cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <Square className="w-3.5 h-3.5 text-blueprint" />
                          <span>Process Step (Box)</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-blueprint border border-ink flex items-center justify-center shrink-0">
                          <Plus size={10} strokeWidth={3} className="text-white" />
                        </div>
                      </button>
                      <button
                        onClick={() => addNode('decision')}
                        className="w-full border-2 border-ink py-2.5 px-3 font-mono text-[12px] text-left bg-paper-raised hover:bg-paper hover:border-signal select-none transition-colors cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <Diamond className="w-3.5 h-3.5 text-signal" />
                          <span>Decision (Diamond)</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-blueprint border border-ink flex items-center justify-center shrink-0">
                          <Plus size={10} strokeWidth={3} className="text-white" />
                        </div>
                      </button>
                      <button
                        onClick={() => addNode('terminal')}
                        className="w-full border-2 border-ink py-2.5 px-3 font-mono text-[12px] text-left bg-paper-raised hover:bg-paper hover:border-ink select-none transition-colors cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <Circle className="w-3.5 h-3.5 text-ink" />
                          <span>Start / End (Oval)</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-blueprint border border-ink flex items-center justify-center shrink-0">
                          <Plus size={10} strokeWidth={3} className="text-white" />
                        </div>
                      </button>
                    </>
                  )}

                  {/* General Floating Text / Note Box */}
                  <div className="border-t border-line my-1"></div>
                  <button
                    onClick={() => addNode('text')}
                    className="w-full border-2 border-dashed border-ink py-2 px-3 font-mono text-[12px] text-left bg-paper-raised hover:bg-paper hover:border-blueprint select-none transition-colors cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2">
                      <Type className="w-3.5 h-3.5 text-blueprint" />
                      <span>Text Box / Note</span>
                    </div>
                    <div className="w-4 h-4 rounded-full bg-blueprint border border-ink flex items-center justify-center shrink-0">
                      <Plus size={10} strokeWidth={3} className="text-white" />
                    </div>
                  </button>
                </div>
              </div>

              {/* Instructions footnote */}
              <div className="font-mono text-[10px] text-ink-soft leading-relaxed border-t-2 border-ink pt-3 mt-4">
                <div>• Click any button to add shape</div>
                <div>• Connect via vertex circle ports</div>
                <div>• Edit properties in right sidebar</div>
              </div>
            </div>
          )}

          {/* Tab 2: Mermaid & Code Bidirectional Engine */}
          {leftSidebarTab === 'code' && (
            <div className="p-4 flex-1 flex flex-col gap-3.5 overflow-y-auto font-mono">
              {/* Top Submode Switcher */}
              <div className="flex border-2 border-ink bg-paper text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setCodeTabSubmode('import')}
                  className={`flex-1 py-1.5 text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    codeTabSubmode === 'import' ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Code → Canvas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCodeTabSubmode('export')}
                  className={`flex-1 py-1.5 text-center border-l-2 border-ink transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    codeTabSubmode === 'export' ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Canvas → Code</span>
                </button>
              </div>

              {/* Submode A: Code to Canvas (Generate & Import) */}
              {codeTabSubmode === 'import' ? (
                <>
                  {/* Starter Presets (Filtered to show only preset matching active diagram template) */}
                  {templatePresets.length > 0 && (
                    <div>
                      <div className="text-[10px] text-blueprint uppercase tracking-wider font-bold mb-1.5 flex justify-between items-center">
                        <span>
                          {diagram?.type === 'erd' 
                            ? 'ERD Schema Preset' 
                            : diagram?.type === 'flowchart' 
                            ? 'Flowchart Preset' 
                            : `${diagram?.type ? diagram.type.toUpperCase() : 'Template'} Preset`}
                        </span>
                        <span className="text-[9px] text-ink-soft">1-Click Load</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {templatePresets.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              setCodeText(preset.code);
                              setCodeDirection(preset.direction);
                            }}
                            className="px-2.5 py-1.5 text-[11px] border-2 border-ink bg-paper hover:bg-paper-raised text-ink transition-colors cursor-pointer font-bold flex items-center gap-1.5 shadow-sm"
                            title={`Load ${preset.title}`}
                          >
                            <Sparkles className="w-3.5 h-3.5 text-blueprint" />
                            <span>{preset.badge}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Flow Direction & Canvas Mode */}
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="flex flex-col gap-1">
                      <span className="text-ink-soft font-bold">DIRECTION</span>
                      <div className="flex border border-ink bg-paper">
                        <button
                          type="button"
                          onClick={() => setCodeDirection('LR')}
                          className={`flex-1 py-1 text-center font-bold cursor-pointer ${
                            codeDirection === 'LR' ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
                          }`}
                        >
                          LR (Horiz)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCodeDirection('TD')}
                          className={`flex-1 py-1 text-center font-bold border-l border-ink cursor-pointer ${
                            codeDirection === 'TD' ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
                          }`}
                        >
                          TD (Vert)
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-ink-soft font-bold">MODE</span>
                      <div className="flex border border-ink bg-paper">
                        <button
                          type="button"
                          onClick={() => setCodeMode('replace')}
                          className={`flex-1 py-1 text-center font-bold cursor-pointer ${
                            codeMode === 'replace' ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
                          }`}
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={() => setCodeMode('append')}
                          className={`flex-1 py-1 text-center font-bold border-l border-ink cursor-pointer ${
                            codeMode === 'append' ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
                          }`}
                        >
                          Append
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Code Textarea */}
                  <div className="flex flex-col gap-1 flex-1 min-h-[180px]">
                    <div className="flex justify-between items-center text-[10px] text-ink-soft font-bold">
                      <span>MERMAID / TEXT CODE</span>
                      <span className="text-[9px] text-blueprint">v10+ Syntax</span>
                    </div>
                    <textarea
                      value={codeText}
                      onChange={(e) => setCodeText(e.target.value)}
                      className="w-full flex-1 min-h-[180px] bg-[#101417] text-[#E2E8F0] text-[11px] p-2.5 border-2 border-ink resize-none focus:outline-none focus:border-blueprint leading-relaxed select-text"
                      placeholder={
                        diagram?.type === 'erd'
                          ? `Table: Users\n- id uuid pk\n- email text\n\nTable: Orders\n- id uuid pk\n- user_id uuid fk\n\nUsers --> Orders: places`
                          : `flowchart LR\n  A[Start] --> B{Is Valid?}\n  B -- Yes --> C[(Database)]\n  B -- No --> D[Error Screen]\n  D --> A`
                      }
                      spellCheck={false}
                    />
                  </div>

                  {/* Status Message */}
                  {codeStatus && (
                    <div className={`p-2 text-[10.5px] border ${
                      codeStatus.type === 'success' 
                        ? 'border-blueprint bg-blueprint/10 text-blueprint font-bold' 
                        : 'border-signal bg-signal/10 text-signal font-bold'
                    }`}>
                      {codeStatus.message}
                    </div>
                  )}

                  {/* Generate Button */}
                  <button
                    type="button"
                    onClick={handleGenerateFromCode}
                    className="w-full py-2.5 bg-ink text-paper text-[12px] font-bold border-2 border-ink hover:bg-blueprint transition-colors flex items-center justify-center shadow-hard-ink cursor-pointer gap-2"
                  >
                    <Wand2 className="w-4 h-4 text-blueprint" />
                    <span>Generate Diagram</span>
                  </button>

                  <div className="text-[9.5px] text-ink-soft border-t border-line pt-2 leading-tight">
                    Supports <code className="text-ink font-bold">flowchart LR/TD</code>, <code className="text-ink font-bold">A[(DB)]</code>, <code className="text-ink font-bold">A([Pill])</code>, <code className="text-ink font-bold">A{`{Diamond}`}</code>, <code className="text-ink font-bold">erDiagram</code>, <code className="text-ink font-bold">sequenceDiagram</code>, & chained arrows <code className="text-ink font-bold">A --&gt; B --&gt; C</code>.
                  </div>
                </>
              ) : (
                /* Submode B: Canvas to Mermaid Code (Export & Live Sync) */
                <>
                  {/* Format & Direction Controls */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center text-[10px] text-ink-soft font-bold">
                      <span>MERMAID FORMAT</span>
                      <span className="text-[9px] text-blueprint">{nodes.length} Shapes • {edges.length} Links</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="flex flex-col gap-1">
                        <span className="text-ink-soft font-bold">DIAGRAM_TYPE</span>
                        <div className="flex border border-ink bg-paper">
                          <button
                            type="button"
                            onClick={() => setExportMermaidFormat('flowchart')}
                            className={`flex-1 py-1 text-center font-bold cursor-pointer ${
                              exportMermaidFormat === 'flowchart' ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
                            }`}
                          >
                            Flowchart
                          </button>
                          <button
                            type="button"
                            onClick={() => setExportMermaidFormat('er')}
                            className={`flex-1 py-1 text-center font-bold border-l border-ink cursor-pointer ${
                              exportMermaidFormat === 'er' ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
                            }`}
                          >
                            ERD
                          </button>
                        </div>
                      </div>

                      {exportMermaidFormat === 'flowchart' && (
                        <div className="flex flex-col gap-1">
                          <span className="text-ink-soft font-bold">LAYOUT</span>
                          <div className="flex border border-ink bg-paper">
                            <button
                              type="button"
                              onClick={() => setExportMermaidDirection('LR')}
                              className={`flex-1 py-1 text-center font-bold cursor-pointer ${
                                exportMermaidDirection === 'LR' ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
                              }`}
                            >
                              LR (Horiz)
                            </button>
                            <button
                              type="button"
                              onClick={() => setExportMermaidDirection('TD')}
                              className={`flex-1 py-1 text-center font-bold border-l border-ink cursor-pointer ${
                                exportMermaidDirection === 'TD' ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
                              }`}
                            >
                              TD (Vert)
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Live Monospace Code Viewer */}
                  <div className="flex flex-col gap-1 flex-1 min-h-[180px]">
                    <div className="flex justify-between items-center text-[10px] text-ink-soft font-bold">
                      <span>GENERATED_MERMAID</span>
                      <span className="text-[9px] text-[#38A169] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#38A169]" />
                        Live Synced
                      </span>
                    </div>
                    <div className="w-full flex-1 min-h-[180px] bg-[#101417] text-[#E2E8F0] text-[11px] p-2.5 border-2 border-ink resize-none overflow-auto leading-relaxed select-text">
                      <pre className="whitespace-pre font-mono">{generatedMermaidCode}</pre>
                    </div>
                  </div>

                  {/* Export Action Buttons */}
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleCopyMermaidCode}
                      className="w-full py-2.5 bg-ink text-paper text-[12px] font-bold border-2 border-ink hover:bg-blueprint transition-colors flex items-center justify-center shadow-hard-ink cursor-pointer gap-2"
                    >
                      {mermaidCopiedSuccess ? (
                        <>
                          <Check className="w-4 h-4 text-blueprint" />
                          <span className="text-blueprint">Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy Mermaid Code</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadMermaidFile}
                      className="w-full py-2 bg-paper text-ink text-[11px] font-bold border-2 border-ink hover:bg-paper-raised transition-colors flex items-center justify-center cursor-pointer gap-2"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download (.mmd)</span>
                    </button>
                  </div>

                  <div className="text-[9.5px] text-ink-soft border-t border-line pt-2 leading-tight">
                    Ready to paste into GitHub Markdown <code className="text-ink font-bold">```mermaid</code>, Notion, Obsidian, or Mermaid Live Editor.
                  </div>
                </>
              )}
            </div>
          )}
        </aside>

        {/* Right Side: Interactive Visual Grid Canvas */}
        <div 
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleCanvasWheel}
          onContextMenu={(e) => handleContextMenu(e, null)}
          className={`flex-1 relative overflow-hidden diagram-canvas ${
            canvasGridStyle === 'dots' ? 'bg-grid-dots' :
            canvasGridStyle === 'blank' ? 'bg-grid-blank' :
            'bg-grid-lines'
          } ${
            activeMode === 'pan' ? 'cursor-grab active:cursor-grabbing' : 
            activeMode === 'mark' ? 'cursor-crosshair' : 
            activeMode === 'draw' ? (pencilTool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair') : 'cursor-default'
          }`}
        >
          {/* Floating Quick Inspector when sidebar is collapsed */}
          {!isSidebarOpen && isSingleNodeSelected && activeNode && (
            <div className="absolute top-4 left-4 z-20 bg-paper-raised border-2 border-ink p-2.5 sm:p-3 shadow-hard-ink font-mono text-[12px] flex items-center gap-2 max-w-[90vw]">
              <span className="text-[11px] font-bold text-ink shrink-0">Label:</span>
              <input
                type="text"
                value={activeNode.label}
                onChange={(e) => updateSelectedNodeLabel(e.target.value)}
                className="border-2 border-ink bg-paper px-2 py-1 text-[12px] font-mono focus:outline-none w-32 sm:w-48"
              />
              <button
                onClick={deleteSelectedNodes}
                className="p-1 border border-line hover:border-signal text-ink-soft hover:text-signal transition-colors cursor-pointer"
                title="Delete shape"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-1 text-ink-soft hover:text-ink text-[11px] border border-line px-2 font-bold cursor-pointer"
                title="Open full inspector"
              >
                Details →
              </button>
            </div>
          )}

          {/* Floating Pencil Subtool Dock when Draw Mode is active */}
          {activeMode === 'draw' && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-paper-raised border-2 border-ink shadow-hard-ink px-3 py-1.5 text-[12px] font-mono select-none">
              {/* Tool Mode: Pen, Highlighter, Eraser */}
              <div className="flex border border-ink bg-paper">
                <button
                  type="button"
                  onClick={() => setPencilTool('pen')}
                  className={`px-2.5 py-1 flex items-center gap-1.5 transition-colors cursor-pointer ${
                    pencilTool === 'pen' ? 'bg-ink text-paper font-bold' : 'text-ink-soft hover:text-ink'
                  }`}
                  title="Pen (Opaque Stroke)"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Pen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPencilTool('highlighter')}
                  className={`px-2.5 py-1 border-l border-ink flex items-center gap-1.5 transition-colors cursor-pointer ${
                    pencilTool === 'highlighter' ? 'bg-ink text-paper font-bold' : 'text-ink-soft hover:text-ink'
                  }`}
                  title="Highlighter (Translucent Stroke)"
                >
                  <Highlighter className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Highlighter</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPencilTool('eraser')}
                  className={`px-2.5 py-1 border-l border-ink flex items-center gap-1.5 transition-colors cursor-pointer ${
                    pencilTool === 'eraser' ? 'bg-ink text-paper font-bold' : 'text-ink-soft hover:text-ink'
                  }`}
                  title="Eraser (Click or drag over strokes to delete)"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Eraser</span>
                </button>
              </div>

              {/* Color Presets & Custom Picker */}
              {pencilTool !== 'eraser' && (
                <>
                  <div className="w-[1.5px] h-5 bg-line"></div>
                  <div className="flex items-center gap-1">
                    {PENCIL_COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setPencilColor(preset.value)}
                        className={`w-5 h-5 rounded-full border border-ink transition-transform cursor-pointer ${
                          pencilColor === preset.value ? 'scale-125 ring-2 ring-blueprint' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: preset.value }}
                        title={preset.label}
                      />
                    ))}
                    <label className="w-5 h-5 rounded-full border border-dashed border-ink flex items-center justify-center cursor-pointer relative overflow-hidden ml-0.5" title="Custom color">
                      <input
                        type="color"
                        value={pencilColor}
                        onChange={(e) => setPencilColor(e.target.value)}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                      <Palette className="w-2.5 h-2.5 text-ink-soft" />
                    </label>
                  </div>
                </>
              )}

              {/* Stroke Width Presets */}
              {pencilTool !== 'eraser' && (
                <>
                  <div className="w-[1.5px] h-5 bg-line"></div>
                  <div className="flex items-center gap-1">
                    {PENCIL_WIDTH_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setPencilWidth(preset.value)}
                        className={`px-1.5 py-0.5 border text-[10px] cursor-pointer transition-colors ${
                          pencilWidth === preset.value
                            ? 'border-ink bg-ink text-paper font-bold'
                            : 'border-line text-ink-soft hover:border-ink hover:text-ink'
                        }`}
                        title={`${preset.label} (${preset.value}px)`}
                      >
                        {preset.value}px
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Clear All Drawings button */}
              {drawings.length > 0 && (
                <>
                  <div className="w-[1.5px] h-5 bg-line"></div>
                  <button
                    type="button"
                    onClick={clearAllDrawings}
                    className="p-1 border border-line hover:border-signal text-ink-soft hover:text-signal transition-colors cursor-pointer flex items-center gap-1 text-[10px]"
                    title="Clear all drawings"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                </>
              )}

              {/* Done button to exit drawing mode */}
              <div className="w-[1.5px] h-5 bg-line"></div>
              <button
                type="button"
                onClick={() => setActiveMode('select')}
                className="px-2 py-1 bg-ink text-paper text-[10.5px] font-bold border border-ink hover:bg-blueprint transition-colors flex items-center gap-1 cursor-pointer"
                title="Done drawing (Shortcut: V or Esc)"
              >
                <Check className="w-3 h-3" />
                <span>Done</span>
              </button>
            </div>
          )}

          {/* S09 Horizontal Floating Mode Selector Toolbar (V, M, H, etc.) at bottom middle */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-row items-center bg-paper-raised border-[1.5px] border-ink rounded-full shadow-hard-ink select-none h-11 px-4 gap-3">
            {/* Select mode V */}
            <button
              onClick={() => setActiveMode('select')}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors border border-transparent ${
                activeMode === 'select' 
                  ? 'bg-ink text-paper border-ink' 
                  : 'text-ink hover:bg-paper hover:border-line'
              }`}
              title="Select / Move / Connect (Shortcut: V)"
            >
              <MousePointer className="w-4 h-4" />
            </button>

            {/* Mark mode M */}
            <button
              onClick={() => {
                setActiveMode('mark');
                setSelectedNodeIds([]);
                setSelectedEdgeId(null);
              }}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors border border-transparent ${
                activeMode === 'mark' 
                  ? 'bg-ink text-paper border-ink' 
                  : 'text-ink hover:bg-paper hover:border-line'
              }`}
              title="Marquee Selection Rectangle (Shortcut: M)"
            >
              <div className="w-3.5 h-3.5 border-dashed border border-current rounded-none"></div>
            </button>

            {/* Pencil mode P */}
            <button
              onClick={() => {
                setActiveMode('draw');
                setSelectedNodeIds([]);
                setSelectedEdgeId(null);
              }}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors border border-transparent ${
                activeMode === 'draw' 
                  ? 'bg-ink text-paper border-ink' 
                  : 'text-ink hover:bg-paper hover:border-line'
              }`}
              title="Pencil Drawing Sketches (Shortcut: P)"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>

            {/* Pan mode H */}
            <button
              onClick={() => setActiveMode('pan')}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors border border-transparent ${
                activeMode === 'pan' 
                  ? 'bg-ink text-paper border-ink' 
                  : 'text-ink hover:bg-paper hover:border-line'
              }`}
              title="Hand Pan Canvas (Shortcut: H)"
            >
              <Hand className="w-4 h-4" />
            </button>

            {/* Divider */}
            <div className="w-[1.5px] h-6 bg-line mx-1"></div>

            {/* Undo */}
            <button
              onClick={undo}
              disabled={historyState.index <= 0}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors border border-transparent ${
                historyState.index > 0 
                  ? 'text-ink hover:bg-paper hover:border-line cursor-pointer' 
                  : 'text-ink-soft opacity-30 cursor-not-allowed'
              }`}
              title="Undo (Ctrl+Z)"
            >
              <Undo className="w-4 h-4" />
            </button>

            {/* Redo */}
            <button
              onClick={redo}
              disabled={historyState.index >= historyState.list.length - 1}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors border border-transparent ${
                historyState.index < historyState.list.length - 1 
                  ? 'text-ink hover:bg-paper hover:border-line cursor-pointer' 
                  : 'text-ink-soft opacity-30 cursor-not-allowed'
              }`}
              title="Redo (Ctrl+Y)"
            >
              <Redo className="w-4 h-4" />
            </button>
          </div>

          {/* Canvas Floating Zoom & Grid controls */}
          <div className="absolute top-4 right-4 z-10 flex border border-line bg-paper-raised shadow-hard-ink font-mono text-[11px] select-none">
            {/* Grid Pattern Selector */}
            <button 
              onClick={handleToggleGridStyle} 
              className="px-2 py-1.5 border-r border-line hover:bg-paper flex items-center gap-1 cursor-pointer text-[10.5px] text-ink-soft hover:text-ink" 
              title={`Grid Pattern: ${canvasGridStyle} (Click to switch)`}
            >
              <Grid className="w-3.5 h-3.5 text-blueprint" />
              <span className="hidden sm:inline uppercase text-[9.5px]">{canvasGridStyle}</span>
            </button>

            {/* Magnetic Snap toggle */}
            <button 
              onClick={handleToggleSnap} 
              className={`px-2 py-1.5 border-r border-line hover:bg-paper flex items-center gap-1 cursor-pointer text-[10.5px] ${
                isSnapToGrid ? 'text-blueprint font-bold bg-blueprint/5' : 'text-ink-soft'
              }`} 
              title={isSnapToGrid ? "Magnetic Snap: 20px ON" : "Magnetic Snap: OFF (Freeform)"}
            >
              <Magnet className={`w-3.5 h-3.5 ${isSnapToGrid ? 'text-blueprint' : 'text-ink-soft'}`} />
              <span className="hidden sm:inline">{isSnapToGrid ? 'Snap' : 'Free'}</span>
            </button>

            <button onClick={handleZoomOut} className="px-2.5 py-1.5 border-r border-line hover:bg-paper flex items-center justify-center cursor-pointer" title="Zoom Out">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2.5 py-1.5 border-r border-line min-w-[46px] text-center flex items-center justify-center font-bold text-[11px]">
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={handleZoomIn} className="px-2.5 py-1.5 border-r border-line hover:bg-paper flex items-center justify-center cursor-pointer" title="Zoom In">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleFitToScreen} className="px-2.5 py-1.5 border-r border-line hover:bg-paper flex items-center gap-1 cursor-pointer text-[10.5px]" title="Fit Diagram to Canvas View">
              <Maximize2 className="w-3 h-3 text-blueprint" />
              <span>Fit</span>
            </button>
            <button onClick={handleResetZoom} className="px-2.5 py-1.5 hover:bg-paper flex items-center justify-center cursor-pointer text-[10.5px]" title="Center Diagram">
              Reset
            </button>
          </div>

          {/* Canvas content element translation viewport */}
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
            className="absolute inset-0 pointer-events-none"
          >
            {/* SVG rendering layer */}
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
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={dc.ink} />
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
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={dc.blueprint} />
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
                  <line x1="0" y1="8" x2="16" y2="8" stroke={dc.ink} strokeWidth="1.5" />
                  <line x1="12" y1="2" x2="12" y2="14" stroke={dc.ink} strokeWidth="1.5" strokeLinecap="round" />
                </marker>
                <marker
                  id="crows-one-selected"
                  viewBox="0 0 16 16"
                  refX="16"
                  refY="8"
                  markerWidth="16"
                  markerHeight="16"
                  orient="auto-start-reverse"
                >
                  <line x1="0" y1="8" x2="16" y2="8" stroke={dc.blueprint} strokeWidth="2.5" />
                  <line x1="12" y1="2" x2="12" y2="14" stroke={dc.blueprint} strokeWidth="2.5" strokeLinecap="round" />
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
                  <line x1="0" y1="8" x2="16" y2="8" stroke={dc.ink} strokeWidth="1.5" />
                  <line x1="7" y1="2" x2="7" y2="14" stroke={dc.ink} strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="12" y1="2" x2="12" y2="14" stroke={dc.ink} strokeWidth="1.5" strokeLinecap="round" />
                </marker>
                <marker
                  id="crows-one-only-selected"
                  viewBox="0 0 16 16"
                  refX="16"
                  refY="8"
                  markerWidth="16"
                  markerHeight="16"
                  orient="auto-start-reverse"
                >
                  <line x1="0" y1="8" x2="16" y2="8" stroke={dc.blueprint} strokeWidth="2.5" />
                  <line x1="7" y1="2" x2="7" y2="14" stroke={dc.blueprint} strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="12" y1="2" x2="12" y2="14" stroke={dc.blueprint} strokeWidth="2.5" strokeLinecap="round" />
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
                  <line x1="0" y1="8" x2="16" y2="8" stroke={dc.ink} strokeWidth="1.5" />
                  <circle cx="10" cy="8" r="3.75" fill={dc.paperRaised} stroke={dc.ink} strokeWidth="1.5" />
                </marker>
                <marker
                  id="crows-zero-one-selected"
                  viewBox="0 0 16 16"
                  refX="16"
                  refY="8"
                  markerWidth="16"
                  markerHeight="16"
                  orient="auto-start-reverse"
                >
                  <line x1="0" y1="8" x2="16" y2="8" stroke={dc.blueprint} strokeWidth="2.5" />
                  <circle cx="10" cy="8" r="3.75" fill={dc.paperRaised} stroke={dc.blueprint} strokeWidth="2.2" />
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
                  <line x1="0" y1="8" x2="16" y2="8" stroke={dc.ink} strokeWidth="1.5" />
                  <line x1="5" y1="8" x2="15.5" y2="2" stroke={dc.ink} strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="5" y1="8" x2="15.5" y2="14" stroke={dc.ink} strokeWidth="1.5" strokeLinecap="round" />
                </marker>
                <marker
                  id="crows-many-selected"
                  viewBox="0 0 16 16"
                  refX="16"
                  refY="8"
                  markerWidth="16"
                  markerHeight="16"
                  orient="auto-start-reverse"
                >
                  <line x1="0" y1="8" x2="16" y2="8" stroke={dc.blueprint} strokeWidth="2.5" />
                  <line x1="5" y1="8" x2="15.5" y2="2" stroke={dc.blueprint} strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="5" y1="8" x2="15.5" y2="14" stroke={dc.blueprint} strokeWidth="2.5" strokeLinecap="round" />
                </marker>

                {/* Crow's Foot: One or More / One or Many (|{) */}
                <marker
                  id="crows-one-many"
                  viewBox="0 0 16 16"
                  refX="16"
                  refY="8"
                  markerWidth="16"
                  markerHeight="16"
                  orient="auto-start-reverse"
                >
                  <line x1="0" y1="8" x2="16" y2="8" stroke={dc.ink} strokeWidth="1.5" />
                  <line x1="4" y1="2" x2="4" y2="14" stroke={dc.ink} strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="5" y1="8" x2="15.5" y2="2" stroke={dc.ink} strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="5" y1="8" x2="15.5" y2="14" stroke={dc.ink} strokeWidth="1.5" strokeLinecap="round" />
                </marker>
                <marker
                  id="crows-one-many-selected"
                  viewBox="0 0 16 16"
                  refX="16"
                  refY="8"
                  markerWidth="16"
                  markerHeight="16"
                  orient="auto-start-reverse"
                >
                  <line x1="0" y1="8" x2="16" y2="8" stroke={dc.blueprint} strokeWidth="2.5" />
                  <line x1="4" y1="2" x2="4" y2="14" stroke={dc.blueprint} strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="5" y1="8" x2="15.5" y2="2" stroke={dc.blueprint} strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="5" y1="8" x2="15.5" y2="14" stroke={dc.blueprint} strokeWidth="2.5" strokeLinecap="round" />
                </marker>

                {/* Crow's Foot: Zero or More / Zero-Many (o{) */}
                <marker
                  id="crows-zero-many"
                  viewBox="0 0 16 16"
                  refX="16"
                  refY="8"
                  markerWidth="16"
                  markerHeight="16"
                  orient="auto-start-reverse"
                >
                  <line x1="0" y1="8" x2="16" y2="8" stroke={dc.ink} strokeWidth="1.5" />
                  <circle cx="4" cy="8" r="3" fill={dc.paperRaised} stroke={dc.ink} strokeWidth="1.5" />
                  <line x1="7" y1="8" x2="15.5" y2="2" stroke={dc.ink} strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="7" y1="8" x2="15.5" y2="14" stroke={dc.ink} strokeWidth="1.5" strokeLinecap="round" />
                </marker>
                <marker
                  id="crows-zero-many-selected"
                  viewBox="0 0 16 16"
                  refX="16"
                  refY="8"
                  markerWidth="16"
                  markerHeight="16"
                  orient="auto-start-reverse"
                >
                  <line x1="0" y1="8" x2="16" y2="8" stroke={dc.blueprint} strokeWidth="2.5" />
                  <circle cx="4" cy="8" r="3" fill={dc.paperRaised} stroke={dc.blueprint} strokeWidth="2.2" />
                  <line x1="7" y1="8" x2="15.5" y2="2" stroke={dc.blueprint} strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="7" y1="8" x2="15.5" y2="14" stroke={dc.blueprint} strokeWidth="2.5" strokeLinecap="round" />
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
                      stroke={dc.inkSoft}
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                  );
                })}

              {/* Render freehand pencil drawings */}
              {drawings.map((draw) => {
                const isSelected = selectedDrawingId === draw.id;
                const strokeWidth = draw.width || 2;
                const strokeColor = draw.color || '#D45B33';
                const strokeOpacity = draw.opacity ?? 1;

                return (
                  <g key={draw.id} className="group">
                    {/* Selected halo indicator */}
                    {isSelected && (
                      <path
                        d={draw.path}
                        fill="none"
                        stroke={dc.blueprint}
                        strokeWidth={strokeWidth + 6}
                        strokeOpacity={0.35}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Actual visible stroke */}
                    <path
                      d={draw.path}
                      fill="none"
                      stroke={isSelected ? dc.blueprint : strokeColor}
                      strokeWidth={strokeWidth}
                      strokeOpacity={strokeOpacity}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="pointer-events-none"
                    />

                    {/* Invisible thick hit target for easy selection and erasing */}
                    <path
                      d={draw.path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={Math.max(strokeWidth + 14, 20)}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`pointer-events-auto ${
                        activeMode === 'draw' && pencilTool === 'eraser'
                          ? 'cursor-cell hover:stroke-signal/20'
                          : activeMode === 'select'
                          ? 'cursor-pointer hover:stroke-blueprint/20'
                          : ''
                      }`}
                      onClick={(e) => {
                        if (activeMode === 'draw' && pencilTool === 'eraser') {
                          e.stopPropagation();
                          deleteDrawing(draw.id);
                        } else if (activeMode === 'select') {
                          e.stopPropagation();
                          setSelectedDrawingId(draw.id);
                          setSelectedNodeIds([]);
                          setSelectedEdgeId(null);
                        }
                      }}
                      onMouseEnter={(e) => {
                        if (activeMode === 'draw' && pencilTool === 'eraser' && e.buttons === 1) {
                          deleteDrawing(draw.id);
                        }
                      }}
                    />
                  </g>
                );
              })}

              {/* Render current active pencil sketch */}
              {activeDrawingPoints && activeDrawingPoints.length > 1 && (() => {
                const isHighlighter = pencilTool === 'highlighter';
                return (
                  <path
                    d={pointsToSmoothSvgPath(activeDrawingPoints)}
                    fill="none"
                    stroke={pencilColor}
                    strokeWidth={isHighlighter ? Math.max(pencilWidth, 8) : pencilWidth}
                    strokeOpacity={isHighlighter ? 0.4 : 1}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })()}

              {/* Render connector edges */}
              {edges.map((edge) => {
                const isSelected = selectedEdgeId === edge.id;
                const path = getEdgePath(edge);
                if (!path) return null;

                const { x: labelX, y: routeLabelY } = getEdgeLabelPosition(path);
                const labelY = routeLabelY - 8;

                return (
                  <g key={edge.id} className="cursor-pointer">
                    <path
                      d={path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="14"
                      onMouseDown={(e) => {
                        if (activeMode !== 'select') return;
                        e.stopPropagation();
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeIds([]);
                        setSelectedDrawingId(null);
                      }}
                      onClick={(e) => {
                        if (activeMode !== 'select') return;
                        e.stopPropagation();
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeIds([]);
                        setSelectedDrawingId(null);
                      }}
                    />
                    {(() => {
                      const markerStartUrl = getMarkerUrl(edge.sourceMarker, edge.arrow, true, isSelected);
                      const markerEndUrl = getMarkerUrl(edge.targetMarker, edge.arrow, false, isSelected);
                      return (
                        <path
                          key={`edge-${edge.id}-${isSelected ? '1' : '0'}`}
                          d={path}
                          fill="none"
                          stroke={isSelected ? dc.blueprint : dc.ink}
                          strokeWidth={isSelected ? '2.5' : '1.5'}
                          strokeDasharray={edge.style === 'dashed' ? '5 5' : undefined}
                          markerStart={markerStartUrl}
                          markerEnd={markerEndUrl}
                          onMouseDown={(e) => {
                            if (activeMode !== 'select') return;
                            e.stopPropagation();
                            setSelectedEdgeId(edge.id);
                            setSelectedNodeIds([]);
                            setSelectedDrawingId(null);
                          }}
                          onClick={(e) => {
                            if (activeMode !== 'select') return;
                            e.stopPropagation();
                            setSelectedEdgeId(edge.id);
                            setSelectedNodeIds([]);
                            setSelectedDrawingId(null);
                          }}
                        />
                      );
                    })()}
                    {edge.label && (
                      <g className="pointer-events-none">
                        <rect
                          x={labelX - (edge.label.length * 3.5 + 8)}
                          y={labelY - 9}
                          width={edge.label.length * 7 + 16}
                          height="18"
                          fill={dc.paperRaised}
                          stroke={dc.ink}
                          strokeWidth="1.5"
                          rx="2"
                        />
                        <text
                          x={labelX}
                          y={labelY + 3.5}
                          fill={dc.ink}
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

              {/* Render temporary connect port edge line */}
              {connectingPort && (() => {
                const srcNode = nodes.find(n => n.id === connectingPort.nodeId);
                if (!srcNode) return null;
                const start = getPortCoords(srcNode, connectingPort.port);
                return (
                  <g>
                    <line
                      x1={start.x}
                      y1={start.y}
                      x2={tempEdgeEnd.x}
                      y2={tempEdgeEnd.y}
                      stroke={snappedPort ? "#00A8FF" : dc.blueprint}
                      strokeWidth={snappedPort ? "2" : "1.5"}
                      strokeDasharray="4 4"
                      markerEnd="url(#arrow)"
                    />
                    {snappedPort && (
                      <circle
                        cx={tempEdgeEnd.x}
                        cy={tempEdgeEnd.y}
                        r="6"
                        fill="#00A8FF"
                        fillOpacity="0.35"
                        stroke="#00A8FF"
                        strokeWidth="1.5"
                      />
                    )}
                  </g>
                );
              })()}

              {/* Dynamic magnetic alignment guide lines */}
              {alignmentGuides.map((guide, idx) => (
                <line
                  key={`guide-${idx}`}
                  x1={guide.x1}
                  y1={guide.y1}
                  x2={guide.x2}
                  y2={guide.y2}
                  stroke={dc.blueprint}
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  className="pointer-events-none"
                />
              ))}
            </svg>

            {/* Interactive HTML Card Nodes */}
            <div className="absolute inset-0 pointer-events-none">
              {nodes.map((node) => {
                const isSelected = selectedNodeIds.includes(node.id);
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

                let shapeClasses = "bg-paper-raised border-ink flex flex-col justify-between p-4";
                if (isDiamond) {
                  shapeClasses = "bg-transparent border-0 flex items-center justify-center p-0 shadow-none";
                } else if (node.type === 'text') {
                  shapeClasses = "bg-transparent flex items-center justify-center p-2";
                } else if (node.type === 'table') {
                  shapeClasses = "border-ink bg-paper-raised flex flex-col p-0";
                } else if (node.type === 'terminal') {
                  shapeClasses = "rounded-[20px] bg-paper-raised border-ink flex items-center justify-center p-2";
                } else if (node.type === 'dfd-store') {
                  shapeClasses = "border-y border-x-0 border-ink bg-paper-raised flex flex-col justify-center p-2";
                } else if (node.type === 'dfd-entity') {
                  shapeClasses = "border-ink bg-paper-raised flex flex-col justify-between p-4";
                } else if (node.type === 'dfd-process') {
                  shapeClasses = "border-ink bg-paper-raised flex flex-col p-0";
                } else if (node.type === 'usecase-actor') {
                  shapeClasses = "flex flex-col items-center justify-center p-1 bg-transparent border-0 select-none shadow-none";
                } else if (node.type === 'usecase-oval') {
                  shapeClasses = "rounded-[50%] bg-paper-raised border-ink flex items-center justify-center p-3 text-center";
                } else if (node.type === 'usecase-boundary') {
                  shapeClasses = "border-dashed border-ink bg-paper bg-opacity-20 flex flex-col justify-start p-3";
                } else if (node.type === 'sequence-activation') {
                  shapeClasses = "border-ink bg-paper-raised flex items-center justify-center p-0";
                } else if (node.type === 'activity-start') {
                  shapeClasses = "rounded-full bg-ink flex items-center justify-center p-0 border-0";
                } else if (node.type === 'activity-end') {
                  shapeClasses = "rounded-full bg-transparent border-ink flex items-center justify-center p-0";
                } else if (node.type === 'activity-action') {
                  shapeClasses = "rounded-xl bg-paper-raised border-ink flex items-center justify-center p-2";
                } else if (node.type === 'activity-fork') {
                  shapeClasses = "bg-ink flex items-center justify-center p-0 border-0 rounded-[1px]";
                }

                return (
                  <div
                    key={node.id}
                    onMouseDown={(e) => handleNodeMouseDown(e, node)}
                    onMouseUp={(e) => handleNodeMouseUp(e, node)}
                    onContextMenu={(e) => handleContextMenu(e, node.id)}
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
                    className={`absolute pointer-events-auto select-none ${
                      draggedNodeId === node.id ? 'cursor-grabbing z-20 shadow-xl' : isSelected ? 'cursor-grab' : 'cursor-default'
                    } ${shapeClasses} ${
                      isSelected && !isDiamond
                        ? nodeBorderStyle === 'none'
                          ? '!border !border-dashed !border-blueprint'
                          : 'border-blueprint !border-2'
                        : ''
                    }`}
                  >
                    {/* Connection ports (visible on node selection in select mode or active port connection lines) */}
                    {(isSelected || connectingPort) && activeMode === 'select' && (
                      <>
                        <div 
                          onMouseDown={(e) => handlePortMouseDown(e, node.id, 'top')} 
                          onMouseUp={(e) => handlePortMouseUp(e, node.id, 'top')}
                          className={`canvas-port port-top ${
                            snappedPort?.nodeId === node.id && snappedPort?.port === 'top' ? 'port-snapped' : ''
                          }`}
                          title="Connect Top" 
                        >
                          <Plus size={10} strokeWidth={3} className="text-white" />
                        </div>
                        <div 
                          onMouseDown={(e) => handlePortMouseDown(e, node.id, 'bottom')} 
                          onMouseUp={(e) => handlePortMouseUp(e, node.id, 'bottom')}
                          className={`canvas-port port-bottom ${
                            snappedPort?.nodeId === node.id && snappedPort?.port === 'bottom' ? 'port-snapped' : ''
                          }`}
                          title="Connect Bottom" 
                        >
                          <Plus size={10} strokeWidth={3} className="text-white" />
                        </div>
                        <div 
                          onMouseDown={(e) => handlePortMouseDown(e, node.id, 'left')} 
                          onMouseUp={(e) => handlePortMouseUp(e, node.id, 'left')}
                          className={`canvas-port port-left ${
                            snappedPort?.nodeId === node.id && snappedPort?.port === 'left' ? 'port-snapped' : ''
                          }`}
                          title="Connect Left" 
                        >
                          <Plus size={10} strokeWidth={3} className="text-white" />
                        </div>
                        <div 
                          onMouseDown={(e) => handlePortMouseDown(e, node.id, 'right')} 
                          onMouseUp={(e) => handlePortMouseUp(e, node.id, 'right')}
                          className={`canvas-port port-right ${
                            snappedPort?.nodeId === node.id && snappedPort?.port === 'right' ? 'port-snapped' : ''
                          }`}
                          title="Connect Right" 
                        >
                          <Plus size={10} strokeWidth={3} className="text-white" />
                        </div>
                      </>
                    )}

                    {/* Resize handles (8 directions) - shown on selected resizable shapes */}
                    {isSelected && activeMode === 'select' && isResizable(node.type) && !connectingPort && (
                      <>
                        <div className="resize-handle handle-nw" onMouseDown={(e) => handleResizeMouseDown(e, node.id, 'nw')} />
                        <div className="resize-handle handle-n" onMouseDown={(e) => handleResizeMouseDown(e, node.id, 'n')} />
                        <div className="resize-handle handle-ne" onMouseDown={(e) => handleResizeMouseDown(e, node.id, 'ne')} />
                        <div className="resize-handle handle-e" onMouseDown={(e) => handleResizeMouseDown(e, node.id, 'e')} />
                        <div className="resize-handle handle-se" onMouseDown={(e) => handleResizeMouseDown(e, node.id, 'se')} />
                        <div className="resize-handle handle-s" onMouseDown={(e) => handleResizeMouseDown(e, node.id, 's')} />
                        <div className="resize-handle handle-sw" onMouseDown={(e) => handleResizeMouseDown(e, node.id, 'sw')} />
                        <div className="resize-handle handle-w" onMouseDown={(e) => handleResizeMouseDown(e, node.id, 'w')} />
                      </>
                    )}

                    {/* Shape Specific Content Renderers */}
                    {isDiamond ? (
                      <div className="relative w-full h-full flex items-center justify-center pointer-events-none select-none">
                        {/* SVG Polygon Diamond with Offset Blueprint/Ink Shadow */}
                        <svg 
                          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" 
                          viewBox={`0 0 ${width} ${height}`}
                        >
                          {/* Hard Offset Shadow */}
                          {node.shadowAccent !== 'none' && (
                            <polygon
                              points={`${width / 2 + 3},${3} ${width + 3},${height / 2 + 3} ${width / 2 + 3},${height + 3} ${3},${height / 2 + 3}`}
                              fill={node.shadowAccent || (colorVal === 1 ? '#1E5C8C' : colorVal === 2 ? '#E65A28' : '#15191C')}
                            />
                          )}
                          {/* Diamond Body */}
                          <polygon
                            points={`${width / 2},0 ${width},${height / 2} ${width / 2},${height} 0,${height / 2}`}
                            fill={node.fillColor && node.fillColor !== 'transparent' ? node.fillColor : dc.paperRaised}
                            stroke={isSelected ? dc.blueprint : dc.ink}
                            strokeWidth={node.borderWidth || (isSelected ? 2 : 1.5)}
                            strokeDasharray={node.borderStyle === 'dashed' ? '5 5' : node.borderStyle === 'dotted' ? '2 2' : undefined}
                          />
                        </svg>

                        {/* Draw.io-style Dashed Bounding Box & 4 Corner Handles on Selection */}
                        {isSelected && (
                          <>
                            <div className="absolute inset-0 border border-dashed border-blueprint pointer-events-none" />
                            <div className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-blueprint border border-paper-raised pointer-events-none" />
                            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blueprint border border-paper-raised pointer-events-none" />
                            <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 rounded-full bg-blueprint border border-paper-raised pointer-events-none" />
                            <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-blueprint border border-paper-raised pointer-events-none" />
                            <div 
                              className="absolute -top-5 right-0 text-blueprint text-[12px] font-bold pointer-events-none select-none flex items-center justify-center w-4 h-4 rounded-full bg-paper border border-blueprint shadow-sm"
                              title="Rotate"
                            >
                              ↻
                            </div>
                          </>
                        )}

                        {/* Centered Upright Label */}
                        <div 
                          className={`relative z-10 font-mono ${textClass} px-2.5 leading-tight text-ink max-w-[80px] break-words select-none pointer-events-none`}
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
                        <div className="absolute inset-1 border border-ink pointer-events-none" />
                        <div 
                          className={`font-mono ${textClass} px-2 select-none truncate w-full`}
                          style={textStyleObj}
                        >
                          {node.label}
                        </div>
                      </div>
                    ) : node.type === 'dfd-store' ? (
                      <div 
                        className={`font-mono ${textClass} select-none h-full flex items-center justify-center px-2`}
                        style={textStyleObj}
                      >
                        {node.label}
                      </div>
                    ) : node.type === 'dfd-process' ? (
                      <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
                        {(() => {
                          const splitIdx = node.label.indexOf(' ');
                          const processId = splitIdx !== -1 ? node.label.substring(0, splitIdx) : '1.0';
                          const processName = splitIdx !== -1 ? node.label.substring(splitIdx + 1) : node.label;
                          return (
                            <>
                              <div className="bg-paper border-b border-ink py-1 text-center font-bold font-mono text-[9px] text-ink-soft select-none truncate">
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
                        <svg className="w-8 h-12 stroke-ink fill-none" strokeWidth="1.5" viewBox="0 0 24 36">
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
                          className={`font-mono ${textClass} text-ink-soft border-b border-dashed border-line pb-1 mb-1 truncate`}
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
                              <div key={idx} className="flex justify-between items-center gap-2 border-b border-dashed border-line last:border-0 pb-1">
                                <span className="text-ink font-bold truncate">{fieldName}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {rawType && <span className="text-ink-soft text-[10px]">{rawType}</span>}
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
                      <div className="w-[18px] h-[18px] rounded-full bg-ink select-none" />
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

          {/* Marquee visual selection border overlays */}
          {marqueeStart && marqueeEnd && (activeMode === 'mark' || activeMode === 'select') && (() => {
            const x1 = Math.min(marqueeStart.x, marqueeEnd.x);
            const x2 = Math.max(marqueeStart.x, marqueeEnd.x);
            const y1 = Math.min(marqueeStart.y, marqueeEnd.y);
            const y2 = Math.max(marqueeStart.y, marqueeEnd.y);

            // Transform back by viewport offsets to draw absolutely in viewport pixels
            const width = (x2 - x1) * zoom;
            const height = (y2 - y1) * zoom;
            const left = x1 * zoom + pan.x;
            const top = y1 * zoom + pan.y;

            return (
              <div
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                  backgroundColor: 'rgba(30, 92, 140, 0.12)',
                }}
                className="absolute border-2 border-dashed border-blueprint pointer-events-none z-30"
              />
            );
          })()}

          {/* Custom Context Menu Overlay */}
          {contextMenu && (
            <div 
              ref={contextMenuRef}
              style={{ 
                left: `${contextMenu.x}px`, 
                top: `${contextMenu.y}px` 
              }}
              className="absolute z-50 min-w-[170px] bg-paper-raised border-[1.5px] border-ink shadow-hard-ink py-1 font-mono text-[11px] select-none text-ink flex flex-col"
            >
              {contextMenu.targetNodeId ? (
                <>
                  <button
                    onClick={() => {
                      copySelection();
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-paper flex justify-between gap-6 cursor-pointer"
                  >
                    <span>COPY</span>
                    <span className="text-ink-soft">CTRL+C</span>
                  </button>
                  <button
                    onClick={() => {
                      cutSelection();
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-paper flex justify-between gap-6 cursor-pointer"
                  >
                    <span>CUT</span>
                    <span className="text-ink-soft">CTRL+X</span>
                  </button>
                  <button
                    onClick={() => {
                      duplicateSelection();
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-paper flex justify-between gap-6 cursor-pointer"
                  >
                    <span>DUPLICATE</span>
                    <span className="text-ink-soft">CTRL+D</span>
                  </button>
                  <button
                    onClick={() => {
                      deleteSelectedNodes();
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-paper flex justify-between gap-6 text-signal cursor-pointer"
                  >
                    <span>DELETE</span>
                    <span className="text-signal opacity-70">DEL</span>
                  </button>
                  
                  {/* Layer Order in Context Menu */}
                  <div className="border-t border-line my-1"></div>
                  <div className="px-3.5 py-1 font-bold text-ink-soft text-[9px] uppercase tracking-wider">// layer_order</div>
                  <button
                    onClick={() => {
                      bringToFront();
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-1 hover:bg-paper flex items-center justify-between cursor-pointer"
                  >
                    <span>BRING_TO_FRONT</span>
                    <span className="text-blueprint font-bold text-[10px]">⇈</span>
                  </button>
                  <button
                    onClick={() => {
                      sendToBack();
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-1 hover:bg-paper flex items-center justify-between cursor-pointer"
                  >
                    <span>SEND_TO_BACK</span>
                    <span className="text-blueprint font-bold text-[10px]">⇊</span>
                  </button>

                  {/* Accent color quick editor option */}
                  <div className="border-t border-line my-1"></div>
                  <div className="px-3.5 py-1 font-bold text-ink-soft text-[9px] uppercase tracking-wider">// shadow_accent</div>
                  <button
                    onClick={() => {
                      updateSelectedNodeProperty('shadowAccent', '#1E5C8C');
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-1 hover:bg-paper flex items-center gap-2 cursor-pointer"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-blueprint border border-ink"></span>
                    <span>BLUEPRINT</span>
                  </button>
                  <button
                    onClick={() => {
                      updateSelectedNodeProperty('shadowAccent', '#D45B33');
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-1 hover:bg-paper flex items-center gap-2 cursor-pointer"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-signal border border-ink"></span>
                    <span>SIGNAL</span>
                  </button>
                  <button
                    onClick={() => {
                      updateSelectedNodeProperty('shadowAccent', '#15191C');
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-1 hover:bg-paper flex items-center gap-2 cursor-pointer"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-ink border border-ink"></span>
                    <span>DARK_INK</span>
                  </button>
                  <button
                    onClick={() => {
                      updateSelectedNodeProperty('shadowAccent', 'none');
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-1 hover:bg-paper flex items-center gap-2 cursor-pointer text-ink-soft"
                  >
                    <span className="w-2.5 h-2.5 rounded-full border border-ink/50 flex items-center justify-center text-[8px]">✕</span>
                    <span>NO_SHADOW</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      pasteClipboard({ x: contextMenu.canvasX, y: contextMenu.canvasY });
                      setContextMenu(null);
                    }}
                    disabled={!clipboard}
                    className={`w-full text-left px-3.5 py-1.5 flex justify-between gap-6 ${
                      clipboard ? 'hover:bg-paper cursor-pointer' : 'opacity-40 cursor-not-allowed text-ink-soft'
                    }`}
                  >
                    <span>PASTE</span>
                    <span className="text-ink-soft">CTRL+V</span>
                  </button>
                  <button
                    onClick={() => {
                      selectAllNodes();
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-paper flex justify-between gap-6 cursor-pointer"
                  >
                    <span>SELECT_ALL</span>
                    <span className="text-ink-soft">CTRL+A</span>
                  </button>
                  
                  <div className="border-t border-line my-1"></div>
                  
                  <button
                    onClick={() => {
                      handleZoomIn();
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-paper flex justify-between gap-6 cursor-pointer"
                  >
                    <span>ZOOM_IN</span>
                    <span className="text-ink-soft">+</span>
                  </button>
                  <button
                    onClick={() => {
                      handleZoomOut();
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-paper flex justify-between gap-6 cursor-pointer"
                  >
                    <span>ZOOM_OUT</span>
                    <span className="text-ink-soft">-</span>
                  </button>
                  <button
                    onClick={() => {
                      handleResetZoom();
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-paper flex justify-between gap-6 cursor-pointer"
                  >
                    <span>RESET_ZOOM</span>
                    <span className="text-ink-soft">100%</span>
                  </button>

                  {drawings.length > 0 && (
                    <>
                      <div className="border-t border-line my-1"></div>
                      <button
                        onClick={() => {
                          clearAllDrawings();
                          setContextMenu(null);
                        }}
                        className="w-full text-left px-3.5 py-1.5 hover:bg-paper text-signal cursor-pointer"
                      >
                        WIPE_SKETCHES
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Horizontal Scrollbar Track */}
          <div
            className="absolute bottom-0 left-0 right-3.5 h-3.5 bg-[#E8EAE6] border-t border-ink z-20 select-none group"
            onClick={(e) => {
              if (e.target !== e.currentTarget || !canvasRef.current) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const clickRatio = (e.clientX - rect.left) / rect.width;
              const targetWorldX = scrollbarMetrics.horiz.worldMinX + clickRatio * scrollbarMetrics.horiz.worldW;
              const viewportWidth = canvasRef.current.getBoundingClientRect().width;
              setPan(prev => ({
                ...prev,
                x: Math.round(viewportWidth / 2 - targetWorldX * zoom)
              }));
            }}
          >
            <div
              onMouseDown={(e) => handleScrollbarThumbMouseDown(e, 'x')}
              style={{
                width: `${scrollbarMetrics.horiz.thumbWidth}px`,
                transform: `translateX(${scrollbarMetrics.horiz.thumbLeft}px)`
              }}
              className={`h-full bg-[#15191C] hover:bg-blueprint border-x border-[#15191C] shadow-sm cursor-ew-resize transition-colors ${
                isScrollbarDragging && scrollbarDragRef.current?.axis === 'x' ? 'bg-blueprint border-blueprint' : ''
              }`}
              title="Drag to scroll canvas horizontally"
            />
          </div>

          {/* Vertical Scrollbar Track */}
          <div
            className="absolute top-0 right-0 bottom-3.5 w-3.5 bg-[#E8EAE6] border-l border-ink z-20 select-none group"
            onClick={(e) => {
              if (e.target !== e.currentTarget || !canvasRef.current) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const clickRatio = (e.clientY - rect.top) / rect.height;
              const targetWorldY = scrollbarMetrics.vert.worldMinY + clickRatio * scrollbarMetrics.vert.worldH;
              const viewportHeight = canvasRef.current.getBoundingClientRect().height;
              setPan(prev => ({
                ...prev,
                y: Math.round(viewportHeight / 2 - targetWorldY * zoom)
              }));
            }}
          >
            <div
              onMouseDown={(e) => handleScrollbarThumbMouseDown(e, 'y')}
              style={{
                height: `${scrollbarMetrics.vert.thumbHeight}px`,
                transform: `translateY(${scrollbarMetrics.vert.thumbTop}px)`
              }}
              className={`w-full bg-[#15191C] hover:bg-blueprint border-y border-[#15191C] shadow-sm cursor-ns-resize transition-colors ${
                isScrollbarDragging && scrollbarDragRef.current?.axis === 'y' ? 'bg-blueprint border-blueprint' : ''
              }`}
              title="Drag to scroll canvas vertically"
            />
          </div>

          {/* Scrollbar Bottom-Right Corner Square */}
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#15191C] border-t border-l border-ink z-20 pointer-events-none" />
        </div>

        {/* Mobile Right Drawer Backdrop */}
        {isRightSidebarOpen && (
          <div 
            className="fixed inset-0 z-30 bg-ink bg-opacity-40 backdrop-blur-[1px] lg:hidden"
            onClick={() => setIsRightSidebarOpen(false)}
          />
        )}

        {/* Right Side: Dedicated Shape Properties & Inspector Sidebar */}
        <aside 
          className={`
            fixed lg:static inset-y-0 right-0 z-40 lg:z-10
            h-full border-l-2 border-ink bg-paper flex flex-col shrink-0 select-none overflow-hidden
            transition-all duration-200 ease-in-out shadow-hard-ink lg:shadow-none
            ${isRightSidebarOpen ? 'w-[290px] translate-x-0' : 'w-0 translate-x-full lg:translate-x-0 lg:w-0 border-l-0'}
          `}
        >
          {/* Inspector Header */}
          <div className="h-11 border-b-2 border-ink px-4 flex items-center justify-between bg-paper-raised shrink-0">
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-blueprint" />
              <span className="font-mono text-[11px] text-ink font-bold uppercase tracking-wider">
                {hasSelection ? 'Shape Properties' : activeEdge ? 'Connector' : 'Properties'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {hasSelection && (
                <button 
                  onClick={deleteSelectedNodes} 
                  className="text-ink-soft hover:text-signal transition-colors p-1 cursor-pointer" 
                  title="Delete Selection"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              {activeEdge && (
                <button 
                  onClick={deleteSelectedEdge} 
                  className="text-ink-soft hover:text-signal transition-colors p-1 cursor-pointer" 
                  title="Delete Connector"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button 
                onClick={() => setIsRightSidebarOpen(false)}
                className="lg:hidden text-ink-soft hover:text-ink text-[11px] font-mono cursor-pointer"
              >
                [close]
              </button>
            </div>
          </div>

          {/* Inspector Body */}
          <div className="p-4 flex-1 flex flex-col justify-between overflow-y-auto">
            {hasSelection && activeNode ? (
              <div className="flex flex-col gap-3.5">
                {/* Shape Type & Morpher */}
                <div className="flex flex-col gap-1.5">
                  <div className="font-mono text-[10px] text-ink-soft font-bold flex justify-between items-center border-b border-line pb-1">
                    <span>MORPH_SHAPE</span>
                    <span className="text-blueprint font-bold uppercase">{activeNode.type}</span>
                  </div>
                  <select
                    value={activeNode.type}
                    onChange={(e) => morphSelectedNodeType(e.target.value as CanvasNode['type'])}
                    className="w-full border-2 border-ink bg-paper px-2 py-1.5 text-[11px] font-mono focus:border-blueprint focus:outline-none cursor-pointer"
                  >
                    {AVAILABLE_SHAPE_TYPES.map((st) => (
                      <option key={st.type} value={st.type}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Rename label */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] text-ink-soft font-bold">SHAPE_LABEL</label>
                  <input
                    type="text"
                    value={activeNode.label}
                    onChange={(e) => updateSelectedNodeLabel(e.target.value)}
                    className="w-full border-2 border-ink bg-paper px-3 py-1.5 text-[12px] font-mono focus:border-blueprint focus:outline-none"
                  />
                </div>

                {/* Table Fields manager for ERD tables */}
                {activeNode.type === 'table' && (
                  <div className="flex flex-col gap-2">
                    <label className="font-mono text-[10px] text-ink-soft flex justify-between items-center font-bold">
                      <span>TABLE_COLUMNS</span>
                      <button
                        type="button"
                        onClick={() => {
                          const currentFields = activeNode.fields || [];
                          updateSelectedNodeFields([...currentFields, 'column text']);
                        }}
                        className="flex items-center gap-1 text-blueprint hover:underline uppercase text-[9px] font-bold cursor-pointer"
                      >
                        <div className="w-3.5 h-3.5 rounded-full bg-blueprint border border-ink flex items-center justify-center shrink-0">
                          <Plus size={8} strokeWidth={3} className="text-white" />
                        </div>
                        <span>Add Column</span>
                      </button>
                    </label>
                    
                    <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                      {(activeNode.fields || []).map((field, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={field}
                            onChange={(e) => {
                              const copy = [...(activeNode.fields || [])];
                              copy[idx] = e.target.value;
                              updateSelectedNodeFields(copy);
                            }}
                            className="flex-1 border border-ink bg-paper px-2 py-1 text-[11px] font-mono focus:border-blueprint focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const copy = (activeNode.fields || []).filter((_, fIdx) => fIdx !== idx);
                              updateSelectedNodeFields(copy);
                            }}
                            className="text-ink-soft hover:text-signal p-0.5 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Typography formatting */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] text-ink-soft font-bold">TEXT_FORMATTING</label>
                  
                  {/* Row 1: S/M/L Presets + Custom Size px Input */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 grid grid-cols-3 border-2 border-ink font-mono text-[11px] text-center bg-paper">
                      {(['sm', 'md', 'lg'] as const).map((size) => {
                        const standardPx = size === 'sm' ? 11 : size === 'md' ? 13 : 16;
                        const isActive = !activeNode.customFontSize && (activeNode.fontSize || 'md') === size;
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() => {
                              updateSelectedNodeProperties({
                                fontSize: size,
                                customFontSize: undefined
                              });
                            }}
                            className={`py-1 border-r last:border-r-0 border-ink cursor-pointer uppercase ${
                              isActive ? 'bg-ink text-paper font-bold' : 'text-ink-soft'
                            }`}
                            title={`Font Size: ${size} (${standardPx}px)`}
                          >
                            {size === 'sm' ? 'S' : size === 'md' ? 'M' : 'L'}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1 border-2 border-ink bg-paper px-1.5 py-0.5">
                      <input
                        type="number"
                        min="8"
                        max="72"
                        value={activeNode.customFontSize ?? (activeNode.fontSize === 'sm' ? 11 : activeNode.fontSize === 'lg' ? 16 : 13)}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v) && v >= 6 && v <= 100) {
                            updateSelectedNodeProperty('customFontSize', v);
                          }
                        }}
                        className="w-8 text-center font-mono text-[11px] font-bold bg-transparent text-ink focus:outline-none"
                      />
                      <span className="font-mono text-[10px] text-ink-soft">px</span>
                    </div>
                  </div>

                  {/* Row 2: Alignment and Bold Toggles */}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex-1 flex border-2 border-ink bg-paper">
                      <button
                        type="button"
                        onClick={() => updateSelectedNodeProperty('textAlign', 'left')}
                        className={`flex-1 p-1 border-r border-ink cursor-pointer flex items-center justify-center ${
                          activeNode.textAlign === 'left' ? 'bg-ink text-paper' : 'text-ink-soft'
                        }`}
                        title="Align Left"
                      >
                        <AlignLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedNodeProperty('textAlign', 'center')}
                        className={`flex-1 p-1 border-r border-ink cursor-pointer flex items-center justify-center ${
                          (activeNode.textAlign || 'center') === 'center' ? 'bg-ink text-paper' : 'text-ink-soft'
                        }`}
                        title="Align Center"
                      >
                        <AlignCenter className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedNodeProperty('textAlign', 'right')}
                        className={`flex-1 p-1 cursor-pointer flex items-center justify-center ${
                          activeNode.textAlign === 'right' ? 'bg-ink text-paper' : 'text-ink-soft'
                        }`}
                        title="Align Right"
                      >
                        <AlignRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateSelectedNodeProperty('isBold', activeNode.isBold === false ? true : false)}
                      className={`px-2.5 py-1 border-2 border-ink cursor-pointer flex items-center justify-center ${
                        activeNode.isBold !== false ? 'bg-ink text-paper font-bold' : 'bg-paper text-ink-soft'
                      }`}
                      title="Toggle Bold"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Border style & width */}
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[10px] text-ink-soft font-bold">BORDER_STYLE</label>
                    <div className="grid grid-cols-4 border-2 border-ink font-mono text-[11px] text-center bg-paper">
                      {(['none', 'solid', 'dashed', 'dotted'] as const).map((style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => updateSelectedNodeProperty('borderStyle', style)}
                          className={`py-1.5 border-r last:border-r-0 border-ink capitalize cursor-pointer ${
                            (activeNode.borderStyle || (activeNode.type === 'text' ? 'none' : activeNode.type === 'usecase-boundary' ? 'dashed' : 'solid')) === style
                              ? 'bg-ink text-paper font-bold'
                              : 'text-ink-soft'
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[10px] text-ink-soft font-bold">BORDER_WIDTH</label>
                    <div className="grid grid-cols-3 border-2 border-ink font-mono text-[11px] text-center bg-paper">
                      {([1, 2, 3] as const).map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => updateSelectedNodeProperty('borderWidth', w)}
                          className={`py-1.5 border-r last:border-r-0 border-ink cursor-pointer ${
                            (activeNode.borderWidth ?? (activeNode.type === 'text' ? 1 : 2)) === w ? 'bg-ink text-paper font-bold' : 'text-ink-soft'
                          }`}
                          title={`${w}px width`}
                        >
                          {w}px
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Fill Color */}
                <div className="flex flex-col gap-1.5">
                  <div className="font-mono text-[10px] text-ink-soft font-bold flex justify-between items-center">
                    <span>FILL_COLOR</span>
                    <input
                      type="text"
                      value={activeNode.fillColor || '#FFFFFF'}
                      onChange={(e) => updateSelectedNodeProperty('fillColor', e.target.value)}
                      placeholder="#FFFFFF"
                      className="w-20 border border-ink bg-paper px-1.5 py-0.5 text-[10px] font-mono focus:border-blueprint focus:outline-none uppercase text-center"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 grid grid-cols-7 border-2 border-ink bg-paper p-0.5 gap-0.5">
                      {FILL_COLOR_PRESETS.map((p) => {
                        const isCurrent = (activeNode.fillColor || '#FFFFFF').toLowerCase() === p.value.toLowerCase() || (!activeNode.fillColor && p.value === '#FFFFFF');
                        return (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => updateSelectedNodeProperty('fillColor', p.value)}
                            className={`h-5 rounded-none border border-ink/40 flex items-center justify-center cursor-pointer ${
                              isCurrent ? 'ring-2 ring-blueprint z-10' : ''
                            }`}
                            style={{ backgroundColor: p.bg === 'transparent' ? '#FFFFFF' : p.bg }}
                            title={p.label}
                          >
                            {p.bg === 'transparent' && <span className="text-[9px] text-signal font-bold leading-none">✕</span>}
                          </button>
                        );
                      })}
                    </div>
                    <label className="border-2 border-ink bg-paper p-1 cursor-pointer flex items-center justify-center relative w-7 h-7 shrink-0" title="Custom Fill Color">
                      <input
                        type="color"
                        value={activeNode.fillColor && activeNode.fillColor !== 'transparent' && activeNode.fillColor.startsWith('#') ? activeNode.fillColor : '#ffffff'}
                        onChange={(e) => updateSelectedNodeProperty('fillColor', e.target.value)}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                      <Palette className="w-3.5 h-3.5 text-blueprint" />
                    </label>
                  </div>
                </div>

                {/* Shadow Accent */}
                <div className="flex flex-col gap-1.5">
                  <div className="font-mono text-[10px] text-ink-soft font-bold flex justify-between items-center">
                    <span>SHADOW_ACCENT</span>
                    <input
                      type="text"
                      value={activeNode.shadowAccent || (activeNode.type === 'text' ? 'none' : '#1E5C8C')}
                      onChange={(e) => updateSelectedNodeProperty('shadowAccent', e.target.value)}
                      placeholder="#1E5C8C"
                      className="w-20 border border-ink bg-paper px-1.5 py-0.5 text-[10px] font-mono focus:border-blueprint focus:outline-none uppercase text-center"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 grid grid-cols-7 border-2 border-ink bg-paper p-0.5 gap-0.5">
                      {SHADOW_COLOR_PRESETS.map((p) => {
                        const currentShadow = activeNode.shadowAccent || (activeNode.type === 'text' ? 'none' : activeNode.width === 2 ? '#D45B33' : activeNode.width === 3 ? '#15191C' : '#1E5C8C');
                        const isCurrent = currentShadow.toLowerCase() === p.value.toLowerCase();
                        return (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => updateSelectedNodeProperty('shadowAccent', p.value)}
                            className={`h-5 rounded-none border border-ink/40 flex items-center justify-center cursor-pointer ${
                              isCurrent ? 'ring-2 ring-blueprint z-10' : ''
                            }`}
                            style={{ backgroundColor: p.bg }}
                            title={p.label}
                          >
                            {p.value === 'none' && <span className="text-[9px] text-ink-soft font-bold leading-none">✕</span>}
                          </button>
                        );
                      })}
                    </div>
                    <label className="border-2 border-ink bg-paper p-1 cursor-pointer flex items-center justify-center relative w-7 h-7 shrink-0" title="Custom Shadow Color">
                      <input
                        type="color"
                        value={activeNode.shadowAccent && activeNode.shadowAccent !== 'none' && activeNode.shadowAccent.startsWith('#') ? activeNode.shadowAccent : '#1E5C8C'}
                        onChange={(e) => updateSelectedNodeProperty('shadowAccent', e.target.value)}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                      <Palette className="w-3.5 h-3.5 text-ink" />
                    </label>
                  </div>
                </div>

                {/* Layer Arrangement */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] text-ink-soft font-bold">LAYER_ORDER</label>
                  <div className="grid grid-cols-4 border-2 border-ink font-mono text-[10px] text-center bg-paper">
                    <button
                      type="button"
                      onClick={bringToFront}
                      className="py-1 border-r border-ink cursor-pointer flex flex-col items-center justify-center gap-0.5"
                      title="Bring to Front"
                    >
                      <ChevronsUp className="w-3.5 h-3.5 text-blueprint" />
                      <span>Front</span>
                    </button>
                    <button
                      type="button"
                      onClick={bringForward}
                      className="py-1 border-r border-ink cursor-pointer flex flex-col items-center justify-center gap-0.5"
                      title="Bring Forward"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>Up</span>
                    </button>
                    <button
                      type="button"
                      onClick={sendBackward}
                      className="py-1 border-r border-ink cursor-pointer flex flex-col items-center justify-center gap-0.5"
                      title="Send Backward"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>Down</span>
                    </button>
                    <button
                      type="button"
                      onClick={sendToBack}
                      className="py-1 cursor-pointer flex flex-col items-center justify-center gap-0.5"
                      title="Send to Back"
                    >
                      <ChevronsDown className="w-3.5 h-3.5 text-blueprint" />
                      <span>Back</span>
                    </button>
                  </div>
                </div>

                {/* Node Geometry Details Badge */}
                <div className="p-2.5 border border-line bg-paper-raised font-mono text-[10px] text-ink-soft flex flex-col gap-1.5">
                  <div className="flex justify-between">
                    <span>Position:</span>
                    <span className="text-ink font-bold">X {activeNode.x}, Y {activeNode.y}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Size:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={getNodeDimensions(activeNode).width}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          if (isNaN(v) || v < getMinDimensions(activeNode).width) return;
                          const isDiamondType = activeNode.type === 'decision' || activeNode.type === 'activity-decision';
                          const nextNodes = nodes.map(n =>
                            n.id === activeNode.id ? { ...n, customWidth: v, ...(isDiamondType ? { customHeight: v } : {}) } : n
                          );
                          setNodes(nextNodes);
                          saveHistoryState(nextNodes, edges, drawings);
                        }}
                        className="w-12 px-1 py-0.5 border border-ink bg-paper text-ink font-bold text-center text-[10px] font-mono"
                        min={getMinDimensions(activeNode).width}
                      />
                      <span className="text-ink-soft">×</span>
                      <input
                        type="number"
                        value={getNodeDimensions(activeNode).height}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          if (isNaN(v) || v < getMinDimensions(activeNode).height) return;
                          const isDiamondType = activeNode.type === 'decision' || activeNode.type === 'activity-decision';
                          const nextNodes = nodes.map(n =>
                            n.id === activeNode.id ? { ...n, customHeight: v, ...(isDiamondType ? { customWidth: v } : {}) } : n
                          );
                          setNodes(nextNodes);
                          saveHistoryState(nextNodes, edges, drawings);
                        }}
                        className="w-12 px-1 py-0.5 border border-ink bg-paper text-ink font-bold text-center text-[10px] font-mono"
                        min={getMinDimensions(activeNode).height}
                      />
                      <span className="text-ink-soft">px</span>
                    </div>
                  </div>
                  {(activeNode.customWidth || activeNode.customHeight) && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextNodes = nodes.map(n =>
                          n.id === activeNode.id ? { ...n, customWidth: undefined, customHeight: undefined } : n
                        );
                        setNodes(nextNodes);
                        saveHistoryState(nextNodes, edges, drawings);
                      }}
                      className="text-[9px] text-blueprint hover:underline cursor-pointer text-right font-bold"
                    >
                      Reset to default size
                    </button>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={duplicateSelection}
                    className="flex-1 py-1.5 px-2 border border-ink bg-paper hover:bg-paper-raised font-mono text-[11px] font-bold text-center cursor-pointer transition-colors"
                  >
                    Duplicate (Ctrl+D)
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelectedNodes}
                    className="py-1.5 px-3 border border-signal text-signal hover:bg-signal hover:text-paper font-mono text-[11px] font-bold text-center cursor-pointer transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : hasSelection && selectedNodeIds.length > 1 ? (
              <div className="flex flex-col gap-3.5">
                <div className="font-mono text-[11px] text-ink-soft font-bold border-b border-line pb-1.5">
                  MULTI_SELECTION ({selectedNodeIds.length})
                </div>

                {/* Batch Text Style */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] text-ink-soft font-bold">TEXT_FORMATTING</label>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 grid grid-cols-3 border-2 border-ink font-mono text-[11px] text-center bg-paper">
                      {(['sm', 'md', 'lg'] as const).map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => {
                            updateSelectedNodeProperties({
                              fontSize: size,
                              customFontSize: undefined
                            });
                          }}
                          className="py-1 border-r last:border-r-0 border-ink cursor-pointer uppercase text-ink-soft"
                        >
                          {size === 'sm' ? 'S' : size === 'md' ? 'M' : 'L'}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 border-2 border-ink bg-paper px-1.5 py-0.5">
                      <input
                        type="number"
                        min="8"
                        max="72"
                        placeholder="13"
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v) && v >= 6 && v <= 100) {
                            updateSelectedNodeProperty('customFontSize', v);
                          }
                        }}
                        className="w-8 text-center font-mono text-[11px] font-bold bg-transparent text-ink focus:outline-none"
                      />
                      <span className="font-mono text-[10px] text-ink-soft">px</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex-1 flex border-2 border-ink bg-paper">
                      <button
                        type="button"
                        onClick={() => updateSelectedNodeProperty('textAlign', 'left')}
                        className="flex-1 p-1 border-r border-ink cursor-pointer text-ink-soft flex items-center justify-center"
                        title="Align Left"
                      >
                        <AlignLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedNodeProperty('textAlign', 'center')}
                        className="flex-1 p-1 border-r border-ink cursor-pointer text-ink-soft flex items-center justify-center"
                        title="Align Center"
                      >
                        <AlignCenter className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedNodeProperty('textAlign', 'right')}
                        className="flex-1 p-1 cursor-pointer text-ink-soft flex items-center justify-center"
                        title="Align Right"
                      >
                        <AlignRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateSelectedNodeProperty('isBold', true)}
                      className="px-2.5 py-1 border-2 border-ink cursor-pointer bg-paper text-ink-soft font-bold flex items-center justify-center"
                      title="Set Bold"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Batch Border Style & Width */}
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[10px] text-ink-soft font-bold">BORDER_STYLE</label>
                    <div className="grid grid-cols-4 border-2 border-ink font-mono text-[11px] text-center bg-paper">
                      {(['none', 'solid', 'dashed', 'dotted'] as const).map((style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => updateSelectedNodeProperty('borderStyle', style)}
                          className="py-1.5 border-r last:border-r-0 border-ink capitalize cursor-pointer text-ink-soft"
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[10px] text-ink-soft font-bold">BORDER_WIDTH</label>
                    <div className="grid grid-cols-3 border-2 border-ink font-mono text-[11px] text-center bg-paper">
                      {([1, 2, 3] as const).map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => updateSelectedNodeProperty('borderWidth', w)}
                          className="py-1.5 border-r last:border-r-0 border-ink cursor-pointer text-ink-soft"
                        >
                          {w}px
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Batch Fill Color */}
                <div className="flex flex-col gap-1.5">
                  <div className="font-mono text-[10px] text-ink-soft font-bold flex justify-between items-center">
                    <span>FILL_COLOR</span>
                    <input
                      type="text"
                      placeholder="#HEX"
                      onChange={(e) => updateSelectedNodeProperty('fillColor', e.target.value)}
                      className="w-20 border border-ink bg-paper px-1.5 py-0.5 text-[10px] font-mono focus:border-blueprint focus:outline-none uppercase text-center"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 grid grid-cols-7 border-2 border-ink bg-paper p-0.5 gap-0.5">
                      {FILL_COLOR_PRESETS.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => updateSelectedNodeProperty('fillColor', p.value)}
                          className="h-5 rounded-none border border-ink/40 flex items-center justify-center cursor-pointer"
                          style={{ backgroundColor: p.bg === 'transparent' ? '#FFFFFF' : p.bg }}
                          title={p.label}
                        >
                          {p.bg === 'transparent' && <span className="text-[9px] text-signal font-bold leading-none">✕</span>}
                        </button>
                      ))}
                    </div>
                    <label className="border-2 border-ink bg-paper p-1 cursor-pointer flex items-center justify-center relative w-7 h-7 shrink-0" title="Custom Fill Color">
                      <input
                        type="color"
                        onChange={(e) => updateSelectedNodeProperty('fillColor', e.target.value)}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                      <Palette className="w-3.5 h-3.5 text-blueprint" />
                    </label>
                  </div>
                </div>

                {/* Batch Shadow Accent */}
                <div className="flex flex-col gap-1.5">
                  <div className="font-mono text-[10px] text-ink-soft font-bold flex justify-between items-center">
                    <span>SHADOW_ACCENT</span>
                    <input
                      type="text"
                      placeholder="#HEX"
                      onChange={(e) => updateSelectedNodeProperty('shadowAccent', e.target.value)}
                      className="w-20 border border-ink bg-paper px-1.5 py-0.5 text-[10px] font-mono focus:border-blueprint focus:outline-none uppercase text-center"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 grid grid-cols-7 border-2 border-ink bg-paper p-0.5 gap-0.5">
                      {SHADOW_COLOR_PRESETS.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => updateSelectedNodeProperty('shadowAccent', p.value)}
                          className="h-5 rounded-none border border-ink/40 flex items-center justify-center cursor-pointer"
                          style={{ backgroundColor: p.bg }}
                          title={p.label}
                        >
                          {p.value === 'none' && <span className="text-[9px] text-ink-soft font-bold leading-none">✕</span>}
                        </button>
                      ))}
                    </div>
                    <label className="border-2 border-ink bg-paper p-1 cursor-pointer flex items-center justify-center relative w-7 h-7 shrink-0" title="Custom Shadow Color">
                      <input
                        type="color"
                        onChange={(e) => updateSelectedNodeProperty('shadowAccent', e.target.value)}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                      <Palette className="w-3.5 h-3.5 text-ink" />
                    </label>
                  </div>
                </div>

                {/* Batch Layer Order */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] text-ink-soft font-bold">LAYER_ORDER</label>
                  <div className="grid grid-cols-2 border-2 border-ink font-mono text-[10px] text-center bg-paper">
                    <button
                      type="button"
                      onClick={bringToFront}
                      className="py-1.5 border-r border-ink cursor-pointer flex items-center justify-center gap-1 font-bold text-blueprint"
                    >
                      <ChevronsUp className="w-3.5 h-3.5" />
                      <span>To Front</span>
                    </button>
                    <button
                      type="button"
                      onClick={sendToBack}
                      className="py-1.5 cursor-pointer flex items-center justify-center gap-1 font-bold text-blueprint"
                    >
                      <ChevronsDown className="w-3.5 h-3.5" />
                      <span>To Back</span>
                    </button>
                  </div>
                </div>

                {/* Batch Actions */}
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={duplicateSelection}
                    className="w-full py-1.5 border border-ink bg-paper hover:bg-paper-raised font-mono text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    Duplicate Selection ({selectedNodeIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelectedNodes}
                    className="w-full py-1.5 border-2 border-signal text-signal hover:bg-signal hover:text-paper font-mono text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    Delete Selected ({selectedNodeIds.length})
                  </button>
                </div>
              </div>
            ) : activeEdge ? (
              <div className="flex flex-col gap-4">
                <div className="font-mono text-[11px] text-ink-soft font-bold border-b border-line pb-1.5 flex items-center justify-between">
                  <span>CONNECTOR_PROPERTIES</span>
                  {diagram?.type === 'erd' && (
                    <span className="text-[9px] text-blueprint border border-blueprint px-1 font-mono uppercase">ERD</span>
                  )}
                </div>

                {/* Edge relationship label */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] text-ink-soft font-bold">LINE_LABEL</label>
                  <input
                    type="text"
                    value={activeEdge.label || ''}
                    onChange={(e) => updateSelectedEdgeLabel(e.target.value)}
                    className="w-full border-2 border-ink bg-paper px-3 py-2 text-[13px] font-mono focus:border-blueprint focus:outline-none"
                    placeholder="e.g. 1:N, places, contains"
                  />
                </div>

                {/* ERD Cardinality Quick Presets */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-mono text-[10px] text-ink-soft font-bold">ERD_CARDINALITY_PRESETS</label>
                    <span className="text-[9.5px] font-mono text-blueprint">Martin / Crow's</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 font-mono text-[10.5px]">
                    {(['1:N', 'N:1', '1:1', 'M:N', '0..1:N'] as const).map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => updateSelectedEdgeErdPreset(preset)}
                        className={`py-1 border border-ink hover:bg-paper-raised cursor-pointer text-center transition-colors ${
                          activeEdge.label === preset ? 'bg-ink text-paper font-bold' : 'bg-paper text-ink'
                        }`}
                        title={`Apply ${preset} Cardinality`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Granular Source Cardinality (Start of connection) */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-mono text-[10px] text-ink-soft font-bold">
                      SOURCE: {nodes.find(n => n.id === activeEdge.source)?.label || 'START'}
                    </label>
                    <span className="text-[9px] font-mono text-ink-soft uppercase">From Entity</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 font-mono">
                    {CARDINALITY_OPTIONS.map(opt => {
                      const isCurrent = (activeEdge.sourceMarker ?? (activeEdge.arrow === 'both' ? 'arrow' : 'none')) === opt.value;
                      return (
                        <button
                          key={`src-${opt.value}`}
                          type="button"
                          onClick={() => updateSelectedEdgeSourceMarker(opt.value)}
                          className={`py-2 px-1.5 border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                            isCurrent 
                              ? 'bg-ink text-paper border-ink font-bold shadow-sm' 
                              : 'bg-paper text-ink border-line hover:border-ink hover:bg-paper-raised'
                          }`}
                          title={opt.title}
                        >
                          <CrowsFootVisualIcon type={opt.value} isSelected={isCurrent} />
                          <span className="text-[10px] tracking-tight">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Granular Target Cardinality (End of connection) */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-mono text-[10px] text-ink-soft font-bold">
                      TARGET: {nodes.find(n => n.id === activeEdge.target)?.label || 'END'}
                    </label>
                    <span className="text-[9px] font-mono text-ink-soft uppercase">To Entity</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 font-mono">
                    {CARDINALITY_OPTIONS.map(opt => {
                      const isCurrent = (activeEdge.targetMarker ?? (activeEdge.arrow === 'none' ? 'none' : 'arrow')) === opt.value;
                      return (
                        <button
                          key={`tgt-${opt.value}`}
                          type="button"
                          onClick={() => updateSelectedEdgeTargetMarker(opt.value)}
                          className={`py-2 px-1.5 border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                            isCurrent 
                              ? 'bg-ink text-paper border-ink font-bold shadow-sm' 
                              : 'bg-paper text-ink border-line hover:border-ink hover:bg-paper-raised'
                          }`}
                          title={opt.title}
                        >
                          <CrowsFootVisualIcon type={opt.value} isSelected={isCurrent} />
                          <span className="text-[10px] tracking-tight">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Edge line style */}
                <div className="flex flex-col gap-1.5 mt-1">
                  <div className="flex items-center justify-between">
                    <label className="font-mono text-[10px] text-ink-soft font-bold">LINE_STYLE</label>
                    <span className="text-[9.5px] font-mono text-ink-soft">Solid (Ident.) / Dashed (Non-ident.)</span>
                  </div>
                  <div className="grid grid-cols-2 border-2 border-ink font-mono text-[11px] text-center bg-paper">
                    <button
                      type="button"
                      onClick={() => updateSelectedEdgeStyle('solid')}
                      className={`py-1.5 border-r border-ink hover:bg-paper-raised cursor-pointer ${
                        activeEdge.style !== 'dashed' ? 'bg-ink text-paper font-bold' : 'text-ink-soft'
                      }`}
                    >
                      solid
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedEdgeStyle('dashed')}
                      className={`py-1.5 hover:bg-paper-raised cursor-pointer ${
                        activeEdge.style === 'dashed' ? 'bg-ink text-paper font-bold' : 'text-ink-soft'
                      }`}
                    >
                      dashed
                    </button>
                  </div>
                </div>

                {/* Legacy Quick Arrow Presets */}
                <div className="flex flex-col gap-1.5 mt-1">
                  <label className="font-mono text-[10px] text-ink-soft font-bold">ARROW_STYLE</label>
                  <div className="grid grid-cols-3 border-2 border-ink font-mono text-[11px] text-center bg-paper">
                    <button
                      type="button"
                      onClick={() => updateSelectedEdgeArrow('end')}
                      className={`py-1.5 border-r border-ink hover:bg-paper-raised cursor-pointer ${
                        activeEdge.arrow !== 'none' && activeEdge.arrow !== 'both' && activeEdge.targetMarker === 'arrow' ? 'bg-ink text-paper font-bold' : 'text-ink-soft'
                      }`}
                      title="Single Arrow (→)"
                    >
                      arrow →
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedEdgeArrow('none')}
                      className={`py-1.5 border-r border-ink hover:bg-paper-raised cursor-pointer ${
                        activeEdge.sourceMarker === 'none' && activeEdge.targetMarker === 'none' ? 'bg-ink text-paper font-bold' : 'text-ink-soft'
                      }`}
                      title="Plain Line (—)"
                    >
                      none —
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedEdgeArrow('both')}
                      className={`py-1.5 hover:bg-paper-raised cursor-pointer ${
                        activeEdge.arrow === 'both' ? 'bg-ink text-paper font-bold' : 'text-ink-soft'
                      }`}
                      title="Both Ends (↔)"
                    >
                      both ↔
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={deleteSelectedEdge}
                  className="w-full py-2 border-2 border-signal text-signal hover:bg-signal hover:text-paper font-mono text-[11px] font-bold cursor-pointer transition-colors mt-2"
                >
                  Delete Connector
                </button>
              </div>
            ) : selectedDrawing ? (
              <div className="flex flex-col gap-4">
                <div className="font-mono text-[11px] text-ink-soft font-bold border-b border-line pb-1.5 flex items-center justify-between">
                  <span>DRAWING_PROPERTIES</span>
                  <span className="text-[9px] text-signal border border-signal px-1 font-mono uppercase">
                    {selectedDrawing.tool === 'highlighter' ? 'Highlighter' : 'Pen Stroke'}
                  </span>
                </div>

                {/* Stroke Color */}
                <div className="flex flex-col gap-1.5">
                  <div className="font-mono text-[10px] text-ink-soft font-bold flex justify-between items-center">
                    <span>STROKE_COLOR</span>
                    <span className="text-ink font-mono text-[10px]">{selectedDrawing.color || '#D45B33'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 grid grid-cols-6 border-2 border-ink bg-paper p-0.5 gap-0.5">
                      {PENCIL_COLOR_PRESETS.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => updateSelectedDrawingColor(p.value)}
                          className="h-5 rounded-none border border-ink/40 flex items-center justify-center cursor-pointer hover:opacity-80"
                          style={{ backgroundColor: p.value }}
                          title={p.label}
                        />
                      ))}
                    </div>
                    <label className="border-2 border-ink bg-paper p-1 cursor-pointer flex items-center justify-center relative w-7 h-7 shrink-0" title="Custom Stroke Color">
                      <input
                        type="color"
                        value={selectedDrawing.color || '#D45B33'}
                        onChange={(e) => updateSelectedDrawingColor(e.target.value)}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                      <Palette className="w-3.5 h-3.5 text-blueprint" />
                    </label>
                  </div>
                </div>

                {/* Stroke Thickness */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-mono text-[10px] text-ink-soft font-bold">STROKE_WIDTH</label>
                    <span className="font-mono text-[10px] text-ink-soft">{selectedDrawing.width || 2}px</span>
                  </div>
                  <div className="grid grid-cols-4 border-2 border-ink font-mono text-[11px] text-center bg-paper">
                    {PENCIL_WIDTH_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => updateSelectedDrawingWidth(p.value)}
                        className={`py-1.5 border-r last:border-r-0 border-ink cursor-pointer ${
                          (selectedDrawing.width || 2) === p.value ? 'bg-ink text-paper font-bold' : 'text-ink-soft hover:text-ink'
                        }`}
                        title={p.label}
                      >
                        {p.value}px
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opacity indicator */}
                <div className="p-2.5 border border-line bg-paper-raised font-mono text-[10px] text-ink-soft flex flex-col gap-1.5">
                  <div className="flex justify-between">
                    <span>Opacity:</span>
                    <span className="text-ink font-bold">{Math.round((selectedDrawing.opacity ?? 1) * 100)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Drawing ID:</span>
                    <span className="text-ink font-mono">{selectedDrawing.id}</span>
                  </div>
                </div>

                {/* Delete and Deselect Buttons */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedDrawingId(null)}
                    className="flex-1 py-1.5 px-2 border border-ink bg-paper hover:bg-paper-raised font-mono text-[11px] font-bold text-center cursor-pointer transition-colors"
                  >
                    Deselect
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelectedDrawing}
                    className="py-1.5 px-3 border border-signal text-signal hover:bg-signal hover:text-paper font-mono text-[11px] font-bold text-center cursor-pointer transition-colors"
                  >
                    Delete (Del)
                  </button>
                </div>
              </div>
            ) : (
              /* Canvas Overview when nothing is selected */
              <div className="flex flex-col gap-4">
                <div className="font-mono text-[10px] text-blueprint uppercase tracking-wider font-bold border-b border-line pb-1.5">
                  Diagram Overview
                </div>

                {/* Diagram Info Card */}
                <div className="p-3 border-2 border-ink bg-paper-raised flex flex-col gap-2 font-mono text-[11px]">
                  <div className="font-bold text-ink truncate">{diagram.title}</div>
                  <div className="flex justify-between text-ink-soft text-[10px] pt-1 border-t border-line border-dashed">
                    <span>Notation:</span>
                    <span className="text-blueprint font-bold uppercase">{diagram.type}</span>
                  </div>
                  <div className="flex justify-between text-ink-soft text-[10px]">
                    <span>Total Shapes:</span>
                    <span className="text-ink font-bold">{nodes.length}</span>
                  </div>
                  <div className="flex justify-between text-ink-soft text-[10px]">
                    <span>Connections:</span>
                    <span className="text-ink font-bold">{edges.length}</span>
                  </div>
                  {drawings.length > 0 && (
                    <div className="flex justify-between text-ink-soft text-[10px]">
                      <span>Drawings:</span>
                      <span className="text-ink font-bold">{drawings.length} paths</span>
                    </div>
                  )}
                </div>

                {/* Canvas Quick Actions */}
                <div className="flex flex-col gap-2 pt-1">
                  <div className="font-mono text-[10px] text-ink-soft uppercase tracking-wider font-bold">
                    Quick Canvas Actions
                  </div>
                  <button
                    type="button"
                    onClick={autoAlignNodes}
                    className="w-full py-2 px-3 border border-line hover:border-ink bg-paper text-[11px] font-mono text-ink hover:text-blueprint transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>Auto-Align Shapes</span>
                    <Wand2 className="w-3.5 h-3.5 text-blueprint" />
                  </button>
                  <button
                    type="button"
                    onClick={handleResetZoom}
                    className="w-full py-2 px-3 border border-line hover:border-ink bg-paper text-[11px] font-mono text-ink transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>Reset View (100%)</span>
                    <span className="text-[10px] text-ink-soft font-bold">{Math.round(zoom * 100)}%</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearCanvas}
                    className="w-full py-2 px-3 border border-line hover:border-signal bg-paper text-[11px] font-mono text-ink-soft hover:text-signal transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>Clear Canvas</span>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Instruction footnote in right sidebar */}
            <div className="font-mono text-[10px] text-ink-soft leading-relaxed border-t-2 border-ink pt-3 mt-4">
              <div className="font-bold text-ink mb-0.5">Shortcuts</div>
              <div>V: Select / Move • M: Box Select</div>
              <div>P: Pencil Notes • H: Hand Grab</div>
              <div>Ctrl+Z: Undo • Delete: Remove</div>
            </div>
          </div>
        </aside>
      </div>

      {/* Overhauled Export Suite Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        diagram={diagram}
        nodes={nodes}
        edges={edges}
        drawings={drawings}
        edgePathGetter={getEdgePath}
      />

      {/* Share & Embed Suite Modal */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        diagram={diagram}
        nodes={nodes}
        edges={edges}
        drawings={drawings}
      />

      {/* Clear Canvas Confirmation Modal */}
      <ConfirmModal
        isOpen={isConfirmClearOpen}
        onClose={() => setIsConfirmClearOpen(false)}
        onConfirm={handleClearCanvasConfirm}
        title="CLEAR_CANVAS"
        message="Clear all shapes and connections on the canvas?"
        description={`This will erase all ${nodes.length} node(s), ${edges.length} connector(s), and freehand drawings from the active drafting sheet.`}
        confirmText="Clear Canvas"
        danger={true}
      />

      {/* Feedback & Diagnostics Modal */}
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        diagramContext={{
          id: diagram?.id,
          type: diagram?.type,
          title: diagram?.title,
          nodeCount: nodes.length,
          edgeCount: edges.length,
          zoom
        }}
      />
    </div>
  );
};
