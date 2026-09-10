# Diagrid — Project Documentation & Architectural Reference

> **Diagrid** is a high-performance, blueprint-styled diagramming application built for developers, students (e.g., BSIT/BSCS), and technical creators. It bridges direct visual canvas drafting with instant code/notes-to-diagram compilation.

---

## Table of Contents

1. [Project Overview & Vision](#1-project-overview--vision)
2. [Visual Design System & Brand Identity](#2-visual-design-system--brand-identity)
3. [Technology Stack](#3-technology-stack)
4. [Architecture & System Design](#4-architecture--system-design)
5. [Core Data Models & Interfaces](#5-core-data-models--interfaces)
6. [Feature Walkthrough & Modules](#6-feature-walkthrough--modules)
   - [Landing Page & Showcase](#61-landing-page--showcase)
   - [Authentication & Role-Based Access](#62-authentication--role-based-access)
   - [Workspace Dashboard & Projects](#63-workspace-dashboard--projects)
   - [Visual Canvas Editor Studio](#64-visual-canvas-editor-studio)
   - [Code & Notes to Diagram Compiler](#65-code--notes-to-diagram-compiler)
   - [Export Pipeline (PNG, SVG, JSON, Mermaid)](#66-export-pipeline-png-svg-json-mermaid)
   - [Template Gallery & Vector Thumbnails](#67-template-gallery--vector-thumbnails)
   - [Admin Backoffice Suite](#68-admin-backoffice-suite)
7. [Directory Structure](#7-directory-structure)
8. [Setup & Development Commands](#8-setup--development-commands)
9. [Roadmap & Future Extensions](#9-roadmap--future-extensions)

---

## 1. Project Overview & Vision

While mainstream tools like Lucidchart and Eraser.io focus on general-purpose enterprise whiteboarding, they often generate messy, overlapping connectors ("diagram spaghetti") and lack first-class support for academic and software engineering diagram types (such as DFDs, Use Case diagrams, and Activity diagrams).

**Diagrid** solves this with two foundational workflows:
1. **Mode 1: The Visual Drag-and-Drop Studio** — A precision drafting canvas where elements snap to grid coordinates, connection ports route 90° right-angled orthogonal lines automatically, and shapes follow standardized notations (crow's foot ERD cardinality, UML shapes, process blocks).
2. **Mode 2: Code & Notes to Diagram Compiler** — A syntax engine that parses Mermaid text, database schema notes (DBML/SQL), or plain bullet points into auto-arranged, formatted diagrams on the canvas.

---

## 2. Visual Design System & Brand Identity

Diagrid eschews generic SaaS templates (gradients, rounded pill cards, blurred drop shadows) in favor of a **technical blueprint drafting aesthetic**.

### 2.1 Color Tokens

| Token | Hex Value | Semantic Usage |
| :--- | :--- | :--- |
| `--ink` | `#15191C` | Primary text, borders (1.5px–2px), icons, dark surfaces |
| `--ink-soft` | `#4A5359` | Secondary text, field types, captions, structural subtitles |
| `--paper` | `#F6F7F5` | Neutral drafting page background |
| `--paper-raised` | `#FFFFFF` | Node cards, modals, dropdowns, inspector panels |
| `--line` | `#D7DBD8` | Hairline dividers, canvas grid lines, inactive borders |
| `--blueprint` | `#1E5C8C` | Primary accent — active states, table headers, connections |
| `--signal` | `#D45B33` | Warning/decision accent — decision diamonds, error highlights |

### 2.2 Typography
- **Space Grotesk**: Headings, body copy, navigation, modal headers.
- **JetBrains Mono**: Structural labels, code blocks, syntax chips, keyboard shortcuts (`[V]`, `[C]`, `[H]`, `[P]`), port tags, and table column data types.

### 2.3 Visual Signatures
- **Hard Offset Shadows**: `box-shadow: 3px 3px 0px #1E5C8C` (or `#15191C`) instead of blurred shadows.
- **Canvas Dot/Line Grid**: 20px snap grid backdrop indicating a precision workspace.
- **Eyebrow Tags**: `// syntax labels` and monospace micro-badges.

---

## 3. Technology Stack

- **Core Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Dev Server**: [Vite 8](https://vitejs.dev/) with `@vitejs/plugin-react`
- **Styling**: [Tailwind CSS v3](https://tailwindcss.com/) with custom tokens, PostCSS, and Autoprefixer
- **Icons**: [Lucide React](https://lucide.dev/)
- **Routing**: [React Router v7](https://reactrouter.com/) (`BrowserRouter`, nested layout routes, guards)
- **Diagram Engines**: Custom SVG Orthogonal Router + [Mermaid.js v11](https://mermaid.js.org/) integration
- **Linting**: [Oxlint](https://oxc.rs/)

---

## 4. Architecture & System Design

```
+---------------------------------------------------------------------------------+
|                               Diagrid Frontend App                              |
+---------------------------------------------------------------------------------+
|                                                                                 |
|  +------------------+  +-------------------+  +------------------------------+  |
|  |   Public Pages   |  |   User Workspace  |  |       Admin Backoffice       |  |
|  |  - Landing       |  |  - Dashboard      |  |  - Overview / Metrics        |  |
|  |  - Auth Portal   |  |  - Projects       |  |  - User Management           |  |
|  |  - Docs          |  |  - Settings       |  |  - Feedback & Reports        |  |
|  |  - Templates     |  |                   |  |  - Activity & Logs           |  |
|  +------------------+  +-------------------+  +------------------------------+  |
|                                |                                                |
|                                v                                                |
|             +--------------------------------------+                            |
|             |      Visual Canvas Studio (Editor)   |                            |
|             |  - Viewport Pan/Zoom Transforms      |                            |
|             |  - Node Manipulation & Snapping      |                            |
|             |  - Orthogonal SVG Edge Routing       |                            |
|             |  - Freehand Pen / Highlighter Engine |                            |
|             |  - Node & Edge Property Inspector    |                            |
|             +--------------------------------------+                            |
|                     |                       |                                   |
|                     v                       v                                   |
|         +-----------------------+  +-------------------------+                  |
|         |  codeToDiagram.ts     |  |    diagramExport.ts     |                  |
|         |  - Mermaid Parser     |  |  - Multi-scale PNG (1-3x)|                  |
|         |  - Node/Edge Layout   |  |  - Crisp SVG Exporter   |                  |
|         |  - Rank Alignment     |  |  - Mermaid Code Gen     |                  |
|         +-----------------------+  +-------------------------+                  |
|                                                                                 |
|  +---------------------------------------------------------------------------+  |
|  |                     Services & Local Storage Layer                        |  |
|  |  - mockDb.ts    (Projects, Diagrams, Templates, Canvas State)             |  |
|  |  - mockAuth.ts  (Session State, Roles, Token Management)                  |  |
|  |  - mockAdmin.ts (Telemetry, System Health, Feedback Processing)           |  |
|  +---------------------------------------------------------------------------+  |
|                                                                                 |
+---------------------------------------------------------------------------------+
```

---

## 5. Core Data Models & Interfaces

Located in [`src/services/mockDb.ts`](file:///c:/Users/sadia/diagrid/src/services/mockDb.ts):

### 5.1 `CanvasNode`
Represents a shape or entity on the diagram canvas.
```typescript
export interface CanvasNode {
  id: string;
  type: 
    | 'table'              // Database ERD table with column rows
    | 'process'            // Flowchart action rectangle
    | 'decision'           // Flowchart decision diamond
    | 'terminal'           // Flowchart start/end capsule
    | 'text'               // Freeform canvas label / markdown note
    | 'dfd-store'          // DFD open-ended data store
    | 'dfd-entity'         // DFD external entity box
    | 'dfd-process'        // DFD process rounded circle
    | 'usecase-actor'      // UML stick-figure actor
    | 'usecase-oval'       // UML use case bubble
    | 'usecase-boundary'   // System scope container box
    | 'sequence-activation'// Sequence timeline activation bar
    | 'activity-start'     // Activity diagram initial state
    | 'activity-end'       // Activity diagram bullseye final state
    | 'activity-action'    // Activity action step
    | 'activity-decision'  // Activity branch diamond
    | 'activity-fork';     // Synchronization bar
  label: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  customWidth?: number;
  customHeight?: number;
  fields?: string[];       // Column definitions: 'id uuid pk', 'email text'
  fontSize?: 'sm' | 'md' | 'lg';
  customFontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
  isBold?: boolean;
  borderStyle?: 'none' | 'solid' | 'dashed' | 'dotted';
  borderWidth?: 1 | 2 | 3;
  fillColor?: string;
  shadowAccent?: string;
}
```

### 5.2 `CanvasEdge`
Represents a connection line between two nodes.
```typescript
export type EdgeMarkerType = 
  | 'none' 
  | 'arrow' 
  | 'one' 
  | 'one-only' 
  | 'zero-one' 
  | 'many' 
  | 'one-many' 
  | 'zero-many';

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: 'top' | 'bottom' | 'left' | 'right';
  targetHandle?: 'top' | 'bottom' | 'left' | 'right';
  label?: string;
  style?: 'solid' | 'dashed';
  arrow?: 'end' | 'none' | 'both';
  sourceMarker?: EdgeMarkerType;
  targetMarker?: EdgeMarkerType;
}
```

### 5.3 `Diagram` & `Project`
```typescript
export interface Diagram {
  id: string;
  project_id: string;
  title: string;
  type: 'erd' | 'flowchart' | 'sequence' | 'class' | 'gantt' | 'dfd' | 'usecase' | 'activity';
  content: string; // Serialized JSON string: { nodes: CanvasNode[], edges: CanvasEdge[], drawings?: FreehandDrawing[] }
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}
```

---

## 6. Feature Walkthrough & Modules

### 6.1 Landing Page & Showcase (`src/pages/Landing.tsx`)
- **Interactive Hero Studio**:
  - Live window chrome with macOS-style window dots, active draft pill, and zoom indicator.
  - Interactive toolbar with tool selection (`[V]`, `[C]`, `[H]`, `[P]`).
  - Real database table nodes with draggable handles, `PK`/`FK` badges, and dynamic SVG orthogonal lines calculating live crow's foot connections.
- **Code & Notes to Diagram Compiler (`#code-to-diagram`)**:
  - Split-screen workspace showcasing Mode 2.
  - Left: syntax-highlighted code editor with line numbers gutter.
  - Right: authentic Diagrid app canvas output across ERD, Flowchart, and Sequence presets.
- **Diagram Profiles Showcase**: 8 diagram categories with vector preview thumbnails, feature badges, and direct links to templates.
- **Comparison Table**: Clear breakdown highlighting Diagrid's structured 90° lines, built-in key tags, and blueprint aesthetic vs. messy whiteboard tools.

### 6.2 Authentication & Role-Based Access (`src/pages/Auth.tsx`, `src/services/mockAuth.ts`)
- **Form Interface**: Clean sign-in and sign-up with instant password validation and session persistence.
- **One-Click Persona Pills**: Quick-login buttons for `Student`, `Freelancer`, and `Admin` personas.
- **Security Guards**:
  - `ProtectedRoute`: Redirects unauthenticated users to `/auth`.
  - `AdminRoute`: Verifies admin privileges before accessing `/admin/*`.

### 6.3 Workspace Dashboard & Projects (`src/pages/Dashboard.tsx`, `src/pages/ProjectDetail.tsx`)
- **Project Organization**: Create, rename, duplicate, and delete project folders.
- **Diagram Search & Filter**: Real-time search across diagram titles and types.
- **Dynamic Previews**: Live vector-rendered thumbnails via `TemplateThumbnail.tsx`.

### 6.4 Visual Canvas Editor Studio (`src/pages/Editor.tsx`)
The centerpiece of Diagrid, supporting high-density diagram editing:
- **Canvas Tools**:
  - `Select [V]`: Click and drag nodes, multi-select, box-select.
  - `Connect [C]`: Drag from any of 4 connection ports (top, bottom, left, right) to link shapes.
  - `Pan [H]`: Viewport navigation with spacebar/wheel panning.
  - `Draw [P]`: Freehand pen and highlighter tool with customizable stroke widths and colors.
- **Node Resizing & Alignment**: Real-time bounding box resize handles with snap-to-grid (20px).
- **Inspector Panel**:
  - Label text, alignment, font sizes (10px to 48px), bold styling.
  - ERD Column Manager: Add/remove columns, toggle `PK` / `FK` key constraints, specify data types.
  - Border styles (`solid`, `dashed`, `dotted`, `none`) and thickness (1px–3px).
  - Background fill colors and custom hard offset shadow accents.
- **History Engine**: Full undo (`Ctrl+Z`) and redo (`Ctrl+Y`) stack for canvas state.

### 6.5 Code & Notes to Diagram Compiler (`src/utils/codeToDiagram.ts`)
- Converts textual descriptions and Mermaid code into visual nodes and edges.
- **Supported Syntaxes**:
  - Mermaid Flowcharts (`flowchart TD`, `graph LR`) with subgraphs, shapes (`[]`, `()`, `{}`, `[//]`, `[[]]`).
  - Mermaid ER diagrams with full relationship notation (`||--||`, `||--o{`, `}|..|{`, etc.).
  - Class definitions, DFD processes, and sequences.
- **Auto-Layout Engine**: Hierarchical rank assignment (topological ordering), collision avoidance, and automatic port attachment.

### 6.6 Export Pipeline (`src/components/canvas/ExportModal.tsx`, `src/utils/diagramExport.ts`)
- **High-Resolution Raster (PNG)**: 1x, 2x (retina), and 3x (print/report scale) export using offscreen HTML5 Canvas.
- **Vector Export (SVG)**: Clean standalone SVG with embedded fonts, stroke styling, markers, and definitions.
- **Data Export (JSON)**: Full diagram serialization for backups, sharing, and project transfers.
- **Code Export (Mermaid)**: Reverse-engineers canvas nodes and edges back into valid Mermaid syntax for README files and technical documentation.
- **Backgrounds**: Transparent, Drafting Paper, Dark Theme, or Pure White.

### 6.7 Template Gallery (`src/pages/Templates.tsx`)
- Pre-built starter templates across all 8 supported diagram types:
  - E-Commerce Database (ERD)
  - Microservices Authentication Flow (Sequence)
  - Order Processing Decision Tree (Flowchart)
  - Domain Model Architecture (Class)
  - Sprint Milestone Tracker (Gantt)
  - Order Processing DFD Level 1
  - Banking Portal Use Case Diagram
  - User Checkout Activity Diagram

### 6.8 Admin Backoffice Suite (`src/pages/admin/*`, `src/services/mockAdmin.ts`)
- **Overview**: System metrics, active sessions, diagram creations, feedback counts.
- **Users**: User roster, role assignment, status toggles (Active / Suspended).
- **Content**: Global diagram management, template inspection.
- **Feedback**: Bug reports and user suggestions with status workflows (Pending, In Progress, Resolved).
- **Activity & System Logs**: Audit trail of system events and platform telemetry.

---

## 7. Directory Structure

```
diagrid/
├── public/                 # Static public assets
├── src/
│   ├── assets/             # Brand logos and iconography
│   ├── components/
│   │   ├── canvas/         # Canvas-specific components (ExportModal, etc.)
│   │   ├── layout/         # DashboardLayout, AdminLayout, Navbars
│   │   └── ui/             # Avatar, Button, Card, FeedbackModal, TemplateThumbnail
│   ├── pages/
│   │   ├── admin/          # Backoffice admin suite (Overview, Users, Feedback, etc.)
│   │   ├── Auth.tsx        # Authentication & persona quick-login
│   │   ├── Dashboard.tsx   # Project list and user workspace
│   │   ├── Docs.tsx        # Technical documentation & usage guides
│   │   ├── Editor.tsx      # Core visual canvas studio
│   │   ├── Landing.tsx     # Marketing landing page with dual-mode showcase
│   │   ├── ProjectDetail.tsx # Diagrams within a project
│   │   ├── Settings.tsx    # User profile and preferences
│   │   └── Templates.tsx   # Pre-built template library
│   ├── services/
│   │   ├── mockAdmin.ts    # Admin telemetry and mock backend
│   │   ├── mockAuth.ts     # User authentication and session store
│   │   └── mockDb.ts       # Canvas node/edge database and templates
│   ├── utils/
│   │   ├── codeToDiagram.ts# Text & Mermaid parser and auto-layout engine
│   │   └── diagramExport.ts# High-DPI PNG, SVG, JSON, and Mermaid export utilities
│   ├── App.css             # Base application styles
│   ├── App.tsx             # Root routing, route guards, and layout tree
│   ├── index.css           # Tailwind directives, CSS variables, blueprint tokens
│   └── main.tsx            # React application mount
├── design.md               # Visual identity and design token specification
├── diagrid.md              # Product requirements document (PRD)
├── DOCUMENTATION.md        # Comprehensive technical documentation (this file)
├── package.json            # Dependencies and scripts
├── tailwind.config.js      # Custom theme colors, fonts, and shadows
└── vite.config.ts          # Vite build configuration
```

---

## 8. Setup & Development Commands

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
# Clone the repository and install dependencies
npm install
```

### Running the Dev Server
```bash
# Starts Vite local server on http://localhost:5173
npm run dev
```

### Building for Production
```bash
# Compiles TypeScript and runs Vite production build
npm run build
```

### Linting
```bash
# Runs fast Oxlint static analysis
npm run lint
```

---

## 9. Roadmap & Future Extensions

1. **Cloud Persistence (Supabase Integration)**:
   - Transition `mockDb.ts` to live PostgreSQL tables via Supabase Client.
   - Attach Row-Level Security (RLS) policies scoped to `auth.uid() = user_id`.
2. **Realtime Multi-User Collaboration**:
   - WebSocket broadcast of cursor positions and node translation coordinates.
3. **AI-Assisted Diagramming (BYOK / OpenRouter)**:
   - Bring-Your-Own-Key integration allowing users to prompt an LLM to generate structured diagrams directly into the canvas.
4. **Academic Document Exporters**:
   - Native DOCX and PDF export with captioning, table of figures numbering, and citation formatting for thesis reports.
