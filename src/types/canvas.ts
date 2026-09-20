import type { CanvasNode, EdgeMarkerType } from '../services/mockDb';

export interface FreehandDrawing {
  id: string;
  path: string; // SVG Path string: M x y Q ...
  color?: string;
  width?: number;
  opacity?: number;
  tool?: 'pen' | 'highlighter';
}

export interface NodeDragState {
  isDown: boolean;
  isDragging: boolean;
  startClientPos: { x: number; y: number };
  primaryNodeId: string;
  initialPositions: Record<string, { x: number; y: number }>;
  activeSelectionIds: string[];
  wasAlreadySelected: boolean;
  isShift: boolean;
}

export interface ResizeState {
  nodeId: string;
  handle: string; // 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
  startClientX: number;
  startClientY: number;
  initialX: number;
  initialY: number;
  initialW: number;
  initialH: number;
}

export interface EdgeRouteDragState {
  edgeId: string;
  waypointIndex: number;
  initialWaypoints: { x: number; y: number }[];
  axis: 'x' | 'y' | 'both';
}

export interface EdgeReconnectState {
  edgeId: string;
  endpoint: 'source' | 'target';
}

export interface ScrollbarDragState {
  axis: 'x' | 'y';
  startClientPos: number;
  startPan: number;
  trackLength: number;
  worldLength: number;
}

// Convert discrete points to a smooth SVG Bézier curve path using midpoint quadratic Bézier interpolation
export const pointsToSmoothSvgPath = (points: { x: number; y: number }[]): string => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    path += ` Q ${points[i].x} ${points[i].y}, ${xc} ${yc}`;
  }
  const last = points[points.length - 1];
  const secondLast = points[points.length - 2];
  path += ` Q ${secondLast.x} ${secondLast.y}, ${last.x} ${last.y}`;
  return path;
};

export const PENCIL_COLOR_PRESETS = [
  { label: 'Signal Orange', value: '#D45B33' },
  { label: 'Blueprint Ink', value: '#15191C' },
  { label: 'Technical Blue', value: '#1E5C8C' },
  { label: 'Accent Teal', value: '#1A6B54' },
  { label: 'Alert Red', value: '#C0392B' },
  { label: 'Highlight Yellow', value: '#F59E0B' },
];

export const PENCIL_WIDTH_PRESETS = [
  { label: 'Fine', value: 1.5 },
  { label: 'Medium', value: 2.5 },
  { label: 'Thick', value: 4.5 },
  { label: 'Marker', value: 8 },
];

export const AVAILABLE_SHAPE_TYPES: { type: CanvasNode['type']; label: string }[] = [
  { type: 'process', label: 'Process (Rectangle)' },
  { type: 'decision', label: 'Decision (Diamond)' },
  { type: 'terminal', label: 'Terminal (Pill)' },
  { type: 'text', label: 'Text Box / Note' },
  { type: 'table', label: 'Table (ERD)' },
  { type: 'dfd-store', label: 'Data Store (DFD)' },
  { type: 'dfd-entity', label: 'Entity (DFD)' },
  { type: 'dfd-process', label: 'Process (DFD)' },
  { type: 'usecase-actor', label: 'Actor (Stick)' },
  { type: 'usecase-oval', label: 'Use Case (Oval)' },
  { type: 'usecase-boundary', label: 'Boundary (Box)' },
  { type: 'activity-action', label: 'Action (Rounded)' },
];

