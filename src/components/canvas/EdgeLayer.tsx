import React from 'react';
import type { CanvasNode, CanvasEdge } from '../../services/mockDb';
import { dc, getMarkerUrl, getNodeDimensions } from '../../types/canvas';
import {
  calculateEdgePath,
  getEdgeLabelPosition,
  getEdgePathPoints,
  getPortCoords,
} from '../../utils/edgeRouting';

export interface EdgeLayerProps {
  edges: CanvasEdge[];
  nodes: CanvasNode[];
  selectedEdgeId: string | null;
  activeMode: 'select' | 'mark' | 'draw' | 'pan';
  edgeReconnectTarget: {
    nodeId: string;
    port: 'top' | 'bottom' | 'left' | 'right';
  } | null;
  connectingPort: {
    nodeId: string;
    port: 'top' | 'bottom' | 'left' | 'right';
  } | null;
  snappedPort: {
    nodeId: string;
    port: 'top' | 'bottom' | 'left' | 'right';
  } | null;
  tempEdgeEnd: { x: number; y: number };
  diagramType?: string;
  onSelectEdge: (id: string) => void;
  handleEdgeReconnectStart: (
    e: React.MouseEvent,
    edgeId: string,
    endpoint: 'source' | 'target'
  ) => void;
  handleEdgeRouteDragStart: (
    e: React.MouseEvent,
    edge: CanvasEdge,
    pathPoints: { x: number; y: number }[],
    segmentIndex?: number,
    waypointIndex?: number
  ) => void;
  resetSelectedEdgeRoute: () => void;
}

