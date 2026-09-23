import { type CanvasNode, type CanvasEdge, type EdgeMarkerType, type Diagram } from '../services/mockDb';

export interface CodeToDiagramResult {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  warning?: string;
  diagnostics: CodeDiagnostic[];
}

export interface CodeDiagnostic {
  line: number;
  message: string;
  source: string;
}

export type LayoutDirection = 'LR' | 'TD';

export interface ParsedNodeInfo {
  id: string;
  label: string;
  type: CanvasNode['type'];
  fields?: string[];
  role?: string;
  subgraph?: string;
}

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
  direction: LayoutDirection = 'LR',
  startOffset: { x: number; y: number } = { x: 80, y: 80 }
): CodeToDiagramResult => {
  const rawLines = rawCode.split('\n');
  const entries = rawLines
    .map((raw, index) => ({ text: raw.trim(), line: index + 1 }))
    .filter(({ text }) => text.length > 0 && !text.startsWith('%%') && !text.startsWith('//'));
  const lines = entries.map(({ text }) => text);
  const diagnostics: CodeDiagnostic[] = [];

  if (lines.length === 0) {
    return { nodes: [], edges: [], diagnostics };
  }

  // Detect Diagram Header & Direction
  let effectiveDir = direction;

  const firstLine = lines[0].toLowerCase();
  const isSequenceDiagram = firstLine.startsWith('sequencediagram');
  if (firstLine.startsWith('flowchart') || firstLine.startsWith('graph')) {
    if (firstLine.includes('td') || firstLine.includes('tb')) effectiveDir = 'TD';
    if (firstLine.includes('lr') || firstLine.includes('rl')) effectiveDir = 'LR';
  }

  const nodeMap = new Map<string, ParsedNodeInfo>();
  const edges: ParsedEdgeInfo[] = [];

  // Helper to ensure node exists or register it
  const ensureNode = (id: string, label?: string, type: CanvasNode['type'] = 'process', fields?: string[], explicit = false) => {
    const cleanId = id.trim();
    if (!cleanId) return;
    if (!nodeMap.has(cleanId)) {
      nodeMap.set(cleanId, {
        id: cleanId,
        label: label ? stripQuotes(label) : cleanId,
        type,
        fields
      });
    } else {
      const existing = nodeMap.get(cleanId)!;
      if (label && (explicit || (existing.label === cleanId && label !== cleanId))) {
        existing.label = stripQuotes(label);
        existing.type = type;
      }
      if (fields && fields.length > 0) {
        existing.fields = fields;
        existing.type = 'table';
      }
    }
  };

  // --- ER Diagram Block Parsing Mode ---
  let inErEntity = false;
  let currentErTable: ParsedNodeInfo | null = null;
  let currentTableShorthand: ParsedNodeInfo | null = null;
  let currentSubgraph: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip diagram declaration headers
    if (/^(flowchart|graph|sequenceDiagram|erDiagram|classDiagram)/i.test(line)) {
      continue;
    }

    // Subgraph boundary tracking
    const subgraphMatch = line.match(/^subgraph\s+([a-zA-Z0-9_.-]+)(?:\s*\[(.*?)\])?/i);
    if (subgraphMatch) {
      currentSubgraph = subgraphMatch[2] ? stripQuotes(subgraphMatch[2]) : subgraphMatch[1];
      continue;
    }
    if (/^end$/i.test(line)) {
      currentSubgraph = null;
      inErEntity = false;
      currentErTable = null;
      continue;
    }

    // Skip styling & class annotations
    if (/^(classDef|style|class|linkStyle|click|accTitle|accDescr)\s+/i.test(line)) {
      continue;
    }

    // --- 1. Mermaid erDiagram Entity Block: ENTITY { type name PK } ---
    const erEntityHeader = line.match(/^([a-zA-Z0-9_.-]+)\s*\{$/i);
    if (erEntityHeader) {
      inErEntity = true;
      const tableName = erEntityHeader[1];
      currentErTable = {
        id: `tbl-${tableName.toLowerCase()}`,
        label: tableName,
        type: 'table',
        fields: []
      };
      nodeMap.set(currentErTable.id, currentErTable);
      continue;
    }

    if (inErEntity && currentErTable) {
      if (line === '}') {
        inErEntity = false;
        currentErTable = null;
        continue;
      }
      // Field row e.g. "string user_id PK" or "int count" or "uuid id PK,FK"
      const fieldParts = line.replace(/[,;]/g, '').trim().split(/\s+/);
      if (fieldParts.length >= 2) {
        const type = fieldParts[0];
        const name = fieldParts[1];
        const isPk = fieldParts.some(p => p.toUpperCase() === 'PK');
        const isFk = fieldParts.some(p => p.toUpperCase() === 'FK');
        const badge = isPk ? 'pk' : isFk ? 'fk' : '';
        const fieldStr = `${name} ${type} ${badge}`.trim();
        currentErTable.fields = currentErTable.fields || [];
        currentErTable.fields.push(fieldStr);
      } else if (fieldParts.length === 1 && fieldParts[0]) {
        currentErTable.fields = currentErTable.fields || [];
        currentErTable.fields.push(fieldParts[0]);
      }
      continue;
    }

    // --- 2. Diagrid Table Shorthand: "Table: Users" or "Table Users" ---
    const tableHeaderMatch = line.match(/^Table[:\s]+([a-zA-Z0-9_.-]+)/i);
    if (tableHeaderMatch) {
      const tableName = tableHeaderMatch[1];
      currentTableShorthand = {
        id: `tbl-${tableName.toLowerCase()}`,
        label: tableName,
        type: 'table',
        fields: []
      };
      nodeMap.set(currentTableShorthand.id, currentTableShorthand);
      continue;
    }

    if (currentTableShorthand && (line.startsWith('-') || line.startsWith('*'))) {
      const fieldDef = line.replace(/^[-*]\s*/, '').trim();
      if (fieldDef) {
        currentTableShorthand.fields = currentTableShorthand.fields || [];
        currentTableShorthand.fields.push(fieldDef);
      }
      continue;
    } else if (!line.startsWith('-') && !line.startsWith('*')) {
      currentTableShorthand = null;
    }

    // Table shorthand references use the table IDs already created above.
    const tableRelMatch = line.match(/^([a-zA-Z0-9_.-]+)\s*-->\s*([a-zA-Z0-9_.-]+)\s*:\s*(.+)$/);
    if (tableRelMatch) {
      const source = `tbl-${tableRelMatch[1].toLowerCase()}`;
      const target = `tbl-${tableRelMatch[2].toLowerCase()}`;
      if (nodeMap.has(source) && nodeMap.has(target)) {
        edges.push({ source, target, label: tableRelMatch[3].trim(), style: 'solid' });
        continue;
      }
    }

    // --- 3. Mermaid erDiagram Relationship: ENTITY1 ||--o{ ENTITY2 : "places" ---
    const erRelMatch = line.match(/^([a-zA-Z0-9_.-]+)\s*([|o}{.-]+)\s*([a-zA-Z0-9_.-]+)\s*:\s*(?:["'](.*?)["']|(.*?))$/i);
    if (erRelMatch) {
      const srcId = `tbl-${erRelMatch[1].toLowerCase()}`;
      const tgtId = `tbl-${erRelMatch[3].toLowerCase()}`;
      const relSymbol = erRelMatch[2];
      const label = (erRelMatch[4] || erRelMatch[5] || '').trim();
      
      ensureNode(srcId, erRelMatch[1], 'table');
      ensureNode(tgtId, erRelMatch[3], 'table');
      
      const parsedRel = parseErRelationshipSymbol(relSymbol);
      edges.push({
        source: srcId,
        target: tgtId,
        label,
        style: parsedRel.style,
        sourceMarker: parsedRel.sourceMarker,
        targetMarker: parsedRel.targetMarker
      });
      continue;
    }

    // --- 4. Sequence Diagram Statements: A->>B: Message or A-->>B: Reply ---
    const seqMatch = isSequenceDiagram ? line.match(/^(.+?)\s*(--?>>?)\s*(.+?)\s*:\s*(.*)$/i) : null;
    if (seqMatch) {
      const src = parseNodeToken(seqMatch[1]);
      const arrowSymbol = seqMatch[2];
      const tgt = parseNodeToken(seqMatch[3]);
      const label = seqMatch[4].trim();

      ensureNode(src.id, src.label, 'process');
      ensureNode(tgt.id, tgt.label, 'process');

      const isDashed = arrowSymbol.includes('--');
      edges.push({
        source: src.id,
        target: tgt.id,
        label,
        style: isDashed ? 'dashed' : 'solid'
      });
      continue;
    }

    // Participant declarations e.g. participant A as Alice or actor User
    const participantMatch = line.match(/^(?:participant|actor)\s+([a-zA-Z0-9_.-]+)(?:\s+as\s+(.*))?$/i);
    if (participantMatch) {
      const id = participantMatch[1];
      const label = participantMatch[2] ? stripQuotes(participantMatch[2]) : id;
      ensureNode(id, label, 'process');
      continue;
    }

    // --- 5. Flowchart Chained Connectors and Multi-arrow lines ---
    // Supports:
    // A --> B --> C --> D
    // A -- Yes --> B
    // A -->|Label| B
    // A -.-> B
    // A ==> B
    // A --- B
    // A -> B: Label
    // A & B --> C & D
    
    // Regular expression to split connectors while keeping edge labels
    // Matches: -->, -.->, ==>, ---, -- text -->, -. text .->, -->|text|, -.->|text|, ==>|text|, == text ==>
    const arrowSplitRegex = /(\s*(?:--\s*.*?\s*-->|-\.\s*.*?\s*\.->|==\s*.*?\s*==>|-->\|.*?\||-\.->\|.*?\||==>\|.*?\||-->|-\.->|==>|---|->|<-->)\s*)/g;
    const parts = line.split(arrowSplitRegex).filter(p => p !== undefined && p.trim().length > 0);

    if (parts.length >= 3) {
      // It's a chained expression: node [connector node]+
      let prevNodes: ParsedNodeInfo[] = [];

      for (let pIdx = 0; pIdx < parts.length; pIdx++) {
        const part = parts[pIdx].trim();
        const isConnector = arrowSplitRegex.test(part);
        arrowSplitRegex.lastIndex = 0; // reset regex state

        if (!isConnector) {
          // It's a node or multiple nodes joined by '&'
          const nodeTokens = part.split('&').map(t => parseNodeToken(t.trim()));
          nodeTokens.forEach(n => {
            ensureNode(n.id, n.label, n.type, undefined, n.label !== n.id || n.type !== 'process');
            if (currentSubgraph) {
              const nodeObj = nodeMap.get(n.id);
              if (nodeObj) nodeObj.subgraph = currentSubgraph;
            }
          });

          // If there were preceding nodes connected by an arrow
          if (prevNodes.length > 0 && pIdx >= 2) {
            const connectorPart = parts[pIdx - 1].trim();
            
            // Extract label and style from connector
            let edgeLabel = '';
            let edgeStyle: 'solid' | 'dashed' = 'solid';
            let edgeArrow: 'end' | 'none' | 'both' = 'end';

            // Pipe label: -->|label|
            const pipeMatch = connectorPart.match(/(?:-->|-\.->|==>)\|(.*?)\|/);
            if (pipeMatch) {
              edgeLabel = pipeMatch[1].trim();
            } else {
              // Middle label: -- label --> or -. label .-> or == label ==>
              const middleMatch = connectorPart.match(/(?:--|-\.|==)\s*(.*?)\s*(?:-->|\.->|==>)/);
              if (middleMatch && middleMatch[1] && !middleMatch[1].startsWith('>')) {
                edgeLabel = middleMatch[1].trim();
              }
            }

            if (connectorPart.includes('-.-') || connectorPart.includes('.-') || connectorPart.startsWith('-.')) {
              edgeStyle = 'dashed';
            }
            if (connectorPart === '---') {
              edgeArrow = 'none';
            } else if (connectorPart.includes('<-->')) {
              edgeArrow = 'both';
            }

            // Connect every prev node to every target node
            prevNodes.forEach(src => {
              nodeTokens.forEach(tgt => {
                edges.push({
                  source: src.id,
                  target: tgt.id,
                  label: edgeLabel || undefined,
                  style: edgeStyle,
                  arrow: edgeArrow
                });
              });
            });
          }

          prevNodes = nodeTokens;
        }
      }
      continue;
    }

    // --- 6. Standalone Node Definition: A[Start Step] or A((Start)) or A{Check} ---
    if (/^[a-zA-Z0-9_.-]+\s*(\[|\(|\{|>)/.test(line)) {
      const parsed = parseNodeToken(line);
      ensureNode(parsed.id, parsed.label, parsed.type, undefined, true);
      if (currentSubgraph) {
        const nodeObj = nodeMap.get(parsed.id);
        if (nodeObj) nodeObj.subgraph = currentSubgraph;
      }
      continue;
    }

    diagnostics.push({
      line: entries[i].line,
      message: 'Unsupported or unrecognized statement',
      source: line,
    });
  }

  if (nodeMap.size === 0) {
    return { nodes: [], edges: [], diagnostics };
  }

  // --- Automatic Hierarchical DAG Layout Algorithm ---
  const isHorizontal = effectiveDir === 'LR';
  const nodeIds = Array.from(nodeMap.keys());
  
  // Calculate In-Degree and Out-Degree for Topological DAG Leveling
  const inDegree = new Map<string, number>();
  const outEdges = new Map<string, string[]>();
  const inEdges = new Map<string, string[]>();

  nodeIds.forEach(id => {
    inDegree.set(id, 0);
    outEdges.set(id, []);
    inEdges.set(id, []);
  });

  edges.forEach(e => {
    if (nodeMap.has(e.source) && nodeMap.has(e.target) && e.source !== e.target) {
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
      outEdges.get(e.source)!.push(e.target);
      inEdges.get(e.target)!.push(e.source);
    }
  });

  // Assign Depth Rank (Layer) to each node using Longest Path from Roots
  const rankMap = new Map<string, number>();
  const visited = new Set<string>();

  // Find root nodes (inDegree === 0)
  const roots = nodeIds.filter(id => (inDegree.get(id) || 0) === 0);
  if (roots.length === 0 && nodeIds.length > 0) {
    roots.push(nodeIds[0]); // Break potential cycles by picking first node
  }

  const queue: { id: string; rank: number }[] = roots.map(r => ({ id: r, rank: 0 }));
  roots.forEach(r => rankMap.set(r, 0));

  while (queue.length > 0) {
    const { id, rank } = queue.shift()!;
    visited.add(id);

    const children = outEdges.get(id) || [];
    for (const child of children) {
      const currentRank = rankMap.get(child) ?? -1;
      const nextRank = Math.max(currentRank, rank + 1);
      rankMap.set(child, nextRank);
      
      if (!visited.has(child)) {
        queue.push({ id: child, rank: nextRank });
      }
    }
  }

  // Any unreached disconnected nodes get assigned rank 0
  nodeIds.forEach(id => {
    if (!rankMap.has(id)) {
      rankMap.set(id, 0);
    }
  });

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
    const isTable = parsed.type === 'table';
    const isDecision = parsed.type === 'decision';
    return {
      width: isTable ? 180 : isDecision ? 100 : 140,
      height: isTable ? Math.max(48, 32 + (parsed.fields?.length || 0) * 24) : isDecision ? 100 : 48
    };
  };

  const layerDimensions = new Map<number, { primary: number; cross: number }>();
  sortedRanks.forEach(rank => {
    const layerNodeIds = layers.get(rank)!;
    const dimensions = layerNodeIds.map(id => getParsedNodeDimensions(nodeMap.get(id)!));
    layerDimensions.set(rank, {
      // In LR, primary is width and cross is height. In TD these are reversed.
      primary: Math.max(...dimensions.map(d => isHorizontal ? d.width : d.height)),
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
      return difference || nodeIds.indexOf(a) - nodeIds.indexOf(b);
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

  const maxCross = Math.max(...sortedRanks.map(rank => layerDimensions.get(rank)!.cross));

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

      const canvasNode: CanvasNode = {
        id: newUuid,
        type: parsed.type,
        label: parsed.label,
        x,
        y,
        fields: parsed.fields,
        width: dimensions.width,
        height: dimensions.height
      };

      finalNodes.push(canvasNode);
      crossPosition += (isHorizontal ? dimensions.height : dimensions.width) + ROW_GAP;
    });
  });

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

  return {
    nodes: finalNodes,
    edges: finalEdges,
    diagnostics,
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
    return 'flowchart ' + direction + '\n  %% Empty canvas';
  }

  // Check if canvas is primarily an ER diagram
  const tableNodes = nodes.filter(n => n.type === 'table');
  const isEr = preferErDiagram || (tableNodes.length > 0 && tableNodes.length >= nodes.length / 2);

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
  const lines: string[] = [`flowchart ${direction}`];

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
  nodes.forEach((node, idx) => {
    let cleanAlias = node.label.replace(/[^a-zA-Z0-9]/g, '');
    if (!/^[a-zA-Z]/.test(cleanAlias) || cleanAlias.length > 8 || usedAliases.has(cleanAlias)) {
      cleanAlias = `Node${idx + 1}`;
    }
    while (usedAliases.has(cleanAlias)) cleanAlias = `Node${idx + 1}_${usedAliases.size}`;
    usedAliases.add(cleanAlias);
    aliasMap.set(node.id, cleanAlias);
  });

  // Track nodes that appear in edges
  const connectedNodeIds = new Set<string>();

  // 1. Generate Edges
  edges.forEach(edge => {
    const srcNode = nodes.find(n => n.id === edge.source);
    const tgtNode = nodes.find(n => n.id === edge.target);
    if (!srcNode || !tgtNode) return;

    connectedNodeIds.add(srcNode.id);
    connectedNodeIds.add(tgtNode.id);

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

  // 2. Declare standalone disconnected nodes
  nodes.forEach(node => {
    if (!connectedNodeIds.has(node.id)) {
      const alias = aliasMap.get(node.id)!;
      lines.push(`    ${formatMermaidNode(node, alias)}`);
    }
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
    code: `flowchart LR
    Client([Client Web/Mobile]) --> Ingress[Ingress Processor]
    Ingress --> DataStore[(Database Store)]
    Ingress --> AsyncWorker[[Async Background Worker]]`
  },
  {
    id: 'usecase-system',
    title: 'System Use Cases',
    badge: 'Use Case',
    type: 'usecase',
    direction: 'LR' as LayoutDirection,
    code: `flowchart LR
    User([End User]) --> Login([Authenticate])
    User --> Browse([Browse Content])
    Admin([System Admin]) --> Audit([Audit Logs])`
  },
  {
    id: 'activity-workflow',
    title: 'Activity Workflow',
    badge: 'Activity',
    type: 'activity',
    direction: 'TD' as LayoutDirection,
    code: `flowchart TD
    Start([Start Task]) --> Action[Execute Action]
    Action --> Validate{Passed Checks?}
    Validate -- Yes --> Finish([Complete])
    Validate -- No --> LogError[Record Error]
    LogError --> Finish`
  }
];
