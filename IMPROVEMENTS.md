# Diagrid — Proposed Improvements & Technical Roadmap

This document outlines prioritized technical and user-experience improvements for **Diagrid**, covering architecture, performance, canvas capabilities, security, and developer workflow.

---

## 1. Architecture & Code Maintainability

### A. Modularize `Editor.tsx` (~5,800+ lines)
The primary editor component currently encapsulates the canvas rendering engine, interaction state, history tracking, properties panel, drawing tools, edge routing, code generation, and modal triggers in a single file.

* **Target Architecture**:
  * **`src/hooks/canvas/`**:
    * `useCanvasHistory.ts`: Encapsulates snapshot stack (`list`, `index`), `undo()`, `redo()`, dirty checking, and history trimming.
    * `useCanvasSelection.ts`: Manages single/multi-selection, marquee drag-select box, clipboard (cut, copy, paste), and duplicate offsets.
    * `useCanvasTransform.ts`: Handles zoom calculations, canvas panning, grid snapping, scrollbar drag coordinates, and minimap viewport math.
    * `useEdgeInteractions.ts`: Manages port hover detection, temporary edge drawing, waypoint manipulation, and endpoint reconnection.
  * **`src/components/canvas/`**:
    * `CanvasToolbar.tsx`: Top mode switchers, undo/redo buttons, zoom controls, and export/share action triggers.
    * `PropertiesSidebar.tsx`: Selected node inspector, table column editors, color pickers, and typography adjustments.
    * `EdgeLayer.tsx`: SVG rendering of orthogonal connectors, manual waypoint handles, edge labels, and endpoint dragging hitboxes.
    * `FreehandLayer.tsx`: Drawing paths, highlighter strokes, and stroke eraser interactions.
    * `Minimap.tsx`: Canvas overview map and draggable viewport rectangle.
    * `NodeRenderer.tsx`: Individual shape and ERD card elements with selection bounds.

### B. Resolve React Hook Exhaustive-Deps Warnings
Oxlint identifies 23 react-hooks warnings in `Editor.tsx` caused by inline functions like `saveHistoryState` being created anew on every render:
* **Remediation**:
  * Stabilize history dispatch using `useCallback` or a dispatch ref.
  * Memoize mouse handler callbacks (`handleNodeDragMouseMove`, `handleResizeMouseMove`, `updateEditableEdgeInteraction`) to prevent event listener thrashing.

---

## 2. Bundle Optimization & Performance

### A. Route Code-Splitting with `React.lazy`
Currently, `src/App.tsx` imports all 20+ pages statically, generating a single production bundle of **~1.57 MB** minified (`index-*.js`).

* **Action Items**:
  * Implement `React.lazy()` and `<Suspense>` in `src/App.tsx`:
    * Heavy pages: `Editor.tsx`, `Docs.tsx`, `Templates.tsx`
    * Admin pages: `AdminOverview.tsx`, `AdminUsers.tsx`, `AdminStorage.tsx`, `AdminFeedback.tsx`, `AdminActivity.tsx`, `AdminSystem.tsx`
  * Dynamically import heavy export utilities (`jspdf`, `html2canvas`, and `mermaid`) only when invoking the corresponding export dialog or code generator.
* **Impact**: 60–75% reduction in initial landing and dashboard load payload.

### B. Canvas Rendering Optimization
* **Component Memoization**: Wrap canvas cards and nodes in `React.memo` with custom comparator functions so dragging one node does not re-render unaffected nodes.
* **Canvas Culling (Virtualization)**: Skip rendering DOM/SVG nodes located completely outside the current viewport bounding box when canvas diagrams exceed 100+ shapes.

---

## 3. Canvas & Feature Enhancements

### A. Multi-Node Alignment & Distribution
Add alignment controls when multiple nodes are selected (`selectedNodeIds.length > 1`):
* **Horizontal/Vertical Align**: Align Left, Align Center, Align Right, Align Top, Align Middle, Align Bottom.
* **Equal Distribution**: Distribute horizontal or vertical gaps evenly between selected items.

### B. Smart Alignment Guides (Magnetic Snap)
* Supplement the static 20px grid snap with dynamic smart guides (dashed alignment lines) that appear when a dragged card's center or edges align with neighboring cards on the canvas.

### C. Node Grouping (`Ctrl+G` / `Ctrl+Shift+G`)
* Allow users to group related shapes and tables into a shared container frame. Moving, copying, or deleting the group operates on all child elements as an atomic unit.

### D. Multiplayer Presence (Supabase Realtime)
* Utilize Supabase Realtime Presence to display live collaborator cursors (`{ x, y, username, avatar, color }`) and active node selections on the canvas.

---

## 4. Backend, Security & Data Integrity

### A. Apply Supporter Badge Security Migration
* Apply `supabase/migrations/20260918000001_secure_supporter_badges.sql` to revoke client updates on `profiles.is_supporter` and restrict badge grants to the `public.set_user_supporter_status()` RPC guarded by `public.is_admin()`.

### B. Diagram Content Schema Validation
* Implement a runtime schema validator (e.g. Zod) for the `diagrams.content` JSON payload. Validate node structure, coordinates, and edge references during cloud load and Mermaid import to protect against data corruption.

### C. Concurrent Offline Sync Conflict Handling
* Extend `src/services/offlineSyncService.ts` to detect concurrent remote updates when reconnecting, offering users a "Merge or Keep Separate Copy" choice instead of silent overwrite.

---

## 5. Testing & Developer Experience

### A. Modernize Unit Testing with Vitest
* Replace Node's ad-hoc TAP runner (`node tests/offlineSync.test.cjs`) with **Vitest**:
  * Native TypeScript and ESM support without `.cjs` wrappers.
  * Fast watch mode and component test coverage via React Testing Library.

### B. Visual Regression Snapshots
* Extend Playwright (`playwright.config.ts`) to capture visual regression snapshots of diagram templates across Blueprint, Dark, and Light themes to catch styling or path routing defects before deployment.

---

## 6. Implementation Roadmap

| Priority | Initiative | Estimated Effort | Key Files |
| :--- | :--- | :--- | :--- |
| **P1** | Route Lazy Loading & Bundle Splitting | Low | `src/App.tsx`, `vite.config.ts` |
| **P1** | Apply Supporter Badge Migration & Tests | Low | `supabase/migrations/`, `src/services/adminService.ts` |
| **P1** | Fix React Hook Exhaustive-Deps Warnings | Low-Med | `src/pages/Editor.tsx` |
| **P2** | Decompose `Editor.tsx` into Custom Hooks | Med | `src/pages/Editor.tsx`, `src/hooks/canvas/` |
| **P2** | Multi-Node Alignment & Distribution Tools | Med | `src/pages/Editor.tsx`, `src/utils/` |
| **P2** | Migrate Test Suite to Vitest | Med | `package.json`, `tests/` |
| **P3** | Smart Alignment Guides (Magnetic Snapping)| Med-High | `src/pages/Editor.tsx`, `src/utils/edgeRouting.ts` |
| **P3** | Realtime Multi-Cursor Collaboration | High | `src/services/supabase.ts`, `src/pages/Editor.tsx` |
