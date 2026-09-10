import { type CanvasNode, type CanvasEdge, type Diagram } from '../services/mockDb';
import { jsPDF } from 'jspdf';

export interface FreehandDrawing {
  id: string;
  path: string;
  color?: string;
  width?: number;
  opacity?: number;
  tool?: 'pen' | 'highlighter';
}

export type ExportFormat = 'png' | 'svg' | 'pdf' | 'json' | 'mermaid';
export type ExportBackground = 'paper' | 'dark' | 'transparent' | 'white';
export type ExportScale = 1 | 2 | 3;
export type PdfPageSize = 'a4' | 'letter' | 'fit';
export type PdfOrientation = 'landscape' | 'portrait' | 'auto';

export interface ExportOptions {
  format: ExportFormat;
  scale: ExportScale;
  background: ExportBackground;
  includeGrid: boolean;
  padding?: number;
  pdfPageSize?: PdfPageSize;
  pdfOrientation?: PdfOrientation;
  pdfIncludeTitleBlock?: boolean;
}

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

// Default dimensions per shape type
const getDefaultDimensions = (node: CanvasNode): { width: number; height: number } => {
  if (node.type === 'table') {
    const fieldCount = node.fields?.length || 0;
    return { width: 180, height: Math.max(48, 32 + fieldCount * 24) };
  }
  if (node.type === 'decision' || node.type === 'activity-decision') {
    return { width: 96, height: 96 };
  }
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
  if (node.type === 'activity-fork') return { width: 200, height: 8 };
  if (node.type === 'text') return { width: 140, height: 40 };
  return { width: 140, height: 48 };
};

// Get node dimensions matching Editor.tsx - honors custom resized dimensions
export const getNodeDimensions = (node: CanvasNode): { width: number; height: number } => {
  const defaults = getDefaultDimensions(node);
  if (node.type === 'table') {
    const fieldCount = node.fields?.length || 0;
    const minRequiredHeight = 32 + fieldCount * 24;
    return {
      width: node.customWidth ?? defaults.width,
      height: Math.max(node.customHeight ?? 0, minRequiredHeight)
    };
  }
  return {
    width: node.customWidth ?? defaults.width,
    height: node.customHeight ?? defaults.height
  };
};

