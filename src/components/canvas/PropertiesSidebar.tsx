import React from 'react';
import {
  Sliders,
  Trash2,
  Plus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Palette,
  ChevronsUp,
  ChevronUp,
  ChevronDown,
  ChevronsDown,
  Wand2,
} from 'lucide-react';
import type { CanvasNode, CanvasEdge, Diagram, EdgeMarkerType } from '../../services/mockDb';
import type { FreehandDrawing } from '../../types/canvas';
import {
  AVAILABLE_SHAPE_TYPES,
  FILL_COLOR_PRESETS,
  SHADOW_COLOR_PRESETS,
  CARDINALITY_OPTIONS,
  PENCIL_COLOR_PRESETS,
  PENCIL_WIDTH_PRESETS,
  getNodeDimensions,
  getMinDimensions,
} from '../../types/canvas';
import { CrowsFootVisualIcon } from './CrowsFootVisualIcon';

export interface PropertiesSidebarProps {
  isRightSidebarOpen: boolean;
  setIsRightSidebarOpen: (open: boolean) => void;
  diagram: Diagram | null;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  drawings: FreehandDrawing[];
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  selectedDrawingId: string | null;
  zoom: number;
  // Selection Actions
  setSelectedDrawingId: (id: string | null) => void;
  duplicateSelection: () => void;
  deleteSelectedNodes: () => void;
  deleteSelectedEdge: () => void;
  deleteSelectedDrawing: () => void;
  // Node Property Updaters
  morphSelectedNodeType: (newType: CanvasNode['type']) => void;
  updateSelectedNodeLabel: (label: string) => void;
  updateSelectedNodeFields: (fields: string[]) => void;
  updateSelectedNodeProperties: (props: Partial<CanvasNode>) => void;
  updateSelectedNodeProperty: <K extends keyof CanvasNode>(key: K, value: CanvasNode[K]) => void;
  bringToFront: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  sendToBack: () => void;
  // Edge Property Updaters
  updateSelectedEdgeLabel: (label: string) => void;
  updateSelectedEdgeStyle: (style: 'solid' | 'dashed') => void;
  updateSelectedEdgeArrow: (arrow: 'end' | 'none' | 'both') => void;
  updateSelectedEdgeSourceMarker: (marker: EdgeMarkerType) => void;
  updateSelectedEdgeTargetMarker: (marker: EdgeMarkerType) => void;
  updateSelectedEdgeErdPreset: (preset: '1:N' | 'N:1' | '1:1' | 'M:N' | '0..1:N') => void;
  resetSelectedEdgeRoute: () => void;
  // Drawing Property Updaters
  updateSelectedDrawingColor: (color: string) => void;
  updateSelectedDrawingWidth: (width: number) => void;
  // Overview Actions
  autoAlignNodes: () => void;
  handleResetZoom: () => void;
  handleClearCanvas: () => void;
}

