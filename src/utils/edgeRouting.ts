import { type CanvasNode, type CanvasEdge } from '../services/mockDb';
import { getNodeDimensions } from './diagramExport';

// Get coordinates for specific connection port handles
// For diamond shapes, ports are at the diamond vertices (midpoints of bounding box edges)
export const getPortCoords = (
  node: CanvasNode,
  port: 'top' | 'bottom' | 'left' | 'right'
): { x: number; y: number } => {
  const { width, height } = getNodeDimensions(node);

  switch (port) {
    case 'top': return { x: node.x + width / 2, y: node.y };
    case 'bottom': return { x: node.x + width / 2, y: node.y + height };
    case 'left': return { x: node.x, y: node.y + height / 2 };
    case 'right': return { x: node.x + width, y: node.y + height / 2 };
  }
};

// Check if a point is inside the bounding box of a node (including safety padding)
export const isPointInsideNode = (x: number, y: number, node: CanvasNode): boolean => {
  const { width, height } = getNodeDimensions(node);
  const padding = 10;
  const isDiamondType = node.type === 'decision' || node.type === 'activity-decision';

  if (isDiamondType) {
    const cx = node.x + width / 2;
    const cy = node.y + height / 2;
    const hw = width / 2 + padding;
    const hh = height / 2 + padding;
    const dx = Math.abs(x - cx);
    const dy = Math.abs(y - cy);
    return (dx / hw + dy / hh) <= 1;
  }

  return (
    x >= node.x - padding &&
    x <= node.x + width + padding &&
    y >= node.y - padding &&
    y <= node.y + height + padding
  );
};

// Check if a segment from p1 to p2 intersects the bounding box of a node
export const isSegmentIntersectingNode = (
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  node: CanvasNode
): boolean => {
  const { width, height } = getNodeDimensions(node);
  const isDiamondType = node.type === 'decision' || node.type === 'activity-decision';
  const padding = isDiamondType ? 4 : 10;
  const minX = node.x - padding;
  const maxX = node.x + width + padding;
  const minY = node.y - padding;
  const maxY = node.y + height + padding;

  if (p1.x === p2.x) {
    const x = p1.x;
    const yStart = Math.min(p1.y, p2.y);
    const yEnd = Math.max(p1.y, p2.y);
    if (x >= minX && x <= maxX) {
      return !(yEnd < minY || yStart > maxY);
    }
  } else if (p1.y === p2.y) {
    const y = p1.y;
    const xStart = Math.min(p1.x, p2.x);
    const xEnd = Math.max(p1.x, p2.x);
    if (y >= minY && y <= maxY) {
      return !(xEnd < minX || xStart > maxX);
    }
  }
  return false;
};

// Check if a segment is blocked by any node other than source and target nodes
export const isSegmentBlocked = (
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  allNodes: CanvasNode[],
  sourceId: string,
  targetId: string
): boolean => {
  for (const node of allNodes) {
    if (node.id === sourceId || node.id === targetId) continue;
    if (isSegmentIntersectingNode(p1, p2, node)) {
      return true;
    }
  }
  return false;
};

// Remove redundant collinear points from an orthogonal path
export const simplifyOrthogonalPath = (
  pts: { x: number; y: number }[]
): { x: number; y: number }[] => {
  if (pts.length <= 2) return pts;
  const result: { x: number; y: number }[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = pts[i];
    const next = pts[i + 1];

    if (Math.abs(curr.x - prev.x) < 0.5 && Math.abs(curr.y - prev.y) < 0.5) continue;

    const isCollinearX = Math.abs(prev.x - curr.x) < 0.5 && Math.abs(curr.x - next.x) < 0.5;
    const isCollinearY = Math.abs(prev.y - curr.y) < 0.5 && Math.abs(curr.y - next.y) < 0.5;
    if (!isCollinearX && !isCollinearY) {
      result.push(curr);
    }
  }
  result.push(pts[pts.length - 1]);
  return result;
};

export const buildSvgPath = (pts: { x: number; y: number }[]): string => {
  if (pts.length === 0) return '';
  let path = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    path += ` L ${pts[i].x} ${pts[i].y}`;
  }
  return path;
};

