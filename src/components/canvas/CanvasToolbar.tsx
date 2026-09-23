import React from 'react';
import {
  MousePointer,
  Pencil,
  Hand,
  Undo,
  Redo,
  Grid,
  Magnet,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Highlighter,
  Eraser,
  Palette,
} from 'lucide-react';
import { PENCIL_COLOR_PRESETS, PENCIL_WIDTH_PRESETS } from '../../types/canvas';

export interface CanvasToolbarProps {
  activeMode: 'select' | 'mark' | 'draw' | 'pan';
  setActiveMode: (mode: 'select' | 'mark' | 'draw' | 'pan') => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  onClearSelection: () => void;
  // Zoom & Grid
  zoom: number;
  canvasGridStyle: 'lines' | 'dots' | 'blank';
  isSnapToGrid: boolean;
  onToggleGridStyle: () => void;
  onToggleSnap: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onResetZoom: () => void;
  // Pencil subtool dock
  pencilTool: 'pen' | 'highlighter' | 'eraser';
  setPencilTool: (tool: 'pen' | 'highlighter' | 'eraser') => void;
  pencilColor: string;
  setPencilColor: (color: string) => void;
  pencilWidth: number;
  setPencilWidth: (width: number) => void;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  activeMode,
  setActiveMode,
  canUndo,
  canRedo,
  undo,
  redo,
  onClearSelection,
  zoom,
  canvasGridStyle,
  isSnapToGrid,
  onToggleGridStyle,
  onToggleSnap,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onResetZoom,
  pencilTool,
  setPencilTool,
  pencilColor,
  setPencilColor,
  pencilWidth,
  setPencilWidth,
}) => {
  return (
    <>
      {/* Floating Pencil Subtool Dock when Draw Mode is active */}
      {activeMode === 'draw' && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-paper-raised border-2 border-ink shadow-hard-ink px-3 py-1.5 text-[12px] font-mono select-none">
          {/* Tool Mode: Pen, Highlighter, Eraser */}
          <div className="flex border border-ink bg-paper">
            <button
              type="button"
              onClick={() => setPencilTool('pen')}
              className={`px-2.5 py-1 flex items-center gap-1.5 transition-colors cursor-pointer ${
                pencilTool === 'pen'
                  ? 'bg-ink text-paper font-bold'
                  : 'text-ink-soft hover:text-ink'
              }`}
              title="Pen (Opaque Stroke)"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="text-[11px]">Pen</span>
            </button>
            <button
              type="button"
              onClick={() => setPencilTool('highlighter')}
              className={`px-2.5 py-1 border-l border-ink flex items-center gap-1.5 transition-colors cursor-pointer ${
                pencilTool === 'highlighter'
                  ? 'bg-ink text-paper font-bold'
                  : 'text-ink-soft hover:text-ink'
              }`}
              title="Highlighter (Translucent Stroke)"
            >
              <Highlighter className="w-3.5 h-3.5" />
              <span className="text-[11px]">Highlighter</span>
            </button>
            <button
              type="button"
              onClick={() => setPencilTool('eraser')}
              className={`px-2.5 py-1 border-l border-ink flex items-center gap-1.5 transition-colors cursor-pointer ${
                pencilTool === 'eraser'
                  ? 'bg-ink text-paper font-bold'
                  : 'text-ink-soft hover:text-ink'
              }`}
              title="Eraser (Click or drag over strokes to delete)"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span className="text-[11px]">Eraser</span>
            </button>
          </div>

          {/* Color Presets & Custom Picker */}
          {pencilTool !== 'eraser' && (
            <>
              <div className="w-[1.5px] h-5 bg-line" />
              <div className="flex items-center gap-1">
                {PENCIL_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setPencilColor(preset.value)}
                    className={`w-5 h-5 rounded-full border border-ink transition-transform cursor-pointer ${
                      pencilColor === preset.value
                        ? 'scale-125 ring-2 ring-blueprint'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: preset.value }}
                    title={preset.label}
                  />
                ))}
                <label
                  className="w-5 h-5 rounded-full border border-dashed border-ink flex items-center justify-center cursor-pointer relative overflow-hidden ml-0.5"
                  title="Custom color"
                >
                  <input
                    type="color"
                    value={pencilColor}
                    onChange={(e) => setPencilColor(e.target.value)}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  />
                  <Palette className="w-2.5 h-2.5 text-ink-soft" />
                </label>
              </div>
            </>
          )}

          {/* Stroke Width Presets */}
          {pencilTool !== 'eraser' && (
            <>
              <div className="w-[1.5px] h-5 bg-line" />
              <div className="flex items-center gap-1">
                {PENCIL_WIDTH_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setPencilWidth(preset.value)}
                    className={`px-1.5 py-0.5 border text-[10px] cursor-pointer transition-colors ${
                      pencilWidth === preset.value
                        ? 'border-ink bg-ink text-paper font-bold'
                        : 'border-line text-ink-soft hover:border-ink hover:text-ink'
                    }`}
                    title={`${preset.label} (${preset.value}px)`}
                  >
                    {preset.value}px
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating Canvas Mode / Control Dock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-paper-raised border-2 border-ink shadow-hard-ink px-2 py-1.5 text-[12px] font-mono select-none">
        {/* Select mode V */}
        <button
          onClick={() => setActiveMode('select')}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors border border-transparent ${
            activeMode === 'select'
              ? 'bg-ink text-paper border-ink'
              : 'text-ink hover:bg-paper hover:border-line'
          }`}
          title="Select / Move / Connect (Shortcut: V)"
        >
          <MousePointer className="w-4 h-4" />
        </button>

        {/* Mark mode M */}
        <button
          onClick={() => {
            setActiveMode('mark');
            onClearSelection();
          }}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors border border-transparent ${
            activeMode === 'mark'
              ? 'bg-ink text-paper border-ink'
              : 'text-ink hover:bg-paper hover:border-line'
          }`}
          title="Marquee Selection Rectangle (Shortcut: M)"
        >
          <div className="w-3.5 h-3.5 border-dashed border border-current rounded-none" />
        </button>

        {/* Pencil mode P */}
        <button
          onClick={() => {
            setActiveMode('draw');
            onClearSelection();
          }}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors border border-transparent ${
            activeMode === 'draw'
              ? 'bg-ink text-paper border-ink'
              : 'text-ink hover:bg-paper hover:border-line'
          }`}
          title="Pencil Drawing Sketches (Shortcut: P)"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>

        {/* Pan mode H */}
        <button
          onClick={() => setActiveMode('pan')}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors border border-transparent ${
            activeMode === 'pan'
              ? 'bg-ink text-paper border-ink'
              : 'text-ink hover:bg-paper hover:border-line'
          }`}
          title="Hand Pan Canvas (Shortcut: H)"
        >
          <Hand className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-[1.5px] h-6 bg-line mx-1" />

        {/* Undo */}
        <button
          onClick={undo}
          disabled={!canUndo}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors border border-transparent ${
            canUndo
              ? 'text-ink hover:bg-paper hover:border-line cursor-pointer'
              : 'text-ink-soft opacity-30 cursor-not-allowed'
          }`}
          title="Undo (Ctrl+Z)"
        >
          <Undo className="w-4 h-4" />
        </button>

        {/* Redo */}
        <button
          onClick={redo}
          disabled={!canRedo}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors border border-transparent ${
            canRedo
              ? 'text-ink hover:bg-paper hover:border-line cursor-pointer'
              : 'text-ink-soft opacity-30 cursor-not-allowed'
          }`}
          title="Redo (Ctrl+Y)"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas Floating Zoom & Grid controls */}
      <div
        className="absolute top-4 right-4 z-40 flex border border-line bg-paper-raised shadow-hard-ink font-mono text-[11px] select-none"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Grid Pattern Selector */}
        <button
          onClick={onToggleGridStyle}
          className="px-2 py-1.5 border-r border-line hover:bg-paper flex items-center gap-1 cursor-pointer text-[10.5px] text-ink-soft hover:text-ink"
          title={`Grid Pattern: ${canvasGridStyle} (Click to switch)`}
        >
          <Grid className="w-3.5 h-3.5 text-blueprint" />
          <span className="hidden sm:inline uppercase text-[9.5px]">{canvasGridStyle}</span>
        </button>

        {/* Magnetic Snap toggle */}
        <button
          onClick={onToggleSnap}
          className={`px-2 py-1.5 border-r border-line hover:bg-paper flex items-center gap-1 cursor-pointer text-[10.5px] ${
            isSnapToGrid ? 'text-blueprint font-bold bg-blueprint/5' : 'text-ink-soft'
          }`}
          title={isSnapToGrid ? 'Magnetic Snap: 20px ON' : 'Magnetic Snap: OFF (Freeform)'}
        >
          <Magnet className={`w-3.5 h-3.5 ${isSnapToGrid ? 'text-blueprint' : 'text-ink-soft'}`} />
          <span className="hidden sm:inline">{isSnapToGrid ? 'Snap' : 'Free'}</span>
        </button>

        <button
          onClick={onZoomOut}
          className="px-2.5 py-1.5 border-r border-line hover:bg-paper flex items-center justify-center cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="px-2.5 py-1.5 border-r border-line min-w-[46px] text-center flex items-center justify-center font-bold text-[11px]">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={onZoomIn}
          className="px-2.5 py-1.5 border-r border-line hover:bg-paper flex items-center justify-center cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onFitToScreen}
          className="px-2.5 py-1.5 border-r border-line hover:bg-paper flex items-center gap-1 cursor-pointer text-[10.5px]"
          title="Fit Diagram to Canvas View"
        >
          <Maximize2 className="w-3 h-3 text-blueprint" />
          <span>Fit</span>
        </button>
        <button
          onClick={onResetZoom}
          className="px-2.5 py-1.5 hover:bg-paper flex items-center justify-center cursor-pointer text-[10.5px]"
          title="Center Diagram"
        >
          Reset
        </button>
      </div>
    </>
  );
};
