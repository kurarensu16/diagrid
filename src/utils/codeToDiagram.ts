import { type CanvasNode, type CanvasEdge, type EdgeMarkerType, type Diagram } from '../services/mockDb';
import { parseDiagramSource, type DiagramSourceSyntax } from './diagramSourceParser';
import { calculateEdgePath, getEdgePathPoints, isSegmentBlocked } from './edgeRouting';

export interface CodeToDiagramResult {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  warning?: string;
  diagnostics: CodeDiagnostic[];
  syntax: DiagramSourceSyntax;
}

export interface CodeDiagnostic {
  line: number;
  column: number;
  endColumn: number;
  severity: 'warning' | 'error';
  code: string;
  message: string;
  source: string;
  suggestion?: string;
}

export type LayoutDirection = 'LR' | 'TD' | 'COMPACT';

export interface ParsedNodeInfo {
  id: string;
  label: string;
  type: CanvasNode['type'];
  fields?: string[];
  role?: string;
  subgraph?: string;
  section?: number;
  colorHint?: string;
  fillColor?: string;
  borderColor?: string;
  textColor?: string;
  borderWidth?: 1 | 2 | 3;
}

export const COLOR_HINTS: Record<string, { fill: string; accent?: string }> = {
  blue: { fill: '#EFF6FF', accent: '#1E5C8C' },
  blueprint: { fill: '#EFF6FF', accent: '#1E5C8C' },
  red: { fill: '#FEF2F2', accent: '#D45B33' },
  signal: { fill: '#FEF2F2', accent: '#D45B33' },
  green: { fill: '#F0FDF4', accent: '#2E7D32' },
  emerald: { fill: '#F0FDF4', accent: '#2E7D32' },
  amber: { fill: '#FFFBEB', accent: '#D97706' },
  purple: { fill: '#FAF5FF', accent: '#7C3AED' },
  gray: { fill: '#F3F4F6', accent: '#4B5563' },
  white: { fill: '#FFFFFF', accent: '#15191C' },
  paper: { fill: '#FFFFFF', accent: '#15191C' },
};

export interface ParsedEdgeInfo {
  source: string;
  target: string;
  label?: string;
  style: 'solid' | 'dashed';
  arrow?: 'end' | 'none' | 'both';
  sourceMarker?: EdgeMarkerType;
  targetMarker?: EdgeMarkerType;
}

/**
 * Parses Mermaid ER diagram relationship symbols like:
 * ||--||, ||--o|, ||--|{, ||--o{, }|..o{, etc.
 */
export const parseErRelationshipSymbol = (symbol: string): {
  sourceMarker: EdgeMarkerType;
  targetMarker: EdgeMarkerType;
  style: 'solid' | 'dashed';
} => {
  const isDashed = symbol.includes('..') || symbol.includes('.-');
  const style: 'solid' | 'dashed' = isDashed ? 'dashed' : 'solid';

  const match = symbol.match(/^([|o}{]+)(?:\.\.|\.--|--|\.-|-)([|o}{]+)$/);

  const parseToken = (tok: string, isLeft: boolean): EdgeMarkerType => {
    if (tok === '||') return 'one-only';
    if (tok === '|') return 'one';
    if (tok === '|o' || tok === 'o|') return 'zero-one';
    if (tok === '}|' || tok === '|{') return 'one-many';
    if (tok === '}' || tok === '{') return 'many';
    if (tok === '}o' || tok === 'o{') return 'zero-many';
    return isLeft ? 'one-only' : 'one-many';
  };

  if (match) {
    return {
      sourceMarker: parseToken(match[1], true),
      targetMarker: parseToken(match[2], false),
      style
    };
  }

  return {
    sourceMarker: 'one',
    targetMarker: 'many',
    style
  };
};

/**
 * Strips matching outer quotes from a string if present.
 */
