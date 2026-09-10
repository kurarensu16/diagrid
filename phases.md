# Diagrid — Detailed Development Phases (Visual Drag-and-Drop Editor)

This document outlines the detailed execution plan for **Diagrid**, pivoted from text-to-diagram to a **Visual Drag-and-Drop Blueprint Diagramming Tool** (direct direct canvas interaction, shape nodes, flow edges, and inline inspector tools).

---

## Phase 1: Project & Theme Alignment (Completed)
* Setup React 19 + TypeScript + Vite + Tailwind CSS.
* Configure custom colors, fonts (Space Grotesk & JetBrains Mono), and sharp border styling.

---

## Phase 2: Mock Database JSON Adaptation
* **Goal:** Update the storage engine to serialize coordinate-based nodes and edges instead of raw text.
* **Tasks:**
  * Update `Diagram` interface in `mockDb.ts`:
    * Replace `content: string` (Mermaid code) with a structured JSON string holding `nodes: Node[]` and `edges: Edge[]`.
  * Update starter seed templates to pre-position nodes (e.g. `users`, `projects`, `diagrams`) with explicit coordinates.

---

## Phase 3: Core Canvas Dragging Engine
* **Goal:** Build the absolute node translation and movement engine.
* **Tasks:**
  * Implement mouse event trackers (`onMouseDown`, `onMouseMove`, `onMouseUp`) for node elements on a grid-locked background.
  * Clamp coordinates to grid alignments (e.g. snap-to-grid of 10px or 20px).
  * Build viewport panning and zooming transforms for the canvas container.

---

## Phase 4: Dynamic SVG Edge Renderer
* **Goal:** Connect node shapes visually using SVG arrow paths.
* **Tasks:**
  * Define connection ports (Top, Bottom, Left, Right handles) on nodes.
  * Program automatic orthogonal or straight path calculations between source and target handle coordinates.
  * Render edges as dashed or solid SVG paths with arrow markers.

---

## Phase 5: Landing Page Drag-and-Drop Porting
* **Goal:** Update landing page copy and demonstrate the drag mechanics instantly.
* **Tasks:**
  * Update S01 Landing page copy to highlight Direct Visual Drafting.
  * Re-engineer the Hero demonstration panel:
    * Left side: Lists a simple toolbox of shapes.
    * Right side: An interactive mini-canvas allowing users to drag cards directly on the landing page!

---

## Phase 6: Selected Node Inspector & Toolbar
* **Goal:** Allow node resizing, text renaming, and color shifting.
* **Tasks:**
  * Implement click selection on nodes.
  * Build a Sidebar properties panel:
    * Rename titles.
    * Add, edit, or remove fields/columns (specifically in ERD database mode).
    * Delete nodes or edges.
  * Add canvas controls (Zoom In, Zoom Out, Fit View, Clear).

---

## Phase 7: Connect-Port Interactivity
* **Goal:** Let users connect boxes visually by dragging from one handle to another.
* **Tasks:**
  * Track "drag edge" state (dragging connection line from Port A).
  * Render a temporary dynamic line tracking the cursor pointer.
  * On mouse up on Port B, create a new edge entry in database state.

---

## Phase 8: Template Gallery Integration
* **Goal:** Seed pre-positioned schemas for Flowcharts, ERDs, and Sequences.
* **Tasks:**
  * Wire the S06 template selection cards to create pre-laid out visual nodes.
  * Enable PDF/PNG downloads of the drawn SVG canvas bounds.

---

## Phase 9: Supabase Tables & Realtime Sync
* **Goal:** Sync visual coordinate states to Postgres.
* **Tasks:**
  * Store JSON payloads in Postgres `diagrams.content` field.
  * Wire realtime client mutations to save node drag positions seamlessly.

---

## Phase 10: Launch & Vercel Deploy
* Deploy final client workspace build.