export const EdgeLayer: React.FC<EdgeLayerProps> = ({
  edges,
  nodes,
  selectedEdgeId,
  activeMode,
  edgeReconnectTarget,
  connectingPort,
  snappedPort,
  tempEdgeEnd,
  diagramType,
  onSelectEdge,
  handleEdgeReconnectStart,
  handleEdgeRouteDragStart,
  resetSelectedEdgeRoute,
}) => {
  return (
    <>
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
      {diagramType === 'sequence' &&
        nodes
          .filter((node) => node.type !== 'sequence-activation')
          .map((node) => {
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

      {/* Render connector edges */}
      {edges.map((edge) => {
        const isSelected = selectedEdgeId === edge.id;
        const path = calculateEdgePath(edge, nodes);
        if (!path) return null;
        const pathPoints = getEdgePathPoints(path);

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
                onSelectEdge(edge.id);
              }}
              onClick={(e) => {
                if (activeMode !== 'select') return;
                e.stopPropagation();
                onSelectEdge(edge.id);
              }}
            />
            {(() => {
              const markerStartUrl = getMarkerUrl(
                edge.sourceMarker,
                edge.arrow,
                true,
                isSelected
              );
              const markerEndUrl = getMarkerUrl(
                edge.targetMarker,
                edge.arrow,
                false,
                isSelected
              );
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
                    onSelectEdge(edge.id);
                  }}
                  onClick={(e) => {
                    if (activeMode !== 'select') return;
                    e.stopPropagation();
                    onSelectEdge(edge.id);
                  }}
                />
              );
            })()}
            {isSelected && (
              <path
                d={path}
                fill="none"
                stroke="#00A8FF"
                strokeWidth="1.25"
                strokeDasharray="4 3"
                strokeLinecap="round"
                className="pointer-events-none"
              />
            )}
            {isSelected && pathPoints.length >= 2 && (
              <g>
                {/* Drag either endpoint onto a shape port to reconnect the line. */}
                {[
                  {
                    point: pathPoints[0],
                    endpoint: 'source' as const,
                    port: edge.sourceHandle || 'right',
                  },
                  {
                    point: pathPoints[pathPoints.length - 1],
                    endpoint: 'target' as const,
                    port: edge.targetHandle || 'left',
                  },
                ].map(({ point, endpoint, port }) => {
                  const offset =
                    port === 'top'
                      ? { x: 0, y: -10 }
                      : port === 'bottom'
                      ? { x: 0, y: 10 }
                      : port === 'left'
                      ? { x: -10, y: 0 }
                      : { x: 10, y: 0 };
                  return (
                    <circle
                      key={`endpoint-${edge.id}-${endpoint}`}
                      cx={point.x + offset.x}
                      cy={point.y + offset.y}
                      r="5"
                      fill="#00A8FF"
                      stroke={dc.paperRaised}
                      strokeWidth="2"
                      className="cursor-crosshair"
                      onMouseDown={(e) => handleEdgeReconnectStart(e, edge.id, endpoint)}
                    />
                  );
                })}
                {edgeReconnectTarget &&
                  (() => {
                    const targetNode = nodes.find(
                      (node) => node.id === edgeReconnectTarget.nodeId
                    );
                    if (!targetNode) return null;
                    const targetPoint = getPortCoords(
                      targetNode,
                      edgeReconnectTarget.port
                    );
                    return (
                      <circle
                        cx={targetPoint.x}
                        cy={targetPoint.y}
                        r="8"
                        fill="none"
                        stroke={dc.signal}
                        strokeWidth="2"
                        strokeDasharray="3 2"
                        className="pointer-events-none"
                      />
                    );
                  })()}

                {/* Corners can be moved directly; auto-routes become manual when edited. */}
                {(edge.routeMode === 'manual' && edge.waypoints?.length
                  ? edge.waypoints
                  : pathPoints.slice(1, -1)
                ).map((point, index) => (
                  <circle
                    key={`corner-${edge.id}-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r="5"
                    fill="#00A8FF"
                    stroke={dc.paperRaised}
                    strokeWidth="2"
                    className="cursor-move"
                    onMouseDown={(e) =>
                      handleEdgeRouteDragStart(e, edge, pathPoints, undefined, index)
                    }
                  />
                ))}

                {/* Mid-segment handles create or reposition an editable route control. */}
                {pathPoints.slice(0, -1).map((point, index) => {
                  const next = pathPoints[index + 1];
                  if (Math.hypot(next.x - point.x, next.y - point.y) < 28) return null;
                  return (
                    <circle
                      key={`segment-${edge.id}-${index}`}
                      cx={(point.x + next.x) / 2}
                      cy={(point.y + next.y) / 2}
                      r="4.5"
                      fill="#00A8FF"
                      stroke={dc.paperRaised}
                      strokeWidth="2"
                      className={
                        point.y === next.y ? 'cursor-ns-resize' : 'cursor-ew-resize'
                      }
                      onMouseDown={(e) =>
                        handleEdgeRouteDragStart(e, edge, pathPoints, index)
                      }
                    />
                  );
                })}
                {edge.routeMode === 'manual' && (
                  <g
                    className="cursor-pointer"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      resetSelectedEdgeRoute();
                    }}
                  >
                    <rect
                      x={labelX - 25}
                      y={labelY + 14}
                      width="50"
                      height="20"
                      rx="10"
                      fill={dc.paperRaised}
                      stroke="#00A8FF"
                      strokeWidth="1.25"
                    />
                    <text
                      x={labelX}
                      y={labelY + 27.5}
                      fill={dc.blueprint}
                      textAnchor="middle"
                      className="font-mono text-[9px] font-bold pointer-events-none"
                    >
                      RESET
                    </text>
                  </g>
                )}
              </g>
            )}
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
      {connectingPort &&
        (() => {
          const srcNode = nodes.find((n) => n.id === connectingPort.nodeId);
          if (!srcNode) return null;
          const start = getPortCoords(srcNode, connectingPort.port);
          return (
            <g>
              <line
                x1={start.x}
                y1={start.y}
                x2={tempEdgeEnd.x}
                y2={tempEdgeEnd.y}
                stroke={snappedPort ? '#00A8FF' : dc.blueprint}
                strokeWidth={snappedPort ? '2' : '1.5'}
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
    </>
  );
};
