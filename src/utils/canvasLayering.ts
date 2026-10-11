import type { CanvasNode } from '../services/mockDb';
import { getNodeDimensions } from '../types/canvas';

/**
 * Keep overlapping nodes in the same DOM layer while one of them needs HTML
 * controls. Otherwise the bitmap layer always sits behind the HTML layer,
 * regardless of the order chosen with Bring to Front or Send to Back.
 */
export const getDomNodeIdsForLayering = (
  nodes: CanvasNode[],
  selectedIds: readonly string[],
  connectingNodeId: string | undefined,
  canvasRenderableTypes: ReadonlySet<CanvasNode['type']>,
): Set<string> => {
  const selected = new Set(selectedIds);
  const bounds = nodes.map(node => {
    const { width, height } = getNodeDimensions(node);
    return { left: node.x, top: node.y, right: node.x + width, bottom: node.y + height };
  });
  const domIds = new Set<string>();
  const pending: number[] = [];
  nodes.forEach((node, index) => {
    if (!canvasRenderableTypes.has(node.type) || selected.has(node.id) || node.id === connectingNodeId) {
      domIds.add(node.id);
      pending.push(index);
    }
  });
  for (let head = 0; head < pending.length; head++) {
    const box = bounds[pending[head]];
    nodes.forEach((node, index) => {
      if (domIds.has(node.id)) return;
      const other = bounds[index];
      if (box.left <= other.right && box.right >= other.left && box.top <= other.bottom && box.bottom >= other.top) {
        domIds.add(node.id);
        pending.push(index);
      }
    });
  }
  return domIds;
};
