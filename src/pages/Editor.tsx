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
import {
  type FreehandDrawing,
  pointsToSmoothSvgPath,
  type NodeDragState,
  type ResizeState,
  UNIVERSAL_TOOLBOX_GROUPS,
  getMinDimensions,
  isResizable,
  getNodeDimensions,
  dc,
} from '../types/canvas';
import { calculateEdgePath } from '../utils/edgeRouting';
import { CanvasSpatialIndex } from '../utils/spatialIndex';
import { FreehandLayer } from '../components/canvas/FreehandLayer';
import { EdgeLayer } from '../components/canvas/EdgeLayer';
import { PropertiesSidebar } from '../components/canvas/PropertiesSidebar';
import { CanvasToolbar } from '../components/canvas/CanvasToolbar';
import { Minimap } from '../components/canvas/Minimap';
import { StaticNodeCanvasLayer } from '../components/canvas/StaticNodeCanvasLayer';
import { CodeImportPreview } from '../components/canvas/CodeImportPreview';
import { useCanvasHistory, type CanvasSnapshot } from '../hooks/canvas/useCanvasHistory';
import { useCanvasSelection } from '../hooks/canvas/useCanvasSelection';
import { useCanvasTransform } from '../hooks/canvas/useCanvasTransform';
import { useEdgeInteractions, getClosestPortOnNode } from '../hooks/canvas/useEdgeInteractions';
import { parseCodeToDiagram, diagramToMermaid, CODE_PRESETS_LIST, type CodeToDiagramResult, type LayoutDirection } from '../utils/codeToDiagram';
import { 
  Plus,
  Sliders,
  ArrowLeft, 
  Download, 
  Share2,
  MessageSquare,
  Check, 
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Square,
  Diamond,
  Circle,
  Database,
  Wand2,
  Code,
  Type,
  Copy,
  FileCode,
  Sparkles,
  Edit3,
  AlertTriangle,
  User
} from 'lucide-react';

const getToolIcon = (type: CanvasNode['type']): React.ReactNode => {
  const iconClass = 'w-3.5 h-3.5 text-blueprint';
  switch (type) {
    case 'table': return <Database className={iconClass} />;
    case 'decision':
    case 'activity-decision': return <Diamond className="w-3.5 h-3.5 text-signal" />;
    case 'terminal': return <Circle className="w-3.5 h-3.5 text-ink" />;
    case 'dfd-entity': return <Square className={iconClass} />;
    case 'dfd-process': return <Circle className={iconClass} />;
    case 'dfd-store': return <span className="w-3.5 h-2.5 border-y border-ink" />;
    case 'usecase-actor': return <User className={iconClass} />;
    case 'usecase-oval': return <Circle className={iconClass} />;
    case 'usecase-boundary': return <Square className="w-3.5 h-3.5 text-ink-soft" />;
    case 'activity-start': return <Circle className="w-3.5 h-3.5 fill-ink text-ink" />;
    case 'activity-action': return <Square className={iconClass} />;
    case 'activity-fork': return <span className="w-3.5 h-1 bg-ink" />;
    case 'activity-end': return <Circle className="w-3.5 h-3.5 text-ink" />;
    case 'sequence-activation': return <span className="w-2 h-3.5 border border-ink" />;
    case 'text': return <Type className={iconClass} />;
    default: return <Square className={iconClass} />;
  }
};

