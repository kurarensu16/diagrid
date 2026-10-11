import { useMemo, useState } from 'react';
import type { CodeToDiagramResult } from '../../utils/codeToDiagram';
import { getNodeDimensions } from '../../types/canvas';
import { calculateEdgePath, getEdgeLabelPosition } from '../../utils/edgeRouting';

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
  const [focusedGroup, setFocusedGroup] = useState('overview');
  const [zoom, setZoom] = useState(1);
  const hasErrors = result.nodes.length === 0 || result.diagnostics.some(item => item.severity === 'error');
  const groups = result.nodes.filter(node => node.type === 'subgraph');
  const shapes = result.nodes.filter(node => node.type !== 'subgraph');
  const bounds = result.nodes.map(node => ({ node, ...getNodeDimensions(node) }));
  const focus = groups.find(node => node.id === focusedGroup);
  const focusBounds = focus ? bounds.filter(({ node }) => node.id === focus.id) : bounds;
  const left = focusBounds.length ? Math.min(...focusBounds.map(({ node }) => node.x)) - 40 : 0;
  const top = focusBounds.length ? Math.min(...focusBounds.map(({ node }) => node.y)) - 40 : 0;
  const right = focusBounds.length ? Math.max(...focusBounds.map(({ node, width }) => node.x + width)) + 40 : 1;
  const bottom = focusBounds.length ? Math.max(...focusBounds.map(({ node, height }) => node.y + height)) + 40 : 1;
  const viewWidth = Math.max(1, (right - left) / zoom);
  const viewHeight = Math.max(1, (bottom - top) / zoom);
  const viewX = left + (right - left - viewWidth) / 2;
  const viewY = top + (bottom - top - viewHeight) / 2;
  const previewEdges = useMemo(() => {
    const nodesById = new Map(result.nodes.map(node => [node.id, node]));
    return result.edges.map(edge => {
      const path = calculateEdgePath(edge, result.nodes, nodesById, { skipSearch: result.nodes.length > 30 });
      return { edge, path, labelPosition: getEdgeLabelPosition(path) };
    }).filter(item => item.path);
  }, [result]);

  return (
    <div className="border-2 border-blueprint bg-paper p-2.5 space-y-2 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <div className="font-bold text-ink">Review {mode === 'replace' ? 'replacement' : 'addition'}</div>
        <div className="text-[9px] uppercase tracking-wider font-bold text-blueprint">{result.syntax}</div>
      </div>
      <div className="text-ink-soft">
        {shapes.length} shapes, {result.edges.length} connections, {groups.length} sections
        {mode === 'replace' ? ` will replace ${existingNodes} shapes and ${existingEdges} connections.` : ' will be added to the canvas.'}
      </div>
      {bounds.length > 0 && <div className="flex items-center gap-1.5">
        <select aria-label="Preview section" value={focusedGroup} onChange={event => { setFocusedGroup(event.target.value); setZoom(1); }} className="min-w-0 flex-1 border border-line bg-paper-raised px-1.5 py-1 text-ink font-mono">
          <option value="overview">Entire diagram</option>
          {groups.map(group => <option key={group.id} value={group.id}>{group.label}</option>)}
        </select>
        <button type="button" aria-label="Zoom out preview" onClick={() => setZoom(value => Math.max(0.5, value / 1.5))} className="border border-line px-2 py-1 font-bold text-ink">−</button>
        <button type="button" aria-label="Zoom in preview" onClick={() => setZoom(value => Math.min(8, value * 1.5))} className="border border-line px-2 py-1 font-bold text-ink">+</button>
      </div>}
      {bounds.length > 0 ? <svg className="w-full h-72 border border-line bg-[#101417]" viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Preview of generated diagram">
        <defs><marker id="import-preview-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#94a3b8" /></marker></defs>
        {bounds.filter(({ node }) => node.type === 'subgraph').map(({ node, width, height }) => (
          <g key={node.id}>
            <rect x={node.x} y={node.y} width={width} height={height} fill="#fff" fillOpacity="0.12" stroke="#64748b" strokeWidth="2" />
            <text x={node.x + width / 2} y={node.y + 26} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#e2e8f0">{node.label}</text>
          </g>
        ))}
        {previewEdges.map(({ edge, path, labelPosition }) => {
          const labelX = labelPosition.x;
          const labelY = labelPosition.y;
          return <g key={edge.id}>
            <path d={path} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray={edge.style === 'dashed' ? '6 4' : undefined} markerEnd={edge.arrow === 'none' ? undefined : 'url(#import-preview-arrow)'} />
            {edge.label && <g><rect x={labelX - Math.max(17, edge.label.length * 3.5 + 6)} y={labelY - 11} width={Math.max(34, edge.label.length * 7 + 12)} height="22" rx="10" fill="#12273a" stroke="#2563eb" /><text x={labelX} y={labelY + 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#dbeafe">{edge.label}</text></g>}
          </g>;
        })}
        {bounds.filter(({ node }) => node.type !== 'subgraph').map(({ node, width, height }) => (
          <g key={node.id}>
            {node.type === 'decision' || node.type === 'activity-decision'
              ? <polygon points={`${node.x + width / 2},${node.y} ${node.x + width},${node.y + height / 2} ${node.x + width / 2},${node.y + height} ${node.x},${node.y + height / 2}`} fill={node.fillColor || '#153b5c'} stroke={node.borderColor || '#2563eb'} strokeWidth={node.borderWidth || 2} />
              : <rect x={node.x} y={node.y} width={width} height={height} rx={node.type === 'terminal' ? height / 2 : 8} fill={node.fillColor || '#153b5c'} stroke={node.borderColor || '#2563eb'} strokeWidth={node.borderWidth || 2} />}
            <text x={node.x + width / 2} y={node.y + height / 2} textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="bold" fill={node.textColor || '#e2e8f0'}>
              {node.label}
            </text>
          </g>
        ))}
      </svg> : <div className="h-20 border border-line bg-paper-raised flex items-center justify-center text-ink-soft">No shapes available to preview</div>}
      {groups.length > 0 && <p className="text-[10px] text-ink-soft">Choose a section to inspect a large diagram. Zoom changes the preview only.</p>}
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
