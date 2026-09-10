import React, { useState } from 'react';
import { Card } from '../components/ui/Card';
import { MousePointer, Pencil, Hand, Columns, FileText, Download } from 'lucide-react';

type SectionKey = 'quickstart' | 'canvas' | 'shortcuts' | 'exports' | 'erd' | 'flowchart' | 'sequence' | 'class' | 'gantt' | 'dfd' | 'usecase' | 'activity';

export const Docs: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SectionKey>('quickstart');

  const menuItems: { value: SectionKey; label: string; file: string; category: string }[] = [
    { value: 'quickstart', label: 'Quick Start', file: '01_quickstart.md', category: 'GETTING STARTED' },
    { value: 'canvas', label: 'Canvas Mechanics', file: '02_canvas.md', category: 'GETTING STARTED' },
    { value: 'shortcuts', label: 'Hotkeys & Shortcuts', file: '03_hotkeys.md', category: 'GETTING STARTED' },
    { value: 'exports', label: 'High-Res Exports', file: '04_exports.md', category: 'GETTING STARTED' },
    { value: 'erd', label: 'Database ERDs', file: 'erd_notation.md', category: 'DIAGRAM GUIDES' },
    { value: 'flowchart', label: 'System Flowcharts', file: 'flowchart_logic.md', category: 'DIAGRAM GUIDES' },
    { value: 'sequence', label: 'Sequence Timelines', file: 'sequence_flow.md', category: 'DIAGRAM GUIDES' },
    { value: 'class', label: 'Class Structures', file: 'class_objects.md', category: 'DIAGRAM GUIDES' },
    { value: 'gantt', label: 'Gantt Timelines', file: 'gantt_schedule.md', category: 'DIAGRAM GUIDES' },
    { value: 'dfd', label: 'Data Flow Diagrams', file: 'dfd_diagrams.md', category: 'DIAGRAM GUIDES' },
    { value: 'usecase', label: 'Use Case Diagrams', file: 'usecase_diagrams.md', category: 'DIAGRAM GUIDES' },
    { value: 'activity', label: 'Activity Diagrams', file: 'activity_diagrams.md', category: 'DIAGRAM GUIDES' },
  ];

  // Group items by category
  const categories = ['GETTING STARTED', 'DIAGRAM GUIDES'] as const;

  return (
    <div className="flex-1 flex overflow-hidden text-ink font-sans bg-paper select-none">
      {/* Docs Left Side: File Explorer styled navigation */}
      <aside className="w-[240px] border-r border-line bg-paper-raised flex flex-col shrink-0 select-none overflow-y-auto">
        <div className="p-4 border-b border-line flex items-center justify-between font-mono text-[10px] text-ink-soft uppercase tracking-wider">
          <span>// docs_explorer</span>
          <span className="text-blueprint animate-pulse">v0.1.0</span>
        </div>

        <div className="p-3 flex flex-col gap-4">
          {categories.map((cat) => (
            <div key={cat} className="flex flex-col gap-1">
              <span className="font-mono text-[9px] text-ink-soft tracking-widest uppercase px-2 mb-1.5 block">
                {cat}
              </span>
              <div className="flex flex-col gap-0.5">
                {menuItems
                  .filter((item) => item.category === cat)
                  .map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setActiveSection(item.value)}
                      className={`text-left px-3 py-2 font-mono text-[11px] border transition-all cursor-pointer flex items-center justify-between rounded-[4px] ${
                        activeSection === item.value
                          ? 'bg-ink text-paper border-ink font-bold shadow-md translate-x-[2px]'
                          : 'text-ink-soft border-transparent hover:text-ink hover:bg-paper hover:border-line'
                      }`}
                    >
                      <span className="truncate">{item.file}</span>
                      <span className="opacity-40 text-[9px] font-mono">→</span>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Docs Right Side: Beautiful blueprint layout content */}
      <main className="flex-1 p-8 lg:p-12 overflow-y-auto bg-paper-raised flex justify-center">
        <div className="w-full max-w-[800px] flex flex-col gap-8 animate-fade-in">
          
          {activeSection === 'quickstart' && (
            <div className="flex flex-col gap-6 animate-slide-up">
              {/* Header */}
              <div className="border-b border-line pb-4 flex justify-between items-end">
                <div>
                  <h1 className="text-[32px] font-extrabold tracking-tight text-ink">01_quickstart.md</h1>
                  <p className="text-[12px] text-blueprint font-mono mt-1">// get up and running on diagrid</p>
                </div>
                <div className="font-mono text-[11px] px-2 py-0.5 border border-line bg-paper text-ink-soft">
                  STATUS: STABLE
                </div>
              </div>
              
              {/* Card visual showcase */}
              <Card variant="blueprint" className="p-6 border-l-4 border-l-blueprint flex flex-col gap-4 bg-opacity-30 relative overflow-hidden">
                <div className="absolute right-[-20px] bottom-[-20px] text-blueprint opacity-10 pointer-events-none">
                  <Columns className="w-48 h-48" />
                </div>
                <span className="font-mono text-[11px] uppercase tracking-wider text-blueprint font-bold">// onboarding_system_check</span>
                <h2 className="text-[20px] font-bold tracking-tight">Drafting technical diagram layouts shouldn't feel like programming.</h2>
                <p className="text-[14px] text-ink-soft leading-relaxed max-w-[620px]">
                  Diagrid delivers a snap-locked blueprints canvas where developers, system architects, and students can layout designs visually. The interface is optimized to generate clean, technical layouts right out of your browser.
                </p>
              </Card>

              {/* Steps container */}
              <div className="flex flex-col gap-6 mt-2">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full border border-ink flex items-center justify-center font-mono text-[12px] font-bold shrink-0 bg-paper">01</div>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-[15px] font-bold text-ink uppercase font-mono">// initialize_projects</h3>
                    <p className="text-[14px] text-ink-soft leading-relaxed">
                      Go to your **Dashboard** page and click the `create_project()` button. A project represents a structured namespace folder to keep your diagram sheets (e.g. system APIs, database models, database tables) grouped cleanly.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full border border-ink flex items-center justify-center font-mono text-[12px] font-bold shrink-0 bg-paper">02</div>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-[15px] font-bold text-ink uppercase font-mono">// choose_layout_templates</h3>
                    <p className="text-[14px] text-ink-soft leading-relaxed">
                      Create a diagram sheet and choose between starter layouts (Entity Relationship Diagram vs Flowchart). The workspace auto-seeds pre-placed node schemas and orthogonal links so you never start with an intimidating blank screen.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full border border-ink flex items-center justify-center font-mono text-[12px] font-bold shrink-0 bg-paper">03</div>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-[15px] font-bold text-ink uppercase font-mono">// autosave_&_offline_caching</h3>
                    <p className="text-[14px] text-ink-soft leading-relaxed">
                      Diagrid works offline. All layout edits and freehand notes autosave in **1 second** to your browser's LocalStorage database cache. You can manage and wipe out cache data anytime in the **Settings** view.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'canvas' && (
            <div className="flex flex-col gap-6 animate-slide-up">
              {/* Header */}
              <div className="border-b border-line pb-4 flex justify-between items-end">
                <div>
                  <h1 className="text-[32px] font-extrabold tracking-tight text-ink">02_canvas.md</h1>
                  <p className="text-[12px] text-blueprint font-mono mt-1">// detailed grid, coordinate, and port mechanics</p>
                </div>
                <div className="font-mono text-[11px] px-2 py-0.5 border border-line bg-paper text-ink-soft">
                  REVISION: 4
                </div>
              </div>

              {/* Snap demonstration visual */}
              <div className="border border-line bg-grid relative p-8 h-[160px] flex items-center justify-center overflow-hidden">
                <div className="absolute top-2 left-3 font-mono text-[9px] text-blueprint">// snapping_simulation_matrix</div>
                
                {/* Visual snap outline mock */}
                <div className="border-[1.5px] border-ink bg-paper-raised shadow-hard-ink px-4 py-2 font-mono text-[11px] relative select-none animate-bounce" style={{ animationDuration: '4s' }}>
                  <div className="w-2.5 h-2.5 bg-blueprint rounded-full absolute -top-1.5 -left-1.5 border border-line"></div>
                  <span>[ snapped_node_coordinate ]</span>
                  <div className="text-[8px] text-ink-soft text-right mt-1">x: 120px | y: 80px</div>
                </div>

                <div className="absolute bottom-2 right-3 font-mono text-[8px] text-ink-soft">// node snaps to closest 20px cell</div>
              </div>

              {/* Placement Details */}
              <div className="flex flex-col gap-5 text-[14px] text-ink-soft leading-relaxed">
                <h3 className="text-[16px] font-bold text-ink uppercase font-mono tracking-wide border-b border-line pb-1.5">// shape_instantiation</h3>
                <p>
                  Instantiate elements on the workspace grid using the sidebar toolbox:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1 font-mono text-[11px]">
                  <Card variant="blueprint" className="p-4 flex flex-col gap-2">
                    <span className="font-bold text-ink uppercase">add_table_entity()</span>
                    <p className="text-ink-soft text-[11px] leading-relaxed">
                      Creates structural schemas containing attribute columns, datatype labels, and key definitions (PK/FK).
                    </p>
                  </Card>
                  <Card variant="ink" className="p-4 flex flex-col gap-2">
                    <span className="font-bold text-ink uppercase">add_process_box()</span>
                    <p className="text-ink-soft text-[11px] leading-relaxed">
                      Creates logic process rectangles, sequence headers, or Gantt sprint schedule timeline blocks.
                    </p>
                  </Card>
                </div>

                <h3 className="text-[16px] font-bold text-ink uppercase font-mono tracking-wide mt-4 border-b border-line pb-1.5">// handle_ports_&_connectors</h3>
                <p>
                  Connector links are generated visually from shape edge anchors:
                </p>
                <ul className="list-disc pl-5 flex flex-col gap-2">
                  <li>
                    Select a card in regular pointer mode to reveal its **port handles** (Top, Bottom, Left, Right).
                  </li>
                  <li>
                    Drag from any port handle to launch a relation line. Release the mouse cursor over a port handle on a different card to link them.
                  </li>
                  <li>
                    Connector paths use relative SVG coordinates, keeping arrow tips locked precisely to the card boundaries even as you drag shapes.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeSection === 'shortcuts' && (
            <div className="flex flex-col gap-6 animate-slide-up">
              {/* Header */}
              <div className="border-b border-line pb-4 flex justify-between items-end">
                <div>
                  <h1 className="text-[32px] font-extrabold tracking-tight text-ink">03_hotkeys.md</h1>
                  <p className="text-[12px] text-blueprint font-mono mt-1">// core shortcuts reference lookup table</p>
                </div>
                <div className="font-mono text-[11px] px-2 py-0.5 border border-line bg-paper text-ink-soft">
                  SHORTCUTS
                </div>
              </div>

              {/* Mode Visualizer toolbar cards */}
              <div className="grid grid-cols-4 gap-3">
                <Card variant="blueprint" className="p-3 text-center flex flex-col items-center justify-center gap-1.5">
                  <div className="w-8 h-8 rounded-full border border-line flex items-center justify-center bg-paper">
                    <MousePointer className="w-4 h-4 text-ink" />
                  </div>
                  <span className="font-mono font-bold text-[13px]">Select (V)</span>
                </Card>
                <Card variant="blueprint" className="p-3 text-center flex flex-col items-center justify-center gap-1.5">
                  <div className="w-8 h-8 rounded-full border border-line flex items-center justify-center bg-paper">
                    <Columns className="w-4 h-4 text-ink" />
                  </div>
                  <span className="font-mono font-bold text-[13px]">Marquee (M)</span>
                </Card>
                <Card variant="blueprint" className="p-3 text-center flex flex-col items-center justify-center gap-1.5">
                  <div className="w-8 h-8 rounded-full border border-line flex items-center justify-center bg-paper">
                    <Pencil className="w-4 h-4 text-ink" />
                  </div>
                  <span className="font-mono font-bold text-[13px]">Pencil (P)</span>
                </Card>
                <Card variant="blueprint" className="p-3 text-center flex flex-col items-center justify-center gap-1.5">
                  <div className="w-8 h-8 rounded-full border border-line flex items-center justify-center bg-paper">
                    <Hand className="w-4 h-4 text-ink" />
                  </div>
                  <span className="font-mono font-bold text-[13px]">Pan (H)</span>
                </Card>
              </div>

              {/* Interactive table */}
              <div className="border border-line font-mono text-[12px] mt-2 bg-paper">
                <div className="grid grid-cols-4 bg-paper-raised border-b border-line font-bold p-3 text-ink-soft">
                  <span>MODE</span>
                  <span>KEY</span>
                  <span className="col-span-2">ACTION DESCRIPTION</span>
                </div>
                <div className="grid grid-cols-4 border-b border-line p-3 hover:bg-paper-raised transition-colors">
                  <span className="font-bold text-ink">Select Mode</span>
                  <span className="text-blueprint font-bold">V</span>
                  <span className="col-span-2 text-ink-soft">Move shapes, connect lines, select paths, edit labels.</span>
                </div>
                <div className="grid grid-cols-4 border-b border-line p-3 hover:bg-paper-raised transition-colors">
                  <span className="font-bold text-ink">Marquee Selection</span>
                  <span className="text-blueprint font-bold">M</span>
                  <span className="col-span-2 text-ink-soft">Highlight nodes in a dashed rectangle selection to drag/delete.</span>
                </div>
                <div className="grid grid-cols-4 border-b border-line p-3 hover:bg-paper-raised transition-colors">
                  <span className="font-bold text-ink">Pencil Draw</span>
                  <span className="text-blueprint font-bold">P</span>
                  <span className="col-span-2 text-ink-soft">Freehand sketching or annotation tags (in signal red).</span>
                </div>
                <div className="grid grid-cols-4 border-b border-line p-3 hover:bg-paper-raised transition-colors">
                  <span className="font-bold text-ink">Pan Mode</span>
                  <span className="text-blueprint font-bold">H</span>
                  <span className="col-span-2 text-ink-soft">Grab the canvas sheet with left-click to move the viewport.</span>
                </div>
                <div className="grid grid-cols-4 p-3 bg-paper-raised hover:bg-paper transition-colors">
                  <span className="font-bold text-ink">Middle-Mouse</span>
                  <span className="text-blueprint font-bold">Drag</span>
                  <span className="col-span-2 text-ink-soft">Grabs and pans viewport immediately (works in all modes).</span>
                </div>
              </div>

              {/* Extra notes */}
              <h3 className="text-[16px] font-bold text-ink uppercase font-mono tracking-wide border-b border-line pb-1.5 mt-2">// shift_key_actions</h3>
              <div className="flex flex-col gap-2 font-mono text-[11px] text-ink-soft">
                <div>* **Multiple selection:** Hold `Shift` while left-clicking cards to select several nodes manually.</div>
                <div>* **Remove objects:** Select any element and click `Delete` or `Backspace` to clear it from database coordinates.</div>
              </div>
            </div>
          )}

          {activeSection === 'exports' && (
            <div className="flex flex-col gap-6 animate-slide-up">
              {/* Header */}
              <div className="border-b border-line pb-4 flex justify-between items-end">
                <div>
                  <h1 className="text-[32px] font-extrabold tracking-tight text-ink">04_exports.md</h1>
                  <p className="text-[12px] text-blueprint font-mono mt-1">// vector and raster graphic export formats</p>
                </div>
                <div className="font-mono text-[11px] px-2 py-0.5 border border-line bg-paper text-ink-soft">
                  EXPORT
                </div>
              </div>

              {/* Direct visual comparison cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                <Card variant="blueprint" className="p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="font-mono font-bold text-[13px] text-blueprint">VECTOR: SVG</span>
                    <FileText className="w-4 h-4 text-blueprint" />
                  </div>
                  <p className="text-[13px] text-ink-soft leading-relaxed">
                    Downloads coordinate vectors that scale perfectly to any dimensions. Ideal for client webpages, responsive markdown readme files, and GitHub docs embedding.
                  </p>
                </Card>

                <Card variant="ink" className="p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="font-mono font-bold text-[13px] text-ink">RASTER: PNG</span>
                    <Download className="w-4 h-4 text-ink" />
                  </div>
                  <p className="text-[13px] text-ink-soft leading-relaxed">
                    Generates clean raster files. Supports scale factors (`1x`, `2x`, `3x`) in the export window to output high-density raster prints for academic papers or thesis attachments.
                  </p>
                </Card>
              </div>

              {/* Detailed Guidelines */}
              <div className="flex flex-col gap-4 text-[14px] text-ink-soft leading-relaxed mt-2">
                <h3 className="text-[16px] font-bold text-ink uppercase font-mono tracking-wide border-b border-line pb-1.5">// resolution_scale_guidelines</h3>
                <p>
                  For documents that will be printed or graded (e.g. BSIT/BSCS thesis outputs), export at **2x or 3x scale**. Standard 1x preview images may appear blurry or pixelated in layout documents due to high-density screen spacing. 2x/3x multipliers increase exported canvas pixel densities to guarantee crisp prints.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'erd' && (
            <div className="flex flex-col gap-6 animate-slide-up">
              {/* Header */}
              <div className="border-b border-line pb-4 flex justify-between items-end">
                <div>
                  <h1 className="text-[32px] font-extrabold tracking-tight text-ink">erd_notation.md</h1>
                  <p className="text-[12px] text-blueprint font-mono mt-1">// database schemas and relationships guides</p>
                </div>
                <div className="font-mono text-[11px] px-2 py-0.5 border border-line bg-paper text-ink-soft">
                  DATABASE
                </div>
              </div>

              {/* Visual DB table illustration */}
              <div className="border border-line bg-paper p-5 max-w-[320px] shadow-hard-ink mx-auto font-mono text-[11px] select-none">
                <div className="border-b border-line pb-2 mb-2 flex justify-between items-center">
                  <span className="font-bold text-blueprint uppercase">users_table</span>
                  <span className="text-ink-soft text-[9px]">x: 20 | y: 30</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-ink font-bold">id uuid pk</span>
                    <span className="text-blueprint font-bold">PK</span>
                  </div>
                  <div className="flex justify-between">
                    <span>username varchar</span>
                    <span className="text-ink-soft">ATTR</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-soft">profile_id uuid fk</span>
                    <span className="text-blueprint">FK</span>
                  </div>
                </div>
              </div>

              {/* Data guides */}
              <div className="flex flex-col gap-5 text-[14px] text-ink-soft leading-relaxed">
                <h3 className="text-[16px] font-bold text-ink uppercase font-mono tracking-wide border-b border-line pb-1.5">// column_syntax</h3>
                <p>
                  Edit attributes within the selected card's sidebar inspector. List fields in shorthand format `[field_name] [type] [key]` to map tables. Key qualifiers (`pk` or `fk`) are visually styled right-aligned inside the table card layout.
                </p>

                <h3 className="text-[16px] font-bold text-ink uppercase font-mono tracking-wide mt-2 border-b border-line pb-1.5">// cardinality_multiplicities</h3>
                <p>
                  Connector line labels map the following data relations:
                </p>
                <div className="border border-line font-mono text-[12px] bg-paper">
                  <div className="grid grid-cols-3 bg-paper-raised border-b border-line font-bold p-3 text-ink-soft">
                    <span>RELATION</span>
                    <span>LABEL TEXT</span>
                    <span>EXAMPLES</span>
                  </div>
                  <div className="grid grid-cols-3 border-b border-line p-3">
                    <span className="font-bold text-ink">One-to-Many</span>
                    <span className="text-blueprint">1:N</span>
                    <span className="text-ink-soft">`users` owns `projects`</span>
                  </div>
                  <div className="grid grid-cols-3 border-b border-line p-3">
                    <span className="font-bold text-ink">One-to-One</span>
                    <span className="text-blueprint">1:1</span>
                    <span className="text-ink-soft">`users` profile link</span>
                  </div>
                  <div className="grid grid-cols-3 p-3">
                    <span className="font-bold text-ink">Many-to-Many</span>
                    <span className="text-blueprint">N:M</span>
                    <span className="text-ink-soft">`students` join `classes`</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'flowchart' && (
            <div className="flex flex-col gap-6 animate-slide-up">
              {/* Header */}
              <div className="border-b border-line pb-4 flex justify-between items-end">
                <div>
                  <h1 className="text-[32px] font-extrabold tracking-tight text-ink">flowchart_logic.md</h1>
                  <p className="text-[12px] text-blueprint font-mono mt-1">// sequential algorithm workflows and systems branching</p>
                </div>
                <div className="font-mono text-[11px] px-2 py-0.5 border border-line bg-paper text-ink-soft">
                  FLOWCHART
                </div>
              </div>

              {/* Interactive preview shapes visual */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 font-mono text-[11px]">
                <Card variant="ink" className="p-4 flex flex-col justify-between min-h-[150px] shadow-hard-ink">
                  <div className="border-b border-line pb-1.5">
                    <span className="font-bold text-ink uppercase">Process Rectangle</span>
                  </div>
                  <p className="text-ink-soft leading-relaxed pt-2">
                    Used for active processing declarations, variable assignments, mathematical logic, and arithmetic steps.
                  </p>
                </Card>

                <Card variant="blueprint" className="p-4 flex flex-col justify-between min-h-[150px] shadow-hard-blueprint">
                  <div className="border-b border-line pb-1.5">
                    <span className="font-bold text-blueprint uppercase">Decision Diamond</span>
                  </div>
                  <p className="text-ink-soft leading-relaxed pt-2">
                    Used to query logical true/false constraints. Outputs multiple labeled branches (e.g. `YES` and `NO`).
                  </p>
                </Card>

                <Card variant="signal" className="p-4 flex flex-col justify-between min-h-[150px] shadow-hard-signal">
                  <div className="border-b border-line pb-1.5">
                    <span className="font-bold text-signal uppercase">Terminal Oval</span>
                  </div>
                  <p className="text-ink-soft leading-relaxed pt-2">
                    Indicates system boundary limits (e.g., `START` and `STOP` tags).
                  </p>
                </Card>
              </div>

              {/* Instructions */}
              <div className="flex flex-col gap-4 text-[14px] text-ink-soft leading-relaxed mt-2">
                <h3 className="text-[16px] font-bold text-ink uppercase font-mono tracking-wide border-b border-line pb-1.5">// sequential_flows</h3>
                <p>
                  Flowcharts should flow left-to-right or top-to-bottom. Double-click line connector labels to write yes/no branching paths from decision diamonds, and set lines as dashed (`style = dashed`) to indicate background calls.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'sequence' && (
            <div className="flex flex-col gap-6 animate-slide-up">
              {/* Header */}
              <div className="border-b border-line pb-4 flex justify-between items-end">
                <div>
                  <h1 className="text-[32px] font-extrabold tracking-tight text-ink">sequence_flow.md</h1>
                  <p className="text-[12px] text-blueprint font-mono mt-1">// timelines of async message pass lifecycles</p>
                </div>
                <div className="font-mono text-[11px] px-2 py-0.5 border border-line bg-paper text-ink-soft">
                  SEQUENCE
                </div>
              </div>

              <div className="flex flex-col gap-5 text-[14px] text-ink-soft leading-relaxed">
                <p>
                  Sequence Diagrams map chronological operations across architectural layers (e.g., Web Clients, API Gateways, databases).
                </p>

                <h3 className="text-[16px] font-bold text-ink uppercase font-mono tracking-wide mt-2 border-b border-line pb-1.5">// lifeline_headers</h3>
                <p>
                  Add process ovals to act as lifelines. Place them side-by-side:
                </p>
                <div className="grid grid-cols-3 border border-line p-4 font-mono text-[11px] bg-paper text-center">
                  <div className="border border-ink py-2 bg-paper-raised font-bold">[ client_app ]</div>
                  <div className="flex items-center justify-center font-bold text-blueprint">-------------&gt;</div>
                  <div className="border border-ink py-2 bg-paper-raised font-bold">[ api_gateway ]</div>
                </div>

                <h3 className="text-[16px] font-bold text-ink uppercase font-mono tracking-wide mt-4 border-b border-line pb-1.5">// messaging_semantics</h3>
                <ul className="list-disc pl-5 flex flex-col gap-2">
                  <li>
                    **Solid Lines:** Synchronous HTTP calls or RPC actions expecting dynamic response payloads.
                  </li>
                  <li>
                    **Dashed Lines:** Return values, response states, or background asynchronous calls.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeSection === 'class' && (
            <div className="flex flex-col gap-6 animate-slide-up">
              {/* Header */}
              <div className="border-b border-line pb-4 flex justify-between items-end">
                <div>
                  <h1 className="text-[32px] font-extrabold tracking-tight text-ink">class_objects.md</h1>
                  <p className="text-[12px] text-blueprint font-mono mt-1">// object-oriented class member visibilities</p>
                </div>
                <div className="font-mono text-[11px] px-2 py-0.5 border border-line bg-paper text-ink-soft">
                  CLASS
                </div>
              </div>

              <div className="flex flex-col gap-5 text-[14px] text-ink-soft leading-relaxed">
                <p>
                  Class diagrams structure programmatic code scopes. Properties prefix methods using visible modifier shortcuts:
                </p>

                <div className="border border-line font-mono text-[12px] bg-paper">
                  <div className="grid grid-cols-3 bg-paper-raised border-b border-line font-bold p-3 text-ink-soft">
                    <span>PREFIX</span>
                    <span>VISIBILITY</span>
                    <span>DESCRIPTION</span>
                  </div>
                  <div className="grid grid-cols-3 border-b border-line p-3">
                    <span className="font-bold text-ink">+</span>
                    <span className="font-bold">Public</span>
                    <span className="text-ink-soft">Accessible globally (e.g. `+getUser()`).</span>
                  </div>
                  <div className="grid grid-cols-3 border-b border-line p-3">
                    <span className="font-bold text-ink">-</span>
                    <span className="font-bold">Private</span>
                    <span className="text-ink-soft">Internal access only (e.g. `-tokenString`).</span>
                  </div>
                  <div className="grid grid-cols-3 p-3">
                    <span className="font-bold text-ink">#</span>
                    <span className="font-bold">Protected</span>
                    <span className="text-ink-soft">Subclass namespace access.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'gantt' && (
            <div className="flex flex-col gap-6 animate-slide-up">
              {/* Header */}
              <div className="border-b border-line pb-4 flex justify-between items-end">
                <div>
                  <h1 className="text-[32px] font-extrabold tracking-tight text-ink">gantt_schedule.md</h1>
                  <p className="text-[12px] text-blueprint font-mono mt-1">// project milestones and duration constraints</p>
                </div>
                <div className="font-mono text-[11px] px-2 py-0.5 border border-line bg-paper text-ink-soft">
                  GANTT
                </div>
              </div>

              <div className="flex flex-col gap-5 text-[14px] text-ink-soft leading-relaxed">
                <p>
                  Gantt charts schedule team sprints, timelines, and milestones:
                </p>
                <ul className="list-disc pl-5 flex flex-col gap-2">
                  <li>
                    Place process blocks as timeline tasks (e.g. `DB Setup`, `Auth Integration`).
                  </li>
                  <li>
                    Draw connection paths linking the right handle of Task A to the left handle of Task B to mark execution pre-requisites.
                  </li>
                  <li>
                    Double-click connector edges to write deadline margins (e.g., `3 days`).
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeSection === 'dfd' && (
            <div className="flex flex-col gap-6 animate-slide-up">
              {/* Header */}
              <div className="border-b border-line pb-4 flex justify-between items-end">
                <div>
                  <h1 className="text-[32px] font-extrabold tracking-tight text-ink">dfd_diagrams.md</h1>
                  <p className="text-[12px] text-blueprint font-mono mt-1">// data flow diagrams — logical data stream mapping</p>
                </div>
                <div className="font-mono text-[11px] px-2 py-0.5 border border-line bg-paper text-ink-soft">
                  DFD
                </div>
              </div>

              <div className="flex flex-col gap-5 text-[14px] text-ink-soft leading-relaxed">
                <p>
                  Data Flow Diagrams model how information moves through a system — from external entities, through processing steps, and into persistent data stores. DFDs are commonly used in systems analysis to document logical data flows without specifying implementation details.
                </p>

                <div className="border border-line font-mono text-[12px] bg-paper">
                  <div className="grid grid-cols-3 bg-paper-raised border-b border-line font-bold p-3 text-ink-soft">
                    <span>NODE TYPE</span>
                    <span>SHAPE</span>
                    <span>PURPOSE</span>
                  </div>
                  <div className="grid grid-cols-3 border-b border-line p-3">
                    <span className="font-bold text-ink">External Entity</span>
                    <span>Rectangle (double-border)</span>
                    <span className="text-ink-soft">Source or sink outside the system boundary.</span>
                  </div>
                  <div className="grid grid-cols-3 border-b border-line p-3">
                    <span className="font-bold text-ink">DFD Process</span>
                    <span>Rectangle (split header)</span>
                    <span className="text-ink-soft">A transformation step: numbered ID + name.</span>
                  </div>
                  <div className="grid grid-cols-3 p-3">
                    <span className="font-bold text-ink">Data Store</span>
                    <span>Open-sided rectangle</span>
                    <span className="text-ink-soft">Persistent storage (DB table, file, cache).</span>
                  </div>
                </div>

                <ul className="list-disc pl-5 flex flex-col gap-2">
                  <li>
                    Place <strong>External Entity</strong> nodes at the edges of your canvas — they represent users, external systems, or hardware devices.
                  </li>
                  <li>
                    Use <strong>DFD Process</strong> nodes in the center. The label format is `1.0 Process Name` — the number prefix identifies the process level.
                  </li>
                  <li>
                    Connect entities → processes → stores using directional edges. Label edges with the data being transferred (e.g., `credentials`, `query_result`).
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeSection === 'usecase' && (
            <div className="flex flex-col gap-6 animate-slide-up">
              {/* Header */}
              <div className="border-b border-line pb-4 flex justify-between items-end">
                <div>
                  <h1 className="text-[32px] font-extrabold tracking-tight text-ink">usecase_diagrams.md</h1>
                  <p className="text-[12px] text-blueprint font-mono mt-1">// use case diagrams — actor-system interaction mapping</p>
                </div>
                <div className="font-mono text-[11px] px-2 py-0.5 border border-line bg-paper text-ink-soft">
                  USE CASE
                </div>
              </div>

              <div className="flex flex-col gap-5 text-[14px] text-ink-soft leading-relaxed">
                <p>
                  Use Case Diagrams capture what a system does from the user's perspective. They show actors (people or external systems) and the use cases (actions) they can perform, all enclosed within a system boundary.
                </p>

                <div className="border border-line font-mono text-[12px] bg-paper">
                  <div className="grid grid-cols-3 bg-paper-raised border-b border-line font-bold p-3 text-ink-soft">
                    <span>NODE TYPE</span>
                    <span>SHAPE</span>
                    <span>PURPOSE</span>
                  </div>
                  <div className="grid grid-cols-3 border-b border-line p-3">
                    <span className="font-bold text-ink">Actor</span>
                    <span>Stick figure</span>
                    <span className="text-ink-soft">A user or external system that interacts with the system.</span>
                  </div>
                  <div className="grid grid-cols-3 border-b border-line p-3">
                    <span className="font-bold text-ink">Use Case</span>
                    <span>Oval / ellipse</span>
                    <span className="text-ink-soft">A specific action or function the system provides.</span>
                  </div>
                  <div className="grid grid-cols-3 p-3">
                    <span className="font-bold text-ink">System Boundary</span>
                    <span>Dashed rectangle</span>
                    <span className="text-ink-soft">Encloses all use cases belonging to the system scope.</span>
                  </div>
                </div>

                <ul className="list-disc pl-5 flex flex-col gap-2">
                  <li>
                    Place <strong>Actor</strong> stick figures outside the system boundary on the left or right of your canvas.
                  </li>
                  <li>
                    Drop a <strong>System Boundary</strong> rectangle first, then place <strong>Use Case</strong> ovals inside it.
                  </li>
                  <li>
                    Draw edges from actors to the use cases they interact with. Use edge labels for relationship types (e.g., `&lt;&lt;include&gt;&gt;`, `&lt;&lt;extend&gt;&gt;`).
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeSection === 'activity' && (
            <div className="flex flex-col gap-6 animate-slide-up">
              {/* Header */}
              <div className="border-b border-line pb-4 flex justify-between items-end">
                <div>
                  <h1 className="text-[32px] font-extrabold tracking-tight text-ink">activity_diagrams.md</h1>
                  <p className="text-[12px] text-blueprint font-mono mt-1">// activity diagrams — workflow and concurrency modeling</p>
                </div>
                <div className="font-mono text-[11px] px-2 py-0.5 border border-line bg-paper text-ink-soft">
                  ACTIVITY
                </div>
              </div>

              <div className="flex flex-col gap-5 text-[14px] text-ink-soft leading-relaxed">
                <p>
                  Activity Diagrams model the flow of actions in a process — including sequential steps, conditional branching, and parallel execution (fork/join). They're ideal for documenting business logic, API request handling, and multi-step workflows.
                </p>

                <div className="border border-line font-mono text-[12px] bg-paper">
                  <div className="grid grid-cols-3 bg-paper-raised border-b border-line font-bold p-3 text-ink-soft">
                    <span>NODE TYPE</span>
                    <span>SHAPE</span>
                    <span>PURPOSE</span>
                  </div>
                  <div className="grid grid-cols-3 border-b border-line p-3">
                    <span className="font-bold text-ink">Initial Node</span>
                    <span>Filled black circle</span>
                    <span className="text-ink-soft">Entry point — every diagram starts here.</span>
                  </div>
                  <div className="grid grid-cols-3 border-b border-line p-3">
                    <span className="font-bold text-ink">Action State</span>
                    <span>Rounded rectangle</span>
                    <span className="text-ink-soft">A single step or operation in the workflow.</span>
                  </div>
                  <div className="grid grid-cols-3 border-b border-line p-3">
                    <span className="font-bold text-ink">Branch / Merge</span>
                    <span>Diamond</span>
                    <span className="text-ink-soft">Conditional split or convergence point.</span>
                  </div>
                  <div className="grid grid-cols-3 border-b border-line p-3">
                    <span className="font-bold text-ink">Fork / Join Bar</span>
                    <span>Thick horizontal bar</span>
                    <span className="text-ink-soft">Split into parallel flows (fork) or synchronize (join).</span>
                  </div>
                  <div className="grid grid-cols-3 p-3">
                    <span className="font-bold text-ink">Final Node</span>
                    <span>Ring with inner dot</span>
                    <span className="text-ink-soft">Termination — the workflow ends here.</span>
                  </div>
                </div>

                <ul className="list-disc pl-5 flex flex-col gap-2">
                  <li>
                    Start every diagram with an <strong>Initial Node</strong> (filled circle) at the top.
                  </li>
                  <li>
                    Chain <strong>Action States</strong> vertically. Use <strong>Branch Diamonds</strong> for conditional logic — label outgoing edges with guard conditions in square brackets (e.g., `[valid]`, `[amount &gt; 100]`).
                  </li>
                  <li>
                    Use <strong>Fork/Join Bars</strong> to model parallel execution. A fork bar splits one flow into multiple; a join bar waits for all parallel flows to complete before continuing.
                  </li>
                  <li>
                    End the diagram with a <strong>Final Node</strong> (ring with inner dot).
                  </li>
                </ul>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Inject custom CSS keyframe animations for smooth content loading */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
        .animate-slide-up {
          animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};
