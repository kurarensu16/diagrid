const MAX_CONTENT_BYTES = 2 * 1024 * 1024;
const MAX_NODES = 500;
const MAX_EDGES = 2000;
const MAX_DRAWINGS = 500;
const MAX_STRING_LENGTH = 10_000;
const MAX_DRAWING_PATH_LENGTH = 200_000;
const MAX_ABSOLUTE_NUMBER = 10_000_000;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const SAFE_PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9eE,.+\s-]*$/;

export interface ValidatedDiagramContent {
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  drawings: Record<string, unknown>[];
}

export type DiagramValidationResult =
  | { ok: true; value: ValidatedDiagramContent }
  | { ok: false; error: string };

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const validateValue = (value: unknown, depth = 0): string | null => {
  if (depth > 8) return 'Diagram data is nested too deeply.';
  if (typeof value === 'string') return value.length <= MAX_STRING_LENGTH ? null : 'Diagram contains an oversized text value.';
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= MAX_ABSOLUTE_NUMBER ? null : 'Diagram contains an invalid number.';
  if (typeof value === 'boolean' || value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    if (value.length > MAX_EDGES) return 'Diagram contains an oversized array.';
    for (const item of value) {
      const error = validateValue(item, depth + 1);
      if (error) return error;
    }
    return null;
  }
  if (!isPlainObject(value)) return 'Diagram contains an unsupported value.';
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) return `Diagram contains a forbidden property: ${key}.`;
    const error = validateValue(item, depth + 1);
    if (error) return error;
  }
  return null;
};

export const parseAndValidateDiagramContent = (input: string | unknown): DiagramValidationResult => {
  try {
    if (typeof input === 'string' && new TextEncoder().encode(input).byteLength > MAX_CONTENT_BYTES) {
      return { ok: false, error: 'Diagram content exceeds the 2 MB limit.' };
    }
    const parsed: unknown = typeof input === 'string' ? JSON.parse(input) : input;
    if (!isPlainObject(parsed)) return { ok: false, error: 'Diagram content must be an object.' };
    const rootError = validateValue(parsed);
    if (rootError) return { ok: false, error: rootError };
    const nodes = parsed.nodes ?? [];
    const edges = parsed.edges ?? [];
    const drawings = parsed.drawings ?? [];
    if (!Array.isArray(nodes) || !Array.isArray(edges) || !Array.isArray(drawings)) {
      return { ok: false, error: 'Diagram nodes, edges, and drawings must be arrays.' };
    }
    if (nodes.length > MAX_NODES) return { ok: false, error: `Diagram exceeds the ${MAX_NODES}-shape limit.` };
    if (edges.length > MAX_EDGES) return { ok: false, error: `Diagram exceeds the ${MAX_EDGES}-connection limit.` };
    if (drawings.length > MAX_DRAWINGS) return { ok: false, error: `Diagram exceeds the ${MAX_DRAWINGS}-drawing limit.` };
    if (![...nodes, ...edges, ...drawings].every(isPlainObject)) {
      return { ok: false, error: 'Diagram entries must be objects.' };
    }
    const nodeIds = new Set<string>();
    for (const node of nodes) {
      if (typeof node.id !== 'string' || !/^[a-zA-Z0-9_.:-]{1,200}$/.test(node.id)) return { ok: false, error: 'Diagram contains an invalid shape ID.' };
      if (nodeIds.has(node.id)) return { ok: false, error: 'Diagram contains duplicate shape IDs.' };
      nodeIds.add(node.id);
      if (typeof node.label !== 'string' || node.label.length > 1000) return { ok: false, error: 'Diagram contains an invalid shape label.' };
    }
    for (const edge of edges) {
      if (typeof edge.id !== 'string' || !/^[a-zA-Z0-9_.:-]{1,200}$/.test(edge.id)) return { ok: false, error: 'Diagram contains an invalid connection ID.' };
      if (typeof edge.source !== 'string' || typeof edge.target !== 'string' || !nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        return { ok: false, error: 'Diagram contains a connection to an unknown shape.' };
      }
    }
    for (const drawing of drawings) {
      if (typeof drawing.path !== 'string' || drawing.path.length > MAX_DRAWING_PATH_LENGTH || !SAFE_PATH.test(drawing.path)) {
        return { ok: false, error: 'Diagram contains an invalid freehand path.' };
      }
    }
    return { ok: true, value: { nodes, edges, drawings } };
  } catch {
    return { ok: false, error: 'Diagram content is not valid JSON.' };
  }
};