export const UNIVERSAL_TOOLBOX_GROUPS: { label: string; items: { type: CanvasNode['type']; label: string }[] }[] = [
  {
    label: 'Flowchart',
    items: [
      { type: 'process', label: 'Process Step (Box)' },
      { type: 'decision', label: 'Decision (Diamond)' },
      { type: 'terminal', label: 'Start / End (Oval)' },
    ],
  },
  { label: 'Database / ERD', items: [{ type: 'table', label: 'Database Table' }] },
  {
    label: 'Data Flow (DFD)',
    items: [
      { type: 'dfd-entity', label: 'External Entity' },
      { type: 'dfd-process', label: 'Transform Process' },
      { type: 'dfd-store', label: 'Data Store' },
    ],
  },
  {
    label: 'Use Case',
    items: [
      { type: 'usecase-actor', label: 'User Actor' },
      { type: 'usecase-oval', label: 'Use Case Oval' },
      { type: 'usecase-boundary', label: 'System Boundary' },
    ],
  },
  {
    label: 'Activity',
    items: [
      { type: 'activity-start', label: 'Start State' },
      { type: 'activity-action', label: 'Action Step' },
      { type: 'activity-decision', label: 'Decision Diamond' },
      { type: 'activity-fork', label: 'Fork / Join Bar' },
      { type: 'activity-end', label: 'Final State' },
    ],
  },
  {
    label: 'Sequence',
    items: [
      { type: 'process', label: 'Participant' },
      { type: 'sequence-activation', label: 'Activation Bar' },
    ],
  },
  { label: 'Annotation', items: [{ type: 'text', label: 'Text Box / Note' }] },
];

export const FILL_COLOR_PRESETS = [
  { label: 'Paper', value: '#FFFFFF', bg: '#FFFFFF' },
  { label: 'Blueprint', value: '#EFF6FF', bg: '#EFF6FF' },
  { label: 'Signal', value: '#FEF2F2', bg: '#FEF2F2' },
  { label: 'Amber', value: '#FFFBEB', bg: '#FFFBEB' },
  { label: 'Emerald', value: '#F0FDF4', bg: '#F0FDF4' },
  { label: 'Purple', value: '#FAF5FF', bg: '#FAF5FF' },
  { label: 'Clear', value: 'transparent', bg: 'transparent' },
];

export const SHADOW_COLOR_PRESETS = [
  { label: 'Blue', value: '#1E5C8C', bg: '#1E5C8C' },
  { label: 'Red', value: '#D45B33', bg: '#D45B33' },
  { label: 'Dark', value: '#15191C', bg: '#15191C' },
  { label: 'Green', value: '#059669', bg: '#059669' },
  { label: 'Purple', value: '#7C3AED', bg: '#7C3AED' },
  { label: 'Amber', value: '#D97706', bg: '#D97706' },
  { label: 'None', value: 'none', bg: '#D1D5DB' },
];

/** Standard blueprint drafting color tokens for diagrams (diagrams remain clean & unaffected by UI themes) */
export const dc = {
  ink: '#15191C',
  inkSoft: '#4A5359',
  paper: '#F6F7F5',
  paperRaised: '#FFFFFF',
  blueprint: '#1E5C8C',
  signal: '#D45B33',
  borderLine: '#D7DBD8',
};

export const CARDINALITY_OPTIONS: { value: EdgeMarkerType; label: string; title: string }[] = [
  { value: 'zero-one', label: 'Zero or one', title: 'Zero or One (Circle)' },
  { value: 'many', label: 'Many', title: 'Many (Crow\'s Foot Prongs)' },
  { value: 'one', label: 'One', title: 'One (Single Bar)' },
  { value: 'one-only', label: 'One (only)', title: 'One and only one (Two Bars)' },
  { value: 'zero-many', label: 'Zero or many', title: 'Zero or Many (Circle + Prongs)' },
  { value: 'one-many', label: 'One or many', title: 'One or Many (Bar + Prongs)' },
  { value: 'none', label: 'Plain line', title: 'Plain Line' },
  { value: 'arrow', label: 'Arrow', title: 'Directed Arrow' },
];

