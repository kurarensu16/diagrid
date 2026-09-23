import { useEffect, useRef } from 'react';
import type { CanvasNode } from '../../services/mockDb';
import { getNodeDimensions } from '../../types/canvas';

interface StaticNodeCanvasLayerProps {
  nodes: CanvasNode[];
  pan: { x: number; y: number };
  zoom: number;
  width: number;
  height: number;
}

/**
 * Bitmap renderer for inactive nodes in large documents. Selected nodes stay
 * in the HTML overlay, retaining rich controls while the bulk of the diagram
 * no longer creates a DOM subtree per card.
 */
export const StaticNodeCanvasLayer = ({ nodes, pan, zoom, width, height }: StaticNodeCanvasLayerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    for (const node of nodes) drawNode(ctx, node);
  }, [nodes, pan, zoom, width, height]);

  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 z-10 pointer-events-none" />;
};

const drawNode = (ctx: CanvasRenderingContext2D, node: CanvasNode) => {
  const { width, height } = getNodeDimensions(node);
  const x = node.x;
  const y = node.y;
  const fill = node.fillColor && node.fillColor !== 'transparent' ? node.fillColor : '#FFFFFF';
  const fontSize = node.customFontSize || (node.fontSize === 'sm' ? 11 : node.fontSize === 'lg' ? 16 : 13);
  const isDiamond = node.type === 'decision' || node.type === 'activity-decision';

  ctx.save();
  ctx.lineWidth = node.borderWidth || 1.5;
  ctx.strokeStyle = '#15191C';
  ctx.fillStyle = fill;
  ctx.setLineDash(node.borderStyle === 'dashed' ? [5, 5] : node.borderStyle === 'dotted' ? [2, 2] : []);

  if (isDiamond) {
    ctx.beginPath();
    ctx.moveTo(x + width / 2, y);
    ctx.lineTo(x + width, y + height / 2);
    ctx.lineTo(x + width / 2, y + height);
    ctx.lineTo(x, y + height / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (node.type === 'terminal' || node.type === 'usecase-oval' || node.type === 'activity-action') {
    roundedRect(ctx, x, y, width, height, node.type === 'terminal' ? 20 : node.type === 'usecase-oval' ? Math.min(width, height) / 2 : 8);
    ctx.fill();
    ctx.stroke();
  } else if (node.type === 'activity-start') {
    ctx.fillStyle = '#15191C';
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (node.type === 'activity-end') {
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#15191C';
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height / 2, Math.max(Math.min(width, height) / 2 - 5, 2), 0, Math.PI * 2);
    ctx.fill();
  } else if (node.type === 'activity-fork') {
    ctx.fillStyle = '#15191C';
    ctx.fillRect(x, y, width, height);
  } else if (node.type === 'text') {
    // Text nodes intentionally have no card body.
  } else {
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
  }

  ctx.setLineDash([]);
  if (node.type === 'table') {
    drawTable(ctx, node, x, y, width, height, fontSize);
  } else if (node.type !== 'activity-start' && node.type !== 'activity-end' && node.type !== 'activity-fork') {
    drawLabel(ctx, node.label, x, y, width, height, fontSize, node.textAlign);
  }
  ctx.restore();
};

const drawTable = (ctx: CanvasRenderingContext2D, node: CanvasNode, x: number, y: number, width: number, height: number, fontSize: number) => {
  const headerHeight = 30;
  ctx.fillStyle = node.shadowAccent && node.shadowAccent !== 'none' && node.shadowAccent.startsWith('#') ? node.shadowAccent : '#1E5C8C';
  ctx.fillRect(x, y, width, headerHeight);
  ctx.strokeStyle = '#15191C';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, width, height);
  ctx.beginPath();
  ctx.moveTo(x, y + headerHeight);
  ctx.lineTo(x + width, y + headerHeight);
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${fontSize}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.label, x + width / 2, y + headerHeight / 2, width - 16);

  ctx.fillStyle = '#15191C';
  ctx.textAlign = 'left';
  ctx.font = 'bold 11px ui-monospace, monospace';
  const rows = node.fields || [];
  const maxRows = Math.floor((height - headerHeight - 12) / 20);
  rows.slice(0, maxRows).forEach((field, index) => {
    const rowY = y + headerHeight + 17 + index * 20;
    const [fieldName, ...type] = field.split(' ');
    ctx.fillText(fieldName || '', x + 10, rowY, width * 0.55);
    ctx.fillStyle = '#65716B';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(type.join(' ').replace(/\b(pk|fk)\b/gi, '').trim(), x + width - 10, rowY, width * 0.4);
    ctx.fillStyle = '#15191C';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textAlign = 'left';
  });
};

const drawLabel = (ctx: CanvasRenderingContext2D, label: string, x: number, y: number, width: number, height: number, fontSize: number, align?: CanvasNode['textAlign']) => {
  ctx.fillStyle = '#15191C';
  ctx.font = `${fontSize}px ui-monospace, monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = align === 'left' ? 'left' : align === 'right' ? 'right' : 'center';
  const labelX = align === 'left' ? x + 10 : align === 'right' ? x + width - 10 : x + width / 2;
  ctx.fillText(label, labelX, y + height / 2, Math.max(width - 20, 10));
};

const roundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
};
