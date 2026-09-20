import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Map as MapIcon, ChevronDown, ChevronUp } from 'lucide-react';
import type { CanvasNode } from '../../services/mockDb';
import { getNodeDimensions } from '../../types/canvas';

export interface MinimapProps {
  nodes: CanvasNode[];
  pan: { x: number; y: number };
  zoom: number;
  canvasWidth?: number;
  canvasHeight?: number;
  onPanChange: (pan: { x: number; y: number }) => void;
}

const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 120;
const PADDING = 200;

export const Minimap: React.FC<MinimapProps> = ({
  nodes,
  pan,
  zoom,
  canvasWidth = window.innerWidth,
  canvasHeight = window.innerHeight,
  onPanChange,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute world bounding box
  const bounds = useMemo(() => {
    if (nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 2000, maxY: 1500, width: 2000, height: 1500 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
      const dim = getNodeDimensions(node);
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + dim.width);
      maxY = Math.max(maxY, node.y + dim.height);
    }

    minX = Math.min(minX - PADDING, 0);
    minY = Math.min(minY - PADDING, 0);
    maxX = Math.max(maxX + PADDING, 2000);
    maxY = Math.max(maxY + PADDING, 1500);

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(maxX - minX, 500),
      height: Math.max(maxY - minY, 500),
    };
  }, [nodes]);

  // Scale from world coords to minimap coords
  const scale = useMemo(() => {
    return Math.min(MINIMAP_WIDTH / bounds.width, MINIMAP_HEIGHT / bounds.height);
  }, [bounds]);

  // Viewport rect in minimap space
  const viewportRect = useMemo(() => {
    const worldViewportX = -pan.x / zoom;
    const worldViewportY = -pan.y / zoom;
    const worldViewportW = canvasWidth / zoom;
    const worldViewportH = canvasHeight / zoom;

    const x = (worldViewportX - bounds.minX) * scale;
    const y = (worldViewportY - bounds.minY) * scale;
    const width = worldViewportW * scale;
    const height = worldViewportH * scale;

    return { x, y, width, height };
  }, [pan.x, pan.y, zoom, canvasWidth, canvasHeight, bounds.minX, bounds.minY, scale]);

  // Handle clicking or dragging on minimap to jump viewport
  const handleMinimapInteraction = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;

      // Convert minimap click to world position
      const worldX = bounds.minX + clickX / scale;
      const worldY = bounds.minY + clickY / scale;

      // Center viewport on click
      const newPanX = -(worldX * zoom) + canvasWidth / 2;
      const newPanY = -(worldY * zoom) + canvasHeight / 2;

      onPanChange({ x: newPanX, y: newPanY });
    },
    [bounds.minX, bounds.minY, scale, zoom, canvasWidth, canvasHeight, onPanChange]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleMinimapInteraction(e.clientX, e.clientY);

    const onMouseMove = (moveEvent: MouseEvent) => {
      handleMinimapInteraction(moveEvent.clientX, moveEvent.clientY);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end select-none font-mono">
      {isOpen ? (
        <div className="bg-paper-raised border-2 border-ink shadow-hard-ink flex flex-col overflow-hidden">
          {/* Header */}
          <div className="h-6 border-b border-ink px-2 flex items-center justify-between bg-paper text-[10px] text-ink-soft">
            <div className="flex items-center gap-1 font-bold">
              <MapIcon className="w-3 h-3 text-blueprint" />
              <span>NAVIGATOR</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-ink-soft hover:text-ink cursor-pointer p-0.5"
              title="Minimize Navigator"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {/* Map Surface */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
            className="relative bg-paper cursor-crosshair overflow-hidden"
          >
            {/* Shapes */}
            <svg
              width={MINIMAP_WIDTH}
              height={MINIMAP_HEIGHT}
              className="absolute inset-0 pointer-events-none"
            >
              {nodes.map((node) => {
                const dim = getNodeDimensions(node);
                const nx = (node.x - bounds.minX) * scale;
                const ny = (node.y - bounds.minY) * scale;
                const nw = Math.max(dim.width * scale, 3);
                const nh = Math.max(dim.height * scale, 2);

                return (
                  <rect
                    key={node.id}
                    x={nx}
                    y={ny}
                    width={nw}
                    height={nh}
                    fill={node.fillColor || '#1E5C8C'}
                    stroke="#15191C"
                    strokeWidth={0.75}
                    opacity={0.8}
                  />
                );
              })}
            </svg>

            {/* Viewport Indicator */}
            <div
              style={{
                left: `${viewportRect.x}px`,
                top: `${viewportRect.y}px`,
                width: `${Math.max(viewportRect.width, 10)}px`,
                height: `${Math.max(viewportRect.height, 10)}px`,
              }}
              className="absolute border-2 border-signal bg-signal/15 pointer-events-none"
            />
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-paper-raised border-2 border-ink shadow-hard-ink px-2 py-1 text-[10px] flex items-center gap-1 text-ink font-bold hover:bg-paper cursor-pointer"
          title="Open Canvas Navigator"
        >
          <MapIcon className="w-3 h-3 text-blueprint" />
          <span>MAP</span>
          <ChevronUp className="w-3 h-3 text-ink-soft" />
        </button>
      )}
    </div>
  );
};
