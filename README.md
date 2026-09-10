# Diagrid

> **Write the structure. Get the diagram.**  
> A fast, blueprint-styled technical diagramming application bridging visual drag-and-drop drafting with instant text-to-diagram compilation.

---

## Quick Links
- **[Full Technical Documentation](DOCUMENTATION.md)**: Exhaustive architectural breakdown, data models, canvas tools, and directory structure.
- **[Backend Implementation Specification](BACKEND_IMPLEMENTATION.md)**: Complete database schema, RLS policies, service contracts, and roadmap for the entire backend.
- **[Design System Guidelines](design.md)**: Blueprint visual identity, color tokens, and typography specs.
- **[Product Plan & Requirements](diagrid.md)**: Functional & non-functional requirements.

---

## Key Features

- **Mode 1: Visual Drag-and-Drop Studio**:
  - Grid-snapped nodes (20px) with automatic orthogonal 90° connector lines (no messy overlapping spaghetti).
  - Pre-styled shapes for ERD tables, flowcharts, decision diamonds, sequences, DFDs, Use Cases, and Activity diagrams.
  - Connection handles with Crow's Foot cardinality notation (`||--|{`, `1:N`, etc.).
  - Freehand Pen and Highlighter tool (`[P]`) for drafting and annotations.
  - Granular node inspector (custom fonts, widths/heights, column key badges, custom shadows).
- **Mode 2: Code & Notes to Diagram Compiler**:
  - Write bullet points, DBML, or Mermaid code and compile directly to live canvas shapes.
  - Intelligent auto-layout with hierarchical topological ranking and port attachment.
- **High-DPI Export Pipeline**:
  - Export to **PNG** (1x, 2x retina, 3x print scale), **SVG** (vector with inline styles), **JSON** (full project backup), or **Mermaid Code**.
- **User Workspaces & Templates**:
  - Project folder organization, real-time diagram search, and ready-to-use templates across 8 technical diagram types.
- **Admin Backoffice**:
  - Complete administrative telemetry dashboard for user management, system metrics, and feedback processing.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v3
- **Icons**: Lucide React
- **Routing**: React Router v7
- **Parser & Layout Engine**: Custom SVG orthogonal router + Mermaid.js v11
- **Persistence**: LocalStorage with schema validation (Supabase-ready model)

---

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Start development server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Build for production
```bash
npm run build
```

### 4. Code quality & linting
```bash
npm run lint
```

---

## License & Credits
Built for developers, engineering students, and technical creators who prefer clean, structured diagrams over chaotic whiteboards.