// ERD cards contain the deepest DOM tree in the canvas. Their node object is
// reference-stable when another shape moves, so memoizing this subtree avoids
// repeatedly rebuilding every field row during unrelated interactions.
const TableNodeContent = React.memo(({ node }: { node: CanvasNode }) => {
  const effectiveFontSize = node.customFontSize || (node.fontSize === 'sm' ? 11 : node.fontSize === 'lg' ? 16 : 13);
  const textStyleObj: React.CSSProperties = { fontSize: `${effectiveFontSize}px` };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
      <div
        className="py-1.5 px-3 border-b-2 border-ink font-mono font-bold text-white uppercase select-none truncate text-center tracking-wider shrink-0"
        style={{
          backgroundColor: (node.shadowAccent && node.shadowAccent !== 'none' && node.shadowAccent.startsWith('#'))
            ? node.shadowAccent
            : '#1E5C8C',
          ...textStyleObj,
        }}
      >
        {node.label}
      </div>
      <div className="flex-1 p-2.5 flex flex-col gap-1.5 select-none font-mono text-[11px]">
        {(node.fields || []).map((field, index) => {
          const parts = field.split(' ');
          const fieldName = parts[0] || '';
          const fieldType = parts.slice(1).join(' ') || '';
          const isPk = field.toLowerCase().includes('pk');
          const isFk = field.toLowerCase().includes('fk');
          const rawType = fieldType.replace(/\b(pk|fk)\b/gi, '').trim();
          return (
            <div key={index} className="flex justify-between items-center gap-2 border-b border-dashed border-line last:border-0 pb-1">
              <span className="text-ink font-bold truncate">{fieldName}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {rawType && <span className="text-ink-soft text-[10px]">{rawType}</span>}
                {isPk && <span className="px-1 py-0.5 text-[8px] font-bold bg-blueprint text-white rounded-[2px] leading-none uppercase">PK</span>}
                {isFk && <span className="px-1 py-0.5 text-[8px] font-bold border border-blueprint text-blueprint rounded-[2px] leading-none uppercase">FK</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// Complex notation-specific cards keep their legacy DOM implementation until
// their Canvas equivalents reach feature parity.
const CANVAS_RENDERABLE_TYPES = new Set<CanvasNode['type']>([
  'table', 'process', 'decision', 'terminal', 'text', 'usecase-oval',
  'activity-start', 'activity-end', 'activity-action', 'activity-decision', 'activity-fork',
]);

export const Editor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [drawings, setDrawings] = useState<FreehandDrawing[]>([]);



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



  // Pencil Tool Submodes & Styles
  const [pencilTool, setPencilTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [pencilColor, setPencilColor] = useState<string>('#D45B33');
  const [pencilWidth, setPencilWidth] = useState<number>(2.5);

  // Dragging states (Figma-inspired click vs drag handling)
  const DRAG_THRESHOLD = 4; // px distance threshold before drag begins
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [routingRevision, setRoutingRevision] = useState(0);
  // Secondary views do not need to reflect every intermediate drag coordinate.
  // Keeping a settled model prevents autosave, Mermaid export, the minimap,
  // and scrollbar bounds from doing full-document work on each animation frame.
  const [settledNodes, setSettledNodes] = useState<CanvasNode[]>(nodes);
  const isGeometryInteraction = draggedNodeId !== null || isResizing;

  const nodeDragStateRef = useRef<NodeDragState | null>(null);
  const dragPreviewDeltaRef = useRef<{ x: number; y: number } | null>(null);
  const dragPreviewEdgePathsRef = useRef(new Map<SVGPathElement, string>());
  const dragMoveFrameRef = useRef<number | null>(null);
  const pendingDragClientRef = useRef<{ x: number; y: number } | null>(null);
  // Pointer events can arrive much faster than the screen refreshes. Keep the
  // model current for hit testing, but commit visual updates no more than once
  // per animation frame.
  const pendingNodeRenderRef = useRef<CanvasNode[] | null>(null);
  const nodeRenderFrameRef = useRef<number | null>(null);
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  const edgesRef = useRef(edges);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);
  const drawingsRef = useRef(drawings);
  useEffect(() => {
    drawingsRef.current = drawings;
  }, [drawings]);

  // Resize state
  const resizeStateRef = useRef<ResizeState | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const alignmentGuideRefs = useRef<(SVGLineElement | null)[]>([]);

  const paintAlignmentGuides = useCallback((guides: { x1: number; y1: number; x2: number; y2: number }[]) => {
    alignmentGuideRefs.current.forEach((line, index) => {
      if (!line) return;
      const guide = guides[index];
      if (!guide) {
        line.style.display = 'none';
        return;
      }
      line.setAttribute('x1', String(guide.x1));
      line.setAttribute('y1', String(guide.y1));
      line.setAttribute('x2', String(guide.x2));
      line.setAttribute('y2', String(guide.y2));
      line.style.display = '';
    });
  }, []);

  const clearNodeDragPreview = useCallback((restoreEdges = false) => {
    if (!canvasRef.current) return;
    for (const element of canvasRef.current.querySelectorAll<HTMLElement>('[data-canvas-node-id]')) {
      element.style.transform = '';
    }
    if (restoreEdges) {
      for (const [segment, path] of dragPreviewEdgePathsRef.current) segment.setAttribute('d', path);
    }
    dragPreviewEdgePathsRef.current.clear();
    dragPreviewDeltaRef.current = null;
  }, []);

  const flushPendingNodeRender = useCallback(() => {
    if (nodeRenderFrameRef.current !== null) {
      cancelAnimationFrame(nodeRenderFrameRef.current);
      nodeRenderFrameRef.current = null;
    }
    const pendingNodes = pendingNodeRenderRef.current;
    pendingNodeRenderRef.current = null;
    if (pendingNodes) setNodes(pendingNodes);
  }, []);

  const scheduleNodeRender = useCallback((nextNodes: CanvasNode[]) => {
    pendingNodeRenderRef.current = nextNodes;
    if (nodeRenderFrameRef.current !== null) return;
    nodeRenderFrameRef.current = requestAnimationFrame(() => {
      nodeRenderFrameRef.current = null;
      const pendingNodes = pendingNodeRenderRef.current;
      pendingNodeRenderRef.current = null;
      if (pendingNodes) setNodes(pendingNodes);
    });
  }, []);

  useEffect(() => () => {
    if (nodeRenderFrameRef.current !== null) cancelAnimationFrame(nodeRenderFrameRef.current);
    if (dragMoveFrameRef.current !== null) cancelAnimationFrame(dragMoveFrameRef.current);
  }, []);

  useEffect(() => {
    if (!isGeometryInteraction) setSettledNodes(nodes);
  }, [nodes, isGeometryInteraction]);

  const {
    zoom,
    pan,
    setPan,
    isPanning,
    setIsPanning,
    panStart,
    scrollbarDragRef,
    isScrollbarDragging,
    scrollbarMetrics,
    viewportSize,
    centerDiagramInView,
    handleZoomIn,
    handleZoomOut,
    handleFitToScreen,
    handleResetZoom,
    handleScrollbarThumbMouseDown,
    updateScrollbarDrag,
    endScrollbarDrag,
    handleCanvasWheel,
  } = useCanvasTransform({
    canvasRef,
    nodes: settledNodes,
    drawings,
    nodesRef,
    drawingsRef,
  });



  // Freehand pencil path state
  const [activeDrawingPoints, setActiveDrawingPoints] = useState<{ x: number; y: number }[] | null>(null);



  // Refs for tracking mouse offsets
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
  const [codePreview, setCodePreview] = useState<{
    source: string;
    direction: LayoutDirection;
    mode: 'replace' | 'append';
    result: CodeToDiagramResult;
  } | null>(null);

  useEffect(() => { setCodePreview(null); }, [codeText, codeDirection, codeMode]);

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
    return diagramToMermaid(settledNodes, edges, exportMermaidDirection, exportMermaidFormat === 'er');
  }, [settledNodes, edges, exportMermaidDirection, exportMermaidFormat]);

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
        const detail = result.diagnostics[0];
        setCodeStatus({ type: 'error', message: detail ? `No valid shapes found. Line ${detail.line}: ${detail.message}.` : 'No valid shapes found in code.' });
        setCodePreview(null);
        return;
      }
      setCodeStatus(null);
      setCodePreview({ source: codeText, direction: codeDirection, mode: codeMode, result });
    } catch (err: any) {
      setCodeStatus({ type: 'error', message: err?.message || 'Failed to parse code.' });
    }
  };

  const handleApplyCodePreview = () => {
    if (!codePreview) return;
    if (codePreview.source !== codeText || codePreview.direction !== codeDirection || codePreview.mode !== codeMode) {
      setCodePreview(null);
      setCodeStatus({ type: 'error', message: 'Code or settings changed. Generate a new preview before applying.' });
      return;
    }
    const { result, mode } = codePreview;
    const nextNodes = mode === 'append' ? [...nodes, ...result.nodes] : result.nodes;
    const nextEdges = mode === 'append' ? [...edges, ...result.edges] : result.edges;
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    saveHistoryState(nextNodes, nextEdges, drawings);
    setCodePreview(null);
    setCodeStatus({
      type: 'success',
      message: `Generated ${result.nodes.length} shapes & ${result.edges.length} connections${result.diagnostics.length ? `; skipped ${result.diagnostics.length} lines` : ''}.`
    });
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
  const onRestoreHistoryRef = useRef<(snapshot: CanvasSnapshot) => void>(() => {});

  const {
    saveHistoryState,
    undo,
    redo,
    resetHistory,
    canUndo,
    canRedo,
  } = useCanvasHistory({
    onRestore: useCallback((snapshot: CanvasSnapshot) => {
      onRestoreHistoryRef.current(snapshot);
    }, []),
  });

  const {
    selectedNodeIds,
    setSelectedNodeIds,
    selectedEdgeId,
    setSelectedEdgeId,
    selectedDrawingId,
    setSelectedDrawingId,
    clipboard,
    marqueeStart,
    setMarqueeStart,
    marqueeEnd,
    setMarqueeEnd,
    copySelection,
    cutSelection,
    pasteClipboard,
    duplicateSelection,
    deleteSelectedNodes,
    deleteSelectedEdge,
    deleteSelectedDrawing,
    deleteDrawing,
    selectAllNodes,
  } = useCanvasSelection({
    nodes,
    edges,
    drawings,
    setNodes,
    setEdges,
    setDrawings,
    saveHistoryState,
    getPastePosition: () => mouseCanvasPos.current,
  });

  const {
    connectingPort,
    setConnectingPort,
    snappedPort,
    setSnappedPort,
    tempEdgeEnd,
    setTempEdgeEnd,
    edgeRouteDragRef,
    edgeReconnectRef,
    edgeReconnectTarget,
    handleEdgeRouteDragStart,
    handleEdgeReconnectStart,
    updateEditableEdgeInteraction,
    finishEditableEdgeInteraction,
    resetSelectedEdgeRoute,
    completePortConnection,
    handlePortMouseDown,
    handlePortMouseUp,
  } = useEdgeInteractions({
    nodes,
    edges,
    drawings,
    nodesRef,
    edgesRef,
    setEdges,
    setSelectedEdgeId,
    setSelectedNodeIds,
    setSelectedDrawingId,
    saveHistoryState,
    diagramType: diagram?.type,
    isSnapToGrid,
    canvasRef,
    pan,
    zoom,
    activeMode,
    selectedEdgeId,
  });

  const spatialIndex = useMemo(() => new CanvasSpatialIndex(nodes), [nodes]);
  // The legacy card DOM becomes noticeably expensive well before hundreds of
  // rich table shapes. Switch early enough to protect typical ERDs too.
  const isCanvasSceneActive = nodes.length >= 30;

  // Keep a generous overscan area to prevent objects popping in during a pan,
  // while avoiding thousands of off-screen DOM/SVG elements in large diagrams.
  const { visibleNodes, visibleEdges } = useMemo(() => {
    const margin = 320;
    const minX = -pan.x / zoom - margin;
    const maxX = (viewportSize.width - pan.x) / zoom + margin;
    const minY = -pan.y / zoom - margin;
    const maxY = (viewportSize.height - pan.y) / zoom + margin;
    const visibleNodeIds = new Set(
      spatialIndex.query({ minX, minY, maxX, maxY }).map((node) => node.id)
    );
    for (const id of selectedNodeIds) visibleNodeIds.add(id);
    if (draggedNodeId) visibleNodeIds.add(draggedNodeId);
    if (connectingPort?.nodeId) visibleNodeIds.add(connectingPort.nodeId);

    return {
      visibleNodes: nodes.filter((node) => visibleNodeIds.has(node.id)),
      // A connector is useful when either endpoint is visible. Selected edges
      // remain available even when their nodes are outside the viewport.
      visibleEdges: edges.filter(
        (edge) =>
          visibleNodeIds.has(edge.source) ||
          visibleNodeIds.has(edge.target) ||
          edge.id === selectedEdgeId
      ),
    };
  }, [nodes, edges, pan, zoom, viewportSize, selectedNodeIds, selectedEdgeId, draggedNodeId, connectingPort, spatialIndex]);

  const staticCanvasNodes = useMemo(() => {
    if (!isCanvasSceneActive) return [];
    const selectedIds = new Set(selectedNodeIds);
    const settledById = new Map(settledNodes.map((node) => [node.id, node]));
    return visibleNodes
      .filter((node) => CANVAS_RENDERABLE_TYPES.has(node.type) && !selectedIds.has(node.id) && node.id !== connectingPort?.nodeId)
      .map((node) => settledById.get(node.id) ?? node);
  }, [isCanvasSceneActive, visibleNodes, selectedNodeIds, connectingPort, settledNodes]);

  const domNodes = useMemo(() => {
    if (!isCanvasSceneActive) return visibleNodes;
    const selectedIds = new Set(selectedNodeIds);
    return visibleNodes.filter((node) => !CANVAS_RENDERABLE_TYPES.has(node.type) || selectedIds.has(node.id) || node.id === connectingPort?.nodeId);
  }, [isCanvasSceneActive, visibleNodes, selectedNodeIds, connectingPort]);

  // A static bitmap should not be repainted merely because the active overlay
  // moves. Freeze it during geometry interactions, then refresh once on drop.
  const [settledCanvasNodes, setSettledCanvasNodes] = useState<CanvasNode[]>([]);
  useEffect(() => {
    if (!isGeometryInteraction) setSettledCanvasNodes(staticCanvasNodes);
  }, [staticCanvasNodes, isGeometryInteraction]);
  const canvasNodesToRender = isGeometryInteraction ? settledCanvasNodes : staticCanvasNodes;

  useEffect(() => {
    onRestoreHistoryRef.current = (snapshot: CanvasSnapshot) => {
      setNodes(JSON.parse(JSON.stringify(snapshot.nodes)));
      setEdges(JSON.parse(JSON.stringify(snapshot.edges)));
      setDrawings(JSON.parse(JSON.stringify(snapshot.drawings)));
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
    };
  }, [setSelectedNodeIds, setSelectedEdgeId]);

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

  const centerDiagramInViewRef = useRef(centerDiagramInView);
  useEffect(() => {
    centerDiagramInViewRef.current = centerDiagramInView;
  }, [centerDiagramInView]);

  const resetHistoryRef = useRef(resetHistory);
  useEffect(() => {
    resetHistoryRef.current = resetHistory;
  }, [resetHistory]);

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
            resetHistoryRef.current(initialNodes, initialEdges, initialDrawings);

            // Focus viewport directly on the diagram shapes
            setTimeout(() => {
              centerDiagramInViewRef.current(initialNodes, initialDrawings);
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
    if (!diagram || isGeometryInteraction) return;
    const currentJson = JSON.stringify({ nodes: settledNodes, edges, drawings });
    latestContentRef.current = currentJson;
    if (lastAttemptedContentRef.current === null || currentJson === lastAttemptedContentRef.current) return;

    setSaveStatus('saving');
    const timer = setTimeout(() => { void flushSave(); }, 1000);

    return () => clearTimeout(timer);
  }, [settledNodes, edges, drawings, diagram, flushSave, isGeometryInteraction]);

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
        if (dragMoveFrameRef.current !== null) cancelAnimationFrame(dragMoveFrameRef.current);
        dragMoveFrameRef.current = null;
        pendingDragClientRef.current = null;
        flushPendingNodeRender();
        clearNodeDragPreview(true);
        const hadGeometryInteraction = Boolean(resizeStateRef.current || nodeDragStateRef.current?.isDragging);
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
        setIsResizing(false);
        setConnectingPort(null);
        setSnappedPort(null);
        setDraggedNodeId(null);
        setMarqueeStart(null);
        setMarqueeEnd(null);
        paintAlignmentGuides([]);
        setContextMenu(null);
        setSelectedDrawingId(null);
        if (hadGeometryInteraction) setRoutingRevision((revision) => revision + 1);
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
  }, [undo, redo, copySelection, cutSelection, pasteClipboard, duplicateSelection, selectAllNodes, selectedNodeIds, selectedEdgeId, selectedDrawingId, deleteSelectedNodes, deleteSelectedEdge, deleteSelectedDrawing, setSelectedNodeIds, setSelectedEdgeId, setSelectedDrawingId, setMarqueeStart, setMarqueeEnd, setConnectingPort, setSnappedPort, flushPendingNodeRender, clearNodeDragPreview, paintAlignmentGuides]);

  const getEdgePath = useCallback((edge: CanvasEdge) => calculateEdgePath(edge, nodes), [nodes]);

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
    if (isCanvasSceneActive && activeMode === 'select' && e.button === 0 && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const point = {
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom,
      };
      const hitNode = spatialIndex
        .queryPoint(point.x, point.y)
        .reverse()
        .find((node) => {
          const { width, height } = getNodeDimensions(node);
          if (node.type === 'decision' || node.type === 'activity-decision') {
            const dx = Math.abs(point.x - (node.x + width / 2)) / (width / 2);
            const dy = Math.abs(point.y - (node.y + height / 2)) / (height / 2);
            return dx + dy <= 1;
          }
          return point.x >= node.x && point.x <= node.x + width && point.y >= node.y && point.y <= node.y + height;
        });
      if (hitNode) {
        handleNodeMouseDown(e, hitNode);
        return;
      }
    }

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

    paintAlignmentGuides(isSnapToGrid ? guides : []);

    const effectiveDeltaX = snappedX - primaryInitial.x;
    const effectiveDeltaY = snappedY - primaryInitial.y;

    dragPreviewDeltaRef.current = { x: effectiveDeltaX, y: effectiveDeltaY };
    if (canvasRef.current) {
      for (const element of canvasRef.current.querySelectorAll<HTMLElement>('[data-canvas-node-id]')) {
        if (dragState.initialPositions[element.dataset.canvasNodeId || '']) {
          element.style.transform = `translate3d(${effectiveDeltaX}px, ${effectiveDeltaY}px, 0)`;
        }
      }
      const previewNodes = currentNodes.map((node) => {
        const initial = dragState.initialPositions[node.id];
        return initial
          ? { ...node, x: Math.round(initial.x + effectiveDeltaX), y: Math.round(initial.y + effectiveDeltaY) }
          : node;
      });
      const previewById = new Map(previewNodes.map((node) => [node.id, node]));
      const edgeGroups = new Map(
        [...canvasRef.current.querySelectorAll<SVGGElement>('[data-canvas-edge-id]')]
          .map((element) => [element.dataset.canvasEdgeId, element])
      );
      for (const edge of edgesRef.current) {
        if (!dragState.initialPositions[edge.source] && !dragState.initialPositions[edge.target]) continue;
        const group = edgeGroups.get(edge.id);
        if (!group) continue;
        const path = calculateEdgePath(edge, previewNodes, previewById, { skipObstacleChecks: true });
        for (const segment of group.querySelectorAll<SVGPathElement>('path[d]')) {
          if (!dragPreviewEdgePathsRef.current.has(segment)) {
            dragPreviewEdgePathsRef.current.set(segment, segment.getAttribute('d') || '');
          }
          segment.setAttribute('d', path);
        }
      }
    }
  };

  const scheduleNodeDragMove = (clientX: number, clientY: number) => {
    pendingDragClientRef.current = { x: clientX, y: clientY };
    if (dragMoveFrameRef.current !== null) return;
    dragMoveFrameRef.current = requestAnimationFrame(() => {
      dragMoveFrameRef.current = null;
      const point = pendingDragClientRef.current;
      pendingDragClientRef.current = null;
      if (point) handleNodeDragMouseMove(point.x, point.y);
    });
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
    setIsResizing(true);
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
    scheduleNodeRender(nextNodes);
    nodesRef.current = nextNodes;
  };

  // Mouse Move Event Listener
  const handleMouseMove = (e: React.MouseEvent) => {
    // Geometry interactions are handled by the window listener so that they
    // continue outside the viewport and run only once per mouse event.
    if (resizeStateRef.current || nodeDragStateRef.current?.isDown) return;
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const canvasMouseX = (e.clientX - rect.left - pan.x) / zoom;
      const canvasMouseY = (e.clientY - rect.top - pan.y) / zoom;
      mouseCanvasPos.current = { x: canvasMouseX, y: canvasMouseY };
    }

    if (updateEditableEdgeInteraction(e.clientX, e.clientY)) return;

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
    if (dragMoveFrameRef.current !== null) cancelAnimationFrame(dragMoveFrameRef.current);
    dragMoveFrameRef.current = null;
    const finalDragPoint = pendingDragClientRef.current;
    pendingDragClientRef.current = null;
    if (finalDragPoint) handleNodeDragMouseMove(finalDragPoint.x, finalDragPoint.y);
    finishEditableEdgeInteraction();
    // Ensure the final pointer position is in React state before history and
    // autosave inspect the document.
    flushPendingNodeRender();

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
    const didMoveNode = Boolean(dragState?.isDragging);
    if (dragState && dragState.isDown) {
      if (dragState.isDragging) {
        const delta = dragPreviewDeltaRef.current;
        if (delta) {
          const nextNodes = nodesRef.current.map((node) => {
            const initial = dragState.initialPositions[node.id];
            return initial
              ? { ...node, x: Math.round(initial.x + delta.x), y: Math.round(initial.y + delta.y) }
              : node;
          });
          nodesRef.current = nextNodes;
          setNodes(nextNodes);
        }
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
    // React commits the final positions at the end of this event. Clear the
    // preview on the next frame to avoid flashing the original coordinates.
    requestAnimationFrame(() => clearNodeDragPreview());
    paintAlignmentGuides([]);
    setIsPanning(false);

    // Complete resize
    const didResizeNode = Boolean(resizeStateRef.current);
    if (resizeStateRef.current) {
      resizeStateRef.current = null;
      setIsResizing(false);
      saveHistoryState(nodesRef.current, edges, drawings);
    }
    if (didMoveNode || didResizeNode) setRoutingRevision((revision) => revision + 1);

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

  const handleWindowMouseMoveRef = useRef<(e: MouseEvent) => void>(() => {});
  handleWindowMouseMoveRef.current = (e: MouseEvent) => {
    if (updateEditableEdgeInteraction(e.clientX, e.clientY)) return;

    if (updateScrollbarDrag(e.clientX, e.clientY)) return;

    if (resizeStateRef.current) {
      handleResizeMouseMove(e.clientX, e.clientY);
    } else if (nodeDragStateRef.current?.isDown && activeMode === 'select') {
      scheduleNodeDragMove(e.clientX, e.clientY);
    }
  };

  const handleWindowMouseUpRef = useRef<() => void>(() => {});
  handleWindowMouseUpRef.current = () => {
    if (edgeRouteDragRef.current || edgeReconnectRef.current) {
      handleMouseUpRef.current();
      return;
    }
    endScrollbarDrag();
    if (resizeStateRef.current) {
      handleMouseUpRef.current();
    } else if (nodeDragStateRef.current?.isDown) {
      handleMouseUpRef.current();
    }
  };

  // Global window listeners to ensure drag move & mouseup are tracked even if pointer leaves canvas
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => handleWindowMouseMoveRef.current(e);
    const handleWindowMouseUp = () => handleWindowMouseUpRef.current();

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, []);



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

  // Context Menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent, targetNodeId: string | null = null) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    // Keep the menu inside the canvas viewport, especially near the right/bottom edges.
    const menuWidth = 220;
    const canvasMouseX = (e.clientX - rect.left - pan.x) / zoom;
    const canvasMouseY = (e.clientY - rect.top - pan.y) / zoom;
    const resolvedNodeId = targetNodeId ?? (isCanvasSceneActive
      ? spatialIndex.queryPoint(canvasMouseX, canvasMouseY).reverse().find((node) => {
          const { width, height } = getNodeDimensions(node);
          return canvasMouseX >= node.x && canvasMouseX <= node.x + width && canvasMouseY >= node.y && canvasMouseY <= node.y + height;
        })?.id ?? null
      : null);
    const menuHeight = resolvedNodeId ? 360 : 240;
    const menuX = Math.max(8, Math.min(e.clientX - rect.left, rect.width - menuWidth - 8));
    const menuY = Math.max(8, Math.min(e.clientY - rect.top, rect.height - menuHeight - 8));

    // If targetNodeId is specified, ensure it is selected!
    if (resolvedNodeId && !selectedNodeIds.includes(resolvedNodeId)) {
      setSelectedNodeIds([resolvedNodeId]);
      setSelectedEdgeId(null);
    } else if (!resolvedNodeId) {
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
    }

    setContextMenu({
      x: menuX,
      y: menuY,
      canvasX: canvasMouseX,
      canvasY: canvasMouseY,
      targetNodeId: resolvedNodeId
    });
  }, [pan, zoom, selectedNodeIds, setSelectedNodeIds, setSelectedEdgeId, isCanvasSceneActive, spatialIndex]);

  // Clickaway listener to close context menu
  useEffect(() => {
    const handleCloseMenu = (e: MouseEvent) => {
      if (contextMenu && contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('mousedown', handleCloseMenu);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleCloseMenu);
      window.removeEventListener('keydown', handleEscape);
    };
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
  const isSingleNodeSelected = selectedNodeIds.length === 1;
  const activeNode = isSingleNodeSelected ? nodes.find(n => n.id === selectedNodeIds[0]) : null;

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
                  {diagram.type === 'blank' ? (
                    <div className="flex flex-col gap-2">
                      <div className="text-[10px] text-ink-soft font-mono leading-relaxed border border-blueprint bg-[#EBF3FA] dark:bg-[#152332] p-2">
                        // universal canvas — every shape is available
                      </div>
                      {UNIVERSAL_TOOLBOX_GROUPS.map((group) => (
                        <details key={group.label} open className="border border-line bg-paper-raised">
                          <summary className="px-2.5 py-2 font-mono text-[10px] text-blueprint uppercase tracking-wider font-bold cursor-pointer select-none hover:bg-paper">
                            {group.label}
                          </summary>
                          <div className="flex flex-col gap-1.5 px-1.5 pb-1.5">
                            {group.items.map((item) => (
                              <button
                                key={`${group.label}-${item.type}-${item.label}`}
                                onClick={() => addNode(item.type)}
                                className="w-full border-2 border-ink py-2 px-2.5 font-mono text-[11px] text-left bg-paper-raised hover:bg-paper hover:border-blueprint select-none transition-colors cursor-pointer flex items-center justify-between group"
                              >
                                <span className="flex items-center gap-2">
                                  {getToolIcon(item.type)}
                                  <span>{item.label}</span>
                                </span>
                                <span className="w-4 h-4 rounded-full bg-blueprint border border-ink flex items-center justify-center shrink-0">
                                  <Plus size={10} strokeWidth={3} className="text-white" />
                                </span>
                              </button>
                            ))}
                          </div>
                        </details>
                      ))}
                    </div>
                  ) : diagram.type === 'erd' || diagram.type === 'class' ? (
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

              {/* Toolbox guidance */}
              <div className="border-t-2 border-ink pt-3 mt-4">
                <div className="font-mono text-[10px] text-blueprint uppercase tracking-wider font-bold mb-2">
                  Toolbox guide
                </div>
                <div className="border border-line bg-paper-raised px-2.5 py-2.5 text-[10px] font-mono leading-relaxed text-ink-soft space-y-1.5">
                  <p><span className="font-bold text-ink">Add:</span> choose a shape to place it on the canvas.</p>
                  <p><span className="font-bold text-ink">Connect:</span> drag from a shape port to another port.</p>
                  <p><span className="font-bold text-ink">Edit:</span> right-click a shape or connector for its settings.</p>
                </div>
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

                  {codePreview && (
                    <CodeImportPreview
                      result={codePreview.result}
                      mode={codePreview.mode}
                      existingNodes={nodes.length}
                      existingEdges={edges.length}
                      onApply={handleApplyCodePreview}
                      onCancel={() => setCodePreview(null)}
                    />
                  )}

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
          onMouseLeave={() => {
            if (!nodeDragStateRef.current?.isDown && !resizeStateRef.current) handleMouseUp();
          }}
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

          <CanvasToolbar
            activeMode={activeMode}
            setActiveMode={setActiveMode}
            canUndo={canUndo}
            canRedo={canRedo}
            undo={undo}
            redo={redo}
            onClearSelection={() => {
              setSelectedNodeIds([]);
              setSelectedEdgeId(null);
            }}
            zoom={zoom}
            canvasGridStyle={canvasGridStyle}
            isSnapToGrid={isSnapToGrid}
            onToggleGridStyle={handleToggleGridStyle}
            onToggleSnap={handleToggleSnap}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitToScreen={handleFitToScreen}
            onResetZoom={handleResetZoom}
            pencilTool={pencilTool}
            setPencilTool={setPencilTool}
            pencilColor={pencilColor}
            setPencilColor={setPencilColor}
            pencilWidth={pencilWidth}
            setPencilWidth={setPencilWidth}
          />

          {/* Canvas Minimap / Overview Navigator */}
          <Minimap
            nodes={settledNodes}
            pan={pan}
            zoom={zoom}
            onPanChange={setPan}
          />

          {/* Canvas content element translation viewport */}
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
            className="absolute inset-0 z-0 pointer-events-none"
          >
            {/* SVG rendering layer */}
            <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-auto overflow-visible">
              <EdgeLayer
                edges={visibleEdges}
                nodes={nodes}
                selectedEdgeId={selectedEdgeId}
                activeMode={activeMode}
                edgeReconnectTarget={edgeReconnectTarget}
                connectingPort={connectingPort}
                snappedPort={snappedPort}
                tempEdgeEnd={tempEdgeEnd}
                diagramType={diagram?.type}
                isRoutingDeferred={draggedNodeId !== null || isResizing}
                routingRevision={routingRevision}
                onSelectEdge={(id) => {
                  setSelectedEdgeId(id);
                  setSelectedNodeIds([]);
                  setSelectedDrawingId(null);
                }}
                handleEdgeReconnectStart={handleEdgeReconnectStart}
                handleEdgeRouteDragStart={handleEdgeRouteDragStart}
                resetSelectedEdgeRoute={resetSelectedEdgeRoute}
              />

              <FreehandLayer
                drawings={drawings}
                selectedDrawingId={selectedDrawingId}
                activeMode={activeMode}
                pencilTool={pencilTool}
                pencilColor={pencilColor}
                pencilWidth={pencilWidth}
                activeDrawingPoints={activeDrawingPoints}
                deleteDrawing={deleteDrawing}
                onSelectDrawing={(id) => {
                  setSelectedDrawingId(id);
                  setSelectedNodeIds([]);
                  setSelectedEdgeId(null);
                }}
              />

              {/* Dynamic magnetic alignment guide lines */}
              {[0, 1].map((index) => (
                <line
                  key={`guide-${index}`}
                  ref={(element) => { alignmentGuideRefs.current[index] = element; }}
                  stroke={dc.blueprint}
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  className="pointer-events-none"
                  style={{ display: 'none' }}
                />
              ))}
            </svg>

          </div>

          {isCanvasSceneActive && (
            <StaticNodeCanvasLayer
              nodes={canvasNodesToRender}
              pan={pan}
              zoom={zoom}
              width={viewportSize.width}
              height={viewportSize.height}
            />
          )}

          {/* Interactive HTML Card Nodes */}
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
            className="absolute inset-0 z-20 pointer-events-none"
          >
            <div className="absolute inset-0 pointer-events-none">
              {domNodes.map((node) => {
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
                const flexAlignClass = node.textAlign === 'left' ? 'justify-start text-left' : node.textAlign === 'right' ? 'justify-end text-right' : 'justify-center text-center';

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
                    data-canvas-node-id={node.id}
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
                        className={`font-mono select-none w-full h-full flex items-center leading-normal px-2 ${flexAlignClass} ${node.isBold === false ? 'font-normal' : 'font-bold'}`}
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
                        className={`font-mono select-none h-full flex items-center px-2 ${flexAlignClass} ${node.isBold === false ? 'font-normal' : 'font-bold'}`}
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
                      <TableNodeContent node={node} />
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
                        className={`font-mono select-none h-full flex items-center px-2 ${flexAlignClass} ${node.isBold === false ? 'font-normal' : 'font-bold'}`}
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
              onMouseDown={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.stopPropagation()}
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

        <PropertiesSidebar
          isRightSidebarOpen={isRightSidebarOpen}
          setIsRightSidebarOpen={setIsRightSidebarOpen}
          diagram={diagram}
          nodes={nodes}
          edges={edges}
          drawings={drawings}
          selectedNodeIds={selectedNodeIds}
          selectedEdgeId={selectedEdgeId}
          selectedDrawingId={selectedDrawingId}
          zoom={zoom}
          setSelectedDrawingId={setSelectedDrawingId}
          duplicateSelection={duplicateSelection}
          deleteSelectedNodes={deleteSelectedNodes}
          deleteSelectedEdge={deleteSelectedEdge}
          deleteSelectedDrawing={deleteSelectedDrawing}
          morphSelectedNodeType={morphSelectedNodeType}
          updateSelectedNodeLabel={updateSelectedNodeLabel}
          updateSelectedNodeFields={updateSelectedNodeFields}
          updateSelectedNodeProperties={updateSelectedNodeProperties}
          updateSelectedNodeProperty={updateSelectedNodeProperty}
          bringToFront={bringToFront}
          bringForward={bringForward}
          sendBackward={sendBackward}
          sendToBack={sendToBack}
          updateSelectedEdgeLabel={updateSelectedEdgeLabel}
          updateSelectedEdgeStyle={updateSelectedEdgeStyle}
          updateSelectedEdgeArrow={updateSelectedEdgeArrow}
          updateSelectedEdgeSourceMarker={updateSelectedEdgeSourceMarker}
          updateSelectedEdgeTargetMarker={updateSelectedEdgeTargetMarker}
          updateSelectedEdgeErdPreset={updateSelectedEdgeErdPreset}
          resetSelectedEdgeRoute={resetSelectedEdgeRoute}
          updateSelectedDrawingColor={updateSelectedDrawingColor}
          updateSelectedDrawingWidth={updateSelectedDrawingWidth}
          autoAlignNodes={autoAlignNodes}
          handleResetZoom={handleResetZoom}
          handleClearCanvas={handleClearCanvas}
        />
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
