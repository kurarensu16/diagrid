# Diagrid — Product & Technical Plan

> Diagramming web app for ERDs and other technical diagrams, positioned for Philippine BSIT/BSCS students and freelance devs. Name: Diagrid (diagram + grid).

---

## 1. Vision

Eraser.io and Lucidchart cover general-purpose diagramming well, but neither fully supports some diagram types commonly needed in technical documentation — particularly **DFDs, Use Case Diagrams, and Activity Diagrams**. Diagrid aims to be a fast, no-friction diagramming tool for freelance developers, solo builders, and small teams: text-to-diagram for common types (ERD, flowchart, sequence, class, Gantt), with broader diagram-type coverage as the long-term differentiator, plus clean export formats for embedding into client docs, READMEs, and technical specs.

## 2. Target Audience

- **Primary:** Freelance developers and solo builders who need to quickly document system design for client work or personal projects
- **Secondary:** Small dev teams wanting a lightweight, fast alternative to heavier tools like Lucidchart

## 3. Differentiation

| Eraser.io / Lucidchart                     | Diagrid                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| General dev diagrams (ERD, flow, sequence) | Same, plus DFD / Use Case / Activity diagrams                           |
| Generic export                             | Export formats suited for embedding into client documentation and specs |
| Built for broad/enterprise use             | Built lean and fast for individuals and small teams                     |

## 4. Phased Roadmap

- **Phase 1 (MVP):** Text-to-diagram editor using Mermaid syntax — ERD, Flowchart, Sequence, Class, Gantt. Save/load projects, PNG/SVG export.
- **Phase 2:** Visual drag-and-drop canvas mode (React Flow) for ERD + Flowchart specifically.
- **Phase 3:** DFD, Use Case, Activity diagrams — custom-rendered, since Mermaid doesn't support them. This is the core differentiator.
- **Phase 4:** Sharing/collaboration, Word/PDF export, SaaS pricing tiers, AI-assisted diagram generation from text/code (Gemini/Claude API).

This doc details Phase 1 fully; Phases 2–4 are scoped at a high level and will get their own planning pass once Phase 1 ships.

---

## 5. Functional Requirements — Phase 1 (MVP)

| ID   | Requirement                                                                                               |
| ---- | --------------------------------------------------------------------------------------------------------- |
| FR01 | User can sign up / log in via Supabase Auth (email + password, optionally Google OAuth)                   |
| FR02 | User can create, rename, and delete a project (a folder grouping diagrams)                                |
| FR03 | User can create a new diagram inside a project, selecting type: ERD, Flowchart, Sequence, Class, or Gantt |
| FR04 | User can write Mermaid syntax in a code editor pane with a live-rendered preview alongside                |
| FR05 | User can rename and delete diagrams                                                                       |
| FR06 | Diagrams auto-save on change (debounced) with a manual "Save" affordance as fallback                      |
| FR07 | User can export a diagram as PNG                                                                          |
| FR08 | User can export a diagram as SVG                                                                          |
| FR09 | User can duplicate an existing diagram                                                                    |
| FR10 | User can start from a pre-built template per diagram type (e.g., a starter ERD with sample entities)      |
| FR11 | User can view a dashboard listing all their projects, with diagram counts                                 |
| FR12 | User can search/filter diagrams by name within a project                                                  |
| FR13 | Editor surfaces basic syntax errors when Mermaid syntax is invalid                                        |
| FR14 | User can zoom and pan the diagram preview canvas                                                          |
| FR15 | User can view their account settings and sign out                                                         |

### Phase 2+ (high-level, to detail later)

- Visual node-and-edge canvas editing (React Flow) for ERD and Flowchart types
- Diagram sharing via public link (read-only)
- DFD / Use Case / Activity diagram types with custom renderer
- Word/PDF export matching academic formatting conventions
- AI-assisted diagram generation from pasted code or text description
- Paid tiers (project limits, export limits, collaboration seats)

---

## 6. Non-Functional Requirements

