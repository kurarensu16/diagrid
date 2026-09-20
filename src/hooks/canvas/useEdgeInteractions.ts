import { useState, useCallback, useRef, useEffect } from 'react';
import type { CanvasNode, CanvasEdge } from '../../services/mockDb';
import type { FreehandDrawing, EdgeRouteDragState, EdgeReconnectState } from '../../types/canvas';
import { getPortCoords } from '../../utils/edgeRouting';

export interface ClosestPortResult {
  port: 'top' | 'bottom' | 'left' | 'right';
  coords: { x: number; y: number };
  dist: number;
}

export const getClosestPortOnNode = (
  node: CanvasNode,
  point: { x: number; y: number }
): ClosestPortResult => {
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

export interface UseEdgeInteractionsProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  drawings: FreehandDrawing[];
  nodesRef: React.MutableRefObject<CanvasNode[]>;
  edgesRef: React.MutableRefObject<CanvasEdge[]>;
  setEdges: React.Dispatch<React.SetStateAction<CanvasEdge[]>>;
  setSelectedEdgeId: (id: string | null) => void;
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedDrawingId: (id: string | null) => void;
  saveHistoryState: (
    nodes: CanvasNode[],
    edges: CanvasEdge[],
    drawings: FreehandDrawing[]
  ) => void;
  diagramType?: string;
  isSnapToGrid?: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  pan: { x: number; y: number };
  zoom: number;
  activeMode: 'select' | 'mark' | 'draw' | 'pan';
  selectedEdgeId: string | null;
}

