import type { CanvasNode } from '../services/mockDb';
import { getNodeDimensions } from '../types/canvas';

export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const DEFAULT_CELL_SIZE = 400;

/**
 * A compact uniform-grid index for canvas objects. It keeps viewport queries
 * proportional to the number of nearby cells rather than every node in the
 * document, and will also back canvas hit testing and routing queries.
 */
export class CanvasSpatialIndex {
  private readonly cells = new Map<string, Set<string>>();
  private readonly nodesById = new Map<string, CanvasNode>();
  private readonly boundsById = new Map<string, WorldBounds>();
  private readonly orderById = new Map<string, number>();
  private readonly cellSize: number;

  constructor(nodes: CanvasNode[], cellSize = DEFAULT_CELL_SIZE) {
    this.cellSize = cellSize;
    nodes.forEach((node, index) => this.insert(node, index));
  }

  getNode(id: string): CanvasNode | undefined {
    return this.nodesById.get(id);
  }

  query(bounds: WorldBounds): CanvasNode[] {
    const ids = new Set<string>();
    const startX = Math.floor(bounds.minX / this.cellSize);
    const endX = Math.floor(bounds.maxX / this.cellSize);
    const startY = Math.floor(bounds.minY / this.cellSize);
    const endY = Math.floor(bounds.maxY / this.cellSize);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        for (const id of this.cells.get(`${x}:${y}`) ?? []) ids.add(id);
      }
    }

    return [...ids]
      .filter((id) => {
        const nodeBounds = this.boundsById.get(id);
        return nodeBounds && intersects(bounds, nodeBounds);
      })
      .sort((a, b) => (this.orderById.get(a) ?? 0) - (this.orderById.get(b) ?? 0))
      .map((id) => this.nodesById.get(id)!)
      .filter(Boolean);
  }

  queryPoint(x: number, y: number): CanvasNode[] {
    return this.query({ minX: x, minY: y, maxX: x, maxY: y });
  }

  private insert(node: CanvasNode, order: number) {
    const { width, height } = getNodeDimensions(node);
    const bounds = { minX: node.x, minY: node.y, maxX: node.x + width, maxY: node.y + height };
    this.nodesById.set(node.id, node);
    this.boundsById.set(node.id, bounds);
    this.orderById.set(node.id, order);

    const startX = Math.floor(bounds.minX / this.cellSize);
    const endX = Math.floor(bounds.maxX / this.cellSize);
    const startY = Math.floor(bounds.minY / this.cellSize);
    const endY = Math.floor(bounds.maxY / this.cellSize);
    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const key = `${x}:${y}`;
        const cell = this.cells.get(key) ?? new Set<string>();
        cell.add(node.id);
        this.cells.set(key, cell);
      }
    }
  }
}

const intersects = (a: WorldBounds, b: WorldBounds) =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