const stripQuotes = (str: string): string => {
  const trimmed = str.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

/**
 * Parses an individual Mermaid node token into its ID, Label, and Diagrid Shape Type.
 * Handles all standard Mermaid shapes:
 * - A["Quoted text with [brackets] and (parentheses)"]
 * - A([Rounded rectangle / Pill]) -> terminal
 * - A((Circle)) -> terminal / oval
 * - A[(Database / Cylinder)] -> dfd-store
 * - A[[Subroutine / Double box]] -> dfd-process
 * - A{{Hexagon}} -> decision
 * - A{Diamond / Decision} -> decision
 * - A[/Parallelogram/] -> process
 * - A[\Parallelogram Alt\] -> process
 * - A[/Trapezoid\] -> process
 * - A>Asymmetric / Flag] -> dfd-entity
 * - A[Standard Box] -> process
 * - A(Standard Rounded) -> terminal
 * - Plain ID
 */
export const parseNodeToken = (token: string): ParsedNodeInfo => {
  let raw = token.trim();
  
  // Remove trailing class annotations e.g. A[Box]:::className
  raw = raw.replace(/:::[a-zA-Z0-9_-]+$/, '').trim();

  // 1. Quoted label with shape delimiters: A["Text"] or A[ "Text" ]
  const quotedBoxMatch = raw.match(/^([a-zA-Z0-9_.-]+)\s*\[\s*"([\s\S]*?)"\s*\]$/);
  if (quotedBoxMatch) {
    return { id: quotedBoxMatch[1].trim(), label: quotedBoxMatch[2].trim(), type: 'process' };
  }
  const quotedRoundMatch = raw.match(/^([a-zA-Z0-9_.-]+)\s*\(\s*"([\s\S]*?)"\s*\)$/);
  if (quotedRoundMatch) {
    return { id: quotedRoundMatch[1].trim(), label: quotedRoundMatch[2].trim(), type: 'terminal' };
  }
  const quotedPillMatch = raw.match(/^([a-zA-Z0-9_.-]+)\s*\(\[\s*"([\s\S]*?)"\s*\]\)$/);
  if (quotedPillMatch) {
    return { id: quotedPillMatch[1].trim(), label: quotedPillMatch[2].trim(), type: 'terminal' };
  }
  const quotedDbMatch = raw.match(/^([a-zA-Z0-9_.-]+)\s*\[\(\s*"([\s\S]*?)"\s*\)\]$/);
  if (quotedDbMatch) {
    return { id: quotedDbMatch[1].trim(), label: quotedDbMatch[2].trim(), type: 'dfd-store' };
  }
  const quotedCircleMatch = raw.match(/^([a-zA-Z0-9_.-]+)\s*\(\(\s*"([\s\S]*?)"\s*\)\)$/);
  if (quotedCircleMatch) {
    return { id: quotedCircleMatch[1].trim(), label: quotedCircleMatch[2].trim(), type: 'terminal' };
  }
  const quotedHexMatch = raw.match(/^([a-zA-Z0-9_.-]+)\s*\{\{\s*"([\s\S]*?)"\s*\}\}$/);
  if (quotedHexMatch) {
    return { id: quotedHexMatch[1].trim(), label: quotedHexMatch[2].trim(), type: 'decision' };
  }
  const quotedDecisionMatch = raw.match(/^([a-zA-Z0-9_.-]+)\s*\{\s*"([\s\S]*?)"\s*\}$/);
  if (quotedDecisionMatch) {
    return { id: quotedDecisionMatch[1].trim(), label: quotedDecisionMatch[2].trim(), type: 'decision' };
  }

  // 2. Unquoted Pill / Stadium: A([Label])
  const pillMatch = raw.match(/^([a-zA-Z0-9_.-]+)\s*\(\[(.*?)\]\)$/);
  if (pillMatch) {
    return { id: pillMatch[1].trim(), label: stripQuotes(pillMatch[2]), type: 'terminal' };
  }

  // 3. Circle: A((Label))
  const circleMatch = raw.match(/^([a-zA-Z0-9_.-]+)\s*\(\((.*?)\)\)$/);
  if (circleMatch) {
    return { id: circleMatch[1].trim(), label: stripQuotes(circleMatch[2]), type: 'terminal' };
  }

  // 4. Database / Cylinder: A[(Label)]
  const dbMatch = raw.match(/^([a-zA-Z0-9_.-]+)\s*\[\((.*?)\)\]$/);
  if (dbMatch) {
    return { id: dbMatch[1].trim(), label: stripQuotes(dbMatch[2]), type: 'dfd-store' };
  }

  // 5. Subroutine / Process: A[[Label]]
  const subroutineMatch = raw.match(/^([a-zA-Z0-9_.-]+)\s*\[\[(.*?)\]\]$/);
  if (subroutineMatch) {
    return { id: subroutineMatch[1].trim(), label: stripQuotes(subroutineMatch[2]), type: 'dfd-process' };
  }

  // 6. Hexagon: A{{Label}}
  const hexMatch = raw.match(/^([a-zA-Z0-9_.-]+)\s*\{\{(.*?)\}\}$/);
  if (hexMatch) {
    return { id: hexMatch[1].trim(), label: stripQuotes(hexMatch[2]), type: 'decision' };
  }

  // 7. Decision Diamond: A{Label}
  const decisionMatch = raw.match(/^([a-zA-Z0-9_.-]+)\s*\{(.*?)\}$/);
  if (decisionMatch) {
    return { id: decisionMatch[1].trim(), label: stripQuotes(decisionMatch[2]), type: 'decision' };
  }

  // 8. Parallelogram: A[/Label/] or A[\Label\]
  const parallelogramMatch = raw.match(/^([a-zA-Z0-9_.-]+)\s*\[\/(.*?)\/\]$/) ||
                             raw.match(/^([a-zA-Z0-9_.-]+)\s*\[\\(.*?)\\\]$/) ||
                             raw.match(/^([a-zA-Z0-9_.-]+)\s*\[\/(.*?)\\\]$/);
  if (parallelogramMatch) {
    return { id: parallelogramMatch[1].trim(), label: stripQuotes(parallelogramMatch[2]), type: 'process' };
  }

  // 9. Asymmetric / Flag: A>Label]
  const flagMatch = raw.match(/^([a-zA-Z0-9_.-]+)\s*>(.*?)\]$/);
  if (flagMatch) {
    return { id: flagMatch[1].trim(), label: stripQuotes(flagMatch[2]), type: 'dfd-entity' };
  }

  // 10. Process Box: A[Label]
  const boxMatch = raw.match(/^([a-zA-Z0-9_.-]+)\s*\[(.*?)\]$/);
  if (boxMatch) {
    return { id: boxMatch[1].trim(), label: stripQuotes(boxMatch[2]), type: 'process' };
  }

  // 11. Rounded Box: A(Label)
  const roundMatch = raw.match(/^([a-zA-Z0-9_.-]+)\s*\((.*?)\)$/);
  if (roundMatch) {
    return { id: roundMatch[1].trim(), label: stripQuotes(roundMatch[2]), type: 'terminal' };
  }

  // 12. Plain ID with possible quotes
  const cleanId = stripQuotes(raw);
  return { id: cleanId, label: cleanId, type: 'process' };
};

/**
 * Parses Mermaid flowchart, ERD, sequence, or plain description text into Diagrid CanvasNode[] and CanvasEdge[]
 * and applies automatic hierarchical DAG grid layout.
 */