export const getOrthogonalRoutePath = (
  start: { x: number; y: number },
  end: { x: number; y: number },
  hA: 'top' | 'bottom' | 'left' | 'right',
  hB: 'top' | 'bottom' | 'left' | 'right',
  sourceNode: CanvasNode,
  targetNode: CanvasNode,
  allNodes: CanvasNode[]
): string => {
  const isHorizA = (hA === 'left' || hA === 'right');
  const isHorizB = (hB === 'left' || hB === 'right');

  // SMART STRAIGHT-LINE SNAPPING:
  // 1. Both ports are vertical (top/bottom) and x positions are roughly aligned (within 14px)
  if (!isHorizA && !isHorizB && Math.abs(start.x - end.x) <= 14) {
    const straightX = Math.round((start.x + end.x) / 2);
    const straightPath = [start, { x: straightX, y: start.y }, { x: straightX, y: end.y }, end];
    let collides = false;
    for (let i = 0; i < straightPath.length - 1; i++) {
      if (isSegmentBlocked(straightPath[i], straightPath[i + 1], allNodes, sourceNode.id, targetNode.id)) {
        collides = true;
        break;
      }
    }
    if (!collides) {
      return buildSvgPath(simplifyOrthogonalPath(straightPath));
    }
  }

  // 2. Both ports are horizontal (left/right) and y positions are roughly aligned (within 14px)
  if (isHorizA && isHorizB && Math.abs(start.y - end.y) <= 14) {
    const straightY = Math.round((start.y + end.y) / 2);
    const straightPath = [start, { x: start.x, y: straightY }, { x: end.x, y: straightY }, end];
    let collides = false;
    for (let i = 0; i < straightPath.length - 1; i++) {
      if (isSegmentBlocked(straightPath[i], straightPath[i + 1], allNodes, sourceNode.id, targetNode.id)) {
        collides = true;
        break;
      }
    }
    if (!collides) {
      return buildSvgPath(simplifyOrthogonalPath(straightPath));
    }
  }

  const buffer = 20;

  const getBufferPoint = (pt: { x: number; y: number }, handle: 'top' | 'bottom' | 'left' | 'right') => {
    switch (handle) {
      case 'top': return { x: pt.x, y: pt.y - buffer };
      case 'bottom': return { x: pt.x, y: pt.y + buffer };
      case 'left': return { x: pt.x - buffer, y: pt.y };
      case 'right': return { x: pt.x + buffer, y: pt.y };
    }
  };

  const startBuf = getBufferPoint(start, hA);
  const endBuf = getBufferPoint(end, hB);

  // Default simple path candidates (clean S-shape, L-shape, and loopbacks)
  const candidates: { x: number; y: number }[][] = [];

  const midX = Math.round((start.x + end.x) / 2);
  const midY = Math.round((start.y + end.y) / 2);

  if (isHorizA && isHorizB) {
    if (hA === 'right' && hB === 'left' && end.x > start.x + 10) {
      candidates.push([start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]);
    } else if (hA === 'left' && hB === 'right' && start.x > end.x + 10) {
      candidates.push([start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]);
    } else {
      candidates.push([start, startBuf, { x: midX, y: startBuf.y }, { x: midX, y: endBuf.y }, endBuf, end]);
    }
    const minY = Math.min(start.y, end.y) - 40;
    const maxY = Math.max(start.y, end.y) + 40;
    candidates.push([start, startBuf, { x: startBuf.x, y: minY }, { x: endBuf.x, y: minY }, endBuf, end]);
    candidates.push([start, startBuf, { x: startBuf.x, y: maxY }, { x: endBuf.x, y: maxY }, endBuf, end]);
  } else if (!isHorizA && !isHorizB) {
    if (hA === 'bottom' && hB === 'top' && end.y > start.y + 10) {
      candidates.push([start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]);
    } else if (hA === 'top' && hB === 'bottom' && start.y > end.y + 10) {
      candidates.push([start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]);
    } else {
      candidates.push([start, startBuf, { x: startBuf.x, y: midY }, { x: endBuf.x, y: midY }, endBuf, end]);
    }
    const minX = Math.min(start.x, end.x) - 40;
    const maxX = Math.max(start.x, end.x) + 40;
    candidates.push([start, startBuf, { x: minX, y: startBuf.y }, { x: minX, y: endBuf.y }, endBuf, end]);
    candidates.push([start, startBuf, { x: maxX, y: startBuf.y }, { x: maxX, y: endBuf.y }, endBuf, end]);
  } else if (isHorizA && !isHorizB) {
    candidates.push([start, { x: end.x, y: start.y }, end]);
    candidates.push([start, { x: start.x, y: end.y }, end]);
    candidates.push([start, startBuf, { x: end.x, y: startBuf.y }, end]);
  } else {
    candidates.push([start, { x: start.x, y: end.y }, end]);
    candidates.push([start, { x: end.x, y: start.y }, end]);
    candidates.push([start, startBuf, { x: startBuf.x, y: end.y }, end]);
  }

  // Check if any candidate has NO collisions
  for (const path of candidates) {
    let collides = false;
    for (let i = 0; i < path.length - 1; i++) {
      if (isSegmentBlocked(path[i], path[i + 1], allNodes, sourceNode.id, targetNode.id)) {
        collides = true;
        break;
      }
    }
    if (!collides) {
      return buildSvgPath(simplifyOrthogonalPath(path));
    }
  }

  // Dijkstra search on Hanan Grid
  const xsSet = new Set<number>([start.x, startBuf.x, end.x, endBuf.x]);
  const ysSet = new Set<number>([start.y, startBuf.y, end.y, endBuf.y]);

  allNodes.forEach(node => {
    const { width, height } = getNodeDimensions(node);
    const padding = 20;
    xsSet.add(node.x - padding);
    xsSet.add(node.x + width + padding);
    ysSet.add(node.y - padding);
    ysSet.add(node.y + height + padding);
  });

  const xs = Array.from(xsSet).sort((a, b) => a - b);
  const ys = Array.from(ysSet).sort((a, b) => a - b);

  interface QueueItem {
    pt: { x: number; y: number };
    dist: number;
    path: { x: number; y: number }[];
    dir: 'H' | 'V' | null;
  }

  const startKey = `${startBuf.x},${startBuf.y}`;
  const distMap: Record<string, number> = { [startKey]: 0 };
  const queue: QueueItem[] = [{ pt: startBuf, dist: 0, path: [startBuf], dir: null }];

  let bestPath: { x: number; y: number }[] | null = null;
  let minDist = Infinity;

  while (queue.length > 0) {
    let minIdx = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].dist < queue[minIdx].dist) {
        minIdx = i;
      }
    }
    const curr = queue.splice(minIdx, 1)[0];

    if (curr.pt.x === endBuf.x && curr.pt.y === endBuf.y) {
      if (curr.dist < minDist) {
        minDist = curr.dist;
        bestPath = curr.path;
      }
      continue;
    }

    const currKey = `${curr.pt.x},${curr.pt.y}`;
    if (curr.dist > (distMap[currKey] ?? Infinity)) {
      continue;
    }

    const xIdx = xs.indexOf(curr.pt.x);
    const yIdx = ys.indexOf(curr.pt.y);

    const neighbors: { pt: { x: number; y: number }; dir: 'H' | 'V' }[] = [];
    if (xIdx > 0) neighbors.push({ pt: { x: xs[xIdx - 1], y: curr.pt.y }, dir: 'H' });
    if (xIdx < xs.length - 1) neighbors.push({ pt: { x: xs[xIdx + 1], y: curr.pt.y }, dir: 'H' });
    if (yIdx > 0) neighbors.push({ pt: { x: curr.pt.x, y: ys[yIdx - 1] }, dir: 'V' });
    if (yIdx < ys.length - 1) neighbors.push({ pt: { x: curr.pt.x, y: ys[yIdx + 1] }, dir: 'V' });

    for (const nbr of neighbors) {
      let insideObstacle = false;
      for (const node of allNodes) {
        if (node.id === sourceNode.id || node.id === targetNode.id) continue;
        if (isPointInsideNode(nbr.pt.x, nbr.pt.y, node)) {
          insideObstacle = true;
          break;
        }
      }
      if (insideObstacle) continue;

      if (isSegmentBlocked(curr.pt, nbr.pt, allNodes, sourceNode.id, targetNode.id)) {
        continue;
      }

      const edgeLen = Math.abs(nbr.pt.x - curr.pt.x) + Math.abs(nbr.pt.y - curr.pt.y);
      const turnPenalty = (curr.dir && curr.dir !== nbr.dir) ? 150 : 0;
      const newDist = curr.dist + edgeLen + turnPenalty;

      const nbrKey = `${nbr.pt.x},${nbr.pt.y}`;
      if (newDist < (distMap[nbrKey] ?? Infinity)) {
        distMap[nbrKey] = newDist;
        queue.push({
          pt: nbr.pt,
          dist: newDist,
          path: [...curr.path, nbr.pt],
          dir: nbr.dir
        });
      }
    }
  }

  if (bestPath) {
    return buildSvgPath([start, ...bestPath, end]);
  }

  return buildSvgPath(candidates[0]);
};

// Universal edge path calculation used across Editor, PublicViewer, and EmbedWidget
export const calculateEdgePath = (
  edge: CanvasEdge,
  allNodes: CanvasNode[]
): string => {
  const sourceNode = allNodes.find(n => n.id === edge.source);
  const targetNode = allNodes.find(n => n.id === edge.target);
  if (!sourceNode || !targetNode) return '';

  const start = getPortCoords(sourceNode, edge.sourceHandle || 'right');
  const end = getPortCoords(targetNode, edge.targetHandle || 'left');

  return getOrthogonalRoutePath(
    start,
    end,
    edge.sourceHandle || 'right',
    edge.targetHandle || 'left',
    sourceNode,
    targetNode,
    allNodes
  );
};
