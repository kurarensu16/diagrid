import React, { useId } from 'react';
import type { Diagram, CanvasNode, CanvasEdge } from '../../services/mockDb';
import { getNodeDimensions, type FreehandDrawing } from '../../utils/diagramExport';

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

    // Determine bounding box of all nodes using exact node dimension calculations
    const nodeCoordsX: number[] = [];
    const nodeCoordsY: number[] = [];

    nodes.forEach(n => {
      const { width, height } = getNodeDimensions(n);
      nodeCoordsX.push(n.x, n.x + width + 8);
      nodeCoordsY.push(n.y, n.y + height + 8);
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

    const padding = 28;
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
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#15191C" />
            </marker>
            <marker id={`arrow-blue-${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#1E5C8C" />
            </marker>
            <marker id={`crows-one-${uid}`} viewBox="0 0 16 16" refX="16" refY="8" markerWidth="14" markerHeight="14" orient="auto-start-reverse">
              <line x1="0" y1="8" x2="16" y2="8" stroke="#15191C" strokeWidth="1.5" />
              <line x1="12" y1="2" x2="12" y2="14" stroke="#15191C" strokeWidth="1.5" strokeLinecap="round" />
            </marker>
            <marker id={`crows-many-${uid}`} viewBox="0 0 16 16" refX="16" refY="8" markerWidth="14" markerHeight="14" orient="auto-start-reverse">
              <line x1="0" y1="8" x2="16" y2="8" stroke="#15191C" strokeWidth="1.5" />
              <line x1="5" y1="8" x2="15.5" y2="2" stroke="#15191C" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="5" y1="8" x2="15.5" y2="14" stroke="#15191C" strokeWidth="1.5" strokeLinecap="round" />
            </marker>
          </defs>

          {/* Render Sequence Diagram Lifelines (Vertical dashed lines beneath participants) */}
          {nodes.filter(n => n.type === 'process' && nodes.some(m => m.type === 'sequence-activation')).map(pNode => {
            const { width } = getNodeDimensions(pNode);
            const lineX = pNode.x + width / 2;
            const startY = pNode.y + 40;
            const endY = maxY - 10;
            return (
              <line
                key={`lifeline-${pNode.id}`}
                x1={lineX}
                y1={startY}
                x2={lineX}
                y2={endY}
                stroke="#15191C"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity="0.4"
              />
            );
          })}

          {/* Render edges */}
          {edges.map((edge) => {
            const src = nodeMap.get(edge.source);
            const tgt = nodeMap.get(edge.target);
            if (!src || !tgt) return null;

            const srcDim = getNodeDimensions(src);
            const tgtDim = getNodeDimensions(tgt);

            // Handle coordinates based on handle ports
            let startX = src.x + srcDim.width / 2;
            let startY = src.y + srcDim.height;
            if (edge.sourceHandle === 'top') { startX = src.x + srcDim.width / 2; startY = src.y; }
            else if (edge.sourceHandle === 'bottom') { startX = src.x + srcDim.width / 2; startY = src.y + srcDim.height; }
            else if (edge.sourceHandle === 'left') { startX = src.x; startY = src.y + srcDim.height / 2; }
            else if (edge.sourceHandle === 'right') { startX = src.x + srcDim.width; startY = src.y + srcDim.height / 2; }

            let endX = tgt.x + tgtDim.width / 2;
            let endY = tgt.y;
            if (edge.targetHandle === 'top') { endX = tgt.x + tgtDim.width / 2; endY = tgt.y; }
            else if (edge.targetHandle === 'bottom') { endX = tgt.x + tgtDim.width / 2; endY = tgt.y + tgtDim.height; }
            else if (edge.targetHandle === 'left') { endX = tgt.x; endY = tgt.y + tgtDim.height / 2; }
            else if (edge.targetHandle === 'right') { endX = tgt.x + tgtDim.width; endY = tgt.y + tgtDim.height / 2; }

            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;

            // Orthogonal path
            let pathData = '';
            if (edge.sourceHandle === 'left' || edge.sourceHandle === 'right' || edge.targetHandle === 'left' || edge.targetHandle === 'right') {
              pathData = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
            } else {
              pathData = `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
            }

            const markerStart = edge.sourceMarker 
              ? (edge.sourceMarker === 'none' ? undefined : `url(#crows-${edge.sourceMarker}-${uid})`)
              : (edge.arrow === 'both' ? `url(#arrow-${uid})` : undefined);
            const markerEnd = edge.targetMarker
              ? (edge.targetMarker === 'none' ? undefined : `url(#crows-${edge.targetMarker}-${uid})`)
              : (edge.arrow === 'none' ? undefined : `url(#arrow-${uid})`);

            return (
              <g key={edge.id}>
                <path
                  d={pathData}
                  fill="none"
                  stroke={edge.style === 'dashed' ? '#4A5359' : '#15191C'}
                  strokeWidth="1.75"
                  strokeDasharray={edge.style === 'dashed' ? '5 4' : undefined}
                  markerStart={markerStart}
                  markerEnd={markerEnd}
                />
                {edge.label && (
                  <g>
                    <rect
                      x={midX - (edge.label.length * 3 + 6)}
                      y={midY - 7}
                      width={edge.label.length * 6 + 12}
                      height="14"
                      fill="#FFFFFF"
                      stroke="#15191C"
                      strokeWidth="1"
                      rx="2"
                    />
                    <text
                      x={midX}
                      y={midY + 3.5}
                      fill="#15191C"
                      fontSize="8"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {edge.label}
                    </text>
                  </g>
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
            const { width, height } = getNodeDimensions(node);
            const fill = node.fillColor && node.fillColor !== 'transparent' ? node.fillColor : '#FFFFFF';
            const strokeWidth = node.borderWidth || 1.75;
            const strokeDash = node.borderStyle === 'dashed' ? '5 3' : node.borderStyle === 'dotted' ? '2 2' : undefined;

            // 1. Table / ERD / Class
            if (node.type === 'table') {
              const fields = node.fields || [];
              const headerBg = (node.shadowAccent && node.shadowAccent !== 'none' && node.shadowAccent.startsWith('#'))
                ? node.shadowAccent
                : '#1E5C8C';

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
                  <rect x="0" y="0" width={width} height="22" fill={headerBg} stroke="#15191C" strokeWidth={strokeWidth} />
                  <text x={width / 2} y="15" fill="#FFFFFF" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                    {node.label}
                  </text>
                  {fields.map((f, i) => (
                    <text key={i} x="6" y={36 + i * 15} fill="#2C3439" fontSize="8" fontFamily="monospace">
                      {f}
                    </text>
                  ))}
                </g>
              );
            }

            // 2. Decision / Activity Decision (Diamond)
            if (node.type === 'decision' || node.type === 'activity-decision') {
              const dW = width;
              const dH = height;
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <polygon
                    points={`${dW / 2 + 2},2 ${dW + 2},${dH / 2 + 2} ${dW / 2 + 2},${dH + 2} 2,${dH / 2 + 2}`}
                    fill="#D45B33"
                    opacity="0.25"
                  />
                  <polygon
                    points={`${dW / 2},0 ${dW},${dH / 2} ${dW / 2},${dH} 0,${dH / 2}`}
                    fill={fill}
                    stroke="#15191C"
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDash}
                  />
                  <text x={dW / 2} y={dH / 2 + 3.5} textAnchor="middle" fill="#D45B33" fontSize="8.5" fontFamily="monospace" fontWeight="bold">
                    {node.label}
                  </text>
                </g>
              );
            }

            // 3. Activity Initial Node (Solid Black Circle ●)
            if (node.type === 'activity-start') {
              const r = width / 2;
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <circle cx={r} cy={r} r={r - 2} fill="#15191C" />
                </g>
              );
            }

            // 4. Activity Final Node (Bullseye Circle ◉)
            if (node.type === 'activity-end') {
              const r = width / 2;
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <circle cx={r} cy={r} r={r - 2} fill="#FFFFFF" stroke="#15191C" strokeWidth="2" />
                  <circle cx={r} cy={r} r={r - 6} fill="#15191C" />
                </g>
              );
            }

            // 5. Activity Fork / Join Synchronization Bar (━━━)
            if (node.type === 'activity-fork') {
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <rect x="0" y="0" width={width} height={height} fill="#15191C" rx="1" />
                </g>
              );
            }

            // 6. Activity Action State (Rounded Pill)
            if (node.type === 'activity-action') {
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <rect x="3" y="3" width={width} height={height} rx="12" fill="#15191C" opacity="0.2" />
                  <rect 
                    x="0" 
                    y="0" 
                    width={width} 
                    height={height} 
                    rx="12" 
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

            // 7. Sequence Activation Bar (Thin vertical strip)
            if (node.type === 'sequence-activation') {
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <rect x="0" y="0" width={width} height={height} fill="#FFFFFF" stroke="#15191C" strokeWidth="1.5" />
                </g>
              );
            }

            // 8. DFD External Entity (Double-bordered box)
            if (node.type === 'dfd-entity') {
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
                  <rect x="3" y="3" width={width - 6} height={height - 6} fill="none" stroke="#15191C" strokeWidth="1" />
                  <text x={width / 2} y={height / 2 + 4} textAnchor="middle" fill="#15191C" fontSize="8.5" fontFamily="monospace" fontWeight="bold">
                    {node.label}
                  </text>
                </g>
              );
            }

            // 9. DFD Process (Gane-Sarson with Top ID Header)
            if (node.type === 'dfd-process') {
              const splitIdx = node.label.indexOf(' ');
              const processId = splitIdx !== -1 ? node.label.substring(0, splitIdx) : '1.0';
              const processName = splitIdx !== -1 ? node.label.substring(splitIdx + 1) : node.label;

              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <rect x="3" y="3" width={width} height={height} rx="6" fill="#15191C" opacity="0.2" />
                  <rect 
                    x="0" 
                    y="0" 
                    width={width} 
                    height={height} 
                    rx="6" 
                    fill={fill} 
                    stroke="#15191C" 
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDash}
                  />
                  <line x1="0" y1="18" x2={width} y2="18" stroke="#15191C" strokeWidth="1.2" />
                  <text x={width / 2} y="13" textAnchor="middle" fill="#5A666E" fontSize="7.5" fontFamily="monospace" fontWeight="bold">
                    {processId}
                  </text>
                  <text x={width / 2} y={height / 2 + 10} textAnchor="middle" fill="#15191C" fontSize="8" fontFamily="monospace" fontWeight="bold">
                    {processName}
                  </text>
                </g>
              );
            }

            // 10. DFD Data Store (Open-ended parallel lines)
            if (node.type === 'dfd-store') {
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <rect x="0" y="0" width={width} height={height} fill="#F1F4F1" />
                  <line x1="0" y1="0" x2={width} y2="0" stroke="#15191C" strokeWidth="2" />
                  <line x1="0" y1={height} x2={width} y2={height} stroke="#15191C" strokeWidth="2" />
                  <text x={width / 2} y={height / 2 + 4} textAnchor="middle" fill="#15191C" fontSize="8.5" fontFamily="monospace" fontWeight="bold">
                    [D] {node.label}
                  </text>
                </g>
              );
            }

            // 11. Use Case Actor (Stick Figure)
            if (node.type === 'usecase-actor') {
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <circle cx="35" cy="14" r="8" fill={fill} stroke="#15191C" strokeWidth={strokeWidth} />
                  <line x1="35" y1="22" x2="35" y2="46" stroke="#15191C" strokeWidth={strokeWidth} />
                  <line x1="18" y1="30" x2="52" y2="30" stroke="#15191C" strokeWidth={strokeWidth} />
                  <line x1="35" y1="46" x2="22" y2="68" stroke="#15191C" strokeWidth={strokeWidth} />
                  <line x1="35" y1="46" x2="48" y2="68" stroke="#15191C" strokeWidth={strokeWidth} />
                  <text x="35" y="82" textAnchor="middle" fill="#15191C" fontSize="8.5" fontFamily="monospace" fontWeight="bold">
                    {node.label}
                  </text>
                </g>
              );
            }

            // 12. Use Case Boundary
            if (node.type === 'usecase-boundary') {
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
                    [System] {node.label}
                  </text>
                </g>
              );
            }

            // 13. Use Case Oval
            if (node.type === 'usecase-oval') {
              const rx = width / 2;
              const ry = height / 2;
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

            // 14. Terminal (Pill / Oval)
            if (node.type === 'terminal') {
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

            // 15. Default Process Card
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