// Calculate tight bounding box containing all nodes and drawings
export const calculateBoundingBox = (
  nodes: CanvasNode[],
  drawings: FreehandDrawing[],
  padding = 40
): BoundingBox => {
  if (nodes.length === 0 && drawings.length === 0) {
    return { minX: 0, maxX: 600, minY: 0, maxY: 400, width: 600, height: 400 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  nodes.forEach((node) => {
    const { width, height } = getNodeDimensions(node);
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x + width + 8); // +8 for hard shadow
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y + height + 8);
  });

  // Check drawings
  drawings.forEach((draw) => {
    const coords = draw.path.match(/[-+]?\d*\.?\d+/g);
    if (coords) {
      for (let i = 0; i < coords.length; i += 2) {
        const x = parseFloat(coords[i]);
        const y = parseFloat(coords[i + 1]);
        if (!isNaN(x) && !isNaN(y)) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
  });

  const bWidth = Math.max(maxX - minX + padding * 2, 320);
  const bHeight = Math.max(maxY - minY + padding * 2, 240);

  return {
    minX: minX - padding,
    maxX: maxX + padding,
    minY: minY - padding,
    maxY: maxY + padding,
    width: bWidth,
    height: bHeight
  };
};

// Generate complete standalone SVG markup containing all shapes, lines, text & styling
export const generateStandaloneSvg = (
  diagram: Diagram | null,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  drawings: FreehandDrawing[],
  options: {
    background: ExportBackground;
    includeGrid: boolean;
    padding?: number;
    edgePathGetter?: (edge: CanvasEdge) => string;
    portCoordsGetter?: (node: CanvasNode, port: 'top' | 'bottom' | 'left' | 'right') => { x: number; y: number };
  }
): string => {
  const box = calculateBoundingBox(nodes, drawings, options.padding || 40);

  // Background styling
  let bgColor = '#F6F7F5'; // paper default
  let isDark = false;

  if (options.background === 'dark') {
    bgColor = '#15191C';
    isDark = true;
  } else if (options.background === 'white') {
    bgColor = '#FFFFFF';
  } else if (options.background === 'transparent') {
    bgColor = 'none';
  }

  const gridLineColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(21, 25, 28, 0.08)';

  // Build SVG nodes XML
  const nodesSvg = nodes.map((node) => {
    const { width, height } = getNodeDimensions(node);
    
    // Determine effective shadow color
    let shadowColor: string | null = null;
    if (node.shadowAccent !== 'none') {
      if (node.shadowAccent) {
        shadowColor = node.shadowAccent;
      } else {
        const colorVal = node.width || 1;
        shadowColor = colorVal === 1 ? '#1E5C8C' : colorVal === 2 ? '#D45B33' : '#15191C';
      }
    }

    // Determine fill color
    const effectiveFill = node.fillColor 
      ? (node.fillColor === 'transparent' ? 'none' : node.fillColor)
      : (isDark ? '#1C2226' : '#FFFFFF');

    // Determine border width & style
    const isNoBorder = node.borderStyle === 'none';
    const strokeWidth = isNoBorder ? 0 : (node.borderWidth || 2);
    const strokeDash = node.borderStyle === 'dashed' ? 'stroke-dasharray="6 4"' : node.borderStyle === 'dotted' ? 'stroke-dasharray="2 3"' : '';
    const strokeColor = isNoBorder ? 'none' : (isDark ? '#E1E5E3' : '#15191C');

    // Determine typography attributes
    const fontSize = node.customFontSize || (node.fontSize === 'sm' ? 10 : node.fontSize === 'lg' ? 15 : 12);
    const fontWeight = node.isBold === false ? 'normal' : 'bold';
    const textAnchor = node.textAlign === 'left' ? 'start' : node.textAlign === 'right' ? 'end' : 'middle';
    const textX = node.textAlign === 'left' ? 12 : node.textAlign === 'right' ? width - 12 : width / 2;

    if (node.type === 'text') {
      const hasBorder = !isNoBorder && node.borderStyle;
      return `
        <g id="${node.id}" transform="translate(${node.x}, ${node.y})">
          ${(effectiveFill !== 'none' || hasBorder) ? `<rect x="0" y="0" width="${width}" height="${height}" fill="${effectiveFill}" stroke="${hasBorder ? strokeColor : 'none'}" stroke-width="${strokeWidth}" ${strokeDash} />` : ''}
          <text x="${textX}" y="${height / 2 + 4}" fill="${isDark ? '#FFFFFF' : '#15191C'}" font-size="${fontSize}" font-family="'JetBrains Mono', monospace" font-weight="${fontWeight}" text-anchor="${textAnchor}">
            ${escapeXml(node.label)}
          </text>
        </g>
      `;
    }

    if (node.type === 'table') {
      const headerColor = (node.shadowAccent && node.shadowAccent !== 'none' && node.shadowAccent.startsWith('#'))
        ? node.shadowAccent
        : '#1E5C8C';
      const fields = node.fields || [];
      const rowHeight = 22;
      const fieldRows = fields.map((f, i) => {
        const parts = f.split(' ');
        const fieldName = parts[0] || '';
        const fieldType = parts.slice(1).join(' ') || '';
        const isPk = f.toLowerCase().includes('pk');
        const isFk = f.toLowerCase().includes('fk');
        const rawType = fieldType.replace(/\b(pk|fk)\b/gi, '').trim();
        const yPos = 46 + i * rowHeight;
        
        let badgeSvg = '';
        let rightOffset = 12;
        if (isPk) {
          badgeSvg = `<rect x="${width - 32}" y="${yPos - 10}" width="20" height="12" fill="#1E5C8C" rx="2" /><text x="${width - 22}" y="${yPos - 1}" fill="#FFFFFF" font-size="7.5" font-family="'JetBrains Mono', monospace" text-anchor="middle" font-weight="bold">PK</text>`;
          rightOffset = 36;
        } else if (isFk) {
          badgeSvg = `<rect x="${width - 32}" y="${yPos - 10}" width="20" height="12" fill="none" stroke="#1E5C8C" stroke-width="1" rx="2" /><text x="${width - 22}" y="${yPos - 1}" fill="#1E5C8C" font-size="7.5" font-family="'JetBrains Mono', monospace" text-anchor="middle" font-weight="bold">FK</text>`;
          rightOffset = 36;
        }

        return `
          <g>
            <!-- Field row separator line -->
            ${i > 0 ? `<line x1="8" y1="${yPos - 13}" x2="${width - 8}" y2="${yPos - 13}" stroke="${isDark ? '#333C42' : '#E1E5E3'}" stroke-dasharray="2 2" stroke-width="1" />` : ''}
            <!-- Field Name -->
            <text x="12" y="${yPos}" fill="${isDark ? '#FFFFFF' : '#15191C'}" font-size="11" font-family="'JetBrains Mono', monospace" font-weight="bold">
              ${escapeXml(fieldName)}
            </text>
            <!-- Field Type -->
            ${rawType ? `
            <text x="${width - rightOffset}" y="${yPos}" fill="${isDark ? '#9BA3A9' : '#5A666E'}" font-size="10" font-family="'JetBrains Mono', monospace" text-anchor="end">
              ${escapeXml(rawType)}
            </text>` : ''}
            <!-- Key Badge -->
            ${badgeSvg}
          </g>
        `;
      }).join('');

      return `
        <g id="${node.id}" transform="translate(${node.x}, ${node.y})">
          <!-- Hard offset shadow -->
          ${shadowColor ? `<rect x="4" y="4" width="${width}" height="${height}" fill="${shadowColor}" />` : ''}
          <!-- Outer border -->
          <rect x="0" y="0" width="${width}" height="${height}" fill="${effectiveFill}" stroke="#15191C" stroke-width="${strokeWidth}" ${strokeDash} />
          <!-- Header Bar -->
          <rect x="0" y="0" width="${width}" height="28" fill="${headerColor}" stroke="#15191C" stroke-width="${strokeWidth}" />
          <text x="${width / 2}" y="19" fill="#FFFFFF" font-size="${fontSize}" font-family="'JetBrains Mono', monospace" font-weight="bold" text-anchor="middle" letter-spacing="0.5">
            ${escapeXml(node.label.toUpperCase())}
          </text>
          ${fieldRows}
        </g>
      `;
    }

    if (node.type === 'decision' || node.type === 'activity-decision') {
      const cx = node.x + width / 2;
      const cy = node.y + height / 2;

      return `
        <g id="${node.id}">
          <!-- Draw.io style Unrotated Polygon Diamond Hard Shadow -->
          ${shadowColor ? `
          <polygon
            points="${cx + 3},${node.y + 3} ${node.x + width + 3},${cy + 3} ${cx + 3},${node.y + height + 3} ${node.x + 3},${cy + 3}"
            fill="${shadowColor}"
          />` : ''}
          <!-- Draw.io style Diamond Body -->
          <polygon
            points="${cx},${node.y} ${node.x + width},${cy} ${cx},${node.y + height} ${node.x},${cy}"
            fill="${effectiveFill}"
            stroke="#15191C"
            stroke-width="${strokeWidth}"
            ${strokeDash}
          />
          <!-- Upright Centered Label Text -->
          <text x="${cx}" y="${cy + 4}" fill="${isDark ? '#FFFFFF' : '#15191C'}" font-size="${fontSize}" font-family="'JetBrains Mono', monospace" font-weight="${fontWeight}" text-anchor="middle">
            ${escapeXml(node.label)}
          </text>
        </g>
      `;
    }

    if (node.type === 'terminal') {
      return `
        <g id="${node.id}" transform="translate(${node.x}, ${node.y})">
          ${shadowColor ? `<rect x="4" y="4" width="${width}" height="${height}" rx="${height / 2}" fill="${shadowColor}" />` : ''}
          <rect x="0" y="0" width="${width}" height="${height}" rx="${height / 2}" fill="${effectiveFill}" stroke="#15191C" stroke-width="${strokeWidth}" ${strokeDash} />
          <text x="${textX}" y="${height / 2 + 4}" fill="${isDark ? '#FFFFFF' : '#15191C'}" font-size="${fontSize}" font-family="'JetBrains Mono', monospace" font-weight="${fontWeight}" text-anchor="${textAnchor}">
            ${escapeXml(node.label)}
          </text>
        </g>
      `;
    }

    if (node.type === 'activity-start') {
      const r = width / 2;
      return `
        <g id="${node.id}" transform="translate(${node.x}, ${node.y})">
          <circle cx="${r}" cy="${r}" r="${r - 2}" fill="${isDark ? '#E1E5E3' : '#15191C'}" />
        </g>
      `;
    }

    if (node.type === 'activity-end') {
      const r = width / 2;
      return `
        <g id="${node.id}" transform="translate(${node.x}, ${node.y})">
          <circle cx="${r}" cy="${r}" r="${r - 2}" fill="${effectiveFill === 'none' ? (isDark ? '#1C2226' : '#FFFFFF') : effectiveFill}" stroke="${isDark ? '#E1E5E3' : '#15191C'}" stroke-width="${strokeWidth}" />
          <circle cx="${r}" cy="${r}" r="${r - 6}" fill="${isDark ? '#E1E5E3' : '#15191C'}" />
        </g>
      `;
    }

    if (node.type === 'activity-fork') {
      return `
        <g id="${node.id}" transform="translate(${node.x}, ${node.y})">
          <rect x="0" y="0" width="${width}" height="${height}" fill="${isDark ? '#E1E5E3' : '#15191C'}" rx="1" />
        </g>
      `;
    }

    if (node.type === 'activity-action') {
      return `
        <g id="${node.id}" transform="translate(${node.x}, ${node.y})">
          ${shadowColor ? `<rect x="4" y="4" width="${width}" height="${height}" rx="12" fill="${shadowColor}" />` : ''}
          <rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="${effectiveFill}" stroke="${isDark ? '#E1E5E3' : '#15191C'}" stroke-width="${strokeWidth}" ${strokeDash} />
          <text x="${textX}" y="${height / 2 + 4}" fill="${isDark ? '#FFFFFF' : '#15191C'}" font-size="${fontSize}" font-family="'JetBrains Mono', monospace" font-weight="${fontWeight}" text-anchor="${textAnchor}">
            ${escapeXml(node.label)}
          </text>
        </g>
      `;
    }

    if (node.type === 'sequence-activation') {
      return `
        <g id="${node.id}" transform="translate(${node.x}, ${node.y})">
          <rect x="0" y="0" width="${width}" height="${height}" fill="${isDark ? '#1C2226' : '#FFFFFF'}" stroke="${isDark ? '#E1E5E3' : '#15191C'}" stroke-width="1.5" />
        </g>
      `;
    }

    if (node.type === 'dfd-process') {
      const splitIdx = node.label.indexOf(' ');
      const processId = splitIdx !== -1 ? node.label.substring(0, splitIdx) : '1.0';
      const processName = splitIdx !== -1 ? node.label.substring(splitIdx + 1) : node.label;

      return `
        <g id="${node.id}" transform="translate(${node.x}, ${node.y})">
          ${shadowColor ? `<rect x="4" y="4" width="${width}" height="${height}" rx="8" fill="${shadowColor}" />` : ''}
          <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="${effectiveFill}" stroke="${isDark ? '#E1E5E3' : '#15191C'}" stroke-width="${strokeWidth}" ${strokeDash} />
          <line x1="0" y1="20" x2="${width}" y2="20" stroke="${isDark ? '#E1E5E3' : '#15191C'}" stroke-width="1.2" />
          <text x="${width / 2}" y="14" fill="${isDark ? '#9BA3A9' : '#5A666E'}" font-size="9" font-family="'JetBrains Mono', monospace" font-weight="bold" text-anchor="middle">
            ${escapeXml(processId)}
          </text>
          <text x="${width / 2}" y="${height / 2 + 10}" fill="${isDark ? '#FFFFFF' : '#15191C'}" font-size="${fontSize}" font-family="'JetBrains Mono', monospace" font-weight="${fontWeight}" text-anchor="middle">
            ${escapeXml(processName)}
          </text>
        </g>
      `;
    }

    if (node.type === 'dfd-store') {
      return `
        <g id="${node.id}" transform="translate(${node.x}, ${node.y})">
          ${shadowColor ? `<rect x="4" y="4" width="${width}" height="${height}" fill="${shadowColor}" />` : ''}
          <rect x="0" y="0" width="${width}" height="${height}" fill="${effectiveFill}" />
          <line x1="0" y1="0" x2="${width}" y2="0" stroke="${isDark ? '#E1E5E3' : '#15191C'}" stroke-width="${strokeWidth}" ${strokeDash} />
          <line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="${isDark ? '#E1E5E3' : '#15191C'}" stroke-width="${strokeWidth}" ${strokeDash} />
          <text x="${textX}" y="${height / 2 + 4}" fill="${isDark ? '#FFFFFF' : '#15191C'}" font-size="${fontSize}" font-family="'JetBrains Mono', monospace" font-weight="${fontWeight}" text-anchor="${textAnchor}">
            [D] ${escapeXml(node.label)}
          </text>
        </g>
      `;
    }

    if (node.type === 'dfd-entity') {
      return `
        <g id="${node.id}" transform="translate(${node.x}, ${node.y})">
          ${shadowColor ? `<rect x="4" y="4" width="${width}" height="${height}" fill="${shadowColor}" />` : ''}
          <rect x="0" y="0" width="${width}" height="${height}" fill="${effectiveFill}" stroke="${isDark ? '#E1E5E3' : '#15191C'}" stroke-width="${strokeWidth}" ${strokeDash} />
          <rect x="3" y="3" width="${width - 6}" height="${height - 6}" fill="none" stroke="${isDark ? '#E1E5E3' : '#15191C'}" stroke-width="1" />
          <text x="${textX}" y="${height / 2 + 4}" fill="${isDark ? '#FFFFFF' : '#15191C'}" font-size="${fontSize}" font-family="'JetBrains Mono', monospace" font-weight="${fontWeight}" text-anchor="${textAnchor}">
            ${escapeXml(node.label)}
          </text>
        </g>
      `;
    }

    if (node.type === 'usecase-actor') {
      return `
        <g id="${node.id}" transform="translate(${node.x}, ${node.y})">
          <circle cx="${width / 2}" cy="16" r="10" fill="${effectiveFill === 'none' ? '#FFFFFF' : effectiveFill}" stroke="#15191C" stroke-width="2" />
          <line x1="${width / 2}" y1="26" x2="${width / 2}" y2="52" stroke="#15191C" stroke-width="2" />
          <line x1="12" y1="36" x2="${width - 12}" y2="36" stroke="#15191C" stroke-width="2" />
          <line x1="${width / 2}" y1="52" x2="16" y2="72" stroke="#15191C" stroke-width="2" />
          <line x1="${width / 2}" y1="52" x2="${width - 16}" y2="72" stroke="#15191C" stroke-width="2" />
          <text x="${width / 2}" y="85" fill="${isDark ? '#FFFFFF' : '#15191C'}" font-size="10" font-family="'JetBrains Mono', monospace" font-weight="${fontWeight}" text-anchor="middle">
            ${escapeXml(node.label)}
          </text>
        </g>
      `;
    }

    if (node.type === 'usecase-oval') {
      return `
        <g id="${node.id}" transform="translate(${node.x}, ${node.y})">
          ${shadowColor ? `<ellipse cx="${width / 2 + 4}" cy="${height / 2 + 4}" rx="${width / 2}" ry="${height / 2}" fill="${shadowColor}" />` : ''}
          <ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}" fill="${effectiveFill}" stroke="#15191C" stroke-width="${strokeWidth}" ${strokeDash} />
          <text x="${textX}" y="${height / 2 + 4}" fill="${isDark ? '#FFFFFF' : '#15191C'}" font-size="${fontSize}" font-family="'JetBrains Mono', monospace" font-weight="${fontWeight}" text-anchor="${textAnchor}">
            ${escapeXml(node.label)}
          </text>
        </g>
      `;
    }

    if (node.type === 'usecase-boundary') {
      return `
        <g id="${node.id}" transform="translate(${node.x}, ${node.y})">
          <rect x="0" y="0" width="${width}" height="${height}" fill="${effectiveFill === 'none' ? 'none' : effectiveFill}" stroke="#1E5C8C" stroke-width="${strokeWidth}" ${strokeDash || 'stroke-dasharray="6 4"'} />
          <rect x="10" y="-12" width="${node.label.length * 8 + 24}" height="22" fill="${bgColor === 'none' ? '#FFFFFF' : bgColor}" stroke="#1E5C8C" stroke-width="1.5" />
          <text x="22" y="4" fill="#1E5C8C" font-size="11" font-family="'JetBrains Mono', monospace" font-weight="bold">
            [System] ${escapeXml(node.label)}
          </text>
        </g>
      `;
    }

    // Default Process Box
    return `
      <g id="${node.id}" transform="translate(${node.x}, ${node.y})">
        <!-- Hard Shadow -->
        ${shadowColor ? `<rect x="4" y="4" width="${width}" height="${height}" fill="${shadowColor}" />` : ''}
        <!-- Outer Box -->
        <rect x="0" y="0" width="${width}" height="${height}" fill="${effectiveFill}" stroke="#15191C" stroke-width="${strokeWidth}" ${strokeDash} />
        <text x="${textX}" y="${height / 2 + 4}" fill="${isDark ? '#FFFFFF' : '#15191C'}" font-size="${fontSize}" font-family="'JetBrains Mono', monospace" font-weight="${fontWeight}" text-anchor="${textAnchor}">
          ${escapeXml(node.label)}
        </text>
      </g>
    `;
  }).join('\n');

  // Build SVG Edges XML
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const edgesSvg = edges.map((edge) => {
    const srcNode = nodeMap.get(edge.source);
    const tgtNode = nodeMap.get(edge.target);
    if (!srcNode || !tgtNode) return '';

    let path = '';
    if (options.edgePathGetter) {
      path = options.edgePathGetter(edge);
    } else {
      // Fallback simple path
      const srcDim = getNodeDimensions(srcNode);
      const tgtDim = getNodeDimensions(tgtNode);
      const startX = srcNode.x + srcDim.width / 2;
      const startY = srcNode.y + srcDim.height;
      const endX = tgtNode.x + tgtDim.width / 2;
      const endY = tgtNode.y;
      const midY = (startY + endY) / 2;
      path = `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
    }

    // Edge Label
    let labelSvg = '';
    if (edge.label) {
      const srcDim = getNodeDimensions(srcNode);
      const tgtDim = getNodeDimensions(tgtNode);
      const labelX = Math.round((srcNode.x + srcDim.width / 2 + tgtNode.x + tgtDim.width / 2) / 2);
      const labelY = Math.round((srcNode.y + srcDim.height / 2 + tgtNode.y + tgtDim.height / 2) / 2);
      const badgeWidth = edge.label.length * 7 + 16;

      labelSvg = `
        <g transform="translate(${labelX}, ${labelY})">
          <rect x="${-badgeWidth / 2}" y="-10" width="${badgeWidth}" height="20" fill="#FFFFFF" stroke="#15191C" stroke-width="1.5" rx="3" />
          <text x="0" y="4" fill="#15191C" font-size="10" font-family="'JetBrains Mono', monospace" font-weight="bold" text-anchor="middle">
            ${escapeXml(edge.label)}
          </text>
        </g>
      `;
    }

    const getExportMarkerUrl = (
      markerType: CanvasEdge['sourceMarker'],
      fallbackArrow: CanvasEdge['arrow'],
      isStart: boolean
    ): string => {
      if (markerType) {
        if (markerType === 'none') return '';
        if (markerType === 'arrow') return 'url(#arrow)';
        return `url(#crows-${markerType})`;
      }
      if (fallbackArrow === 'both') return 'url(#arrow)';
      if (fallbackArrow === 'none') return '';
      if (isStart) return '';
      return 'url(#arrow)';
    };

    const markerStart = getExportMarkerUrl(edge.sourceMarker, edge.arrow, true);
    const markerEnd = getExportMarkerUrl(edge.targetMarker, edge.arrow, false);

    return `
      <g id="${edge.id}">
        <path
          d="${path}"
          fill="none"
          stroke="${isDark ? '#E1E5E3' : '#15191C'}"
          stroke-width="2"
          ${edge.style === 'dashed' ? 'stroke-dasharray="5 4"' : ''}
          ${markerEnd ? `marker-end="${markerEnd}"` : ''}
          ${markerStart ? `marker-start="${markerStart}"` : ''}
        />
        ${labelSvg}
      </g>
    `;
  }).join('\n');

  // Build Freehand Drawings XML
  const drawingsSvg = drawings.map((d) => `
    <path
      d="${d.path}"
      fill="none"
      stroke="${d.color || '#D45B33'}"
      stroke-width="${d.width || 2}"
      stroke-opacity="${d.opacity ?? 1}"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `).join('\n');

  // Title Watermark
  const titleWatermark = diagram ? `
    <g transform="translate(${box.minX + 24}, ${box.maxY - 16})">
      <text fill="${isDark ? '#6B7A82' : '#8A9992'}" font-size="11" font-family="'JetBrains Mono', monospace" font-weight="bold">
        diagrid // ${escapeXml(diagram.title)} • ${diagram.type.toUpperCase()}
      </text>
    </g>
  ` : '';

  const markerStroke = isDark ? '#E1E5E3' : '#15191C';
  const markerCircleFill = isDark ? '#1C2226' : '#FFFFFF';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg 
  xmlns="http://www.w3.org/2000/svg" 
  viewBox="${box.minX} ${box.minY} ${box.width} ${box.height}"
  width="${box.width}"
  height="${box.height}"
  style="background-color: ${bgColor === 'none' ? 'transparent' : bgColor}; display: block;"
>
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="${markerStroke}" />
    </marker>
    <marker id="crows-one" viewBox="0 0 16 16" refX="16" refY="8" markerWidth="16" markerHeight="16" orient="auto-start-reverse">
      <line x1="0" y1="8" x2="16" y2="8" stroke="${markerStroke}" stroke-width="1.5" />
      <line x1="12" y1="2" x2="12" y2="14" stroke="${markerStroke}" stroke-width="1.5" stroke-linecap="round" />
    </marker>
    <marker id="crows-one-only" viewBox="0 0 16 16" refX="16" refY="8" markerWidth="16" markerHeight="16" orient="auto-start-reverse">
      <line x1="0" y1="8" x2="16" y2="8" stroke="${markerStroke}" stroke-width="1.5" />
      <line x1="7" y1="2" x2="7" y2="14" stroke="${markerStroke}" stroke-width="1.5" stroke-linecap="round" />
      <line x1="12" y1="2" x2="12" y2="14" stroke="${markerStroke}" stroke-width="1.5" stroke-linecap="round" />
    </marker>
    <marker id="crows-zero-one" viewBox="0 0 16 16" refX="16" refY="8" markerWidth="16" markerHeight="16" orient="auto-start-reverse">
      <line x1="0" y1="8" x2="16" y2="8" stroke="${markerStroke}" stroke-width="1.5" />
      <circle cx="10" cy="8" r="3.75" fill="${markerCircleFill}" stroke="${markerStroke}" stroke-width="1.5" />
    </marker>
    <marker id="crows-many" viewBox="0 0 16 16" refX="16" refY="8" markerWidth="16" markerHeight="16" orient="auto-start-reverse">
      <line x1="0" y1="8" x2="16" y2="8" stroke="${markerStroke}" stroke-width="1.5" />
      <line x1="5" y1="8" x2="15.5" y2="2" stroke="${markerStroke}" stroke-width="1.5" stroke-linecap="round" />
      <line x1="5" y1="8" x2="15.5" y2="14" stroke="${markerStroke}" stroke-width="1.5" stroke-linecap="round" />
    </marker>
    <marker id="crows-one-many" viewBox="0 0 16 16" refX="16" refY="8" markerWidth="16" markerHeight="16" orient="auto-start-reverse">
      <line x1="0" y1="8" x2="16" y2="8" stroke="${markerStroke}" stroke-width="1.5" />
      <line x1="4" y1="2" x2="4" y2="14" stroke="${markerStroke}" stroke-width="1.5" stroke-linecap="round" />
      <line x1="5" y1="8" x2="15.5" y2="2" stroke="${markerStroke}" stroke-width="1.5" stroke-linecap="round" />
      <line x1="5" y1="8" x2="15.5" y2="14" stroke="${markerStroke}" stroke-width="1.5" stroke-linecap="round" />
    </marker>
    <marker id="crows-zero-many" viewBox="0 0 16 16" refX="16" refY="8" markerWidth="16" markerHeight="16" orient="auto-start-reverse">
      <line x1="0" y1="8" x2="16" y2="8" stroke="${markerStroke}" stroke-width="1.5" />
      <circle cx="4" cy="8" r="3" fill="${markerCircleFill}" stroke="${markerStroke}" stroke-width="1.5" />
      <line x1="7" y1="8" x2="15.5" y2="2" stroke="${markerStroke}" stroke-width="1.5" stroke-linecap="round" />
      <line x1="7" y1="8" x2="15.5" y2="14" stroke="${markerStroke}" stroke-width="1.5" stroke-linecap="round" />
    </marker>
    ${options.includeGrid ? `
    <pattern id="blueprint-grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="${gridLineColor}" stroke-width="1"/>
    </pattern>
    ` : ''}
  </defs>

  ${bgColor !== 'none' ? `
  <!-- Canvas Background -->
  <rect x="${box.minX}" y="${box.minY}" width="${box.width}" height="${box.height}" fill="${bgColor}" />
  ` : ''}

  ${options.includeGrid ? `
  <!-- Grid Overlay -->
  <rect x="${box.minX}" y="${box.minY}" width="${box.width}" height="${box.height}" fill="url(#blueprint-grid)" />
  ` : ''}

  <!-- Connectors -->
  <g id="layer-connectors">
    ${edgesSvg}
  </g>

  <!-- Drawings -->
  <g id="layer-drawings">
    ${drawingsSvg}
  </g>

  <!-- Shapes -->
  <g id="layer-shapes">
    ${nodesSvg}
  </g>

  ${titleWatermark}
</svg>`;
};

// Rasterize SVG string to HTML5 Canvas & PNG Blob
export const rasterizeSvgToPngBlob = async (
  svgString: string,
  scale: ExportScale = 2
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // Parse SVG to get dimensions
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgEl = doc.documentElement;
    const width = parseFloat(svgEl.getAttribute('width') || '800');
    const height = parseFloat(svgEl.getAttribute('height') || '600');

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Could not get 2D canvas context'));
      return;
    }

    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas toBlob failed'));
        }
      }, 'image/png');
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
};

// Download helper
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Copy PNG Blob directly to system clipboard
export const copyPngBlobToClipboard = async (blob: Blob): Promise<boolean> => {
  try {
    if (!navigator.clipboard || !window.ClipboardItem) {
      return false;
    }
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob
      })
    ]);
    return true;
  } catch (err) {
    console.error('Failed to copy image to clipboard:', err);
    return false;
  }
};

// Export Diagram directly to a styled, high-resolution PDF document
export interface PdfExportConfig {
  pageSize?: PdfPageSize;
  orientation?: PdfOrientation;
  includeTitleBlock?: boolean;
  scale?: ExportScale;
}

export const exportDiagramToPdf = async (
  svgString: string,
  diagram: Diagram | null,
  config: PdfExportConfig = {}
): Promise<Blob> => {
  const pageSize = config.pageSize || 'a4';
  const requestedOrientation = config.orientation || 'auto';
  const includeTitleBlock = config.includeTitleBlock !== false;
  const scale = config.scale || 2;

  // 1. Parse SVG to get native canvas dimensions
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = doc.documentElement;
  const svgWidth = parseFloat(svgEl.getAttribute('width') || '800');
  const svgHeight = parseFloat(svgEl.getAttribute('height') || '600');

  // 2. Determine effective orientation
  const isLandscape = requestedOrientation === 'auto'
    ? svgWidth >= svgHeight
    : requestedOrientation === 'landscape';

  const effectiveOrientation: 'landscape' | 'portrait' = isLandscape ? 'landscape' : 'portrait';

  // 3. Determine Page Dimensions in mm
  let pageWidthMm = 297;
  let pageHeightMm = 210;

  if (pageSize === 'letter') {
    pageWidthMm = isLandscape ? 279.4 : 215.9;
    pageHeightMm = isLandscape ? 215.9 : 279.4;
  } else if (pageSize === 'a4') {
    pageWidthMm = isLandscape ? 297 : 210;
    pageHeightMm = isLandscape ? 210 : 297;
  } else if (pageSize === 'fit') {
    // Convert px to mm (1 px ≈ 0.264583 mm)
    const marginMm = 15;
    const extraBottomMm = includeTitleBlock ? 18 : 0;
    pageWidthMm = Math.max(svgWidth * 0.264583 + marginMm * 2, 100);
    pageHeightMm = Math.max(svgHeight * 0.264583 + marginMm * 2 + extraBottomMm, 80);
  }

  // 4. Create jsPDF document
  const pdf = new jsPDF({
    orientation: effectiveOrientation,
    unit: 'mm',
    format: pageSize === 'fit' ? [pageWidthMm, pageHeightMm] : pageSize
  });

  // 5. High-resolution canvas rasterization
  const pngBlob = await rasterizeSvgToPngBlob(svgString, scale);
  const pngDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(pngBlob);
  });

  // 6. Calculate printable region margins
  const marginMm = 12;
  const headerHeightMm = includeTitleBlock ? 12 : 0;
  const footerHeightMm = includeTitleBlock ? 10 : 0;

  const usableWidthMm = pageWidthMm - marginMm * 2;
  const usableHeightMm = pageHeightMm - marginMm * 2 - headerHeightMm - footerHeightMm;

  // Scale diagram image into usable region maintaining aspect ratio
  const diagramAspect = svgWidth / svgHeight;
  let imgWidthMm = usableWidthMm;
  let imgHeightMm = imgWidthMm / diagramAspect;

  if (imgHeightMm > usableHeightMm) {
    imgHeightMm = usableHeightMm;
    imgWidthMm = imgHeightMm * diagramAspect;
  }

  // Center horizontally and vertically within usable area
  const imgX = marginMm + (usableWidthMm - imgWidthMm) / 2;
  const imgY = marginMm + headerHeightMm + (usableHeightMm - imgHeightMm) / 2;

  // 7. Draw blueprint styling & Title Block if enabled
  if (includeTitleBlock) {
    // Top Header
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(21, 25, 28);
    const titleText = diagram?.title || 'System Diagram';
    pdf.text(titleText, marginMm, marginMm + 6);

    pdf.setFont('courier', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 110, 115);
    const typeLabel = diagram ? `// ${diagram.type.toUpperCase()} SPECIFICATION` : '// DIAGRAM SPECIFICATION';
    pdf.text(typeLabel, marginMm + pdf.getTextWidth(titleText) + 4, marginMm + 6);

    const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    pdf.text(generatedDate, pageWidthMm - marginMm, marginMm + 6, { align: 'right' });

    // Header divider rule
    pdf.setDrawColor(21, 25, 28);
    pdf.setLineWidth(0.35);
    pdf.line(marginMm, marginMm + 9, pageWidthMm - marginMm, marginMm + 9);

    // Bottom Footer
    const footerY = pageHeightMm - marginMm + 2;
    pdf.setDrawColor(200, 205, 208);
    pdf.setLineWidth(0.2);
    pdf.line(marginMm, footerY - 4, pageWidthMm - marginMm, footerY - 4);

    pdf.setFont('courier', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(120, 130, 135);
    pdf.text('diagrid // write the structure. get the diagram.', marginMm, footerY);
    pdf.text('Page 1 of 1', pageWidthMm - marginMm, footerY, { align: 'right' });
  }

  // 8. Embed rasterized diagram into PDF
  pdf.addImage(pngDataUrl, 'PNG', imgX, imgY, imgWidthMm, imgHeightMm, undefined, 'FAST');

  // 9. Return Blob
  return pdf.output('blob');
};

// XML special characters escaping
const escapeXml = (unsafe: string): string => {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};
