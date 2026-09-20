import React from 'react';
import type { FreehandDrawing } from '../../types/canvas';
import { dc, pointsToSmoothSvgPath } from '../../types/canvas';

export interface FreehandLayerProps {
  drawings: FreehandDrawing[];
  selectedDrawingId: string | null;
  activeMode: 'select' | 'mark' | 'draw' | 'pan';
  pencilTool: 'pen' | 'highlighter' | 'eraser';
  pencilColor: string;
  pencilWidth: number;
  activeDrawingPoints: { x: number; y: number }[] | null;
  deleteDrawing: (id: string) => void;
  onSelectDrawing: (id: string) => void;
}

export const FreehandLayer: React.FC<FreehandLayerProps> = ({
  drawings,
  selectedDrawingId,
  activeMode,
  pencilTool,
  pencilColor,
  pencilWidth,
  activeDrawingPoints,
  deleteDrawing,
  onSelectDrawing,
}) => {
  return (
    <>
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
                  onSelectDrawing(draw.id);
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
    </>
  );
};
