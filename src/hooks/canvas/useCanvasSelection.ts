import { useState, useCallback } from 'react';
import type { CanvasNode, CanvasEdge } from '../../services/mockDb';
import type { FreehandDrawing } from '../../types/canvas';

export interface UseCanvasSelectionProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  drawings: FreehandDrawing[];
  setNodes: React.Dispatch<React.SetStateAction<CanvasNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<CanvasEdge[]>>;
  setDrawings: React.Dispatch<React.SetStateAction<FreehandDrawing[]>>;
  saveHistoryState: (
    nodes: CanvasNode[],
    edges: CanvasEdge[],
    drawings: FreehandDrawing[]
  ) => void;
  getPastePosition?: () => { x: number; y: number };
}

export const useCanvasSelection = ({
  nodes,
  edges,
  drawings,
  setNodes,
  setEdges,
  setDrawings,
  saveHistoryState,
  getPastePosition,
}: UseCanvasSelectionProps) => {
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);

  const [clipboard, setClipboard] = useState<{
    nodes: CanvasNode[];
    edges: CanvasEdge[];
  } | null>(null);

  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null);

  const clearSelection = useCallback(() => {
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setSelectedDrawingId(null);
  }, []);

  const copySelection = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
    const selectedEdges = edges.filter(
      (e) => selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target)
    );
    setClipboard({
      nodes: JSON.parse(JSON.stringify(selectedNodes)),
      edges: JSON.parse(JSON.stringify(selectedEdges)),
    });
  }, [nodes, edges, selectedNodeIds]);

  const cutSelection = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
    const selectedEdges = edges.filter(
      (e) => selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target)
    );
    setClipboard({
      nodes: JSON.parse(JSON.stringify(selectedNodes)),
      edges: JSON.parse(JSON.stringify(selectedEdges)),
    });

    const nextNodes = nodes.filter((n) => !selectedNodeIds.includes(n.id));
    const nextEdges = edges.filter(
      (e) => !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target)
    );
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeIds([]);
    saveHistoryState(nextNodes, nextEdges, drawings);
  }, [nodes, edges, drawings, selectedNodeIds, saveHistoryState, setNodes, setEdges]);

  const pasteClipboard = useCallback(
    (targetCoords?: { x: number; y: number }) => {
      if (!clipboard || clipboard.nodes.length === 0) return;

      const minX = Math.min(...clipboard.nodes.map((n) => n.x));
      const minY = Math.min(...clipboard.nodes.map((n) => n.y));

      const fallbackPos = getPastePosition ? getPastePosition() : { x: 200, y: 200 };
      const pasteX = targetCoords ? targetCoords.x : fallbackPos.x;
      const pasteY = targetCoords ? targetCoords.y : fallbackPos.y;

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
          y: targetY,
        };
      });

      const newEdges: CanvasEdge[] = clipboard.edges
        .map((oldEdge) => {
          const newSource = idMap[oldEdge.source];
          const newTarget = idMap[oldEdge.target];
          if (newSource && newTarget) {
            return {
              ...oldEdge,
              id: `e-${Math.random().toString(36).substr(2, 9)}`,
              source: newSource,
              target: newTarget,
            };
          }
          return null;
        })
        .filter(Boolean) as CanvasEdge[];

      const updatedNodes = [...nodes, ...newNodes];
      const updatedEdges = [...edges, ...newEdges];
      setNodes(updatedNodes);
      setEdges(updatedEdges);
      setSelectedNodeIds(newNodes.map((n) => n.id));
      setSelectedEdgeId(null);
      saveHistoryState(updatedNodes, updatedEdges, drawings);
    },
    [clipboard, nodes, edges, drawings, saveHistoryState, getPastePosition, setNodes, setEdges]
  );

  const duplicateSelection = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
    const selectedEdges = edges.filter(
      (e) => selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target)
    );

    const idMap: Record<string, string> = {};
    const newNodes: CanvasNode[] = selectedNodes.map((oldNode) => {
      const newId = `n-${Math.random().toString(36).substr(2, 9)}`;
      idMap[oldNode.id] = newId;
      return {
        ...oldNode,
        id: newId,
        x: oldNode.x + 20,
        y: oldNode.y + 20,
      };
    });

    const newEdges: CanvasEdge[] = selectedEdges
      .map((oldEdge) => {
        const newSource = idMap[oldEdge.source];
        const newTarget = idMap[oldEdge.target];
        if (newSource && newTarget) {
          return {
            ...oldEdge,
            id: `e-${Math.random().toString(36).substr(2, 9)}`,
            source: newSource,
            target: newTarget,
          };
        }
        return null;
      })
      .filter(Boolean) as CanvasEdge[];

    const updatedNodes = [...nodes, ...newNodes];
    const updatedEdges = [...edges, ...newEdges];
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    setSelectedNodeIds(newNodes.map((n) => n.id));
    setSelectedEdgeId(null);
    saveHistoryState(updatedNodes, updatedEdges, drawings);
  }, [nodes, edges, drawings, selectedNodeIds, saveHistoryState, setNodes, setEdges]);

  const deleteSelectedNodes = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    const nextNodes = nodes.filter((n) => !selectedNodeIds.includes(n.id));
    const nextEdges = edges.filter(
      (e) => !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target)
    );
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeIds([]);
    saveHistoryState(nextNodes, nextEdges, drawings);
  }, [nodes, edges, drawings, selectedNodeIds, saveHistoryState, setNodes, setEdges]);

  const deleteSelectedEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    const nextEdges = edges.filter((e) => e.id !== selectedEdgeId);
    setEdges(nextEdges);
    setSelectedEdgeId(null);
    saveHistoryState(nodes, nextEdges, drawings);
  }, [nodes, edges, drawings, selectedEdgeId, saveHistoryState, setEdges]);

  const deleteSelectedDrawing = useCallback(() => {
    if (!selectedDrawingId) return;
    const nextDrawings = drawings.filter((d) => d.id !== selectedDrawingId);
    setDrawings(nextDrawings);
    setSelectedDrawingId(null);
    saveHistoryState(nodes, edges, nextDrawings);
  }, [drawings, selectedDrawingId, nodes, edges, saveHistoryState, setDrawings]);

  const deleteDrawing = useCallback(
    (drawingId: string) => {
      const nextDrawings = drawings.filter((d) => d.id !== drawingId);
      setDrawings(nextDrawings);
      if (selectedDrawingId === drawingId) setSelectedDrawingId(null);
      saveHistoryState(nodes, edges, nextDrawings);
    },
    [drawings, selectedDrawingId, nodes, edges, saveHistoryState, setDrawings]
  );

  const selectAllNodes = useCallback(() => {
    setSelectedNodeIds(nodes.map((n) => n.id));
    setSelectedEdgeId(null);
  }, [nodes]);

  return {
    selectedNodeIds,
    setSelectedNodeIds,
    selectedEdgeId,
    setSelectedEdgeId,
    selectedDrawingId,
    setSelectedDrawingId,
    clipboard,
    setClipboard,
    marqueeStart,
    setMarqueeStart,
    marqueeEnd,
    setMarqueeEnd,
    clearSelection,
    copySelection,
    cutSelection,
    pasteClipboard,
    duplicateSelection,
    deleteSelectedNodes,
    deleteSelectedEdge,
    deleteSelectedDrawing,
    deleteDrawing,
    selectAllNodes,
  };
};