export const useEdgeInteractions = ({
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
  diagramType,
  isSnapToGrid = true,
  canvasRef,
  pan,
  zoom,
  activeMode,
  selectedEdgeId,
}: UseEdgeInteractionsProps) => {
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

  // Editable connector routing states.
  const edgeRouteDragRef = useRef<EdgeRouteDragState | null>(null);
  const edgeReconnectRef = useRef<EdgeReconnectState | null>(null);
  const [edgeReconnectTarget, setEdgeReconnectTarget] = useState<{
    nodeId: string;
    port: 'top' | 'bottom' | 'left' | 'right';
  } | null>(null);
  const edgeReconnectTargetRef = useRef<typeof edgeReconnectTarget>(null);

  const getCanvasPointFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const raw = {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
      if (!isSnapToGrid) return raw;
      return { x: Math.round(raw.x / 20) * 20, y: Math.round(raw.y / 20) * 20 };
    },
    [canvasRef, pan.x, pan.y, zoom, isSnapToGrid]
  );

  const findNearestPort = useCallback(
    (point: { x: number; y: number }) => {
      let nearest: { nodeId: string; port: 'top' | 'bottom' | 'left' | 'right'; distance: number } | null = null;
      for (const node of nodesRef.current) {
        const candidate = getClosestPortOnNode(node, point);
        if (candidate.dist <= 36 && (!nearest || candidate.dist < nearest.distance)) {
          nearest = { nodeId: node.id, port: candidate.port, distance: candidate.dist };
        }
      }
      return nearest;
    },
    [nodesRef]
  );

  const handleEdgeRouteDragStart = useCallback(
    (
      e: React.MouseEvent,
      edge: CanvasEdge,
      pathPoints: { x: number; y: number }[],
      segmentIndex?: number,
      waypointIndex?: number
    ) => {
      if (activeMode !== 'select') return;
      e.preventDefault();
      e.stopPropagation();
      const pointer = getCanvasPointFromClient(e.clientX, e.clientY);
      if (!pointer) return;

      const initialWaypoints =
        edge.routeMode === 'manual' && edge.waypoints?.length
          ? edge.waypoints.map((point) => ({ ...point }))
          : pathPoints.slice(1, -1).map((point) => ({ ...point }));

      let nextIndex =
        waypointIndex ??
        Math.min(
          Math.max((segmentIndex ?? 1) - 1, 0),
          Math.max(initialWaypoints.length - 1, 0)
        );
      if (initialWaypoints.length === 0) {
        initialWaypoints.push(pointer);
        nextIndex = 0;
      }

      const segmentStart = segmentIndex === undefined ? null : pathPoints[segmentIndex];
      const segmentEnd = segmentIndex === undefined ? null : pathPoints[segmentIndex + 1];
      const axis =
        segmentStart && segmentEnd
          ? segmentStart.y === segmentEnd.y
            ? 'y'
            : 'x'
          : 'both';

      edgeRouteDragRef.current = {
        edgeId: edge.id,
        waypointIndex: nextIndex,
        initialWaypoints,
        axis,
      };
      const nextEdges = edgesRef.current.map((item) =>
        item.id === edge.id
          ? { ...item, routeMode: 'manual' as const, waypoints: initialWaypoints }
          : item
      );
      edgesRef.current = nextEdges;
      setEdges(nextEdges);
      setSelectedEdgeId(edge.id);
      setSelectedNodeIds([]);
      setSelectedDrawingId(null);
    },
    [
      activeMode,
      getCanvasPointFromClient,
      edgesRef,
      setEdges,
      setSelectedEdgeId,
      setSelectedNodeIds,
      setSelectedDrawingId,
    ]
  );

  const handleEdgeReconnectStart = useCallback(
    (e: React.MouseEvent, edgeId: string, endpoint: 'source' | 'target') => {
      if (activeMode !== 'select') return;
      e.preventDefault();
      e.stopPropagation();
      edgeReconnectRef.current = { edgeId, endpoint };
      edgeReconnectTargetRef.current = null;
      setEdgeReconnectTarget(null);
    },
    [activeMode]
  );

  const updateEditableEdgeInteraction = useCallback(
    (clientX: number, clientY: number): boolean => {
      const point = getCanvasPointFromClient(clientX, clientY);
      if (!point) return false;

      if (edgeRouteDragRef.current) {
        const { edgeId, waypointIndex, initialWaypoints, axis } = edgeRouteDragRef.current;
        const waypoints = initialWaypoints.map((waypoint, index) =>
          index === waypointIndex
            ? {
                x: axis === 'y' ? waypoint.x : point.x,
                y: axis === 'x' ? waypoint.y : point.y,
              }
            : waypoint
        );
        const nextEdges = edgesRef.current.map((edge) =>
          edge.id === edgeId ? { ...edge, routeMode: 'manual' as const, waypoints } : edge
        );
        edgesRef.current = nextEdges;
        setEdges(nextEdges);
        return true;
      }

      if (edgeReconnectRef.current) {
        const nearest = findNearestPort(point);
        edgeReconnectTargetRef.current = nearest
          ? { nodeId: nearest.nodeId, port: nearest.port }
          : null;
        setEdgeReconnectTarget(nearest ? { nodeId: nearest.nodeId, port: nearest.port } : null);
        return true;
      }

      return false;
    },
    [getCanvasPointFromClient, edgesRef, setEdges, findNearestPort]
  );

  const finishEditableEdgeInteraction = useCallback(() => {
    if (edgeRouteDragRef.current) {
      edgeRouteDragRef.current = null;
      saveHistoryState(nodesRef.current, edgesRef.current, drawings);
    }

    if (edgeReconnectRef.current) {
      const { edgeId, endpoint } = edgeReconnectRef.current;
      const reconnectTarget = edgeReconnectTargetRef.current;
      if (reconnectTarget) {
        const nextEdges = edgesRef.current.map((edge) =>
          edge.id === edgeId
            ? {
                ...edge,
                [endpoint]: reconnectTarget.nodeId,
                [endpoint === 'source' ? 'sourceHandle' : 'targetHandle']:
                  reconnectTarget.port,
                routeMode: 'auto' as const,
                waypoints: undefined,
              }
            : edge
        );
        edgesRef.current = nextEdges;
        setEdges(nextEdges);
        saveHistoryState(nodesRef.current, nextEdges, drawings);
      }
      edgeReconnectRef.current = null;
      edgeReconnectTargetRef.current = null;
      setEdgeReconnectTarget(null);
    }
  }, [nodesRef, edgesRef, drawings, saveHistoryState, setEdges]);

  const resetSelectedEdgeRoute = useCallback(() => {
    if (!selectedEdgeId) return;
    const nextEdges = edges.map((edge) =>
      edge.id === selectedEdgeId
        ? { ...edge, routeMode: 'auto' as const, waypoints: undefined }
        : edge
    );
    edgesRef.current = nextEdges;
    setEdges(nextEdges);
    saveHistoryState(nodes, nextEdges, drawings);
  }, [selectedEdgeId, edges, edgesRef, setEdges, saveHistoryState, nodes, drawings]);

  const completePortConnection = useCallback(
    (targetNodeId: string, targetPort: 'top' | 'bottom' | 'left' | 'right') => {
      if (!connectingPort || connectingPort.nodeId === targetNodeId) {
        setConnectingPort(null);
        setSnappedPort(null);
        return;
      }

      const isErd = diagramType === 'erd';
      const newEdge: CanvasEdge = {
        id: `e-${Math.random().toString(36).substr(2, 9)}`,
        source: connectingPort.nodeId,
        target: targetNodeId,
        sourceHandle: connectingPort.port,
        targetHandle: targetPort,
        style: 'solid',
        arrow: isErd ? undefined : 'end',
        sourceMarker: isErd ? 'one' : undefined,
        targetMarker: isErd ? 'many' : 'arrow',
      };

      const nextEdges = [...edges, newEdge];
      setEdges(nextEdges);
      setSelectedEdgeId(newEdge.id);
      setSelectedNodeIds([]);
      setConnectingPort(null);
      setSnappedPort(null);
      saveHistoryState(nodes, nextEdges, drawings);
    },
    [
      connectingPort,
      diagramType,
      edges,
      nodes,
      drawings,
      saveHistoryState,
      setEdges,
      setSelectedEdgeId,
      setSelectedNodeIds,
    ]
  );

  const completePortConnectionRef = useRef(completePortConnection);
  useEffect(() => {
    completePortConnectionRef.current = completePortConnection;
  }, [completePortConnection]);

  // Global window mouseup listener to guarantee connection cleanup
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (connectingPort) {
        if (snappedPort) {
          completePortConnectionRef.current(snappedPort.nodeId, snappedPort.port);
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
  }, [connectingPort, snappedPort]);

  // Connect Handles Anchors
  const handlePortMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string, port: 'top' | 'bottom' | 'left' | 'right') => {
      e.stopPropagation();
      e.preventDefault();
      const sourceNode = nodes.find((n) => n.id === nodeId);
      if (!sourceNode) return;

      const start = getPortCoords(sourceNode, port);
      setConnectingPort({ nodeId, port });
      setSnappedPort(null);
      setTempEdgeEnd(start);
    },
    [nodes]
  );

  const handlePortMouseUp = useCallback(
    (
      e: React.MouseEvent,
      targetNodeId: string,
      targetPort: 'top' | 'bottom' | 'left' | 'right'
    ) => {
      e.stopPropagation();
      completePortConnection(targetNodeId, targetPort);
    },
    [completePortConnection]
  );

  return {
    connectingPort,
    setConnectingPort,
    snappedPort,
    setSnappedPort,
    tempEdgeEnd,
    setTempEdgeEnd,
    edgeRouteDragRef,
    edgeReconnectRef,
    edgeReconnectTarget,
    setEdgeReconnectTarget,
    edgeReconnectTargetRef,
    getCanvasPointFromClient,
    findNearestPort,
    handleEdgeRouteDragStart,
    handleEdgeReconnectStart,
    updateEditableEdgeInteraction,
    finishEditableEdgeInteraction,
    resetSelectedEdgeRoute,
    completePortConnection,
    completePortConnectionRef,
    handlePortMouseDown,
    handlePortMouseUp,
  };
};
