import type { CodeToDiagramResult } from '../../utils/codeToDiagram';
import { getNodeDimensions } from '../../types/canvas';

interface Props {
  result: CodeToDiagramResult;
  mode: 'replace' | 'append';
  existingNodes: number;
  existingEdges: number;
  onApply: () => void;
  onCancel: () => void;
}

export function CodeImportPreview({ result, mode, existingNodes, existingEdges, onApply, onCancel }: Props) {
  const bounds = result.nodes.map(node => ({ node, ...getNodeDimensions(node) }));
  const left = Math.min(...bounds.map(({ node }) => node.x)) - 30;
  const top = Math.min(...bounds.map(({ node }) => node.y)) - 30;
  const right = Math.max(...bounds.map(({ node, width }) => node.x + width)) + 30;
  const bottom = Math.max(...bounds.map(({ node, height }) => node.y + height)) + 30;
  const centers = new Map(bounds.map(({ node, width, height }) => [node.id, { x: node.x + width / 2, y: node.y + height / 2 }]));

  return (
    <div className="border-2 border-blueprint bg-paper p-2.5 space-y-2 text-[11px]">
      <div className="font-bold text-ink">Review {mode === 'replace' ? 'replacement' : 'addition'}</div>
      <div className="text-ink-soft">
        {result.nodes.length} shapes, {result.edges.length} connections
        {mode === 'replace' ? ` will replace ${existingNodes} shapes and ${existingEdges} connections.` : ' will be added to the canvas.'}
      </div>
      <svg className="w-full h-36 border border-line bg-paper-raised" viewBox={`${left} ${top} ${Math.max(1, right - left)} ${Math.max(1, bottom - top)}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Preview of generated diagram">
        {result.edges.map(edge => {
          const source = centers.get(edge.source);
          const target = centers.get(edge.target);
          return source && target ? <line key={edge.id} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="#64748b" strokeWidth="2" /> : null;
        })}
        {bounds.map(({ node, width, height }) => (
          <g key={node.id}>
            <rect x={node.x} y={node.y} width={width} height={height} rx="5" fill="#fff" stroke="#334155" strokeWidth="2" />
            <text x={node.x + width / 2} y={node.y + height / 2} textAnchor="middle" dominantBaseline="middle" fontSize="13" fill="#1e293b">
              {node.label.length > 24 ? `${node.label.slice(0, 21)}…` : node.label}
            </text>
          </g>
        ))}
      </svg>
      {result.diagnostics.length > 0 && (
        <div className="border border-signal bg-signal/10 p-2 text-signal">
          <div className="font-bold">{result.diagnostics.length} line{result.diagnostics.length === 1 ? '' : 's'} skipped</div>
          <ul className="mt-1 max-h-24 overflow-y-auto space-y-1">
            {result.diagnostics.map(item => <li key={item.line}>Line {item.line}: {item.message} — <code>{item.source}</code></li>)}
          </ul>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onApply} className="flex-1 bg-blueprint text-paper px-2 py-1.5 font-bold cursor-pointer">Apply {mode === 'replace' ? 'replacement' : 'addition'}</button>
        <button type="button" onClick={onCancel} className="border border-ink px-2 py-1.5 text-ink cursor-pointer">Cancel</button>
      </div>
    </div>
  );
}