export const PropertiesSidebar: React.FC<PropertiesSidebarProps> = ({
  isRightSidebarOpen,
  setIsRightSidebarOpen,
  diagram,
  nodes,
  edges,
  drawings,
  selectedNodeIds,
  selectedEdgeId,
  selectedDrawingId,
  zoom,
  setSelectedDrawingId,
  duplicateSelection,
  deleteSelectedNodes,
  deleteSelectedEdge,
  deleteSelectedDrawing,
  morphSelectedNodeType,
  updateSelectedNodeLabel,
  updateSelectedNodeFields,
  updateSelectedNodeProperties,
  updateSelectedNodeProperty,
  bringToFront,
  bringForward,
  sendBackward,
  sendToBack,
  updateSelectedEdgeLabel,
  updateSelectedEdgeStyle,
  updateSelectedEdgeArrow,
  updateSelectedEdgeSourceMarker,
  updateSelectedEdgeTargetMarker,
  updateSelectedEdgeErdPreset,
  resetSelectedEdgeRoute,
  updateSelectedDrawingColor,
  updateSelectedDrawingWidth,
  autoAlignNodes,
  handleResetZoom,
  handleClearCanvas,
}) => {
  const activeNode = nodes.find((n) => n.id === selectedNodeIds[0]);
  const activeEdge = edges.find((e) => e.id === selectedEdgeId);
  const selectedDrawing = drawings.find((d) => d.id === selectedDrawingId);
  const hasSelection = selectedNodeIds.length > 0;

  return (
    <aside
      className={`
        fixed lg:static inset-y-0 right-0 z-40 lg:z-10
        h-full border-l-2 border-ink bg-paper flex flex-col shrink-0 select-none overflow-hidden
        transition-all duration-200 ease-in-out shadow-hard-ink lg:shadow-none
        ${isRightSidebarOpen ? 'w-[290px] translate-x-0' : 'w-0 translate-x-full lg:translate-x-0 lg:w-0 border-l-0'}
      `}
    >
      {/* Inspector Header */}
      <div className="h-11 border-b-2 border-ink px-4 flex items-center justify-between bg-paper-raised shrink-0">
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-blueprint" />
          <span className="font-mono text-[11px] text-ink font-bold uppercase tracking-wider">
            {hasSelection ? 'Shape Properties' : activeEdge ? 'Connector' : 'Properties'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasSelection && (
            <button
              onClick={deleteSelectedNodes}
              className="text-ink-soft hover:text-signal transition-colors p-1 cursor-pointer"
              title="Delete Selection"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {activeEdge && (
            <button
              onClick={deleteSelectedEdge}
              className="text-ink-soft hover:text-signal transition-colors p-1 cursor-pointer"
              title="Delete Connector"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsRightSidebarOpen(false)}
            className="lg:hidden text-ink-soft hover:text-ink text-[11px] font-mono cursor-pointer"
          >
            [close]
          </button>
        </div>
      </div>

      {/* Inspector Body */}
      <div className="p-4 flex-1 flex flex-col justify-between overflow-y-auto">
        {hasSelection && activeNode ? (
          <div className="flex flex-col gap-3.5">
            {/* Shape Type & Morpher */}
            <div className="flex flex-col gap-1.5">
              <div className="font-mono text-[10px] text-ink-soft font-bold flex justify-between items-center border-b border-line pb-1">
                <span>MORPH_SHAPE</span>
                <span className="text-blueprint font-bold uppercase">{activeNode.type}</span>
              </div>
              <select
                value={activeNode.type}
                onChange={(e) => morphSelectedNodeType(e.target.value as CanvasNode['type'])}
                className="w-full border-2 border-ink bg-paper px-2 py-1.5 text-[11px] font-mono focus:border-blueprint focus:outline-none cursor-pointer"
              >
                {AVAILABLE_SHAPE_TYPES.map((st) => (
                  <option key={st.type} value={st.type}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Rename label */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-ink-soft font-bold">SHAPE_LABEL</label>
              <input
                type="text"
                value={activeNode.label}
                onChange={(e) => updateSelectedNodeLabel(e.target.value)}
                className="w-full border-2 border-ink bg-paper px-3 py-1.5 text-[12px] font-mono focus:border-blueprint focus:outline-none"
              />
            </div>

            {/* Table Fields manager for ERD tables */}
            {activeNode.type === 'table' && (
              <div className="flex flex-col gap-2">
                <label className="font-mono text-[10px] text-ink-soft flex justify-between items-center font-bold">
                  <span>TABLE_COLUMNS</span>
                  <button
                    type="button"
                    onClick={() => {
                      const currentFields = activeNode.fields || [];
                      updateSelectedNodeFields([...currentFields, 'column text']);
                    }}
                    className="flex items-center gap-1 text-blueprint hover:underline uppercase text-[9px] font-bold cursor-pointer"
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-blueprint border border-ink flex items-center justify-center shrink-0">
                      <Plus size={8} strokeWidth={3} className="text-white" />
                    </div>
                    <span>Add Column</span>
                  </button>
                </label>

                <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {(activeNode.fields || []).map((field, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={field}
                        onChange={(e) => {
                          const copy = [...(activeNode.fields || [])];
                          copy[idx] = e.target.value;
                          updateSelectedNodeFields(copy);
                        }}
                        className="flex-1 border border-ink bg-paper px-2 py-1 text-[11px] font-mono focus:border-blueprint focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const copy = (activeNode.fields || []).filter((_, fIdx) => fIdx !== idx);
                          updateSelectedNodeFields(copy);
                        }}
                        className="text-ink-soft hover:text-signal p-0.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Typography formatting */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-ink-soft font-bold">TEXT_FORMATTING</label>

              {/* Row 1: S/M/L Presets + Custom Size px Input */}
              <div className="flex items-center gap-1.5">
                <div className="flex-1 grid grid-cols-3 border-2 border-ink font-mono text-[11px] text-center bg-paper">
                  {(['sm', 'md', 'lg'] as const).map((size) => {
                    const standardPx = size === 'sm' ? 11 : size === 'md' ? 13 : 16;
                    const isActive = !activeNode.customFontSize && (activeNode.fontSize || 'md') === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          updateSelectedNodeProperties({
                            fontSize: size,
                            customFontSize: undefined,
                          });
                        }}
                        className={`py-1 border-r last:border-r-0 border-ink cursor-pointer uppercase ${
                          isActive ? 'bg-ink text-paper font-bold' : 'text-ink-soft'
                        }`}
                        title={`Font Size: ${size} (${standardPx}px)`}
                      >
                        {size === 'sm' ? 'S' : size === 'md' ? 'M' : 'L'}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1 border-2 border-ink bg-paper px-1.5 py-0.5">
                  <input
                    type="number"
                    min="8"
                    max="72"
                    value={
                      activeNode.customFontSize ??
                      (activeNode.fontSize === 'sm' ? 11 : activeNode.fontSize === 'lg' ? 16 : 13)
                    }
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v >= 6 && v <= 100) {
                        updateSelectedNodeProperty('customFontSize', v);
                      }
                    }}
                    className="w-8 text-center font-mono text-[11px] font-bold bg-transparent text-ink focus:outline-none"
                  />
                  <span className="font-mono text-[10px] text-ink-soft">px</span>
                </div>
              </div>

              {/* Row 2: Alignment and Bold Toggles */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="flex-1 flex border-2 border-ink bg-paper">
                  <button
                    type="button"
                    onClick={() => updateSelectedNodeProperty('textAlign', 'left')}
                    className={`flex-1 p-1 border-r border-ink cursor-pointer flex items-center justify-center ${
                      activeNode.textAlign === 'left' ? 'bg-ink text-paper' : 'text-ink-soft'
                    }`}
                    title="Align Left"
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedNodeProperty('textAlign', 'center')}
                    className={`flex-1 p-1 border-r border-ink cursor-pointer flex items-center justify-center ${
                      (activeNode.textAlign || 'center') === 'center'
                        ? 'bg-ink text-paper'
                        : 'text-ink-soft'
                    }`}
                    title="Align Center"
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedNodeProperty('textAlign', 'right')}
                    className={`flex-1 p-1 cursor-pointer flex items-center justify-center ${
                      activeNode.textAlign === 'right' ? 'bg-ink text-paper' : 'text-ink-soft'
                    }`}
                    title="Align Right"
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    updateSelectedNodeProperty('isBold', activeNode.isBold === false ? true : false)
                  }
                  className={`px-2.5 py-1 border-2 border-ink cursor-pointer flex items-center justify-center ${
                    activeNode.isBold !== false
                      ? 'bg-ink text-paper font-bold'
                      : 'bg-paper text-ink-soft'
                  }`}
                  title="Toggle Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Border style & width */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] text-ink-soft font-bold">BORDER_STYLE</label>
                <div className="grid grid-cols-4 border-2 border-ink font-mono text-[11px] text-center bg-paper">
                  {(['none', 'solid', 'dashed', 'dotted'] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => updateSelectedNodeProperty('borderStyle', style)}
                      className={`py-1.5 border-r last:border-r-0 border-ink capitalize cursor-pointer ${
                        (activeNode.borderStyle ||
                          (activeNode.type === 'text'
                            ? 'none'
                            : activeNode.type === 'usecase-boundary'
                            ? 'dashed'
                            : 'solid')) === style
                          ? 'bg-ink text-paper font-bold'
                          : 'text-ink-soft'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] text-ink-soft font-bold">BORDER_WIDTH</label>
                <div className="grid grid-cols-3 border-2 border-ink font-mono text-[11px] text-center bg-paper">
                  {([1, 2, 3] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => updateSelectedNodeProperty('borderWidth', w)}
                      className={`py-1.5 border-r last:border-r-0 border-ink cursor-pointer ${
                        (activeNode.borderWidth ?? (activeNode.type === 'text' ? 1 : 2)) === w
                          ? 'bg-ink text-paper font-bold'
                          : 'text-ink-soft'
                      }`}
                      title={`${w}px width`}
                    >
                      {w}px
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Fill Color */}
            <div className="flex flex-col gap-1.5">
              <div className="font-mono text-[10px] text-ink-soft font-bold flex justify-between items-center">
                <span>FILL_COLOR</span>
                <input
                  type="text"
                  value={activeNode.fillColor || '#FFFFFF'}
                  onChange={(e) => updateSelectedNodeProperty('fillColor', e.target.value)}
                  placeholder="#FFFFFF"
                  className="w-20 border border-ink bg-paper px-1.5 py-0.5 text-[10px] font-mono focus:border-blueprint focus:outline-none uppercase text-center"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 grid grid-cols-7 border-2 border-ink bg-paper p-0.5 gap-0.5">
                  {FILL_COLOR_PRESETS.map((p) => {
                    const isCurrent =
                      (activeNode.fillColor || '#FFFFFF').toLowerCase() === p.value.toLowerCase() ||
                      (!activeNode.fillColor && p.value === '#FFFFFF');
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => updateSelectedNodeProperty('fillColor', p.value)}
                        className={`h-5 rounded-none border border-ink/40 flex items-center justify-center cursor-pointer ${
                          isCurrent ? 'ring-2 ring-blueprint z-10' : ''
                        }`}
                        style={{ backgroundColor: p.bg === 'transparent' ? '#FFFFFF' : p.bg }}
                        title={p.label}
                      >
                        {p.bg === 'transparent' && (
                          <span className="text-[9px] text-signal font-bold leading-none">✕</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <label
                  className="border-2 border-ink bg-paper p-1 cursor-pointer flex items-center justify-center relative w-7 h-7 shrink-0"
                  title="Custom Fill Color"
                >
                  <input
                    type="color"
                    value={
                      activeNode.fillColor &&
                      activeNode.fillColor !== 'transparent' &&
                      activeNode.fillColor.startsWith('#')
                        ? activeNode.fillColor
                        : '#ffffff'
                    }
                    onChange={(e) => updateSelectedNodeProperty('fillColor', e.target.value)}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  />
                  <Palette className="w-3.5 h-3.5 text-blueprint" />
                </label>
              </div>
            </div>

            {/* Shadow Accent */}
            <div className="flex flex-col gap-1.5">
              <div className="font-mono text-[10px] text-ink-soft font-bold flex justify-between items-center">
                <span>SHADOW_ACCENT</span>
                <input
                  type="text"
                  value={
                    activeNode.shadowAccent || (activeNode.type === 'text' ? 'none' : '#1E5C8C')
                  }
                  onChange={(e) => updateSelectedNodeProperty('shadowAccent', e.target.value)}
                  placeholder="#1E5C8C"
                  className="w-20 border border-ink bg-paper px-1.5 py-0.5 text-[10px] font-mono focus:border-blueprint focus:outline-none uppercase text-center"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 grid grid-cols-7 border-2 border-ink bg-paper p-0.5 gap-0.5">
                  {SHADOW_COLOR_PRESETS.map((p) => {
                    const currentShadow =
                      activeNode.shadowAccent ||
                      (activeNode.type === 'text'
                        ? 'none'
                        : activeNode.width === 2
                        ? '#D45B33'
                        : activeNode.width === 3
                        ? '#15191C'
                        : '#1E5C8C');
                    const isCurrent = currentShadow.toLowerCase() === p.value.toLowerCase();
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => updateSelectedNodeProperty('shadowAccent', p.value)}
                        className={`h-5 rounded-none border border-ink/40 flex items-center justify-center cursor-pointer ${
                          isCurrent ? 'ring-2 ring-blueprint z-10' : ''
                        }`}
                        style={{ backgroundColor: p.bg }}
                        title={p.label}
                      >
                        {p.value === 'none' && (
                          <span className="text-[9px] text-ink-soft font-bold leading-none">✕</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <label
                  className="border-2 border-ink bg-paper p-1 cursor-pointer flex items-center justify-center relative w-7 h-7 shrink-0"
                  title="Custom Shadow Color"
                >
                  <input
                    type="color"
                    value={
                      activeNode.shadowAccent &&
                      activeNode.shadowAccent !== 'none' &&
                      activeNode.shadowAccent.startsWith('#')
                        ? activeNode.shadowAccent
                        : '#1E5C8C'
                    }
                    onChange={(e) => updateSelectedNodeProperty('shadowAccent', e.target.value)}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  />
                  <Palette className="w-3.5 h-3.5 text-ink" />
                </label>
              </div>
            </div>

            {/* Layer Arrangement */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-ink-soft font-bold">LAYER_ORDER</label>
              <div className="grid grid-cols-4 border-2 border-ink font-mono text-[10px] text-center bg-paper">
                <button
                  type="button"
                  onClick={bringToFront}
                  className="py-1 border-r border-ink cursor-pointer flex flex-col items-center justify-center gap-0.5"
                  title="Bring to Front"
                >
                  <ChevronsUp className="w-3.5 h-3.5 text-blueprint" />
                  <span>Front</span>
                </button>
                <button
                  type="button"
                  onClick={bringForward}
                  className="py-1 border-r border-ink cursor-pointer flex flex-col items-center justify-center gap-0.5"
                  title="Bring Forward"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Up</span>
                </button>
                <button
                  type="button"
                  onClick={sendBackward}
                  className="py-1 border-r border-ink cursor-pointer flex flex-col items-center justify-center gap-0.5"
                  title="Send Backward"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Down</span>
                </button>
                <button
                  type="button"
                  onClick={sendToBack}
                  className="py-1 cursor-pointer flex flex-col items-center justify-center gap-0.5"
                  title="Send to Back"
                >
                  <ChevronsDown className="w-3.5 h-3.5 text-blueprint" />
                  <span>Back</span>
                </button>
              </div>
            </div>

            {/* Node Geometry Details Badge */}
            <div className="p-2.5 border border-line bg-paper-raised font-mono text-[10px] text-ink-soft flex flex-col gap-1.5">
              <div className="flex justify-between">
                <span>Position:</span>
                <span className="text-ink font-bold">
                  X {activeNode.x}, Y {activeNode.y}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Size:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={getNodeDimensions(activeNode).width}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (isNaN(v) || v < getMinDimensions(activeNode).width) return;
                      const isDiamondType =
                        activeNode.type === 'decision' || activeNode.type === 'activity-decision';
                      updateSelectedNodeProperties({
                        customWidth: v,
                        ...(isDiamondType ? { customHeight: v } : {}),
                      });
                    }}
                    className="w-12 px-1 py-0.5 border border-ink bg-paper text-ink font-bold text-center text-[10px] font-mono"
                    min={getMinDimensions(activeNode).width}
                  />
                  <span className="text-ink-soft">×</span>
                  <input
                    type="number"
                    value={getNodeDimensions(activeNode).height}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (isNaN(v) || v < getMinDimensions(activeNode).height) return;
                      const isDiamondType =
                        activeNode.type === 'decision' || activeNode.type === 'activity-decision';
                      updateSelectedNodeProperties({
                        customHeight: v,
                        ...(isDiamondType ? { customWidth: v } : {}),
                      });
                    }}
                    className="w-12 px-1 py-0.5 border border-ink bg-paper text-ink font-bold text-center text-[10px] font-mono"
                    min={getMinDimensions(activeNode).height}
                  />
                  <span className="text-ink-soft">px</span>
                </div>
              </div>
              {(activeNode.customWidth || activeNode.customHeight) && (
                <button
                  type="button"
                  onClick={() => {
                    updateSelectedNodeProperties({
                      customWidth: undefined,
                      customHeight: undefined,
                    });
                  }}
                  className="text-[9px] text-blueprint hover:underline cursor-pointer text-right font-bold"
                >
                  Reset to default size
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={duplicateSelection}
                className="flex-1 py-1.5 px-2 border border-ink bg-paper hover:bg-paper-raised font-mono text-[11px] font-bold text-center cursor-pointer transition-colors"
              >
                Duplicate (Ctrl+D)
              </button>
              <button
                type="button"
                onClick={deleteSelectedNodes}
                className="py-1.5 px-3 border border-signal text-signal hover:bg-signal hover:text-paper font-mono text-[11px] font-bold text-center cursor-pointer transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ) : hasSelection && selectedNodeIds.length > 1 ? (
          <div className="flex flex-col gap-3.5">
            <div className="font-mono text-[11px] text-ink-soft font-bold border-b border-line pb-1.5">
              MULTI_SELECTION ({selectedNodeIds.length})
            </div>

            {/* Batch Text Style */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-ink-soft font-bold">TEXT_FORMATTING</label>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 grid grid-cols-3 border-2 border-ink font-mono text-[11px] text-center bg-paper">
                  {(['sm', 'md', 'lg'] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        updateSelectedNodeProperties({
                          fontSize: size,
                          customFontSize: undefined,
                        });
                      }}
                      className="py-1 border-r last:border-r-0 border-ink cursor-pointer uppercase text-ink-soft"
                    >
                      {size === 'sm' ? 'S' : size === 'md' ? 'M' : 'L'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 border-2 border-ink bg-paper px-1.5 py-0.5">
                  <input
                    type="number"
                    min="8"
                    max="72"
                    placeholder="13"
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v >= 6 && v <= 100) {
                        updateSelectedNodeProperty('customFontSize', v);
                      }
                    }}
                    className="w-8 text-center font-mono text-[11px] font-bold bg-transparent text-ink focus:outline-none"
                  />
                  <span className="font-mono text-[10px] text-ink-soft">px</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="flex-1 flex border-2 border-ink bg-paper">
                  <button
                    type="button"
                    onClick={() => updateSelectedNodeProperty('textAlign', 'left')}
                    className="flex-1 p-1 border-r border-ink cursor-pointer text-ink-soft flex items-center justify-center"
                    title="Align Left"
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedNodeProperty('textAlign', 'center')}
                    className="flex-1 p-1 border-r border-ink cursor-pointer text-ink-soft flex items-center justify-center"
                    title="Align Center"
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedNodeProperty('textAlign', 'right')}
                    className="flex-1 p-1 cursor-pointer text-ink-soft flex items-center justify-center"
                    title="Align Right"
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => updateSelectedNodeProperty('isBold', true)}
                  className="px-2.5 py-1 border-2 border-ink cursor-pointer bg-paper text-ink-soft font-bold flex items-center justify-center"
                  title="Set Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Batch Border Style & Width */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] text-ink-soft font-bold">BORDER_STYLE</label>
                <div className="grid grid-cols-4 border-2 border-ink font-mono text-[11px] text-center bg-paper">
                  {(['none', 'solid', 'dashed', 'dotted'] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => updateSelectedNodeProperty('borderStyle', style)}
                      className="py-1.5 border-r last:border-r-0 border-ink capitalize cursor-pointer text-ink-soft"
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] text-ink-soft font-bold">BORDER_WIDTH</label>
                <div className="grid grid-cols-3 border-2 border-ink font-mono text-[11px] text-center bg-paper">
                  {([1, 2, 3] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => updateSelectedNodeProperty('borderWidth', w)}
                      className="py-1.5 border-r last:border-r-0 border-ink cursor-pointer text-ink-soft"
                    >
                      {w}px
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Batch Fill Color */}
            <div className="flex flex-col gap-1.5">
              <div className="font-mono text-[10px] text-ink-soft font-bold flex justify-between items-center">
                <span>FILL_COLOR</span>
                <input
                  type="text"
                  placeholder="#HEX"
                  onChange={(e) => updateSelectedNodeProperty('fillColor', e.target.value)}
                  className="w-20 border border-ink bg-paper px-1.5 py-0.5 text-[10px] font-mono focus:border-blueprint focus:outline-none uppercase text-center"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 grid grid-cols-7 border-2 border-ink bg-paper p-0.5 gap-0.5">
                  {FILL_COLOR_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => updateSelectedNodeProperty('fillColor', p.value)}
                      className="h-5 rounded-none border border-ink/40 flex items-center justify-center cursor-pointer"
                      style={{ backgroundColor: p.bg === 'transparent' ? '#FFFFFF' : p.bg }}
                      title={p.label}
                    >
                      {p.bg === 'transparent' && (
                        <span className="text-[9px] text-signal font-bold leading-none">✕</span>
                      )}
                    </button>
                  ))}
                </div>
                <label
                  className="border-2 border-ink bg-paper p-1 cursor-pointer flex items-center justify-center relative w-7 h-7 shrink-0"
                  title="Custom Fill Color"
                >
                  <input
                    type="color"
                    onChange={(e) => updateSelectedNodeProperty('fillColor', e.target.value)}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  />
                  <Palette className="w-3.5 h-3.5 text-blueprint" />
                </label>
              </div>
            </div>

            {/* Batch Shadow Accent */}
            <div className="flex flex-col gap-1.5">
              <div className="font-mono text-[10px] text-ink-soft font-bold flex justify-between items-center">
                <span>SHADOW_ACCENT</span>
                <input
                  type="text"
                  placeholder="#HEX"
                  onChange={(e) => updateSelectedNodeProperty('shadowAccent', e.target.value)}
                  className="w-20 border border-ink bg-paper px-1.5 py-0.5 text-[10px] font-mono focus:border-blueprint focus:outline-none uppercase text-center"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 grid grid-cols-7 border-2 border-ink bg-paper p-0.5 gap-0.5">
                  {SHADOW_COLOR_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => updateSelectedNodeProperty('shadowAccent', p.value)}
                      className="h-5 rounded-none border border-ink/40 flex items-center justify-center cursor-pointer"
                      style={{ backgroundColor: p.bg }}
                      title={p.label}
                    >
                      {p.value === 'none' && (
                        <span className="text-[9px] text-ink-soft font-bold leading-none">✕</span>
                      )}
                    </button>
                  ))}
                </div>
                <label
                  className="border-2 border-ink bg-paper p-1 cursor-pointer flex items-center justify-center relative w-7 h-7 shrink-0"
                  title="Custom Shadow Color"
                >
                  <input
                    type="color"
                    onChange={(e) => updateSelectedNodeProperty('shadowAccent', e.target.value)}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  />
                  <Palette className="w-3.5 h-3.5 text-ink" />
                </label>
              </div>
            </div>

            {/* Batch Layer Order */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-ink-soft font-bold">LAYER_ORDER</label>
              <div className="grid grid-cols-2 border-2 border-ink font-mono text-[10px] text-center bg-paper">
                <button
                  type="button"
                  onClick={bringToFront}
                  className="py-1.5 border-r border-ink cursor-pointer flex items-center justify-center gap-1 font-bold text-blueprint"
                >
                  <ChevronsUp className="w-3.5 h-3.5" />
                  <span>To Front</span>
                </button>
                <button
                  type="button"
                  onClick={sendToBack}
                  className="py-1.5 cursor-pointer flex items-center justify-center gap-1 font-bold text-blueprint"
                >
                  <ChevronsDown className="w-3.5 h-3.5" />
                  <span>To Back</span>
                </button>
              </div>
            </div>

            {/* Batch Actions */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={duplicateSelection}
                className="w-full py-1.5 border border-ink bg-paper hover:bg-paper-raised font-mono text-[11px] font-bold cursor-pointer transition-colors"
              >
                Duplicate Selection ({selectedNodeIds.length})
              </button>
              <button
                type="button"
                onClick={deleteSelectedNodes}
                className="w-full py-1.5 border-2 border-signal text-signal hover:bg-signal hover:text-paper font-mono text-[11px] font-bold cursor-pointer transition-colors"
              >
                Delete Selected ({selectedNodeIds.length})
              </button>
            </div>
          </div>
        ) : activeEdge ? (
          <div className="flex flex-col gap-4">
            <div className="font-mono text-[11px] text-ink-soft font-bold border-b border-line pb-1.5 flex items-center justify-between">
              <span>CONNECTOR_PROPERTIES</span>
              {diagram?.type === 'erd' && (
                <span className="text-[9px] text-blueprint border border-blueprint px-1 font-mono uppercase">
                  ERD
                </span>
              )}
            </div>

            {/* Edge relationship label */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-ink-soft font-bold">LINE_LABEL</label>
              <input
                type="text"
                value={activeEdge.label || ''}
                onChange={(e) => updateSelectedEdgeLabel(e.target.value)}
                className="w-full border-2 border-ink bg-paper px-3 py-2 text-[13px] font-mono focus:border-blueprint focus:outline-none"
                placeholder="e.g. 1:N, places, contains"
              />
            </div>

            <div className="flex items-center justify-between gap-3 border border-line bg-paper-raised px-2.5 py-2">
              <div className="font-mono text-[10px]">
                <div className="font-bold text-ink">
                  ROUTE: {activeEdge.routeMode === 'manual' ? 'MANUAL' : 'AUTO'}
                </div>
                <div className="text-ink-soft mt-0.5">Drag the blue line handles to edit.</div>
              </div>
              <button
                type="button"
                onClick={resetSelectedEdgeRoute}
                disabled={activeEdge.routeMode !== 'manual'}
                className="shrink-0 border border-ink px-2 py-1 font-mono text-[10px] font-bold hover:bg-paper disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Reset route
              </button>
            </div>

            {/* ERD Cardinality Quick Presets */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="font-mono text-[10px] text-ink-soft font-bold">
                  ERD_CARDINALITY_PRESETS
                </label>
                <span className="text-[9.5px] font-mono text-blueprint">Martin / Crow&apos;s</span>
              </div>
              <div className="grid grid-cols-5 gap-1 font-mono text-[10.5px]">
                {(['1:N', 'N:1', '1:1', 'M:N', '0..1:N'] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => updateSelectedEdgeErdPreset(preset)}
                    className={`py-1 border border-ink hover:bg-paper-raised cursor-pointer text-center transition-colors ${
                      activeEdge.label === preset
                        ? 'bg-ink text-paper font-bold'
                        : 'bg-paper text-ink'
                    }`}
                    title={`Apply ${preset} Cardinality`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Granular Source Cardinality (Start of connection) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="font-mono text-[10px] text-ink-soft font-bold">
                  SOURCE: {nodes.find((n) => n.id === activeEdge.source)?.label || 'START'}
                </label>
                <span className="text-[9px] font-mono text-ink-soft uppercase">From Entity</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 font-mono">
                {CARDINALITY_OPTIONS.map((opt) => {
                  const isCurrent =
                    (activeEdge.sourceMarker ??
                      (activeEdge.arrow === 'both' ? 'arrow' : 'none')) === opt.value;
                  return (
                    <button
                      key={`src-${opt.value}`}
                      type="button"
                      onClick={() => updateSelectedEdgeSourceMarker(opt.value)}
                      className={`py-2 px-1.5 border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        isCurrent
                          ? 'bg-ink text-paper border-ink font-bold shadow-sm'
                          : 'bg-paper text-ink border-line hover:border-ink hover:bg-paper-raised'
                      }`}
                      title={opt.title}
                    >
                      <CrowsFootVisualIcon type={opt.value} isSelected={isCurrent} />
                      <span className="text-[10px] tracking-tight">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Granular Target Cardinality (End of connection) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="font-mono text-[10px] text-ink-soft font-bold">
                  TARGET: {nodes.find((n) => n.id === activeEdge.target)?.label || 'END'}
                </label>
                <span className="text-[9px] font-mono text-ink-soft uppercase">To Entity</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 font-mono">
                {CARDINALITY_OPTIONS.map((opt) => {
                  const isCurrent =
                    (activeEdge.targetMarker ??
                      (activeEdge.arrow === 'none' ? 'none' : 'arrow')) === opt.value;
                  return (
                    <button
                      key={`tgt-${opt.value}`}
                      type="button"
                      onClick={() => updateSelectedEdgeTargetMarker(opt.value)}
                      className={`py-2 px-1.5 border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        isCurrent
                          ? 'bg-ink text-paper border-ink font-bold shadow-sm'
                          : 'bg-paper text-ink border-line hover:border-ink hover:bg-paper-raised'
                      }`}
                      title={opt.title}
                    >
                      <CrowsFootVisualIcon type={opt.value} isSelected={isCurrent} />
                      <span className="text-[10px] tracking-tight">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Edge line style */}
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex items-center justify-between">
                <label className="font-mono text-[10px] text-ink-soft font-bold">LINE_STYLE</label>
                <span className="text-[9.5px] font-mono text-ink-soft">
                  Solid (Ident.) / Dashed (Non-ident.)
                </span>
              </div>
              <div className="grid grid-cols-2 border-2 border-ink font-mono text-[11px] text-center bg-paper">
                <button
                  type="button"
                  onClick={() => updateSelectedEdgeStyle('solid')}
                  className={`py-1.5 border-r border-ink hover:bg-paper-raised cursor-pointer ${
                    activeEdge.style !== 'dashed' ? 'bg-ink text-paper font-bold' : 'text-ink-soft'
                  }`}
                >
                  solid
                </button>
                <button
                  type="button"
                  onClick={() => updateSelectedEdgeStyle('dashed')}
                  className={`py-1.5 hover:bg-paper-raised cursor-pointer ${
                    activeEdge.style === 'dashed' ? 'bg-ink text-paper font-bold' : 'text-ink-soft'
                  }`}
                >
                  dashed
                </button>
              </div>
            </div>

            {/* Legacy Quick Arrow Presets */}
            <div className="flex flex-col gap-1.5 mt-1">
              <label className="font-mono text-[10px] text-ink-soft font-bold">ARROW_STYLE</label>
              <div className="grid grid-cols-3 border-2 border-ink font-mono text-[11px] text-center bg-paper">
                <button
                  type="button"
                  onClick={() => updateSelectedEdgeArrow('end')}
                  className={`py-1.5 border-r border-ink hover:bg-paper-raised cursor-pointer ${
                    activeEdge.arrow !== 'none' &&
                    activeEdge.arrow !== 'both' &&
                    activeEdge.targetMarker === 'arrow'
                      ? 'bg-ink text-paper font-bold'
                      : 'text-ink-soft'
                  }`}
                  title="Single Arrow (→)"
                >
                  arrow →
                </button>
                <button
                  type="button"
                  onClick={() => updateSelectedEdgeArrow('none')}
                  className={`py-1.5 border-r border-ink hover:bg-paper-raised cursor-pointer ${
                    activeEdge.sourceMarker === 'none' && activeEdge.targetMarker === 'none'
                      ? 'bg-ink text-paper font-bold'
                      : 'text-ink-soft'
                  }`}
                  title="Plain Line (—)"
                >
                  none —
                </button>
                <button
                  type="button"
                  onClick={() => updateSelectedEdgeArrow('both')}
                  className={`py-1.5 hover:bg-paper-raised cursor-pointer ${
                    activeEdge.arrow === 'both' ? 'bg-ink text-paper font-bold' : 'text-ink-soft'
                  }`}
                  title="Both Ends (↔)"
                >
                  both ↔
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={deleteSelectedEdge}
              className="w-full py-2 border-2 border-signal text-signal hover:bg-signal hover:text-paper font-mono text-[11px] font-bold cursor-pointer transition-colors mt-2"
            >
              Delete Connector
            </button>
          </div>
        ) : selectedDrawing ? (
          <div className="flex flex-col gap-4">
            <div className="font-mono text-[11px] text-ink-soft font-bold border-b border-line pb-1.5 flex items-center justify-between">
              <span>DRAWING_PROPERTIES</span>
              <span className="text-[9px] text-signal border border-signal px-1 font-mono uppercase">
                {selectedDrawing.tool === 'highlighter' ? 'Highlighter' : 'Pen Stroke'}
              </span>
            </div>

            {/* Stroke Color */}
            <div className="flex flex-col gap-1.5">
              <div className="font-mono text-[10px] text-ink-soft font-bold flex justify-between items-center">
                <span>STROKE_COLOR</span>
                <span className="text-ink font-mono text-[10px]">
                  {selectedDrawing.color || '#D45B33'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 grid grid-cols-6 border-2 border-ink bg-paper p-0.5 gap-0.5">
                  {PENCIL_COLOR_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => updateSelectedDrawingColor(p.value)}
                      className="h-5 rounded-none border border-ink/40 flex items-center justify-center cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: p.value }}
                      title={p.label}
                    />
                  ))}
                </div>
                <label
                  className="border-2 border-ink bg-paper p-1 cursor-pointer flex items-center justify-center relative w-7 h-7 shrink-0"
                  title="Custom Stroke Color"
                >
                  <input
                    type="color"
                    value={selectedDrawing.color || '#D45B33'}
                    onChange={(e) => updateSelectedDrawingColor(e.target.value)}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  />
                  <Palette className="w-3.5 h-3.5 text-blueprint" />
                </label>
              </div>
            </div>

            {/* Stroke Thickness */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="font-mono text-[10px] text-ink-soft font-bold">
                  STROKE_WIDTH
                </label>
                <span className="font-mono text-[10px] text-ink-soft">
                  {selectedDrawing.width || 2}px
                </span>
              </div>
              <div className="grid grid-cols-4 border-2 border-ink font-mono text-[11px] text-center bg-paper">
                {PENCIL_WIDTH_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => updateSelectedDrawingWidth(p.value)}
                    className={`py-1.5 border-r last:border-r-0 border-ink cursor-pointer ${
                      (selectedDrawing.width || 2) === p.value
                        ? 'bg-ink text-paper font-bold'
                        : 'text-ink-soft hover:text-ink'
                    }`}
                    title={p.label}
                  >
                    {p.value}px
                  </button>
                ))}
              </div>
            </div>

            {/* Opacity indicator */}
            <div className="p-2.5 border border-line bg-paper-raised font-mono text-[10px] text-ink-soft flex flex-col gap-1.5">
              <div className="flex justify-between">
                <span>Opacity:</span>
                <span className="text-ink font-bold">
                  {Math.round((selectedDrawing.opacity ?? 1) * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Drawing ID:</span>
                <span className="text-ink font-mono">{selectedDrawing.id}</span>
              </div>
            </div>

            {/* Delete and Deselect Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedDrawingId(null)}
                className="flex-1 py-1.5 px-2 border border-ink bg-paper hover:bg-paper-raised font-mono text-[11px] font-bold text-center cursor-pointer transition-colors"
              >
                Deselect
              </button>
              <button
                type="button"
                onClick={deleteSelectedDrawing}
                className="py-1.5 px-3 border border-signal text-signal hover:bg-signal hover:text-paper font-mono text-[11px] font-bold text-center cursor-pointer transition-colors"
              >
                Delete (Del)
              </button>
            </div>
          </div>
        ) : (
          /* Canvas Overview when nothing is selected */
          <div className="flex flex-col gap-4">
            <div className="font-mono text-[10px] text-blueprint uppercase tracking-wider font-bold border-b border-line pb-1.5">
              Diagram Overview
            </div>

            {/* Diagram Info Card */}
            <div className="p-3 border-2 border-ink bg-paper-raised flex flex-col gap-2 font-mono text-[11px]">
              <div className="font-bold text-ink truncate">{diagram?.title}</div>
              <div className="flex justify-between text-ink-soft text-[10px] pt-1 border-t border-line border-dashed">
                <span>Notation:</span>
                <span className="text-blueprint font-bold uppercase">{diagram?.type}</span>
              </div>
              <div className="flex justify-between text-ink-soft text-[10px]">
                <span>Total Shapes:</span>
                <span className="text-ink font-bold">{nodes.length}</span>
              </div>
              <div className="flex justify-between text-ink-soft text-[10px]">
                <span>Connections:</span>
                <span className="text-ink font-bold">{edges.length}</span>
              </div>
              {drawings.length > 0 && (
                <div className="flex justify-between text-ink-soft text-[10px]">
                  <span>Drawings:</span>
                  <span className="text-ink font-bold">{drawings.length} paths</span>
                </div>
              )}
            </div>

            {/* Canvas Quick Actions */}
            <div className="flex flex-col gap-2 pt-1">
              <div className="font-mono text-[10px] text-ink-soft uppercase tracking-wider font-bold">
                Quick Canvas Actions
              </div>
              <button
                type="button"
                onClick={autoAlignNodes}
                className="w-full py-2 px-3 border border-line hover:border-ink bg-paper text-[11px] font-mono text-ink hover:text-blueprint transition-colors cursor-pointer flex items-center justify-between"
              >
                <span>Auto-Align Shapes</span>
                <Wand2 className="w-3.5 h-3.5 text-blueprint" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="w-full py-2 px-3 border border-line hover:border-ink bg-paper text-[11px] font-mono text-ink transition-colors cursor-pointer flex items-center justify-between"
              >
                <span>Reset View (100%)</span>
                <span className="text-[10px] text-ink-soft font-bold">{Math.round(zoom * 100)}%</span>
              </button>
              <button
                type="button"
                onClick={handleClearCanvas}
                className="w-full py-2 px-3 border border-line hover:border-signal bg-paper text-[11px] font-mono text-ink-soft hover:text-signal transition-colors cursor-pointer flex items-center justify-between"
              >
                <span>Clear Canvas</span>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Instruction footnote in right sidebar */}
        <div className="font-mono text-[10px] text-ink-soft leading-relaxed border-t-2 border-ink pt-3 mt-4">
          <div className="font-bold text-ink mb-0.5">Shortcuts</div>
          <div>V: Select / Move • M: Box Select</div>
          <div>P: Pencil Notes • H: Hand Grab</div>
          <div>Ctrl+Z: Undo • Delete: Remove</div>
        </div>
      </div>
    </aside>
  );
};
