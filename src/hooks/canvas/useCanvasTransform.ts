import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { CanvasNode } from '../../services/mockDb';
import {
  type FreehandDrawing,
  type ScrollbarDragState,
  getNodeDimensions,
} from '../../types/canvas';

export interface UseCanvasTransformProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  nodes: CanvasNode[];
  drawings: FreehandDrawing[];
  nodesRef?: React.MutableRefObject<CanvasNode[]>;
  drawingsRef?: React.MutableRefObject<FreehandDrawing[]>;
}

export const useCanvasTransform = ({
  canvasRef,
  nodes,
  drawings,
  nodesRef,
  drawingsRef,
}: UseCanvasTransformProps) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Scrollbar Dragging State
  const scrollbarDragRef = useRef<ScrollbarDragState | null>(null);
  const [isScrollbarDragging, setIsScrollbarDragging] = useState(false);

  const nodesRefInternal = useRef(nodes);
  useEffect(() => {
    nodesRefInternal.current = nodes;
  }, [nodes]);

  const drawingsRefInternal = useRef(drawings);
  useEffect(() => {
    drawingsRefInternal.current = drawings;
  }, [drawings]);

  // Helper to center and fit the diagram into the canvas viewport
  const centerDiagramInView = useCallback(
    (
      customNodes?: CanvasNode[],
      customDrawings?: FreehandDrawing[]
    ) => {
      const targetNodes = customNodes ?? nodesRef?.current ?? nodesRefInternal.current;
      const targetDrawings = customDrawings ?? drawingsRef?.current ?? drawingsRefInternal.current;
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const viewportWidth = rect.width > 0 ? rect.width : window.innerWidth - 300;
      const viewportHeight = rect.height > 0 ? rect.height : window.innerHeight - 60;

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
        minX = 0;
        maxX = 400;
        minY = 0;
        maxY = 300;
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
    },
    [canvasRef, nodesRef, drawingsRef]
  );

  const handleZoomIn = useCallback(() => setZoom((prev) => Math.min(prev + 0.15, 3)), []);
  const handleZoomOut = useCallback(() => setZoom((prev) => Math.max(prev - 0.15, 0.25)), []);
  const handleFitToScreen = useCallback(() => {
    centerDiagramInView();
  }, [centerDiagramInView]);
  const handleResetZoom = useCallback(() => {
    centerDiagramInView();
  }, [centerDiagramInView]);

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
      minX = 0;
      maxX = 800;
      minY = 0;
      maxY = 600;
    }

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: Math.max(maxX - minX, 100),
      height: Math.max(maxY - minY, 100),
    };
  }, [nodes, drawings]);

  // Track canvas container viewport size
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 800,
    height: typeof window !== 'undefined' ? window.innerHeight : 600,
  });

  useEffect(() => {
    if (!canvasRef.current) return;
    const updateSize = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setViewportSize({ width: rect.width, height: rect.height });
        }
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [canvasRef]);

  // Compute real-time scrollbar dimensions and positions
  const scrollbarMetrics = useMemo(() => {
    const width = viewportSize.width;
    const height = viewportSize.height;

    // Horizontal scrollbar metrics
    const trackW = Math.max(width - 24, 100);
    const visibleMinX = -pan.x / zoom;
    const visibleMaxX = (width - pan.x) / zoom;
    const worldMinX = Math.min(contentBounds.minX - 600, visibleMinX - 200);
    const worldMaxX = Math.max(contentBounds.maxX + 600, visibleMaxX + 200);
    const worldW = Math.max(worldMaxX - worldMinX, 100);
    const thumbRatioX = Math.min(Math.max(width / zoom / worldW, 0.05), 0.95);
    const thumbW = Math.max(thumbRatioX * trackW, 36);
    const thumbLeft = Math.max(
      0,
      Math.min(((visibleMinX - worldMinX) / worldW) * trackW, trackW - thumbW)
    );

    // Vertical scrollbar metrics
    const trackH = Math.max(height - 24, 100);
    const visibleMinY = -pan.y / zoom;
    const visibleMaxY = (height - pan.y) / zoom;
    const worldMinY = Math.min(contentBounds.minY - 500, visibleMinY - 200);
    const worldMaxY = Math.max(contentBounds.maxY + 500, visibleMaxY + 200);
    const worldH = Math.max(worldMaxY - worldMinY, 100);
    const thumbRatioY = Math.min(Math.max(height / zoom / worldH, 0.05), 0.95);
    const thumbH = Math.max(thumbRatioY * trackH, 36);
    const thumbTop = Math.max(
      0,
      Math.min(((visibleMinY - worldMinY) / worldH) * trackH, trackH - thumbH)
    );

    return {
      horiz: {
        trackWidth: trackW,
        thumbWidth: thumbW,
        thumbLeft: Math.round(thumbLeft),
        worldMinX,
        worldW,
      },
      vert: {
        trackHeight: trackH,
        thumbHeight: thumbH,
        thumbTop: Math.round(thumbTop),
        worldMinY,
        worldH,
      },
    };
  }, [pan, zoom, contentBounds, viewportSize]);

  const handleScrollbarThumbMouseDown = useCallback(
    (e: React.MouseEvent, axis: 'x' | 'y') => {
      e.stopPropagation();
      e.preventDefault();
      const width = viewportSize.width;
      const height = viewportSize.height;
      const trackLength =
        axis === 'x' ? Math.max(width - 24, 100) : Math.max(height - 24, 100);

      const visibleMin = axis === 'x' ? -pan.x / zoom : -pan.y / zoom;
      const visibleSpan = axis === 'x' ? width / zoom : height / zoom;
      const contentMin = axis === 'x' ? contentBounds.minX : contentBounds.minY;
      const contentMax = axis === 'x' ? contentBounds.maxX : contentBounds.maxY;
      const worldMin = Math.min(contentMin - 600, visibleMin - 200);
      const worldMax = Math.max(contentMax + 600, visibleMin + visibleSpan + 200);
      const worldLength = Math.max(worldMax - worldMin, 100);

      const startClientPos = axis === 'x' ? e.clientX : e.clientY;
      const startPan = axis === 'x' ? pan.x : pan.y;

      scrollbarDragRef.current = {
        axis,
        startClientPos,
        startPan,
        trackLength,
        worldLength,
      };
      setIsScrollbarDragging(true);

      const onMouseMove = (moveEvent: MouseEvent) => {
        const currentClientPos = axis === 'x' ? moveEvent.clientX : moveEvent.clientY;
        const deltaClient = currentClientPos - startClientPos;
        const deltaWorld = deltaClient * (worldLength / trackLength);
        const newPanValue = Math.round(startPan - deltaWorld * zoom);
        if (axis === 'x') {
          setPan((prev) => ({ ...prev, x: newPanValue }));
        } else {
          setPan((prev) => ({ ...prev, y: newPanValue }));
        }
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        scrollbarDragRef.current = null;
        setIsScrollbarDragging(false);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [pan, zoom, contentBounds, viewportSize]
  );

  const updateScrollbarDrag = useCallback(
    (clientX: number, clientY: number): boolean => {
      if (!scrollbarDragRef.current) return false;
      const s = scrollbarDragRef.current;
      const currentClientPos = s.axis === 'x' ? clientX : clientY;
      const deltaClient = currentClientPos - s.startClientPos;
      const deltaWorld = deltaClient * (s.worldLength / s.trackLength);
      const newPanValue = Math.round(s.startPan - deltaWorld * zoom);
      if (s.axis === 'x') {
        setPan((prev) => ({ ...prev, x: newPanValue }));
      } else {
        setPan((prev) => ({ ...prev, y: newPanValue }));
      }
      return true;
    },
    [zoom]
  );

  const endScrollbarDrag = useCallback((): boolean => {
    if (scrollbarDragRef.current) {
      scrollbarDragRef.current = null;
      setIsScrollbarDragging(false);
      return true;
    }
    return false;
  }, []);

  // Wheel Zoom & 2D Pan Scroll
  const handleCanvasWheel = useCallback(
    (e: React.WheelEvent) => {
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

        setPan((prev) => ({
          x: Math.round(prev.x - deltaX),
          y: Math.round(prev.y - deltaY),
        }));
      }
    },
    [zoom, pan, canvasRef]
  );

  return {
    zoom,
    setZoom,
    pan,
    setPan,
    isPanning,
    setIsPanning,
    panStart,
    scrollbarDragRef,
    isScrollbarDragging,
    setIsScrollbarDragging,
    contentBounds,
    scrollbarMetrics,
    centerDiagramInView,
    handleZoomIn,
    handleZoomOut,
    handleFitToScreen,
    handleResetZoom,
    handleScrollbarThumbMouseDown,
    updateScrollbarDrag,
    endScrollbarDrag,
    handleCanvasWheel,
  };
};
