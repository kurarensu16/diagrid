import React, { useState, useMemo } from 'react';
import { Button } from '../ui/Button';
import { type Diagram, type CanvasNode, type CanvasEdge } from '../../services/mockDb';
import { adminService } from '../../services/adminService';
import {
  type FreehandDrawing,
  type ExportFormat,
  type ExportBackground,
  type ExportScale,
  type PdfPageSize,
  type PdfOrientation,
  calculateBoundingBox,
  generateStandaloneSvg,
  rasterizeSvgToPngBlob,
  exportDiagramToPdf,
  downloadBlob,
  copyPngBlobToClipboard
} from '../../utils/diagramExport';
import { diagramToMermaid } from '../../utils/codeToDiagram';
import {
  X,
  Download,
  Copy,
  Check,
  Image as ImageIcon,
  Code2,
  FileJson,
  Sparkles,
  Layers,
  Grid,
  FileCode,
  FileText
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagram: Diagram | null;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  drawings: FreehandDrawing[];
  edgePathGetter?: (edge: CanvasEdge) => string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  diagram,
  nodes,
  edges,
  drawings,
  edgePathGetter
}) => {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [scale, setScale] = useState<ExportScale>(2);
  const [background, setBackground] = useState<ExportBackground>('paper');
  const [includeGrid, setIncludeGrid] = useState(false);
  const [pdfPageSize, setPdfPageSize] = useState<PdfPageSize>('a4');
  const [pdfOrientation, setPdfOrientation] = useState<PdfOrientation>('auto');
  const [pdfIncludeTitleBlock, setPdfIncludeTitleBlock] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Compute bounding box
  const boundingBox = useMemo(() => {
    return calculateBoundingBox(nodes, drawings, 40);
  }, [nodes, drawings]);

  // Compute live SVG string
  const previewSvg = useMemo(() => {
    return generateStandaloneSvg(diagram, nodes, edges, drawings, {
      background,
      includeGrid,
      padding: 40,
      edgePathGetter
    });
  }, [diagram, nodes, edges, drawings, background, includeGrid, edgePathGetter]);

  // Compute live Mermaid code
  const mermaidCode = useMemo(() => {
    return diagramToMermaid(nodes, edges, 'LR');
  }, [nodes, edges]);

  if (!isOpen) return null;

  const exportWidth = Math.round(boundingBox.width * (format === 'png' ? scale : 1));
  const exportHeight = Math.round(boundingBox.height * (format === 'png' ? scale : 1));
  const cleanTitle = diagram?.title.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'diagram';

  // Handle Download
  const handleDownload = async () => {
    setIsProcessing(true);
    try {
      if (format === 'mermaid') {
        const blob = new Blob([mermaidCode], { type: 'text/plain;charset=utf-8' });
        downloadBlob(blob, `${cleanTitle}.mmd`);
      } else if (format === 'svg') {
        const blob = new Blob([previewSvg], { type: 'image/svg+xml;charset=utf-8' });
        downloadBlob(blob, `${cleanTitle}.svg`);
      } else if (format === 'png') {
        const blob = await rasterizeSvgToPngBlob(previewSvg, scale);
        downloadBlob(blob, `${cleanTitle}_${scale}x.png`);
      } else if (format === 'pdf') {
        const pdfBlob = await exportDiagramToPdf(previewSvg, diagram, {
          pageSize: pdfPageSize,
          orientation: pdfOrientation,
          includeTitleBlock: pdfIncludeTitleBlock,
          scale
        });
        downloadBlob(pdfBlob, `${cleanTitle}.pdf`);
      } else if (format === 'json') {
        const exportData = {
          schema: 'diagrid_v1',
          diagram,
          nodes,
          edges,
          drawings,
          exportedAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `${cleanTitle}.diagrid.json`);
      }

      // Record export audit trail event
      adminService.logActivity('exported_diagram', `${cleanTitle} (${format.toUpperCase()})`);

      onClose();
    } catch (err) {
      console.error('Export download error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Copy to Clipboard
  const handleCopyClipboard = async () => {
    setIsProcessing(true);
    try {
      if (format === 'mermaid') {
        await navigator.clipboard.writeText(mermaidCode);
        setCopiedSuccess(true);
        setTimeout(() => setCopiedSuccess(false), 2500);
      } else if (format === 'png') {
        const blob = await rasterizeSvgToPngBlob(previewSvg, scale);
        const success = await copyPngBlobToClipboard(blob);
        if (success) {
          setCopiedSuccess(true);
          setTimeout(() => setCopiedSuccess(false), 2500);
        }
      } else if (format === 'svg') {
        await navigator.clipboard.writeText(previewSvg);
        setCopiedSuccess(true);
        setTimeout(() => setCopiedSuccess(false), 2500);
      } else if (format === 'json') {
        const exportData = {
          schema: 'diagrid_v1',
          diagram,
          nodes,
          edges,
          drawings,
          exportedAt: new Date().toISOString()
        };
        await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
        setCopiedSuccess(true);
        setTimeout(() => setCopiedSuccess(false), 2500);
      }
    } catch (err) {
      console.error('Copy to clipboard error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 sm:p-6 z-50 backdrop-blur-sm">
      <div className="w-full max-w-5xl bg-paper border-2 border-ink shadow-hard-blueprint flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="h-14 border-b-2 border-ink bg-ink text-paper px-6 flex items-center justify-between font-mono select-none">
          <div className="flex items-center gap-3">
            <span className="text-blueprint border border-blueprint px-2 py-0.5 text-[10px] uppercase font-bold bg-paper">
              Export Suite
            </span>
            <span className="font-bold text-white text-[15px]">
              Export Diagram
            </span>
            <span className="text-[#A6B2AD] text-[12px] hidden sm:inline">
              // {diagram?.title}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 border border-[#2D363C] text-paper hover:bg-paper hover:text-ink transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Split Layout */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left / Center: Live Interactive Graphic Preview or Mermaid Code Preview */}
          <div className="flex-1 p-6 bg-paper-raised flex flex-col justify-between overflow-hidden border-b-2 lg:border-b-0 lg:border-r-2 border-ink">
            <div className="flex justify-between items-center mb-3 font-mono text-[11px] text-ink-soft">
              <span className="flex items-center gap-1.5 font-bold text-ink">
                <Sparkles className="w-3.5 h-3.5 text-blueprint" />
                {format === 'mermaid' ? 'Live Mermaid Code Preview' : 'Live Output Preview'}
              </span>
              <span className="border border-line bg-paper px-2 py-0.5 text-[10.5px]">
                {format === 'mermaid' 
                  ? `${nodes.length} nodes • ${edges.length} edges` 
                  : `${exportWidth} × ${exportHeight} px • ${format.toUpperCase()}`}
              </span>
            </div>

            {/* Graphic or Code Preview Container */}
            {format === 'mermaid' ? (
              <div className="flex-1 min-h-[260px] sm:min-h-[340px] border-2 border-ink bg-[#101417] text-[#E2E8F0] p-4 font-mono text-[11.5px] leading-relaxed overflow-auto select-text">
                <pre className="whitespace-pre font-mono">{mermaidCode}</pre>
              </div>
            ) : (
              <div className="flex-1 min-h-[260px] sm:min-h-[340px] border-2 border-ink relative overflow-hidden flex items-center justify-center bg-[#ECEEEB]">
                {/* Transparency checkerboard */}
                <div 
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: `linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)`,
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
                  }}
                />

                {/* Render Live SVG Output */}
                <div 
                  className="relative z-10 w-full h-full p-4 flex items-center justify-center select-none"
                  dangerouslySetInnerHTML={{ __html: previewSvg }}
                />
              </div>
            )}

            {/* Footnote information */}
            <div className="mt-3 flex justify-between items-center font-mono text-[11px] text-ink-soft">
              <span>Nodes: {nodes.length} • Connectors: {edges.length}</span>
              <span className="text-[#525E65]">
                {format === 'mermaid' 
                  ? 'Mermaid v10+ compliant flowchart markup' 
                  : format === 'pdf' 
                    ? `Vector PDF (${pdfPageSize.toUpperCase()} ${pdfOrientation}) with title block`
                    : 'Exact bounding box auto-cropped with 40px margin'}
              </span>
            </div>
          </div>

          {/* Right Column: Export Configuration Controls */}
          <div className="w-full lg:w-[360px] p-6 bg-paper flex flex-col justify-between overflow-y-auto gap-6 shrink-0">
            <div className="flex flex-col gap-5">
              {/* Option 1: Format Selector */}
              <div className="flex flex-col gap-2">
                <label className="font-mono text-[11px] text-ink font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blueprint" />
                  Format
                </label>
                <div className="grid grid-cols-5 border-2 border-ink font-mono text-[11px] text-center bg-paper-raised">
                  {([
                    { id: 'png', label: 'PNG', icon: ImageIcon },
                    { id: 'svg', label: 'SVG', icon: Code2 },
                    { id: 'pdf', label: 'PDF', icon: FileText },
                    { id: 'mermaid', label: 'Mermaid', icon: FileCode },
                    { id: 'json', label: 'JSON', icon: FileJson }
                  ] as const).map((fmt) => {
                    const Icon = fmt.icon;
                    const isActive = format === fmt.id;
                    return (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setFormat(fmt.id)}
                        className={`py-2 px-0.5 border-r last:border-r-0 border-ink flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                          isActive ? 'bg-ink text-paper font-bold' : 'text-ink-soft hover:bg-paper'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="text-[9.5px] truncate">{fmt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Option: PDF Specific Configuration */}
              {format === 'pdf' && (
                <div className="flex flex-col gap-3">
                  {/* PDF Page Format */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[11px] text-ink font-bold uppercase tracking-wider">
                      Page Size
                    </label>
                    <div className="grid grid-cols-3 border-2 border-ink font-mono text-[11px] text-center bg-paper-raised">
                      {([
                        { id: 'a4' as PdfPageSize, label: 'A4', sub: 'Standard' },
                        { id: 'letter' as PdfPageSize, label: 'Letter', sub: 'US Letter' },
                        { id: 'fit' as PdfPageSize, label: 'Fit Canvas', sub: 'Single Page' }
                      ]).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setPdfPageSize(item.id)}
                          className={`py-2 border-r last:border-r-0 border-ink flex flex-col items-center justify-center transition-colors cursor-pointer ${
                            pdfPageSize === item.id ? 'bg-ink text-paper font-bold' : 'text-ink-soft hover:bg-paper'
                          }`}
                        >
                          <span className="text-[11px]">{item.label}</span>
                          <span className="text-[8.5px] opacity-75">{item.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* PDF Orientation */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[11px] text-ink font-bold uppercase tracking-wider">
                      Orientation
                    </label>
                    <div className="grid grid-cols-3 border-2 border-ink font-mono text-[11px] text-center bg-paper-raised">
                      {([
                        { id: 'auto' as PdfOrientation, label: 'Auto' },
                        { id: 'landscape' as PdfOrientation, label: 'Landscape' },
                        { id: 'portrait' as PdfOrientation, label: 'Portrait' }
                      ]).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setPdfOrientation(item.id)}
                          className={`py-1.5 border-r last:border-r-0 border-ink transition-colors cursor-pointer ${
                            pdfOrientation === item.id ? 'bg-ink text-paper font-bold' : 'text-ink-soft hover:bg-paper'
                          }`}
                        >
                          <span className="text-[11px]">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title Block Switch */}
                  <div className="border-t border-line pt-2 flex items-center justify-between font-mono text-[11px]">
                    <span className="text-ink font-bold">Blueprint Title Block</span>
                    <button
                      type="button"
                      onClick={() => setPdfIncludeTitleBlock(!pdfIncludeTitleBlock)}
                      className={`px-2.5 py-0.5 border border-ink font-bold text-[10px] transition-colors cursor-pointer ${
                        pdfIncludeTitleBlock ? 'bg-blueprint text-paper' : 'bg-paper text-ink-soft'
                      }`}
                    >
                      {pdfIncludeTitleBlock ? 'Included' : 'None'}
                    </button>
                  </div>
                </div>
              )}

              {/* Option 2: Resolution Scale (PNG only) */}
              {format === 'png' && (
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[11px] text-ink font-bold uppercase tracking-wider">
                    Resolution Scale
                  </label>
                  <div className="grid grid-cols-3 border-2 border-ink font-mono text-[12px] text-center bg-paper-raised">
                    {([
                      { s: 1 as ExportScale, label: '1x', sub: 'Standard' },
                      { s: 2 as ExportScale, label: '2x', sub: 'Retina HD' },
                      { s: 3 as ExportScale, label: '3x', sub: 'Print 300DPI' }
                    ]).map((item) => (
                      <button
                        key={item.s}
                        type="button"
                        onClick={() => setScale(item.s)}
                        className={`py-2 border-r last:border-r-0 border-ink flex flex-col items-center justify-center transition-colors cursor-pointer ${
                          scale === item.s ? 'bg-ink text-paper font-bold' : 'text-ink-soft hover:bg-paper'
                        }`}
                      >
                        <span className="text-[12px]">{item.label}</span>
                        <span className="text-[9px] opacity-75">{item.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Option 3: Background Theme (PNG, SVG, PDF) */}
              {(format === 'png' || format === 'svg' || format === 'pdf') && (
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[11px] text-ink font-bold uppercase tracking-wider">
                    Background Theme
                  </label>
                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                    {([
                      { id: 'paper' as ExportBackground, label: 'Paper Blueprint', color: '#F6F7F5' },
                      { id: 'transparent' as ExportBackground, label: 'Transparent', color: 'transparent' },
                      { id: 'dark' as ExportBackground, label: 'Dark Terminal', color: '#15191C' },
                      { id: 'white' as ExportBackground, label: 'Pure White', color: '#FFFFFF' }
                    ]).map((theme) => {
                      const isSelected = background === theme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => setBackground(theme.id)}
                          className={`border-2 border-ink p-2 flex items-center gap-2 text-left transition-colors cursor-pointer ${
                            isSelected ? 'bg-ink text-paper font-bold shadow-sm' : 'bg-paper-raised text-ink hover:bg-paper'
                          }`}
                        >
                          <div 
                            className="w-3.5 h-3.5 border border-ink shrink-0" 
                            style={{ 
                              backgroundColor: theme.color === 'transparent' ? '#FFF' : theme.color,
                              backgroundImage: theme.color === 'transparent' ? 'linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%)' : undefined,
                              backgroundSize: '4px 4px'
                            }} 
                          />
                          <span className="truncate">{theme.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Option 4: Technical Blueprint Grid (PNG, SVG, PDF) */}
              {(format === 'png' || format === 'svg' || format === 'pdf') && (
                <div className="border-t-2 border-ink pt-3 flex items-center justify-between font-mono text-[11px]">
                  <span className="text-ink font-bold flex items-center gap-1.5">
                    <Grid className="w-3.5 h-3.5 text-blueprint" />
                    Blueprint Grid Pattern
                  </span>
                  <button
                    type="button"
                    onClick={() => setIncludeGrid(!includeGrid)}
                    className={`px-3 py-1 border-2 border-ink font-bold transition-colors cursor-pointer uppercase text-[10px] ${
                      includeGrid ? 'bg-blueprint text-paper' : 'bg-paper text-ink-soft hover:bg-paper-raised'
                    }`}
                  >
                    {includeGrid ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              )}

              {/* Mermaid details notice */}
              {format === 'mermaid' && (
                <div className="p-3 border border-blueprint bg-blueprint/10 text-blueprint font-mono text-[11px] leading-relaxed">
                  <div className="font-bold mb-1">Mermaid Export</div>
                  <div>Directly export or copy clean, valid Mermaid code representation of your canvas diagram.</div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-4 border-t-2 border-ink font-mono">
              <Button
                variant="primary"
                onClick={handleDownload}
                disabled={isProcessing}
                className="w-full py-3 text-[13px] font-bold flex items-center justify-center gap-2 shadow-hard-ink"
              >
                <Download className="w-4 h-4" />
                <span>
                  Download {format === 'mermaid' ? 'Mermaid (.mmd)' : format === 'pdf' ? `PDF (${pdfPageSize.toUpperCase()})` : `${format.toUpperCase()} ${format === 'png' ? `(${scale}x)` : ''}`}
                </span>
              </Button>

              {format !== 'pdf' && (
                <Button
                  variant="secondary"
                  onClick={handleCopyClipboard}
                  disabled={isProcessing}
                  className="w-full py-2.5 text-[12px] flex items-center justify-center gap-2"
                >
                  {copiedSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-blueprint" />
                      <span className="font-bold text-blueprint">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy to Clipboard</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


