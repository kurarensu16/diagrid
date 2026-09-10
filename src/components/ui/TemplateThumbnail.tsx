import React, { useId } from 'react';
import type { Diagram, CanvasNode, CanvasEdge } from '../../services/mockDb';

export interface FreehandDrawing {
  id: string;
  path: string;
  color?: string;
  width?: number;
  opacity?: number;
  tool?: 'pen' | 'highlighter';
}

export interface TemplateThumbnailProps {
  content: string;
  type?: Diagram['type'];
  className?: string;
}

export const TemplateThumbnail: React.FC<TemplateThumbnailProps> = ({ 
  content, 
  type: _type = 'erd', 
  className = '' 
}) => {
  const uid = useId().replace(/:/g, '');

  try {
    const parsed = typeof content === 'string' ? JSON.parse(content || '{}') : content;
    const nodes: CanvasNode[] = parsed.nodes || [];
    const edges: CanvasEdge[] = parsed.edges || [];
    const drawings: FreehandDrawing[] = parsed.drawings || [];

    if (nodes.length === 0 && drawings.length === 0) {
      return (
        <div className={`w-full h-full flex flex-col items-center justify-center bg-paper-raised border border-dashed border-line text-ink-soft font-mono text-[11px] select-none ${className}`}>
          <div className="w-8 h-8 rounded-full border border-line flex items-center justify-center mb-1 text-[13px] text-ink-soft/60">
            [+]
          </div>
          <span>// blank_canvas</span>
        </div>
      );
    }

    // Determine bounding box of all nodes
    const nodeCoordsX: number[] = [];
    const nodeCoordsY: number[] = [];

    nodes.forEach(n => {
      const w = n.customWidth || n.width || (n.type === 'table' ? 140 : n.type === 'usecase-boundary' ? 240 : 120);
      const h = n.customHeight || n.height || (n.type === 'table' ? (n.fields ? 35 + n.fields.length * 16 : 100) : n.type === 'usecase-boundary' ? 180 : 60);
      nodeCoordsX.push(n.x, n.x + w);
      nodeCoordsY.push(n.y, n.y + h);
    });

    // Fallback coords if only drawings exist
    if (nodeCoordsX.length === 0) {
      nodeCoordsX.push(0, 300);
      nodeCoordsY.push(0, 200);
    }

    const minX = Math.min(...nodeCoordsX);
    const maxX = Math.max(...nodeCoordsX);
    const minY = Math.min(...nodeCoordsY);
    const maxY = Math.max(...nodeCoordsY);

    const padding = 32;
    const boxWidth = Math.max(maxX - minX + padding * 2, 280);
    const boxHeight = Math.max(maxY - minY + padding * 2, 180);
    const viewBox = `${minX - padding} ${minY - padding} ${boxWidth} ${boxHeight}`;

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    return (
      <div className={`w-full h-full bg-paper-raised bg-grid relative overflow-hidden flex items-center justify-center select-none ${className}`}>
        <svg 
          viewBox={viewBox} 
          className="w-full h-full p-2 pointer-events-none"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <marker id={`arrow-${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#15191C" />
            </marker>
            <marker id={`arrow-blue-${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#1E5C8C" />
            </marker>
            <marker id={`crows-one-${uid}`} viewBox="0 0 16 16" refX="16" refY="8" markerWidth="14" markerHeight="14" orient="auto-start-reverse">
              <line x1="0" y1="8" x2="16" y2="8" stroke="#15191C" strokeWidth="1.5" />
              <line x1="7" y1="2" x2="7" y2="14" stroke="#15191C" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="12" y1="2" x2="12" y2="14" stroke="#15191C" strokeWidth="1.5" strokeLinecap="round" />
            </marker>
            <marker id={`crows-many-${uid}`} viewBox="0 0 16 16" refX="16" refY="8" markerWidth="14" markerHeight="14" orient="auto-start-reverse">
              <line x1="0" y1="8" x2="16" y2="8" stroke="#15191C" strokeWidth="1.5" />
              <line x1="4" y1="2" x2="4" y2="14" stroke="#15191C" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="5" y1="8" x2="15.5" y2="2" stroke="#15191C" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="5" y1="8" x2="15.5" y2="14" stroke="#15191C" strokeWidth="1.5" strokeLinecap="round" />
            </marker>
          </defs>

          {/* Render edges */}
          {edges.map((edge) => {
            const src = nodeMap.get(edge.source);
            const tgt = nodeMap.get(edge.target);
            if (!src || !tgt) return null;

            const srcW = src.customWidth || src.width || (src.type === 'table' ? 130 : 90);
            const srcH = src.customHeight || src.height || (src.type === 'table' ? 70 : 40);
            const tgtW = tgt.customWidth || tgt.width || (tgt.type === 'table' ? 130 : 90);
            const tgtH = tgt.customHeight || tgt.height || (tgt.type === 'table' ? 70 : 40);

            const startX = src.x + srcW / 2;
            const startY = src.y + srcH / 2;
            const endX = tgt.x + tgtW / 2;
            const endY = tgt.y + tgtH / 2;
            const midX = (startX + endX) / 2;

            const markerStart = edge.sourceMarker 
              ? (edge.sourceMarker === 'none' ? undefined : `url(#crows-${edge.sourceMarker}-${uid})`)
              : (edge.arrow === 'both' ? `url(#arrow-${uid})` : undefined);
            const markerEnd = edge.targetMarker
              ? (edge.targetMarker === 'none' ? undefined : `url(#crows-${edge.targetMarker}-${uid})`)
              : (edge.arrow === 'none' ? undefined : `url(#arrow-${uid})`);

            return (
              <g key={edge.id}>
                <path
                  d={`M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`}
                  fill="none"
                  stroke={edge.style === 'dashed' ? '#4A5359' : '#15191C'}
                  strokeWidth="1.75"
                  strokeDasharray={edge.style === 'dashed' ? '5 4' : undefined}
                  markerStart={markerStart}
                  markerEnd={markerEnd}
                />
                {edge.label && (
                  <text
                    x={midX + 4}
                    y={(startY + endY) / 2}
                    fill="#15191C"
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Render freehand pencil annotations */}
          {drawings.map((draw) => (
            <path
              key={draw.id}
              d={draw.path}
              fill="none"
              stroke={draw.color || '#D45B33'}
              strokeWidth={draw.width || 2.5}
              opacity={draw.opacity ?? (draw.tool === 'highlighter' ? 0.35 : 1)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Render nodes */}
          {nodes.map((node) => {
            const fill = node.fillColor && node.fillColor !== 'transparent' ? node.fillColor : '#FFFFFF';
            const strokeWidth = node.borderWidth || 1.75;
            const strokeDash = node.borderStyle === 'dashed' ? '5 3' : node.borderStyle === 'dotted' ? '2 2' : undefined;

            if (node.type === 'table') {
              const fields = node.fields || [];
              const width = node.customWidth || node.width || 130;
              const height = node.customHeight || node.height || (28 + fields.length * 15);

              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <rect x="3" y="3" width={width} height={height} fill="#1E5C8C" opacity="0.25" />
                  <rect 
                    x="0" 
                    y="0" 
                    width={width} 
                    height={height} 
                    fill={fill} 
                    stroke="#15191C" 
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDash}
                  />
                  <rect x="0" y="0" width={width} height="22" fill="#1E5C8C" stroke="#15191C" strokeWidth={strokeWidth} />
                  <text x="6" y="15" fill="#FFFFFF" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                    {node.label}
                  </text>
                  {fields.map((f, i) => (
                    <text key={i} x="6" y={35 + i * 14} fill="#2C3439" fontSize="8" fontFamily="monospace">
                      {f}
                    </text>
                  ))}
                </g>
              );
            }

            if (node.type === 'decision' || node.type === 'activity-decision') {
              const dSize = node.customWidth || 64;
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <polygon
                    points={`${dSize / 2 + 2},2 ${dSize + 2},${dSize / 2 + 2} ${dSize / 2 + 2},${dSize + 2} 2,${dSize / 2 + 2}`}
                    fill="#D45B33"
                    opacity="0.25"
                  />
                  <polygon
                    points={`${dSize / 2},0 ${dSize},${dSize / 2} ${dSize / 2},${dSize} 0,${dSize / 2}`}
                    fill={fill}
                    stroke="#15191C"
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDash}
                  />
                  <text x={dSize / 2} y={dSize / 2 + 3} textAnchor="middle" fill="#D45B33" fontSize="8.5" fontFamily="monospace" fontWeight="bold">
                    {node.label}
                  </text>
                </g>
              );
            }

            if (node.type === 'terminal' || node.type === 'activity-start' || node.type === 'activity-end') {
              const width = node.customWidth || node.width || 90;
              const height = node.customHeight || node.height || 28;
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <rect x="2" y="2" width={width} height={height} rx={height / 2} fill="#15191C" opacity="0.2" />
                  <rect 
                    x="0" 
                    y="0" 
                    width={width} 
                    height={height} 
                    rx={height / 2} 
                    fill={fill} 
                    stroke="#15191C" 
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDash}
                  />
                  <text x={width / 2} y={height / 2 + 4} textAnchor="middle" fill="#15191C" fontSize="8.5" fontFamily="monospace" fontWeight="bold">
                    {node.label}
                  </text>
                </g>
              );
            }

            if (node.type === 'usecase-actor') {
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <circle cx="20" cy="10" r="7" fill={fill} stroke="#15191C" strokeWidth={strokeWidth} />
                  <line x1="20" y1="17" x2="20" y2="35" stroke="#15191C" strokeWidth={strokeWidth} />
                  <line x1="10" y1="23" x2="30" y2="23" stroke="#15191C" strokeWidth={strokeWidth} />
                  <line x1="20" y1="35" x2="12" y2="48" stroke="#15191C" strokeWidth={strokeWidth} />
                  <line x1="20" y1="35" x2="28" y2="48" stroke="#15191C" strokeWidth={strokeWidth} />
                  <text x="20" y="60" textAnchor="middle" fill="#15191C" fontSize="8.5" fontFamily="monospace" fontWeight="bold">
                    {node.label}
                  </text>
                </g>
              );
            }

            if (node.type === 'usecase-boundary') {
              const width = node.customWidth || 220;
              const height = node.customHeight || 170;
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <rect 
                    x="0" 
                    y="0" 
                    width={width} 
                    height={height} 
                    fill="none" 
                    stroke="#1E5C8C" 
                    strokeWidth="1.5" 
                    strokeDasharray="4 4" 
                  />
                  <text x="10" y="16" fill="#1E5C8C" fontSize="8.5" fontFamily="monospace" fontWeight="bold">
                    [Boundary] {node.label}
                  </text>
                </g>
              );
            }

            if (node.type === 'usecase-oval') {
              const rx = (node.customWidth || 120) / 2;
              const ry = (node.customHeight || 36) / 2;
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <ellipse 
                    cx={rx} 
                    cy={ry} 
                    rx={rx} 
                    ry={ry} 
                    fill={fill} 
                    stroke="#15191C" 
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDash}
                  />
                  <text x={rx} y={ry + 4} textAnchor="middle" fill="#15191C" fontSize="8.5" fontFamily="monospace" fontWeight="bold">
                    {node.label}
                  </text>
                </g>
              );
            }

            if (node.type === 'dfd-store') {
              const width = node.customWidth || 110;
              const height = node.customHeight || 36;
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <line x1="0" y1="0" x2={width} y2="0" stroke="#15191C" strokeWidth="2" />
                  <line x1="0" y1={height} x2={width} y2={height} stroke="#15191C" strokeWidth="2" />
                  <rect x="0" y="0" width={width} height={height} fill="#F1F4F1" />
                  <text x={width / 2} y={height / 2 + 4} textAnchor="middle" fill="#15191C" fontSize="8.5" fontFamily="monospace" fontWeight="bold">
                    [D] {node.label}
                  </text>
                </g>
              );
            }

            // Default Process Card
            const width = node.customWidth || node.width || 105;
            const height = node.customHeight || node.height || 38;
            return (
              <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                <rect x="3" y="3" width={width} height={height} fill="#15191C" opacity="0.2" />
                <rect 
                  x="0" 
                  y="0" 
                  width={width} 
                  height={height} 
                  fill={fill} 
                  stroke="#15191C" 
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDash}
                />
                <text x={width / 2} y={height / 2 + 4} textAnchor="middle" fill="#15191C" fontSize="8.5" fontFamily="monospace" fontWeight="bold">
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  } catch {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-paper text-ink-soft font-mono text-[11px] ${className}`}>
        // preview_not_available
      </div>
    );
  }
};

// Also export as DiagramThumbnail for clear semantic usage
export const DiagramThumbnail = TemplateThumbnail;