export const getMarkerUrl = (
  markerType: EdgeMarkerType | undefined,
  fallbackArrow: 'end' | 'none' | 'both' | undefined,
  isStart: boolean,
  isSelected: boolean
): string | undefined => {
  const suffix = isSelected ? '-selected' : '';

  if (markerType) {
    if (markerType === 'none') return undefined;
    if (markerType === 'arrow') return `url(#arrow${suffix})`;
    if (markerType === 'one') return `url(#crows-one${suffix})`;
    if (markerType === 'one-only') return `url(#crows-one-only${suffix})`;
    if (markerType === 'zero-one') return `url(#crows-zero-one${suffix})`;
    if (markerType === 'many') return `url(#crows-many${suffix})`;
    if (markerType === 'one-many') return `url(#crows-one-many${suffix})`;
    if (markerType === 'zero-many') return `url(#crows-zero-many${suffix})`;
  }

  if (fallbackArrow === 'both') {
    return `url(#arrow${suffix})`;
  }
  if (fallbackArrow === 'none') {
    return undefined;
  }
  if (isStart) {
    return undefined;
  }
  return `url(#arrow${suffix})`;
};

// Default dimensions per shape type
export const getDefaultDimensions = (node: CanvasNode): { width: number; height: number } => {
  if (node.type === 'table') {
    const fieldCount = node.fields?.length || 0;
    return { width: 180, height: Math.max(48, 32 + fieldCount * 24) };
  }
  if (node.type === 'decision') return { width: 96, height: 96 };
  if (node.type === 'terminal') return { width: 120, height: 38 };
  if (node.type === 'dfd-store') return { width: 140, height: 48 };
  if (node.type === 'dfd-entity') return { width: 120, height: 56 };
  if (node.type === 'dfd-process') return { width: 130, height: 64 };
  if (node.type === 'usecase-actor') return { width: 70, height: 90 };
  if (node.type === 'usecase-oval') return { width: 130, height: 52 };
  if (node.type === 'usecase-boundary') return { width: 360, height: 300 };
  if (node.type === 'sequence-activation') return { width: 20, height: 80 };
  if (node.type === 'activity-start') return { width: 32, height: 32 };
  if (node.type === 'activity-end') return { width: 36, height: 36 };
  if (node.type === 'activity-action') return { width: 150, height: 48 };
  if (node.type === 'activity-decision') return { width: 96, height: 96 };
  if (node.type === 'activity-fork') return { width: 200, height: 8 };
  if (node.type === 'text') return { width: 140, height: 40 };
  return { width: 140, height: 48 };
};

// Minimum dimensions per shape type
export const getMinDimensions = (node: CanvasNode): { width: number; height: number } => {
  if (node.type === 'table') {
    const fieldCount = node.fields?.length || 0;
    return { width: 120, height: Math.max(48, 32 + fieldCount * 24) };
  }
  if (node.type === 'decision' || node.type === 'activity-decision') return { width: 48, height: 48 };
  if (node.type === 'activity-start') return { width: 20, height: 20 };
  if (node.type === 'activity-end') return { width: 24, height: 24 };
  if (node.type === 'activity-fork') return { width: 60, height: 6 };
  if (node.type === 'usecase-actor') return { width: 40, height: 50 };
  if (node.type === 'sequence-activation') return { width: 14, height: 40 };
  if (node.type === 'text') return { width: 40, height: 24 };
  return { width: 60, height: 28 };
};

// Check if shape type supports resizing
export const isResizable = (type: string): boolean => {
  return !['activity-start', 'activity-end'].includes(type);
};

export const getNodeDimensions = (node: CanvasNode): { width: number; height: number } => {
  const defaults = getDefaultDimensions(node);
  if (node.type === 'table') {
    const fieldCount = node.fields?.length || 0;
    const minRequiredHeight = 32 + fieldCount * 24;
    return {
      width: node.customWidth ?? defaults.width,
      height: Math.max(node.customHeight ?? 0, minRequiredHeight),
    };
  }
  return {
    width: node.customWidth ?? defaults.width,
    height: node.customHeight ?? defaults.height,
  };
};
