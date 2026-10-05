import type { CodeToDiagramResult } from '../../utils/codeToDiagram';
import { getNodeDimensions } from '../../types/canvas';

interface Props {
  result: CodeToDiagramResult;
  mode: 'replace' | 'append';
  existingNodes: number;
  existingEdges: number;
  onApply: () => void;
  onCancel: () => void;
  onDiagnosticSelect: (line: number, column: number) => void;
}

export function CodeImportPreview({ result, mode, existingNodes, existingEdges, onApply, onCancel, onDiagnosticSelect }: Props) {
  const hasErrors = result.nodes.length === 0 || result.diagnostics.some(item => item.severity === 'error');
  const bounds = result.nodes.map(node => ({ node, ...getNodeDimensions(node) }));
  const left = bounds.length ? Math.min(...bounds.map(({ node }) => node.x)) - 30 : 0;
  const top = bounds.length ? Math.min(...bounds.map(({ node }) => node.y)) - 30 : 0;
  const right = bounds.length ? Math.max(...bounds.map(({ node, width }) => node.x + width)) + 30 : 1;
  const bottom = bounds.length ? Math.max(...bounds.map(({ node, height }) => node.y + height)) + 30 : 1;
  const centers = new Map(bounds.map(({ node, width, height }) => [node.id, { x: node.x + width / 2, y: node.y + height / 2 }]));

  return (
    <div className="border-2 border-blueprint bg-paper p-2.5 space-y-2 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <div className="font-bold text-ink">Review {mode === 'replace' ? 'replacement' : 'addition'}</div>
        <div className="text-[9px] uppercase tracking-wider font-bold text-blueprint">{result.syntax}</div>
      </div>
      <div className="text-ink-soft">
        {result.nodes.length} shapes, {result.edges.length} connections
        {mode === 'replace' ? ` will replace ${existingNodes} shapes and ${existingEdges} connections.` : ' will be added to the canvas.'}
      </div>
      {bounds.length > 0 ? <svg className="w-full h-36 border border-line bg-paper-raised" viewBox={`${left} ${top} ${Math.max(1, right - left)} ${Math.max(1, bottom - top)}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Preview of generated diagram">
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
      </svg> : <div className="h-20 border border-line bg-paper-raised flex items-center justify-center text-ink-soft">No shapes available to preview</div>}
      {result.diagnostics.length > 0 && (
        <div className="border border-signal bg-signal/10 p-2 text-signal">
          <div className="font-bold">{result.diagnostics.length} source issue{result.diagnostics.length === 1 ? '' : 's'}</div>
          <ul className="mt-1 max-h-28 overflow-y-auto space-y-1.5">
            {result.diagnostics.map((item, index) => (
              <li key={`${item.line}-${item.column}-${index}`}>
                <button type="button" onClick={() => onDiagnosticSelect(item.line, item.column)} className="w-full text-left hover:underline cursor-pointer">
                  <span className="font-bold uppercase">{item.severity}</span> L{item.line}:{item.column} — {item.message}
                  {item.suggestion && <span className="block text-ink-soft">Suggestion: {item.suggestion}</span>}
                  <code className="block truncate">{item.source.trim()}</code>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onApply} disabled={hasErrors} className="flex-1 bg-blueprint text-paper px-2 py-1.5 font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">{hasErrors ? 'Fix errors to apply' : `Apply ${mode === 'replace' ? 'replacement' : 'addition'}`}</button>
        <button type="button" onClick={onCancel} className="border border-ink px-2 py-1.5 text-ink cursor-pointer">Cancel</button>
      </div>
    </div>
  );
}