| ID    | Requirement                                                                                                                 |
| ----- | --------------------------------------------------------------------------------------------------------------------------- |
| NFR01 | Diagram preview re-renders within ~300ms of a syntax change (debounced input)                                               |
| NFR02 | Supports latest Chrome, Edge, and Firefox; no legacy browser support required                                               |
| NFR03 | Dashboard is mobile-responsive; the editor itself targets desktop/tablet (diagram editing needs screen real estate)         |
| NFR04 | All data persisted in Supabase Postgres with Row Level Security scoped per user                                             |
| NFR05 | Export operations (PNG/SVG) complete within 2 seconds for typical diagram sizes                                             |
| NFR06 | Diagram storage model (Mermaid source as text) is structured so Phase 2's canvas mode can be added without a data migration |
| NFR07 | Codebase organized so Phase 3's custom diagram types can plug in as new renderer modules without touching Phase 1 code      |

---

## 7. Tech Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **Diagram rendering:** Mermaid.js (Phase 1) → React Flow added in Phase 2 for canvas mode
- **Code editor:** CodeMirror 6 (lightweight, good Mermaid/syntax-highlighting support)
- **Backend:** Supabase (Postgres, Auth, Storage — for exported image files)
- **Hosting:** Vercel
- **Future (Phase 4):** Claude or Gemini API for AI-assisted diagram generation

## 8. Data Model — Phase 1

```
users            (managed by Supabase Auth)

projects
  id              uuid, pk
  user_id         uuid, fk -> users.id
  name            text
  description     text, nullable
  created_at      timestamptz
  updated_at      timestamptz

diagrams
  id              uuid, pk
  project_id      uuid, fk -> projects.id
  title           text
  type            enum (erd, flowchart, sequence, class, gantt)
  content         text          -- raw Mermaid source
  thumbnail_url   text, nullable -- cached render for dashboard previews
  created_at      timestamptz
  updated_at      timestamptz

templates
  id              uuid, pk
  type            enum (erd, flowchart, sequence, class, gantt)
  title           text
  content         text          -- starter Mermaid source
  is_featured     boolean
```

**Relationships:** `users` 1—N `projects`; `projects` 1—N `diagrams`; `templates` standalone, referenced when a user creates a new diagram from a starting point.

## 9. Screen List — Phase 1

| ID  | Screen                                                   |
| --- | -------------------------------------------------------- |
| S01 | Landing page                                             |
| S02 | Sign up / Login                                          |
| S03 | Dashboard (project list)                                 |
| S04 | Project view (diagrams within a project)                 |
| S05 | Diagram editor (split pane: Mermaid code + live preview) |
| S06 | Template gallery                                         |
| S07 | Export modal (PNG/SVG options)                           |
| S08 | Account settings                                         |

## 10. Suggested Sprint Plan (solo, part-time)

| Sprint       | Focus                                                                      |
| ------------ | -------------------------------------------------------------------------- |
| 1 (1–2 wks) | Project setup, Supabase schema + RLS, auth flow, skeleton dashboard        |
| 2            | Project CRUD, diagram CRUD, routing between dashboard → project → editor |
| 3            | CodeMirror + Mermaid integration, debounced live preview, error feedback   |
| 4            | Template gallery, PNG/SVG export, thumbnail generation, UI polish          |
| 5            | Testing, bug fixes, deploy to Vercel, write-up for portfolio               |

## 11. Risks & Open Questions

- **Diagram notation conventions:** Default Mermaid styling may not match what users expect from standard ERD/UML conventions (e.g., crow's foot notation for cardinality). May need custom Mermaid theme config.
- **Phase 3 is the hard part:** DFD, Use Case, and Activity diagrams have no existing JS library support — will likely require a custom SVG/canvas renderer. This is the biggest technical unknown and the actual differentiator, so it's worth a small spike/prototype before committing to the full roadmap.
- **Naming:** locked — Diagrid.
- **Monetization model:** deferred until Phase 1 validates real usage (per your "personal tool first, SaaS if it succeeds" framing).
