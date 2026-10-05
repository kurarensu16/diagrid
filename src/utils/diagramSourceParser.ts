import type { CanvasNode, EdgeMarkerType } from '../services/mockDb';

export type LayoutDirection = 'LR' | 'TD';
export type DiagramSourceSyntax = 'flowchart' | 'sequence' | 'er' | 'table-shorthand' | 'dfd' | 'usecase' | 'activity' | 'unknown';

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

export interface ParsedNodeInfo {
  id: string;
  label: string;
  type: CanvasNode['type'];
  fields?: string[];
  role?: string;
  subgraph?: string;
  colorHint?: string;
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

export interface ParsedDiagramSource {
  syntax: DiagramSourceSyntax;
  direction: LayoutDirection;
  nodes: ParsedNodeInfo[];
  edges: ParsedEdgeInfo[];
  diagnostics: CodeDiagnostic[];
}

interface SourceLine {
  text: string;
  raw: string;
  line: number;
  column: number;
}

const stripQuotes = (value: string): string => {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

export const parseErRelationshipSymbol = (symbol: string): {
  sourceMarker: EdgeMarkerType;
  targetMarker: EdgeMarkerType;
  style: 'solid' | 'dashed';
} => {
  const style = symbol.includes('..') || symbol.includes('.-') ? 'dashed' : 'solid';
  const match = symbol.match(/^([|o}{]+)(?:\.\.|\.--|--|\.-|-)([|o}{]+)$/);
  const parseToken = (token: string, isLeft: boolean): EdgeMarkerType => {
    if (token === '||') return 'one-only';
    if (token === '|') return 'one';
    if (token === '|o' || token === 'o|') return 'zero-one';
    if (token === '}|' || token === '|{') return 'one-many';
    if (token === '}' || token === '{') return 'many';
    if (token === '}o' || token === 'o{') return 'zero-many';
    return isLeft ? 'one-only' : 'one-many';
  };
  return match ? {
    sourceMarker: parseToken(match[1], true),
    targetMarker: parseToken(match[2], false),
    style,
  } : { sourceMarker: 'one', targetMarker: 'many', style };
};

export const parseNodeToken = (token: string): ParsedNodeInfo => {
  let raw = token.trim();
  let colorHint: string | undefined;
  const classMatch = raw.match(/:::([a-zA-Z0-9_-]+)$/);
  if (classMatch) {
    colorHint = classMatch[1].toLowerCase();
    raw = raw.replace(/:::([a-zA-Z0-9_-]+)$/, '').trim();
  }

  const patterns: Array<[RegExp, CanvasNode['type']]> = [
    [/^([a-zA-Z0-9_.-]+)\s*\(\[\s*"([\s\S]*?)"\s*\]\)$/, 'terminal'],
    [/^([a-zA-Z0-9_.-]+)\s*\[\(\s*"([\s\S]*?)"\s*\)\]$/, 'dfd-store'],
    [/^([a-zA-Z0-9_.-]+)\s*\(\(\s*"([\s\S]*?)"\s*\)\)$/, 'terminal'],
    [/^([a-zA-Z0-9_.-]+)\s*\{\{\s*"([\s\S]*?)"\s*\}\}$/, 'decision'],
    [/^([a-zA-Z0-9_.-]+)\s*\[\s*"([\s\S]*?)"\s*\]$/, 'process'],
    [/^([a-zA-Z0-9_.-]+)\s*\(\s*"([\s\S]*?)"\s*\)$/, 'terminal'],
    [/^([a-zA-Z0-9_.-]+)\s*\{\s*"([\s\S]*?)"\s*\}$/, 'decision'],
    [/^([a-zA-Z0-9_.-]+)\s*\(\[(.*?)\]\)$/, 'terminal'],
    [/^([a-zA-Z0-9_.-]+)\s*\(\((.*?)\)\)$/, 'terminal'],
    [/^([a-zA-Z0-9_.-]+)\s*\[\((.*?)\)\]$/, 'dfd-store'],
    [/^([a-zA-Z0-9_.-]+)\s*\[\[(.*?)\]\]$/, 'dfd-process'],
    [/^([a-zA-Z0-9_.-]+)\s*\{\{(.*?)\}\}$/, 'decision'],
    [/^([a-zA-Z0-9_.-]+)\s*\{(.*?)\}$/, 'decision'],
    [/^([a-zA-Z0-9_.-]+)\s*\[\/(.*?)\/\]$/, 'process'],
    [/^([a-zA-Z0-9_.-]+)\s*\[\\(.*?)\\\]$/, 'process'],
    [/^([a-zA-Z0-9_.-]+)\s*\[\/(.*?)\\\]$/, 'process'],
    [/^([a-zA-Z0-9_.-]+)\s*>(.*?)\]$/, 'dfd-entity'],
    [/^([a-zA-Z0-9_.-]+)\s*\[(.*?)\]$/, 'process'],
    [/^([a-zA-Z0-9_.-]+)\s*\((.*?)\)$/, 'terminal'],
  ];
  for (const [pattern, type] of patterns) {
    const match = raw.match(pattern);
    if (match) return { id: match[1].trim(), label: stripQuotes(match[2]), type, colorHint, role: colorHint };
  }
  raw = stripQuotes(raw);
  return { id: raw, label: raw, type: 'process', colorHint, role: colorHint };
};

const sourceLines = (rawCode: string): SourceLine[] => rawCode.split(/\r?\n/).map((raw, index) => {
  const first = raw.search(/\S/);
  return { raw, text: raw.trim(), line: index + 1, column: first < 0 ? 1 : first + 1 };
}).filter(line => line.text && !line.text.startsWith('%%') && !line.text.startsWith('//'));

export const detectDiagramSyntax = (rawCode: string): DiagramSourceSyntax => {
  const lines = sourceLines(rawCode);
  if (!lines.length) return 'unknown';
  const first = lines[0].text;
  if (/^(flowchart|graph)\b/i.test(first)) return 'flowchart';
  if (/^sequenceDiagram\b/i.test(first)) return 'sequence';
  if (/^erDiagram\b/i.test(first)) return 'er';
  if (/^dfdDiagram\b/i.test(first)) return 'dfd';
  if (/^usecaseDiagram\b/i.test(first)) return 'usecase';
  if (/^activityDiagram\b/i.test(first)) return 'activity';
  if (/^Table[:\s]/i.test(first)) return 'table-shorthand';
  if (lines.some(line => /--?>>/.test(line.text))) return 'sequence';
  if (lines.some(line => /^[a-zA-Z0-9_.-]+\s+[|o}{]+(?:\.\.|--)\s*[|o}{]*\s*[a-zA-Z0-9_.-]+\s*:/.test(line.text))) return 'er';
  return 'flowchart';
};

const diagnostic = (line: SourceLine, code: string, message: string, severity: 'warning' | 'error' = 'warning', suggestion?: string, offset = 0): CodeDiagnostic => ({
  line: line.line,
  column: line.column + offset,
  endColumn: line.column + Math.max(offset + 1, line.text.length),
  severity,
  code,
  message,
  source: line.raw,
  suggestion,
});

/**
 * Parses declaration parameters such as:
 * - `Client as "Client Web/Mobile"`
 * - `Ingress as "1.0 Ingress Processor"`
 * - `"1.0 Ingress Processor"`
 * - `Customer:::blue`
 */
const parseDeclaration = (raw: string): { id: string; label: string; color?: string } => {
  let text = raw.trim();
  let color: string | undefined;
  const colorMatch = text.match(/:::([a-zA-Z0-9_-]+)$/);
  if (colorMatch) {
    color = colorMatch[1].toLowerCase();
    text = text.replace(/:::([a-zA-Z0-9_-]+)$/, '').trim();
  }

  const asMatch = text.match(/^([a-zA-Z0-9_.-]+)\s+as\s+(.+)$/i);
  if (asMatch) {
    return {
      id: asMatch[1].trim(),
      label: stripQuotes(asMatch[2]),
      color,
    };
  }

  const unquoted = stripQuotes(text);
  return {
    id: unquoted,
    label: unquoted,
    color,
  };
};

const extractTokenAndColor = (rawStr: string): { id: string; color?: string } => {
  let s = rawStr.trim();
  let color: string | undefined;
  const m = s.match(/:::([a-zA-Z0-9_-]+)$/);
  if (m) {
    color = m[1].toLowerCase();
    s = s.replace(/:::([a-zA-Z0-9_-]+)$/, '').trim();
  }
  return { id: stripQuotes(s), color };
};

const parseGenericConnector = (lineText: string): {
  source: string;
  target: string;
  label?: string;
  style: 'solid' | 'dashed';
  arrow?: 'end' | 'none' | 'both';
} | null => {
  // 1. Pipe syntax: A -->|Label| B or A -.->|Label| B
  const pipeMatch = lineText.match(/^(.+?)\s*(?:(-->|-\.->|==>)\|(.*?)\|)\s*(.+)$/);
  if (pipeMatch) {
    return {
      source: pipeMatch[1].trim(),
      target: pipeMatch[4].trim(),
      label: pipeMatch[3].trim() || undefined,
      style: pipeMatch[2].startsWith('-.') ? 'dashed' : 'solid',
      arrow: 'end',
    };
  }

  // 2. Middle label: A -- Label --> B or A -. Label .-> B
  const middleMatch = lineText.match(/^(.+?)\s*(?:--\s*(.*?)\s*-->|-\.\s*(.*?)\s*\.->)\s*(.+)$/);
  if (middleMatch) {
    const isDashed = middleMatch[0].includes('.-') || middleMatch[0].includes('-.');
    const label = (middleMatch[2] || middleMatch[3] || '').trim();
    return {
      source: middleMatch[1].trim(),
      target: middleMatch[4].trim(),
      label: label || undefined,
      style: isDashed ? 'dashed' : 'solid',
      arrow: 'end',
    };
  }

  // 3. Colon label: A --> B : Label or A -.-> B : Label or A <--> B : Label or A --- B : Label
  const colonMatch = lineText.match(/^(.+?)\s*(-->|-\.->|<-->|---)\s*(.+?)\s*:\s*(.+)$/);
  if (colonMatch) {
    const connector = colonMatch[2];
    return {
      source: colonMatch[1].trim(),
      target: colonMatch[3].trim(),
      label: colonMatch[4].trim() || undefined,
      style: connector.startsWith('-.') ? 'dashed' : 'solid',
      arrow: connector === '---' ? 'none' : connector === '<-->' ? 'both' : 'end',
    };
  }

  // 4. Plain connector: A --> B or A -.-> B or A <--> B or A --- B
  const plainMatch = lineText.match(/^(.+?)\s*(-->|-\.->|<-->|---)\s*(.+)$/);
  if (plainMatch) {
    const connector = plainMatch[2];
    return {
      source: plainMatch[1].trim(),
      target: plainMatch[3].trim(),
      style: connector.startsWith('-.') ? 'dashed' : 'solid',
      arrow: connector === '---' ? 'none' : connector === '<-->' ? 'both' : 'end',
    };
  }

  return null;
};

export const parseDiagramSource = (rawCode: string, fallbackDirection: LayoutDirection = 'LR'): ParsedDiagramSource => {
  const lines = sourceLines(rawCode);
  const syntax = detectDiagramSyntax(rawCode);
  const diagnostics: CodeDiagnostic[] = [];
  const nodeMap = new Map<string, ParsedNodeInfo>();
  const edges: ParsedEdgeInfo[] = [];
  let direction = fallbackDirection;
  if (!lines.length) return { syntax, direction, nodes: [], edges, diagnostics };

  const first = lines[0].text;
  if (/^(flowchart|graph)\b/i.test(first)) {
    if (/\b(TD|TB)\b/i.test(first)) direction = 'TD';
    else if (/\b(LR|RL)\b/i.test(first)) direction = 'LR';
    else diagnostics.push(diagnostic(lines[0], 'missing-direction', 'Flowchart direction is missing or unsupported.', 'warning', 'Use flowchart LR or flowchart TD.'));
  } else if (/^dfdDiagram\b/i.test(first)) {
    if (/\b(TD|TB)\b/i.test(first)) direction = 'TD';
    else if (/\b(LR|RL)\b/i.test(first)) direction = 'LR';
  } else if (/^usecaseDiagram\b/i.test(first)) {
    if (/\b(TD|TB)\b/i.test(first)) direction = 'TD';
    else if (/\b(LR|RL)\b/i.test(first)) direction = 'LR';
  } else if (/^activityDiagram\b/i.test(first)) {
    if (/\b(LR|RL)\b/i.test(first)) direction = 'LR';
    else direction = 'TD';
  }

  if (/^(classDiagram|stateDiagram|journey|gantt|pie|mindmap|timeline)\b/i.test(first)) {
    diagnostics.push(diagnostic(lines[0], 'unsupported-diagram', `The ${first.split(/\s+/)[0]} syntax is not supported yet.`, 'error', 'Use flowchart, sequenceDiagram, erDiagram, dfdDiagram, usecaseDiagram, activityDiagram, or Table: shorthand.'));
    return { syntax: 'unknown', direction, nodes: [], edges, diagnostics };
  }

  const ensureNode = (
    id: string,
    label?: string,
    type: CanvasNode['type'] = 'process',
    fields?: string[],
    explicit = false,
    colorHint?: string
  ) => {
    const cleanId = id.trim();
    if (!cleanId) return;
    const existing = nodeMap.get(cleanId);
    if (!existing) {
      nodeMap.set(cleanId, {
        id: cleanId,
        label: label ? stripQuotes(label) : cleanId,
        type,
        fields,
        colorHint,
        role: colorHint,
      });
    } else {
      if (label && (explicit || (existing.label === cleanId && label !== cleanId))) {
        existing.label = stripQuotes(label);
        existing.type = type;
      }
      if (colorHint && !existing.colorHint) {
        existing.colorHint = colorHint;
        existing.role = colorHint;
      }
      if (fields?.length) {
        existing.fields = fields;
        existing.type = 'table';
      }
    }
  };

  const parseCheckedNode = (token: string, line: SourceLine): ParsedNodeInfo | null => {
    const parsed = parseNodeToken(token);
    if (!/^[a-zA-Z0-9_.-]+$/.test(parsed.id)) {
      diagnostics.push(diagnostic(line, 'invalid-node', `Invalid node expression: ${token.trim()}`, 'error', 'Use an ID followed by a complete shape, for example A[Label].', Math.max(0, line.text.indexOf(token.trim()))));
      return null;
    }
    return parsed;
  };

  if (syntax === 'sequence') {
    for (const line of lines) {
      if (/^sequenceDiagram\b/i.test(line.text)) continue;
      const participant = line.text.match(/^(?:participant|actor)\s+([a-zA-Z0-9_.-]+)(?:\s+as\s+(.+))?$/i);
      if (participant) {
        ensureNode(participant[1], participant[2] || participant[1], 'process', undefined, true);
        continue;
      }
      const message = line.text.match(/^(.+?)\s*(--?>>?)\s*(.+?)\s*:\s*(.+)$/);
      if (message) {
        const source = message[1].trim();
        const target = message[3].trim();
        if (!source || !target) {
          diagnostics.push(diagnostic(line, 'invalid-message', 'Sequence message needs both a sender and receiver.', 'error', 'Use Sender->>Receiver: Message.'));
          continue;
        }
        ensureNode(source, source);
        ensureNode(target, target);
        edges.push({ source, target, label: message[4].trim(), style: message[2].startsWith('--') ? 'dashed' : 'solid' });
        continue;
      }
      diagnostics.push(diagnostic(line, 'unsupported-sequence-statement', 'Unsupported sequence diagram statement.', 'warning', 'Supported statements are participant, actor, and Sender->>Receiver: Message.'));
    }
    return { syntax, direction, nodes: [...nodeMap.values()], edges, diagnostics };
  }

  if (syntax === 'er' || syntax === 'table-shorthand') {
    let currentTable: ParsedNodeInfo | null = null;
    let entityStart: SourceLine | null = null;
    for (const line of lines) {
      if (/^erDiagram\b/i.test(line.text)) continue;
      if (line.text === '}') {
        if (!entityStart) diagnostics.push(diagnostic(line, 'unexpected-block-end', 'Unexpected closing brace.', 'error'));
        currentTable = null;
        entityStart = null;
        continue;
      }
      const entity = line.text.match(/^([a-zA-Z0-9_.-]+)\s*\{$/);
      const shorthand = line.text.match(/^Table[:\s]+([a-zA-Z0-9_.-]+)$/i);
      if (entity || shorthand) {
        const name = (entity || shorthand)![1];
        currentTable = { id: `tbl-${name.toLowerCase()}`, label: name, type: 'table', fields: [] };
        nodeMap.set(currentTable.id, currentTable);
        entityStart = entity ? line : null;
        continue;
      }
      if (currentTable && (entityStart || /^[-*]\s*/.test(line.text))) {
        const cleaned = line.text.replace(/^[-*]\s*/, '').replace(/[,;]/g, '').trim();
        const parts = cleaned.split(/\s+/);
        if (parts.length < 2) diagnostics.push(diagnostic(line, 'invalid-field', 'A field needs a type and name.', 'warning', entityStart ? 'Use: string email' : 'Use: - email string'));
        else {
          const [firstPart, secondPart, ...badges] = parts;
          const [name, type] = entityStart ? [secondPart, firstPart] : [firstPart, secondPart];
          currentTable.fields!.push(`${name} ${type} ${badges.join(' ').toLowerCase()}`.trim());
        }
        continue;
      }
      currentTable = null;
      const shorthandRel = line.text.match(/^([a-zA-Z0-9_.-]+)\s*-->\s*([a-zA-Z0-9_.-]+)\s*:\s*(.+)$/);
      const erRel = line.text.match(/^([a-zA-Z0-9_.-]+)\s*([|o}{.-]+)\s*([a-zA-Z0-9_.-]+)\s*:\s*(?:["'](.*?)["']|(.*?))$/);
      if (shorthandRel) {
        const source = `tbl-${shorthandRel[1].toLowerCase()}`;
        const target = `tbl-${shorthandRel[2].toLowerCase()}`;
        ensureNode(source, shorthandRel[1], 'table');
        ensureNode(target, shorthandRel[2], 'table');
        edges.push({ source, target, label: shorthandRel[3].trim(), style: 'solid' });
        continue;
      }
      if (erRel) {
        const source = `tbl-${erRel[1].toLowerCase()}`;
        const target = `tbl-${erRel[3].toLowerCase()}`;
        ensureNode(source, erRel[1], 'table');
        ensureNode(target, erRel[3], 'table');
        const relationship = parseErRelationshipSymbol(erRel[2]);
        edges.push({ source, target, label: (erRel[4] || erRel[5] || '').trim(), ...relationship });
        continue;
      }
      diagnostics.push(diagnostic(line, 'unsupported-er-statement', 'Unsupported ER diagram statement.', 'warning', 'Use an entity block, Table: Name, or a relationship.'));
    }
    if (entityStart) diagnostics.push(diagnostic(entityStart, 'unclosed-entity', 'Entity block is missing a closing brace.', 'error', 'Add } after the last field.'));
    return { syntax, direction, nodes: [...nodeMap.values()], edges, diagnostics };
  }

  // DFD Diagram syntax
  if (syntax === 'dfd') {
    for (const line of lines) {
      if (/^dfdDiagram\b/i.test(line.text)) continue;

      const edge = parseGenericConnector(line.text);
      if (edge) {
        const src = extractTokenAndColor(edge.source);
        const tgt = extractTokenAndColor(edge.target);
        ensureNode(src.id, src.id, 'dfd-entity', undefined, false, src.color);
        ensureNode(tgt.id, tgt.id, 'dfd-process', undefined, false, tgt.color);
        edges.push({
          source: src.id,
          target: tgt.id,
          label: edge.label,
          style: edge.style,
          arrow: edge.arrow,
        });
        continue;
      }

      const entityMatch = line.text.match(/^entity\s+(.+)$/i);
      if (entityMatch) {
        const { id, label, color } = parseDeclaration(entityMatch[1]);
        ensureNode(id, label, 'dfd-entity', undefined, true, color);
        continue;
      }

      const processMatch = line.text.match(/^process\s+(.+)$/i);
      if (processMatch) {
        const { id, label, color } = parseDeclaration(processMatch[1]);
        ensureNode(id, label, 'dfd-process', undefined, true, color);
        continue;
      }

      const storeMatch = line.text.match(/^store\s+(.+)$/i);
      if (storeMatch) {
        const { id, label, color } = parseDeclaration(storeMatch[1]);
        ensureNode(id, label, 'dfd-store', undefined, true, color);
        continue;
      }

      diagnostics.push(diagnostic(line, 'unsupported-dfd-statement', 'Unsupported DFD statement.', 'warning', 'Use entity, process, store, or Source --> Target : Label.'));
    }
    return { syntax, direction, nodes: [...nodeMap.values()], edges, diagnostics };
  }

  // Use Case Diagram syntax
  if (syntax === 'usecase') {
    for (const line of lines) {
      if (/^usecaseDiagram\b/i.test(line.text)) continue;

      const edge = parseGenericConnector(line.text);
      if (edge) {
        const src = extractTokenAndColor(edge.source);
        const tgt = extractTokenAndColor(edge.target);
        ensureNode(src.id, src.id, 'usecase-actor', undefined, false, src.color);
        ensureNode(tgt.id, tgt.id, 'usecase-oval', undefined, false, tgt.color);
        edges.push({
          source: src.id,
          target: tgt.id,
          label: edge.label,
          style: edge.style,
          arrow: edge.arrow,
        });
        continue;
      }

      const actorMatch = line.text.match(/^actor\s+(.+)$/i);
      if (actorMatch) {
        const { id, label, color } = parseDeclaration(actorMatch[1]);
        ensureNode(id, label, 'usecase-actor', undefined, true, color);
        continue;
      }

      const ucMatch = line.text.match(/^usecase\s+(.+)$/i);
      if (ucMatch) {
        const { id, label, color } = parseDeclaration(ucMatch[1]);
        ensureNode(id, label, 'usecase-oval', undefined, true, color);
        continue;
      }

      const boundaryMatch = line.text.match(/^boundary\s+(.+)$/i);
      if (boundaryMatch) {
        const { id, label, color } = parseDeclaration(boundaryMatch[1]);
        ensureNode(id, label, 'usecase-boundary', undefined, true, color);
        continue;
      }

      diagnostics.push(diagnostic(line, 'unsupported-usecase-statement', 'Unsupported Use Case statement.', 'warning', 'Use actor, usecase, boundary, or Actor --> Usecase.'));
    }
    return { syntax, direction, nodes: [...nodeMap.values()], edges, diagnostics };
  }

  // Activity Diagram syntax
  if (syntax === 'activity') {
    for (const line of lines) {
      if (/^activityDiagram\b/i.test(line.text)) continue;

      const edge = parseGenericConnector(line.text);
      if (edge) {
        const src = extractTokenAndColor(edge.source);
        const tgt = extractTokenAndColor(edge.target);

        const inferActivityType = (name: string): CanvasNode['type'] => {
          const lower = name.toLowerCase();
          if (lower === 'start') return 'activity-start';
          if (lower === 'end' || lower === 'stop') return 'activity-end';
          if (lower === 'fork' || lower === 'join') return 'activity-fork';
          return 'activity-action';
        };

        ensureNode(src.id, src.id, inferActivityType(src.id), undefined, false, src.color);
        ensureNode(tgt.id, tgt.id, inferActivityType(tgt.id), undefined, false, tgt.color);
        edges.push({
          source: src.id,
          target: tgt.id,
          label: edge.label,
          style: edge.style,
          arrow: edge.arrow,
        });
        continue;
      }

      const startMatch = line.text.match(/^start(?:\s+(.+))?$/i);
      if (startMatch) {
        const decl = startMatch[1] ? parseDeclaration(startMatch[1]) : { id: 'start', label: 'Start' };
        ensureNode(decl.id, decl.label, 'activity-start', undefined, true, decl.color);
        continue;
      }

      const endMatch = line.text.match(/^(?:stop|end)(?:\s+(.+))?$/i);
      if (endMatch) {
        const decl = endMatch[1] ? parseDeclaration(endMatch[1]) : { id: 'end', label: 'End' };
        ensureNode(decl.id, decl.label, 'activity-end', undefined, true, decl.color);
        continue;
      }

      const actionMatch = line.text.match(/^action\s+(.+)$/i);
      if (actionMatch) {
        const { id, label, color } = parseDeclaration(actionMatch[1]);
        ensureNode(id, label, 'activity-action', undefined, true, color);
        continue;
      }

      const decisionMatch = line.text.match(/^decision\s+(.+)$/i);
      if (decisionMatch) {
        const { id, label, color } = parseDeclaration(decisionMatch[1]);
        ensureNode(id, label, 'activity-decision', undefined, true, color);
        continue;
      }

      const forkMatch = line.text.match(/^fork(?:\s+(.+))?$/i);
      if (forkMatch) {
        const decl = forkMatch[1] ? parseDeclaration(forkMatch[1]) : { id: 'fork', label: 'Fork' };
        ensureNode(decl.id, decl.label, 'activity-fork', undefined, true, decl.color);
        continue;
      }

      const joinMatch = line.text.match(/^join(?:\s+(.+))?$/i);
      if (joinMatch) {
        const decl = joinMatch[1] ? parseDeclaration(joinMatch[1]) : { id: 'join', label: 'Join' };
        ensureNode(decl.id, decl.label, 'activity-fork', undefined, true, decl.color);
        continue;
      }

      diagnostics.push(diagnostic(line, 'unsupported-activity-statement', 'Unsupported Activity diagram statement.', 'warning', 'Use start, end, action, decision, fork, join, or Step --> Next.'));
    }
    return { syntax, direction, nodes: [...nodeMap.values()], edges, diagnostics };
  }

  // Flowchart parsing
  let currentSubgraph: string | null = null;
  let subgraphStart: SourceLine | null = null;
  const arrowSplitRegex = /(\s*(?:--\s*.*?\s*-->|-\.\s*.*?\s*\.->|==\s*.*?\s*==>|-->\|.*?\||-\.->\|.*?\||==>\|.*?\||-->|-\.->|==>|---|->|<-->)\s*)/g;
  for (const line of lines) {
    if (/^(flowchart|graph)\b/i.test(line.text)) continue;
    const subgraph = line.text.match(/^subgraph\s+([a-zA-Z0-9_.-]+)(?:\s*\[(.*?)\])?/i);
    if (subgraph) {
      if (currentSubgraph) diagnostics.push(diagnostic(line, 'nested-subgraph', 'Nested subgraphs are not supported.', 'warning'));
      currentSubgraph = subgraph[2] ? stripQuotes(subgraph[2]) : subgraph[1];
      subgraphStart = line;
      continue;
    }
    if (/^end$/i.test(line.text)) {
      if (!currentSubgraph) diagnostics.push(diagnostic(line, 'unexpected-end', 'Unexpected end without a subgraph.', 'error'));
      currentSubgraph = null;
      subgraphStart = null;
      continue;
    }
    if (/^(classDef|style|class|linkStyle|click|accTitle|accDescr)\s+/i.test(line.text)) continue;
    const parts = line.text.split(arrowSplitRegex).filter(part => part?.trim());
    if (parts.length >= 3) {
      let previous: ParsedNodeInfo[] = [];
      let malformed = false;
      for (let index = 0; index < parts.length; index += 2) {
        const tokens = parts[index].trim().split('&').map(token => parseCheckedNode(token.trim(), line)).filter((node): node is ParsedNodeInfo => Boolean(node));
        if (!tokens.length) { malformed = true; break; }
        for (const node of tokens) {
          ensureNode(node.id, node.label, node.type, undefined, node.label !== node.id || node.type !== 'process', node.colorHint);
          if (currentSubgraph) nodeMap.get(node.id)!.subgraph = currentSubgraph;
        }
        if (previous.length && index > 0) {
          const connector = parts[index - 1].trim();
          const pipe = connector.match(/(?:-->|-\.->|==>)\|(.*?)\|/);
          const middle = connector.match(/(?:--|-\.|==)\s*(.*?)\s*(?:-->|\.->|==>)/);
          const label = pipe?.[1]?.trim() || middle?.[1]?.trim() || undefined;
          const style = connector.startsWith('-.') ? 'dashed' : 'solid';
          const arrow = connector === '---' ? 'none' : connector.includes('<-->') ? 'both' : 'end';
          previous.forEach(source => tokens.forEach(target => edges.push({ source: source.id, target: target.id, label, style, arrow })));
        }
        previous = tokens;
      }
      if (!malformed) continue;
    }
    if (/^[a-zA-Z0-9_.-]+\s*(\[|\(|\{|>)/.test(line.text)) {
      const node = parseCheckedNode(line.text, line);
      if (node) {
        ensureNode(node.id, node.label, node.type, undefined, true, node.colorHint);
        if (currentSubgraph) nodeMap.get(node.id)!.subgraph = currentSubgraph;
      }
      continue;
    }
    const arrowOffset = line.text.search(/<?[-=.]+>?/);
    diagnostics.push(diagnostic(line, arrowOffset >= 0 ? 'invalid-connector' : 'unsupported-flowchart-statement', arrowOffset >= 0 ? 'Malformed or incomplete connector.' : 'Unsupported flowchart statement.', arrowOffset >= 0 ? 'error' : 'warning', arrowOffset >= 0 ? 'Use A --> B, A -.-> B, or A --- B.' : 'Use a node such as A[Label] or a connector such as A --> B.', Math.max(0, arrowOffset)));
  }
  if (subgraphStart) diagnostics.push(diagnostic(subgraphStart, 'unclosed-subgraph', 'Subgraph is missing its end statement.', 'error', 'Add end after the final subgraph node.'));
  return { syntax, direction, nodes: [...nodeMap.values()], edges, diagnostics };
};
