# Diagrid — Design System

> Visual identity reference, derived from the landing page mockup. Use this to keep the editor, dashboard, and any future pages consistent with the brand.

---

## 1. Design Direction

**Concept:** Blueprint / schematic drafting, not generic SaaS. Diagrid's whole product is about turning typed structure into precise visual structure — the UI itself should look like a drafting tool, not a marketing template.

**What to avoid:** rounded-2xl cards with soft drop shadows, purple-to-blue gradients, glassmorphism, Inter-everywhere, emoji-as-icons. These read as "vibe coded" defaults and work against the brand.

**What to lean into:** grid backgrounds, hard offset shadows (not blurred), sharp 0–2px borders, monospace used structurally (not just for code), confident whitespace.

---

## 2. Color

| Token              | Hex         | Usage                                                                      |
| ------------------ | ----------- | -------------------------------------------------------------------------- |
| `--ink`          | `#15191C` | Primary text, borders, icons                                               |
| `--ink-soft`     | `#4A5359` | Secondary text, captions, muted labels                                     |
| `--paper`        | `#F6F7F5` | Page background                                                            |
| `--paper-raised` | `#FFFFFF` | Cards, panels, elevated surfaces                                           |
| `--line`         | `#D7DBD8` | Hairline borders, dividers, grid lines                                     |
| `--blueprint`    | `#1E5C8C` | Primary accent — links, active states, primary structural highlight       |
| `--signal`       | `#D45B33` | Secondary accent — used sparingly for emphasis/warnings/highlighted nodes |

**Rule of restraint:** `--blueprint` and `--signal` should never both dominate the same view. Pick one per context — blueprint for normal active/selected states, signal only for things that genuinely need to stand out (errors, a single highlighted diagram element).

No gradients. Flat color only.

---

## 3. Typography

| Role              | Typeface       | Notes                                                                                                                                                   |
| ----------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Display / UI      | Space Grotesk  | Headings, buttons, nav, body copy. Weights: 400 (body), 500 (UI labels), 700 (headings)                                                                 |
| Structural / Mono | JetBrains Mono | Code editor, syntax labels, eyebrows, button labels, tags, footer copy — used as a structural signature throughout the UI, not confined to code blocks |

**Type scale (reference from mockup):**

| Element                               | Size     | Weight   | Letter-spacing |
| ------------------------------------- | -------- | -------- | -------------- |
| H1                                    | 46px     | 700      | -0.02em        |
| Section title                         | 16–18px | 700      | -0.02em        |
| Body / sub                            | 14–16px | 400      | normal         |
| Mono labels (eyebrows, buttons, tags) | 11–14px | 400–500 | 0.02–0.05em   |

Eyebrow labels use a `// ` prefix in mono type (e.g. `// text-to-diagram editor`) — a nod to code comments, reinforcing the developer-tool identity. Use sparingly, only above section headers.

---

## 4. Layout

- **Grid-based, hairline-divided sections.** Panels and sections are separated by 1px `--line` borders rather than spacing + shadow. Think technical drawing sheets, not floating cards.
- **Split-pane is a core pattern.** Code/input on one side, live rendered output on the other — this should carry from the landing page hero into the actual editor.
- **Background grid texture** (`linear-gradient` dot/line grid at ~20px spacing, `--line` colored) is reserved for diagram canvas areas specifically — it signals "this is drafting space," so don't apply it to general UI chrome or it loses meaning.
- **No large border-radius.** 0px on structural elements (panels, nav, buttons). A small radius (2–4px) is acceptable only on small interactive chips/tags if needed for legibility, not as a default.

---

## 5. Components

**Buttons**

- Primary: solid `--ink` background, `--paper` text, mono font, no radius, 13–14px
- Secondary: transparent, `--line` border, `--ink` text, same sizing
- No hover glow/scale effects — a simple border or background shift on hover is enough

**Nodes / diagram elements (canvas UI)**

- White/`--paper-raised` fill, 1.5px `--ink` border
- Offset hard shadow (3px 3px 0, colored — `--blueprint` default, `--signal` for highlighted/error state) instead of blurred drop shadow
- This shadow style is the signature visual motif — reuse it anywhere a diagram element or card needs emphasis

**Tabs**

- Flat, bordered, mono type, active state = solid `--ink` fill with `--paper` text (not underline-only)

**Tags / labels**

- Mono type, small, minimal padding, bordered rather than filled where possible

---

## 6. Motion

Minimal and purposeful only:

- Live preview re-render on code change: no transition needed beyond the re-render itself (keep it instant/near-instant per NFR01 in the planning doc)
- Optional: scroll-triggered "diagram assembles" animation on the landing page hero only (nodes/edges drawing in sequentially) — this is the one place a deliberate animated moment is justified, because it demonstrates the product mechanism
- Avoid hover scale, parallax, or ambient background motion — these read as decorative "AI slop" signals

---

## 7. Voice (UI copy)

- Active voice, plain verbs, sentence case. "Save diagram," not "Submit."
- Function-style labels are part of the brand voice where appropriate (`start_diagram →`, `sign_in()`, `view_templates`) — used in nav/CTA contexts only, not in body copy or error messages, where plain English is clearer.
- Errors state what happened and how to fix it, no apologetic tone ("Invalid syntax on line 4" not "Oops, something went wrong!").
- Empty states are an invitation to act, not just a placeholder graphic.

---

## 8. Reference

Landing page mockup: `diagrid-landing.html` — treat as the canonical implementation of these tokens. When building the editor/dashboard, derive every color and type choice from this doc rather than reaching for new defaults.
