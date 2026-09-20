import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { CanvasNode, CanvasEdge } from '../../services/mockDb';
import type { FreehandDrawing } from '../../types/canvas';

export interface CanvasSnapshot {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  drawings: FreehandDrawing[];
}

export interface HistoryState {
  list: CanvasSnapshot[];
  index: number;
}

export interface UseCanvasHistoryOptions {
  onRestore?: (snapshot: CanvasSnapshot) => void;
  maxHistory?: number;
}

export const useCanvasHistory = (options?: UseCanvasHistoryOptions) => {
  const maxHistory = options?.maxHistory ?? 50;
  const onRestoreRef = useRef(options?.onRestore);

  useEffect(() => {
    onRestoreRef.current = options?.onRestore;
  }, [options?.onRestore]);

  const [historyState, setHistoryState] = useState<HistoryState>({
    list: [],
    index: -1,
  });

  const saveHistoryState = useCallback(
    (
      nextNodes: CanvasNode[],
      nextEdges: CanvasEdge[],
      nextDrawings: FreehandDrawing[]
    ) => {
      const newSnapshot: CanvasSnapshot = {
        nodes: JSON.parse(JSON.stringify(nextNodes)),
        edges: JSON.parse(JSON.stringify(nextEdges)),
        drawings: JSON.parse(JSON.stringify(nextDrawings)),
      };

      setHistoryState((prev) => {
        // Check if identical to the current snapshot
        const current = prev.list[prev.index];
        if (current) {
          if (
            JSON.stringify(current.nodes) === JSON.stringify(newSnapshot.nodes) &&
            JSON.stringify(current.edges) === JSON.stringify(newSnapshot.edges) &&
            JSON.stringify(current.drawings) === JSON.stringify(newSnapshot.drawings)
          ) {
            return prev;
          }
        }

        const trimmed = prev.list.slice(0, prev.index + 1);
        const updated = [...trimmed, newSnapshot];
        if (updated.length > maxHistory) {
          updated.shift();
        }
        return {
          list: updated,
          index: updated.length - 1,
        };
      });
    },
    [maxHistory]
  );

  const undo = useCallback(() => {
    setHistoryState((prev) => {
      if (prev.index > 0) {
        const nextIndex = prev.index - 1;
        const snapshot = prev.list[nextIndex];
        if (onRestoreRef.current) {
          onRestoreRef.current(snapshot);
        }
        return {
          ...prev,
          index: nextIndex,
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
        if (onRestoreRef.current) {
          onRestoreRef.current(snapshot);
        }
        return {
          ...prev,
          index: nextIndex,
        };
      }
      return prev;
    });
  }, []);

  const resetHistory = useCallback(
    (
      initialNodes: CanvasNode[],
      initialEdges: CanvasEdge[],
      initialDrawings: FreehandDrawing[]
    ) => {
      setHistoryState({
        list: [
          {
            nodes: JSON.parse(JSON.stringify(initialNodes)),
            edges: JSON.parse(JSON.stringify(initialEdges)),
            drawings: JSON.parse(JSON.stringify(initialDrawings)),
          },
        ],
        index: 0,
      });
    },
    []
  );

  const canUndo = useMemo(() => historyState.index > 0, [historyState.index]);
  const canRedo = useMemo(
    () => historyState.index < historyState.list.length - 1,
    [historyState.index, historyState.list.length]
  );

  return {
    historyState,
    setHistoryState,
    saveHistoryState,
    undo,
    redo,
    resetHistory,
    canUndo,
    canRedo,
  };
};