export const parseCodeToDiagram = (
  rawCode: string,
  direction?: LayoutDirection,
  startOffset: { x: number; y: number } = { x: 80, y: 80 }
): CodeToDiagramResult => {
  const parsedSource = parseDiagramSource(rawCode, direction === 'COMPACT' ? 'TD' : direction || 'LR');
  const diagnostics: CodeDiagnostic[] = parsedSource.diagnostics;

  if (parsedSource.nodes.length === 0) {
    return { nodes: [], edges: [], diagnostics, syntax: parsedSource.syntax };
  }

  const effectiveDir = direction || parsedSource.direction;
  const nodeMap = new Map<string, ParsedNodeInfo>(parsedSource.nodes.map(node => [node.id, node]));
  const edges: ParsedEdgeInfo[] = [...parsedSource.edges];

  // --- Automatic Hierarchical DAG Layout Algorithm ---
  const isHorizontal = effectiveDir === 'LR';
  const nodeIds = Array.from(nodeMap.keys());
  const sectionOf = new Map(nodeIds.map(id => [id, nodeMap.get(id)!.section ?? 0]));
  
  // Keep both directions for cycle detection and layer ordering.
  const outEdges = new Map<string, string[]>();
  const inEdges = new Map<string, string[]>();

  nodeIds.forEach(id => {
    outEdges.set(id, []);
    inEdges.set(id, []);
  });

  edges.forEach(e => {
    if (nodeMap.has(e.source) && nodeMap.has(e.target) && e.source !== e.target) {
      outEdges.get(e.source)!.push(e.target);
      inEdges.get(e.target)!.push(e.source);
    }
  });

  const rankOutEdges = new Map(nodeIds.map(id => [id, outEdges.get(id)!.filter(child => sectionOf.get(child) === sectionOf.get(id))]));
  const rankInEdges = new Map(nodeIds.map(id => [id, inEdges.get(id)!.filter(parent => sectionOf.get(parent) === sectionOf.get(id))]));

  // Collapse strongly connected components before ranking. A large cycle is
  // arranged in a compact grid rather than one extremely long row/column.
  const visited = new Set<string>();
  const finishOrder: string[] = [];
  for (const root of nodeIds) {
    if (visited.has(root)) continue;
    const stack: Array<{ id: string; finish: boolean }> = [{ id: root, finish: false }];
    while (stack.length) {
      const { id, finish } = stack.pop()!;
      if (finish) { finishOrder.push(id); continue; }
      if (visited.has(id)) continue;
      visited.add(id);
      stack.push({ id, finish: true });
      for (const child of [...rankOutEdges.get(id)!].reverse()) {
        if (!visited.has(child)) stack.push({ id: child, finish: false });
      }
    }
  }

  const componentOf = new Map<string, number>();
  const components: string[][] = [];
  for (let index = finishOrder.length - 1; index >= 0; index--) {
    const root = finishOrder[index];
    if (componentOf.has(root)) continue;
    const componentId = components.length;
    const members: string[] = [];
    const stack = [root];
    componentOf.set(root, componentId);
    while (stack.length) {
      const id = stack.pop()!;
      members.push(id);
      for (const parent of rankInEdges.get(id)!) {
        if (componentOf.has(parent)) continue;
        componentOf.set(parent, componentId);
        stack.push(parent);
      }
    }
    components.push(members);
  }

  const sourceOrder = new Map(nodeIds.map((id, index) => [id, index]));
  const componentSpan = components.map(members => members.length <= 2 ? 1 : Math.ceil(Math.sqrt(members.length)));
  const componentOut = components.map(() => new Set<number>());
  const componentInDegree = components.map(() => 0);
  for (const edge of edges) {
    if (sectionOf.get(edge.source) !== sectionOf.get(edge.target)) continue;
    const source = componentOf.get(edge.source);
    const target = componentOf.get(edge.target);
    if (source === undefined || target === undefined || source === target || componentOut[source].has(target)) continue;
    componentOut[source].add(target);
    componentInDegree[target]++;
  }
  const componentRank = components.map(() => 0);
  const componentQueue = componentInDegree.map((degree, index) => degree === 0 ? index : -1).filter(index => index >= 0);
  for (let head = 0; head < componentQueue.length; head++) {
    const componentId = componentQueue[head];
    for (const target of componentOut[componentId]) {
      componentRank[target] = Math.max(componentRank[target], componentRank[componentId] + componentSpan[componentId]);
      if (--componentInDegree[target] === 0) componentQueue.push(target);
    }
  }

  const rankMap = new Map<string, number>();
  components.forEach((members, componentId) => {
    members.sort((a, b) => sourceOrder.get(a)! - sourceOrder.get(b)!);
    const perRank = Math.ceil(members.length / componentSpan[componentId]);
    members.forEach((id, index) => rankMap.set(id, componentRank[componentId] + Math.floor(index / perRank)));
  });

  if (parsedSource.groups?.length) {
    let offset = 0;
    const sections = [...new Set(nodeIds.map(id => sectionOf.get(id)!))].sort((a, b) => a - b);
    for (const section of sections) {
      const ids = nodeIds.filter(id => sectionOf.get(id) === section);
      const maxLocalRank = ids.reduce((max, id) => Math.max(max, rankMap.get(id)!), 0);
      ids.forEach(id => rankMap.set(id, rankMap.get(id)! + offset));
      offset += maxLocalRank + 2;
    }
  }

  // Group nodes by their Layer Rank
  const layers = new Map<number, string[]>();
  nodeIds.forEach(id => {
    const r = rankMap.get(id) || 0;
    if (!layers.has(r)) layers.set(r, []);
    layers.get(r)!.push(id);
  });

  const sortedRanks = Array.from(layers.keys()).sort((a, b) => a - b);

  // Position dimensions. Layout spacing must account for the actual node size;
  // a fixed row gap makes ERD tables (which can be much taller than process
  // nodes) overlap as soon as a schema contains a few fields.
  const ROW_GAP = isHorizontal ? 80 : 100;
  const COL_GAP = isHorizontal ? 140 : 120;

  const getParsedNodeDimensions = (parsed: ParsedNodeInfo) => {
    const flowLabelWidth = parsedSource.syntax === 'flowchart' ? Math.ceil(parsed.label.length * 7.3 + 32) : 0;
    switch (parsed.type) {
      case 'table':
        return {
          width: 180,
          height: Math.max(48, 32 + (parsed.fields?.length || 0) * 24),
        };
      case 'decision':
      case 'activity-decision':
        return { width: Math.max(120, Math.min(260, flowLabelWidth || 96)), height: 100 };
      case 'terminal':
        return { width: Math.max(120, Math.min(300, flowLabelWidth || 120)), height: 42 };
      case 'dfd-store':
        return { width: 160, height: 48 };
      case 'dfd-entity':
        return { width: 120, height: 56 };
      case 'dfd-process':
        return { width: 130, height: 64 };
      case 'usecase-actor':
        return { width: 70, height: 90 };
      case 'usecase-oval':
        return { width: 130, height: 52 };
      case 'usecase-boundary':
        return { width: 360, height: 300 };
      case 'activity-start':
        return { width: 32, height: 32 };
      case 'activity-end':
        return { width: 36, height: 36 };
      case 'activity-action':
        return { width: 150, height: 48 };
      case 'activity-fork':
        return { width: 180, height: 12 };
      case 'text':
        return { width: 140, height: 40 };
      case 'process':
      default:
        return { width: Math.max(140, Math.min(320, flowLabelWidth || 140)), height: 48 };
    }
  };

  const layerDimensions = new Map<number, { primary: number; cross: number }>();
  sortedRanks.forEach(rank => {
    const layerNodeIds = layers.get(rank)!;
    const dimensions = layerNodeIds.map(id => getParsedNodeDimensions(nodeMap.get(id)!));
    layerDimensions.set(rank, {
      // In LR, primary is width and cross is height. In TD these are reversed.
      primary: dimensions.reduce((max, d) => Math.max(max, isHorizontal ? d.width : d.height), 0),
      cross: dimensions.reduce((sum, d) => sum + (isHorizontal ? d.height : d.width), 0) + Math.max(0, dimensions.length - 1) * ROW_GAP
    });
  });

  // Put connected nodes near the average position of their neighbors. This
  // substantially reduces diagonal and crossing connectors in branching flows.
  const nodeOrder = new Map<string, number>();
  sortedRanks.forEach(rank => {
    const layerNodeIds = layers.get(rank)!;
    const previousOrder = new Map(nodeOrder);
    layerNodeIds.sort((a, b) => {
      const neighborPosition = (id: string) => {
        const neighbors = (inEdges.get(id) || []).concat(outEdges.get(id) || []);
        const positions = neighbors.map(neighbor => previousOrder.get(neighbor)).filter((value): value is number => value !== undefined);
        return positions.length ? positions.reduce((sum, value) => sum + value, 0) / positions.length : Number.POSITIVE_INFINITY;
      };
      const difference = neighborPosition(a) - neighborPosition(b);
      return difference || (sourceOrder.get(a)! - sourceOrder.get(b)!);
    });
    layerNodeIds.forEach((id, index) => nodeOrder.set(id, index));
  });

  // Calculate each layer's absolute primary-axis position from its content,
  // instead of assuming every node has the same width/height.
  const primaryPositions = new Map<number, number>();
  let primaryPosition = isHorizontal ? startOffset.x : startOffset.y;
  sortedRanks.forEach(rank => {
    primaryPositions.set(rank, primaryPosition);
    primaryPosition += layerDimensions.get(rank)!.primary + COL_GAP;
  });

  const maxCross = sortedRanks.reduce((max, rank) => Math.max(max, layerDimensions.get(rank)!.cross), 0);

  const finalNodes: CanvasNode[] = [];
  const idMap = new Map<string, string>(); // maps parsed ID to generated canvas node UUID

  sortedRanks.forEach(rank => {
    const layerNodeIds = layers.get(rank)!;
    const layerCross = layerDimensions.get(rank)!.cross;
    let crossPosition = (maxCross - layerCross) / 2;

    layerNodeIds.forEach((id) => {
      const parsed = nodeMap.get(id)!;
      const newUuid = `node-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      idMap.set(id, newUuid);

      const dimensions = getParsedNodeDimensions(parsed);

      let x = isHorizontal ? primaryPositions.get(rank)! : startOffset.x + crossPosition;
      let y = isHorizontal ? startOffset.y + crossPosition : primaryPositions.get(rank)!;

      // Snap to 20px blueprint grid after dimension-aware placement.
      x = Math.max(40, Math.round(x / 20) * 20);
      y = Math.max(40, Math.round(y / 20) * 20);

      const colorKey = (parsed.colorHint || parsed.role || '').toLowerCase();
      let fillColor: string | undefined;
      let shadowAccent: string | undefined;
      if (colorKey && COLOR_HINTS[colorKey]) {
        fillColor = COLOR_HINTS[colorKey].fill;
        shadowAccent = COLOR_HINTS[colorKey].accent;
      }

      const canvasNode: CanvasNode = {
        id: newUuid,
        type: parsed.type,
        label: parsed.label,
        x,
        y,
        fields: parsed.fields,
        width: dimensions.width,
        height: dimensions.height,
        customWidth: dimensions.width,
        customHeight: dimensions.height,
        fillColor: parsed.fillColor || fillColor,
        borderColor: parsed.borderColor,
        textColor: parsed.textColor,
        borderWidth: parsed.borderWidth,
        subgraphId: parsed.subgraph,
        shadowAccent
      };

      finalNodes.push(canvasNode);
      crossPosition += (isHorizontal ? dimensions.height : dimensions.width) + ROW_GAP;
    });
  });

  // Give disconnected groups separate bands so their nodes and connectors do
  // not interleave even when they happen to occupy the same DAG ranks.
  const placedById = new Map(finalNodes.map(node => [node.id, node]));
  const grouped = new Set<string>();
  let nextBand = isHorizontal ? startOffset.y : startOffset.x;
  for (const root of nodeIds) {
    if (grouped.has(root)) continue;
    const pending = [root];
    const members: CanvasNode[] = [];
    grouped.add(root);
    while (pending.length) {
      const id = pending.pop()!;
      const placed = placedById.get(idMap.get(id)!);
      if (placed) members.push(placed);
      for (const neighbor of [...outEdges.get(id)!, ...inEdges.get(id)!]) {
        if (grouped.has(neighbor)) continue;
        grouped.add(neighbor);
        pending.push(neighbor);
      }
    }
    const first = members.reduce((min, node) => Math.min(min, isHorizontal ? node.y : node.x), Infinity);
    const last = members.reduce((max, node) => Math.max(max, isHorizontal ? node.y + node.height! : node.x + node.width!), -Infinity);
    const shift = Math.ceil((nextBand - first) / 20) * 20;
    for (const node of members) {
      if (isHorizontal) node.y += shift;
      else node.x += shift;
    }
    nextBand = last + shift + 160;
  }

  if (effectiveDir === 'COMPACT') {
    // Wrap consecutive ranks into balanced shelves. Keep named subgraphs in
    // one piece, so the resulting section boxes still describe real members.
    const compactUnits: string[][] = [];
    const sections = [...new Set(nodeIds.map(id => sectionOf.get(id)!))].sort((a, b) => a - b);
    const boundsFor = (ids: string[]) => {
      const placed = ids.map(id => placedById.get(idMap.get(id)!)!);
      return {
        left: Math.min(...placed.map(node => node.x)),
        top: Math.min(...placed.map(node => node.y)),
        right: Math.max(...placed.map(node => node.x + node.width!)),
        bottom: Math.max(...placed.map(node => node.y + node.height!)),
      };
    };
    for (const section of sections) {
      const ids = nodeIds.filter(id => sectionOf.get(id) === section);
      if (ids.some(id => nodeMap.get(id)!.subgraph)) {
        compactUnits.push(ids);
        continue;
      }
      const visited = new Set<string>();
      for (const root of ids) {
        if (visited.has(root)) continue;
        const pending = [root];
        visited.add(root);
        const component = new Set<string>();
        while (pending.length) {
          const id = pending.pop()!;
          component.add(id);
          for (const neighbor of [...outEdges.get(id)!, ...inEdges.get(id)!]) {
            if (sectionOf.get(neighbor) !== section || visited.has(neighbor)) continue;
            visited.add(neighbor);
            pending.push(neighbor);
          }
        }
        const componentIds = ids.filter(id => component.has(id));
        const ranks = [...new Set(componentIds.map(id => rankMap.get(id)!))].sort((a, b) => a - b);
        let unit: string[] = [];
        for (const rank of ranks) {
          const rankIds = componentIds.filter(id => rankMap.get(id) === rank);
          if (unit.length) {
            const candidate = boundsFor([...unit, ...rankIds]);
            if (candidate.bottom - candidate.top > 1400) {
              compactUnits.push(unit);
              unit = [];
            }
          }
          unit.push(...rankIds);
        }
        if (unit.length) compactUnits.push(unit);
      }
    }
    const unitBounds = compactUnits.map(ids => boundsFor(ids));
    const totalArea = unitBounds.reduce((sum, box) => sum + (box.right - box.left) * (box.bottom - box.top), 0);
    const maxUnitWidth = Math.max(...unitBounds.map(box => box.right - box.left));
    const targetWidth = Math.max(maxUnitWidth, Math.sqrt(totalArea) * 1.6);
    const shelves: number[][] = [[]];
    let shelfWidth = 0;
    unitBounds.forEach((box, index) => {
      const width = box.right - box.left;
      const nextWidth = shelfWidth ? shelfWidth + 180 + width : width;
      if (shelfWidth && nextWidth > targetWidth) {
        shelves.push([]);
        shelfWidth = 0;
      }
      shelves[shelves.length - 1].push(index);
      shelfWidth += (shelfWidth ? 180 : 0) + width;
    });
    let cursorY = startOffset.y;
    shelves.forEach((shelf, rowIndex) => {
      const reverse = rowIndex % 2 === 1;
      let cursorX = reverse ? startOffset.x + targetWidth : startOffset.x;
      const rowHeight = Math.max(...shelf.map(index => unitBounds[index].bottom - unitBounds[index].top));
      shelf.forEach(index => {
        const box = unitBounds[index];
        const width = box.right - box.left;
        const left = reverse ? cursorX - width : cursorX;
        const dx = left - box.left;
        const dy = cursorY - box.top;
        compactUnits[index].forEach(id => {
          const node = placedById.get(idMap.get(id)!)!;
          node.x += dx;
          node.y += dy;
        });
        cursorX += reverse ? -width - 180 : width + 180;
      });
      cursorY += rowHeight + 180;
    });
  }

  const subgraphNodes: CanvasNode[] = [];
  for (const group of parsedSource.groups || []) {
    const members = parsedSource.nodes
      .filter(node => node.subgraph === group.id)
      .map(node => placedById.get(idMap.get(node.id)!))
      .filter((node): node is CanvasNode => Boolean(node));
    if (!members.length) {
      diagnostics.push({ line: 1, column: 1, endColumn: 1, severity: 'error', code: 'empty-subgraph', message: `Subgraph ${group.id} contains no shapes.`, source: group.label });
      continue;
    }
    const left = Math.min(...members.map(node => node.x)) - 40;
    const top = Math.min(...members.map(node => node.y)) - 56;
    const right = Math.max(...members.map(node => node.x + node.width!)) + 40;
    const bottom = Math.max(...members.map(node => node.y + node.height!)) + 40;
    subgraphNodes.push({
      id: `group-${Date.now()}-${subgraphNodes.length}`,
      type: 'subgraph', label: group.label,
      x: left, y: top,
      width: right - left, height: bottom - top,
      customWidth: right - left, customHeight: bottom - top,
      subgraphId: group.id,
    });
  }
  finalNodes.unshift(...subgraphNodes);

  // Map final node details for smart geometric port selection
  const canvasNodeMap = new Map<string, CanvasNode>();
  finalNodes.forEach(n => canvasNodeMap.set(n.id, n));

  // Generate Diagrid CanvasEdge[]
  const finalEdges: CanvasEdge[] = [];
  edges.forEach((e, idx) => {
    const srcId = idMap.get(e.source);
    const tgtId = idMap.get(e.target);
    if (!srcId || !tgtId) return;

    const srcNode = canvasNodeMap.get(srcId);
    const tgtNode = canvasNodeMap.get(tgtId);

    // Default handle determination based on layout direction
    let sourceHandle: 'top' | 'bottom' | 'left' | 'right' = isHorizontal ? 'right' : 'bottom';
    let targetHandle: 'top' | 'bottom' | 'left' | 'right' = isHorizontal ? 'left' : 'top';

    if (srcNode && tgtNode) {
      const dx = tgtNode.x - srcNode.x;
      const dy = tgtNode.y - srcNode.y;

      // Smart decision diamond vertex routing
      if (srcNode.type === 'decision' || srcNode.type === 'activity-decision') {
        if (!isHorizontal) {
          if (dx < -30) {
            sourceHandle = 'left';
            targetHandle = dy > 40 ? 'top' : 'right';
          } else if (dx > 30) {
            sourceHandle = 'right';
            targetHandle = dy > 40 ? 'top' : 'left';
          } else {
            sourceHandle = 'bottom';
            targetHandle = 'top';
          }
        } else {
          if (dy < -30) {
            sourceHandle = 'top';
            targetHandle = dx > 40 ? 'left' : 'bottom';
          } else if (dy > 30) {
            sourceHandle = 'bottom';
            targetHandle = dx > 40 ? 'left' : 'top';
          } else {
            sourceHandle = 'right';
            targetHandle = 'left';
          }
        }
      } else if (tgtNode.type === 'decision' || tgtNode.type === 'activity-decision') {
        if (!isHorizontal) {
          if (dy > 30) {
            sourceHandle = 'bottom';
            targetHandle = 'top';
          } else if (dx > 30) {
            sourceHandle = 'right';
            targetHandle = 'left';
          } else if (dx < -30) {
            sourceHandle = 'left';
            targetHandle = 'right';
          }
        } else {
          if (dx > 30) {
            sourceHandle = 'right';
            targetHandle = 'left';
          } else if (dy > 30) {
            sourceHandle = 'bottom';
            targetHandle = 'top';
          } else if (dy < -30) {
            sourceHandle = 'top';
            targetHandle = 'bottom';
          }
        }
      } else if (srcId !== tgtId) {
        const sourceRight = srcNode.x + (srcNode.width || 0);
        const targetRight = tgtNode.x + (tgtNode.width || 0);
        const sourceBottom = srcNode.y + (srcNode.height || 0);
        const targetBottom = tgtNode.y + (tgtNode.height || 0);
        if (isHorizontal) {
          if (tgtNode.x >= sourceRight + 20) {
            sourceHandle = 'right'; targetHandle = 'left';
          } else if (srcNode.x >= targetRight + 20) {
            sourceHandle = 'left'; targetHandle = 'right';
          } else if (dy >= 0) {
            sourceHandle = 'bottom'; targetHandle = 'top';
          } else {
            sourceHandle = 'top'; targetHandle = 'bottom';
          }
        } else if (tgtNode.y >= sourceBottom + 20) {
          sourceHandle = 'bottom'; targetHandle = 'top';
        } else if (srcNode.y >= targetBottom + 20) {
          sourceHandle = 'top'; targetHandle = 'bottom';
        } else if (dx >= 0) {
          sourceHandle = 'right'; targetHandle = 'left';
        } else {
          sourceHandle = 'left'; targetHandle = 'right';
        }
      }
      if (effectiveDir === 'COMPACT') {
        const sourceCenterX = srcNode.x + srcNode.width! / 2;
        const sourceCenterY = srcNode.y + srcNode.height! / 2;
        const targetCenterX = tgtNode.x + tgtNode.width! / 2;
        const targetCenterY = tgtNode.y + tgtNode.height! / 2;
        const dx = targetCenterX - sourceCenterX;
        const dy = targetCenterY - sourceCenterY;
        if (Math.abs(dx) > Math.abs(dy) || (srcNode.subgraphId !== tgtNode.subgraphId && Math.abs(dx) > 100)) {
          sourceHandle = dx >= 0 ? 'right' : 'left';
          targetHandle = dx >= 0 ? 'left' : 'right';
        } else {
          sourceHandle = dy >= 0 ? 'bottom' : 'top';
          targetHandle = dy >= 0 ? 'top' : 'bottom';
        }
      }
    }

    finalEdges.push({
      id: `e-${idx}-${Math.random().toString(36).substr(2, 6)}`,
      source: srcId,
      target: tgtId,
      sourceHandle,
      targetHandle,
      label: e.label,
      style: e.style,
      arrow: e.arrow,
      sourceMarker: e.sourceMarker,
      targetMarker: e.targetMarker
    });
  });

  if (effectiveDir === 'COMPACT') {
    const handles = ['top', 'right', 'bottom', 'left'] as const;
    const routeScore = (edge: CanvasEdge) => {
      const path = calculateEdgePath(edge, finalNodes, canvasNodeMap, { skipSearch: true });
      const points = getEdgePathPoints(path);
      const blocked = points.slice(1).reduce((count, point, index) =>
        count + Number(isSegmentBlocked(points[index], point, finalNodes, edge.source, edge.target)), 0);
      const length = points.slice(1).reduce((total, point, index) =>
        total + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y), 0);
      return { blocked, length };
    };
    for (const edge of finalEdges) {
      let best = routeScore(edge);
      if (best.blocked === 0) continue;
      let sourceHandle = edge.sourceHandle;
      let targetHandle = edge.targetHandle;
      for (const source of handles) for (const target of handles) {
        const candidate = routeScore({ ...edge, sourceHandle: source, targetHandle: target });
        if (candidate.blocked < best.blocked || (candidate.blocked === best.blocked && candidate.length < best.length)) {
          best = candidate;
          sourceHandle = source;
          targetHandle = target;
        }
      }
      edge.sourceHandle = sourceHandle;
      edge.targetHandle = targetHandle;
    }
  }

  if (finalNodes.length !== parsedSource.nodes.length + (parsedSource.groups?.length || 0) || finalEdges.length !== parsedSource.edges.length) {
    diagnostics.push({
      line: 1,
      column: 1,
      endColumn: 1,
      severity: 'error',
      code: 'incomplete-conversion',
      message: 'Some parsed shapes or connections could not be placed on the canvas.',
      source: rawCode.split(/\r?\n/, 1)[0] || '',
    });
  }

  return {
    nodes: finalNodes,
    edges: finalEdges,
    diagnostics,
    syntax: parsedSource.syntax,
  };
};

/**
 * Converts Diagrid CanvasNode[] and CanvasEdge[] into clean, valid Mermaid code.
 * Supports flowchart (LR / TD), ER diagram (erDiagram), and sequence diagram modes.
 */
export const diagramToMermaid = (
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  direction: LayoutDirection = 'LR',
  preferErDiagram = false
): string => {
  if (nodes.length === 0) {
    return 'flowchart ' + (direction === 'COMPACT' ? 'TD' : direction) + '\n  %% Empty canvas';
  }

  // Check if canvas is primarily an ER diagram
  const contentNodes = nodes.filter(n => n.type !== 'subgraph');
  const groupNodes = nodes.filter(n => n.type === 'subgraph');
  const tableNodes = contentNodes.filter(n => n.type === 'table');
  const isEr = preferErDiagram || (tableNodes.length > 0 && tableNodes.length >= contentNodes.length / 2);

  if (isEr && tableNodes.length > 0) {
    const lines: string[] = ['erDiagram'];
    const entityNames = new Map<string, string>();
    const usedEntityNames = new Set<string>();
    tableNodes.forEach((node, index) => {
      const base = (node.label || 'Table').replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[^a-zA-Z_]+/, '') || `Table_${index + 1}`;
      let name = base;
      let suffix = 2;
      while (usedEntityNames.has(name)) name = `${base}_${suffix++}`;
      usedEntityNames.add(name);
      entityNames.set(node.id, name);
    });

    // 1. Entities & Fields
    tableNodes.forEach(node => {
      const cleanEntityName = entityNames.get(node.id)!;
      lines.push(`    ${cleanEntityName} {`);
      if (node.fields && node.fields.length > 0) {
        node.fields.forEach(field => {
          const parts = field.split(/\s+/);
          const name = parts[0] || 'field';
          const type = parts[1] || 'text';
          const badge = parts.slice(2).join(' ').toUpperCase();
          lines.push(`        ${type} ${name} ${badge}`.trimEnd());
        });
      } else {
        lines.push('        uuid id PK');
      }
      lines.push('    }');
    });

    // 2. ER Relationships
    const markerToMermaidToken = (marker: EdgeMarkerType | undefined, isLeft: boolean): string => {
      switch (marker) {
        case 'one': return '||'; // Standard Mermaid uses || for one
        case 'one-only': return '||';
        case 'zero-one': return isLeft ? '|o' : 'o|';
        case 'many': return isLeft ? '}o' : 'o{';
        case 'one-many': return isLeft ? '}|' : '|{';
        case 'zero-many': return isLeft ? '}o' : 'o{';
        case 'none': return isLeft ? '||' : '||';
        case 'arrow': return isLeft ? '||' : 'o{';
        default: return isLeft ? '||' : 'o{';
      }
    };

    edges.forEach(edge => {
      const src = nodes.find(n => n.id === edge.source);
      const tgt = nodes.find(n => n.id === edge.target);
      if (src && tgt && entityNames.has(src.id) && entityNames.has(tgt.id)) {
        const srcName = entityNames.get(src.id)!;
        const tgtName = entityNames.get(tgt.id)!;
        const relLabel = edge.label ? ` : "${edge.label}"` : ' : references';
        const lineStyle = edge.style === 'dashed' ? '..' : '--';
        const leftToken = markerToMermaidToken(edge.sourceMarker, true);
        const rightToken = markerToMermaidToken(edge.targetMarker, false);
        lines.push(`    ${srcName} ${leftToken}${lineStyle}${rightToken} ${tgtName}${relLabel}`);
      }
    });

    return lines.join('\n');
  }

  // Standard Flowchart Generation
  const lines: string[] = [`flowchart ${direction === 'COMPACT' ? 'TD' : direction}`];

  // Helper to create safe Mermaid node representation
  const formatMermaidNode = (node: CanvasNode, alias: string): string => {
    const label = (node.label || alias).replace(/"/g, "'");
    switch (node.type) {
      case 'terminal':
      case 'activity-start':
      case 'activity-end':
        return `${alias}(["${label}"])`;
      case 'decision':
      case 'activity-decision':
        return `${alias}{"${label}"}`;
      case 'dfd-store':
        return `${alias}[("${label}")]`;
      case 'dfd-process':
        return `${alias}[["${label}"]]`;
      case 'dfd-entity':
        return `${alias}>"${label}"]`;
      case 'usecase-oval':
      case 'usecase-actor':
        return `${alias}(("${label}"))`;
      case 'table':
        return `${alias}["Table: ${label}"]`;
      case 'process':
      case 'activity-action':
      default:
        return `${alias}["${label}"]`;
    }
  };

  // Map each node ID to a clean alias e.g. A, B, C, N1, N2...
  const aliasMap = new Map<string, string>();
  const usedAliases = new Set<string>();
  contentNodes.forEach((node, idx) => {
    let cleanAlias = node.label.replace(/[^a-zA-Z0-9]/g, '');
    if (!/^[a-zA-Z]/.test(cleanAlias) || cleanAlias.length > 8 || usedAliases.has(cleanAlias)) {
      cleanAlias = `Node${idx + 1}`;
    }
    while (usedAliases.has(cleanAlias)) cleanAlias = `Node${idx + 1}_${usedAliases.size}`;
    usedAliases.add(cleanAlias);
    aliasMap.set(node.id, cleanAlias);
  });

  // Declare membership before edges, because cross-section edges can appear
  // anywhere in the source without changing which section owns a node.
  contentNodes.filter(node => !node.subgraphId).forEach(node => {
    lines.push(`    ${formatMermaidNode(node, aliasMap.get(node.id)!)}`);
  });
  groupNodes.forEach((group, index) => {
    const groupId = group.subgraphId || `Group${index + 1}`;
    const label = (group.label || groupId).replace(/"/g, "'");
    lines.push(`    subgraph ${groupId}["${label}"]`);
    contentNodes.filter(node => node.subgraphId === groupId).forEach(node => {
      lines.push(`        ${formatMermaidNode(node, aliasMap.get(node.id)!)}`);
    });
    lines.push('    end');
  });

  // 1. Generate Edges
  edges.forEach(edge => {
    const srcNode = contentNodes.find(n => n.id === edge.source);
    const tgtNode = contentNodes.find(n => n.id === edge.target);
    if (!srcNode || !tgtNode) return;

    const srcAlias = aliasMap.get(srcNode.id)!;
    const tgtAlias = aliasMap.get(tgtNode.id)!;

    const srcFormatted = formatMermaidNode(srcNode, srcAlias);
    const tgtFormatted = formatMermaidNode(tgtNode, tgtAlias);

    let connector = '-->';
    if (edge.style === 'dashed') {
      connector = edge.label ? `-. "${edge.label}" .->` : '-.->';
    } else if (edge.arrow === 'none') {
      connector = edge.label ? `-- "${edge.label}" ---` : '---';
    } else if (edge.arrow === 'both') {
      connector = edge.label ? `<-- "${edge.label}" -->` : '<-->';
    } else if (edge.label) {
      connector = `-- "${edge.label}" -->`;
    }

    lines.push(`    ${srcFormatted} ${connector} ${tgtFormatted}`);
  });

  // Preserve colors that Mermaid can represent when code is exported again.
  const validColor = (color: string | undefined) => Boolean(color && (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color) || color === 'transparent'));
  contentNodes.forEach(node => {
    const styles: string[] = [];
    if (validColor(node.fillColor)) styles.push(`fill:${node.fillColor}`);
    if (validColor(node.borderColor) && node.borderColor !== 'transparent') styles.push(`stroke:${node.borderColor}`);
    if (validColor(node.textColor) && node.textColor !== 'transparent') styles.push(`color:${node.textColor}`);
    if (node.borderWidth) styles.push(`stroke-width:${node.borderWidth}px`);
    if (styles.length) lines.push(`    style ${aliasMap.get(node.id)!} ${styles.join(',')}`);
  });

  return lines.join('\n');
};

/**
 * Built-in Quick Example Presets for Code to Diagram
 */
export interface CodePreset {
  id: string;
  title: string;
  badge: string;
  type: Diagram['type'];
  direction: LayoutDirection;
  code: string;
}

export const CODE_PRESETS_LIST: CodePreset[] = [
  {
    id: 'flowchart',
    title: 'Flowchart with Branching',
    badge: 'Flowchart',
    type: 'flowchart',
    direction: 'LR' as LayoutDirection,
    code: `flowchart LR
    Start([User Registration]) --> Validate[Validate Input Data]
    Validate --> Check{Is Email Unique?}
    Check -- Yes --> CreateUser[Create User in Database]
    Check -- No --> ShowError[Display 'Email in use' error]
    ShowError --> Validate
    CreateUser --> SendEmail[(Send Confirmation Queue)]
    SendEmail --> Done([Registration Complete])`
  },
  {
    id: 'database',
    title: 'ERD Database Schema',
    badge: 'ERD Schema',
    type: 'erd',
    direction: 'LR' as LayoutDirection,
    code: `Table: Users
- id uuid pk
- email text
- full_name text
- role text

Table: Organizations
- id uuid pk
- name text
- plan text

Table: Projects
- id uuid pk
- org_id uuid fk
- owner_id uuid fk
- name text

Table: Tasks
- id uuid pk
- project_id uuid fk
- title text
- status text

Users --> Organizations: member of
Organizations --> Projects: owns
Projects --> Tasks: contains`
  },
  {
    id: 'login-sequence',
    title: 'OAuth2 Login Flow',
    badge: 'Sequence',
    type: 'sequence',
    direction: 'LR' as LayoutDirection,
    code: `sequenceDiagram
    Client->>API Gateway: Request /auth/login
    API Gateway->>Auth Service: Validate Credentials
    Auth Service->>Database: Query User Record
    Database-->>Auth Service: Return User
    Auth Service-->>API Gateway: Issue JWT Token
    API Gateway-->>Client: 200 OK + Token`
  },
  {
    id: 'dfd-flow',
    title: 'Data Flow Diagram',
    badge: 'DFD Pipeline',
    type: 'dfd',
    direction: 'LR' as LayoutDirection,
    code: `dfdDiagram LR
    entity Client as "Client Web/Mobile"
    process Ingress as "1.0 Ingress Processor"
    store DataStore as "D1 Database Store"
    process AsyncWorker as "2.0 Background Worker"

    Client --> Ingress : Raw Data
    Ingress --> DataStore : Save Record
    Ingress --> AsyncWorker : Dispatch Job`
  },
  {
    id: 'usecase-system',
    title: 'System Use Cases',
    badge: 'Use Case',
    type: 'usecase',
    direction: 'LR' as LayoutDirection,
    code: `usecaseDiagram LR
    actor User as "End User"
    actor Admin as "System Admin"
    usecase Login as "Authenticate"
    usecase Browse as "Browse Content"
    usecase Audit as "Audit Logs"

    User --> Login
    User --> Browse
    Admin --> Audit`
  },
  {
    id: 'activity-workflow',
    title: 'Activity Workflow',
    badge: 'Activity',
    type: 'activity',
    direction: 'TD' as LayoutDirection,
    code: `activityDiagram TD
    start
    action Action as "Execute Action"
    decision Validate as "Passed Checks?"
    action LogError as "Record Error"
    end Finish as "Complete"

    start --> Action
    Action --> Validate
    Validate -- Yes --> Finish
    Validate -- No --> LogError
    LogError --> Finish`
  }
];
