import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Search } from 'lucide-react';

type Section = {
  id: string;
  title: string;
  category: 'Start here' | 'Work with diagrams' | 'Diagram guides';
  description: string;
  blocks: { heading: string; text: string }[];
};

const sections: Section[] = [
  {
    id: 'quickstart', title: 'Quick start', category: 'Start here',
    description: 'Create your first diagram in a project.',
    blocks: [
      { heading: '1. Create a project', text: 'Sign in, open Dashboard, and choose create_project(). A project groups related diagrams.' },
      { heading: '2. Choose a starting point', text: 'Open your project and create a diagram. Choose one of the available diagram types and its starter layout, or browse Templates and use a template in an existing project.' },
      { heading: '3. Edit and save', text: 'Move shapes, connect ports, and edit labels in the editor. Changes are saved after about one second of inactivity. The app keeps a local copy and, when cloud storage is configured and you are signed in, also attempts to save to your account. Check the editor save indicator before leaving; a local copy does not guarantee that a cloud save succeeded.' },
    ],
  },
  {
    id: 'canvas', title: 'Canvas and connections', category: 'Start here',
    description: 'Place shapes, connect them, and control the grid.',
    blocks: [
      { heading: 'Add and move shapes', text: 'Use the editor toolbox to add shapes. Select a shape to move, resize, or edit it. Drag on empty canvas in Marquee mode to select multiple shapes.' },
      { heading: 'Connect shapes', text: 'Select a shape to reveal its top, right, bottom, and left ports. Drag from one port to a port on another shape to create a connector. The line follows the shapes when they move.' },
      { heading: 'Grid and snapping', text: 'Choose lines, dots, or a blank canvas in Settings or the editor. Snapping aligns positions to a 20-pixel grid when enabled; turn it off for freeform placement.' },
    ],
  },
  {
    id: 'shortcuts', title: 'Keyboard shortcuts', category: 'Start here',
    description: 'Switch tools and edit faster.',
    blocks: [
      { heading: 'Tools', text: 'V: Select · M: Marquee · P: Pencil · H: Pan. Middle-mouse drag also pans the canvas.' },
      { heading: 'Selection', text: 'Shift-click adds shapes to the selection. Delete or Backspace removes selected objects. Escape cancels the current interaction.' },
      { heading: 'Edit history and clipboard', text: 'Ctrl/Cmd+Z: Undo · Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y: Redo · Ctrl/Cmd+C/X/V: Copy, cut, paste · Ctrl/Cmd+D: Duplicate · Ctrl/Cmd+A: Select all shapes. Shortcuts do not run while you are typing in a text field.' },
    ],
  },
  {
    id: 'exports', title: 'Export a diagram', category: 'Work with diagrams',
    description: 'Choose an image, document, or editable code format.',
    blocks: [
      { heading: 'Open Export', text: 'In the editor, choose Export. Preview the result before downloading.' },
      { heading: 'Pick a format', text: 'PNG is a raster image with 1×, 2×, and 3× scale options. SVG is a scalable vector image. PDF supports page size and orientation options. Mermaid downloads editable diagram code as an .mmd file.' },
      { heading: 'Adjust the output', text: 'For PNG, SVG, and PDF, choose the background and whether to include the blueprint grid. Use a higher PNG scale when you need more pixels for print or slides.' },
    ],
  },
  {
    id: 'sharing', title: 'Share and embed', category: 'Work with diagrams',
    description: 'Give others a read-only view of your work.',
    blocks: [
      { heading: 'Share a link', text: 'Open Share in the editor and copy the view link. Recipients can inspect the diagram in a read-only viewer.' },
      { heading: 'Embed a diagram', text: 'In Share, open the Embed tab to copy an iframe. Choose its theme, grid, controls, and height before copying.' },
      { heading: 'Use Markdown', text: 'The Markdown tab provides a snippet that links readers to the interactive view. Review a shared link before posting it publicly, especially if the diagram contains private information.' },
    ],
  },
  {
    id: 'code', title: 'Code and Mermaid', category: 'Work with diagrams',
    description: 'Generate a canvas from code or copy code from a canvas.',
    blocks: [
      { heading: 'Code to canvas', text: 'In the editor, open Code to Diagram, then Code → Canvas. Enter supported code or start with a preset. Choose the direction and whether to replace the canvas or append to it before generating.' },
      { heading: 'Canvas to code', text: 'Open Canvas → Code for a live Mermaid representation. Choose flowchart or ER output, select a direction for flowcharts, then copy or download the code.' },
      { heading: 'Export option', text: 'You can also download Mermaid from the Export dialog. Check the generated code after editing complex diagrams because visual details may not have an equivalent Mermaid form.' },
    ],
  },
  {
    id: 'preferences', title: 'Appearance and preferences', category: 'Work with diagrams',
    description: 'Set how the workspace and canvas look and behave.',
    blocks: [
      { heading: 'Appearance', text: 'Open Settings → Appearance to choose Blueprint, Light, or Dark for the signed-in workspace. Diagram content keeps its drafting colors.' },
      { heading: 'Canvas defaults', text: 'Open Settings → Workspace Preferences to select grid lines, dots, or a blank background and to turn magnetic snapping on or off. The editor also exposes canvas controls.' },
      { heading: 'Storage', text: 'Settings includes storage information and a reset action. Read the reset confirmation carefully before deleting local data.' },
    ],
  },
  {
    id: 'erd', title: 'Entity relationship diagrams', category: 'Diagram guides',
    description: 'Model tables, keys, and relationships.',
    blocks: [
      { heading: 'Build the schema', text: 'Use table entities for records and add attributes with data types. Mark primary keys (PK) and foreign keys (FK) where appropriate.' },
      { heading: 'Show relationships', text: 'Connect related tables and use cardinality markers to clarify one-to-one, one-to-many, or many-to-many relationships.' },
    ],
  },
  {
    id: 'flowchart', title: 'Flowcharts', category: 'Diagram guides',
    description: 'Show steps and decisions in a process.',
    blocks: [
      { heading: 'Choose shapes', text: 'Use terminals for start and end, process boxes for actions, and diamonds for decisions.' },
      { heading: 'Label branches', text: 'Connect steps in reading order and label decision exits so each path is clear.' },
    ],
  },
  {
    id: 'sequence', title: 'Sequence diagrams', category: 'Diagram guides',
    description: 'Trace messages between participants over time.',
    blocks: [
      { heading: 'Set participants', text: 'Place participants from left to right. Lifelines show each participant across the sequence.' },
      { heading: 'Trace calls', text: 'Arrange requests and returns from top to bottom. Label messages with the action or data they carry.' },
    ],
  },
  {
    id: 'class', title: 'Class diagrams', category: 'Diagram guides',
    description: 'Describe objects, attributes, methods, and connections.',
    blocks: [
      { heading: 'Describe a class', text: 'Give each class a name, then list its attributes and methods in separate compartments.' },
      { heading: 'Connect classes', text: 'Draw relationships between classes and label them where the meaning is not obvious.' },
    ],
  },
  {
    id: 'gantt', title: 'Gantt timelines', category: 'Diagram guides',
    description: 'Plan tasks, phases, and milestones.',
    blocks: [
      { heading: 'Lay out the schedule', text: 'Place tasks against a timeline and use bars to show duration. Keep phase labels and milestones legible.' },
      { heading: 'Show dependencies', text: 'Connect dependent work so the order of tasks is visible.' },
    ],
  },
  {
    id: 'dfd', title: 'Data flow diagrams', category: 'Diagram guides',
    description: 'Track how information moves through a system.',
    blocks: [
      { heading: 'Identify components', text: 'Use external entities for sources and destinations, processes for transformations, and data stores for information held by the system.' },
      { heading: 'Name the flows', text: 'Connect components and label each flow with the data it carries. Keep the detail level consistent across a diagram.' },
    ],
  },
  {
    id: 'usecase', title: 'Use case diagrams', category: 'Diagram guides',
    description: 'Show actors and the goals they can accomplish.',
    blocks: [
      { heading: 'Define the boundary', text: 'Draw a system boundary and place use cases inside it. Actors sit outside the boundary.' },
      { heading: 'Connect goals', text: 'Link actors to the use cases they participate in. Add relationship labels when needed.' },
    ],
  },
  {
    id: 'activity', title: 'Activity diagrams', category: 'Diagram guides',
    description: 'Model actions, decisions, and parallel work.',
    blocks: [
      { heading: 'Trace the path', text: 'Start with an initial node, add action states and decisions, then finish with a final node. Label conditional branches.' },
      { heading: 'Show concurrency', text: 'Use fork and join bars when multiple paths run in parallel and then synchronize.' },
    ],
  },
];

const categories: Section['category'][] = ['Start here', 'Work with diagrams', 'Diagram guides'];

const getSectionFromHash = () => {
  const id = window.location.hash.slice(1);
  return sections.some((section) => section.id === id) ? id : 'quickstart';
};

export const Docs: React.FC = () => {
  const [activeId, setActiveId] = useState(getSectionFromHash);
  const [query, setQuery] = useState('');
  const active = sections.find((section) => section.id === activeId) || sections[0];
  const matches = useMemo(() => sections.filter((section) =>
    `${section.title} ${section.description} ${section.blocks.map((block) => `${block.heading} ${block.text}`).join(' ')}`
      .toLowerCase().includes(query.trim().toLowerCase())
  ), [query]);

  useEffect(() => {
    const onHashChange = () => setActiveId(getSectionFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div className="docs-layout bg-paper text-ink">
      <aside className="docs-sidebar border-line bg-paper-raised">
        <div className="p-5 border-b border-line">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-blueprint font-bold">
            <BookOpen className="w-4 h-4" /> Diagrid guide
          </div>
          <label className="mt-4 flex items-center gap-2 border border-line bg-paper px-3 py-2 focus-within:border-blueprint">
            <Search className="w-4 h-4 text-ink-soft" />
            <input aria-label="Search documentation" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search topics" className="w-full min-w-0 bg-transparent outline-none text-[13px] text-ink placeholder:text-ink-soft" />
          </label>
        </div>
        <nav aria-label="Documentation topics" className="docs-topic-nav flex lg:flex-col gap-2 lg:gap-5 p-3 lg:p-4">
          {categories.map((category) => {
            const items = matches.filter((section) => section.category === category);
            if (!items.length) return null;
            return (
              <div key={category} className="flex lg:flex-col gap-1 shrink-0">
                <h2 className="hidden lg:block px-2 pb-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft">{category}</h2>
                {items.map((section) => (
                  <a key={section.id} href={`#${section.id}`} aria-current={active.id === section.id ? 'page' : undefined}
                    className={`block whitespace-nowrap lg:whitespace-normal px-3 py-2 text-[12px] font-mono border transition-colors ${active.id === section.id ? 'bg-ink text-paper border-ink font-bold' : 'border-transparent text-ink-soft hover:text-ink hover:bg-paper hover:border-line'}`}>
                    {section.title}
                  </a>
                ))}
              </div>
            );
          })}
          {matches.length === 0 && <p className="text-[12px] text-ink-soft px-2">No matching topics.</p>}
        </nav>
      </aside>

      <main className="docs-article bg-paper" id="docs-content">
        <article className="max-w-[850px] mx-auto px-6 sm:px-10 py-8 sm:py-12">
          <p className="font-mono text-[11px] uppercase tracking-wider text-blueprint font-bold">{active.category}</p>
          <h1 className="mt-2 text-[30px] sm:text-[38px] font-bold tracking-tight">{active.title}</h1>
          <p className="mt-2 text-[15px] text-ink-soft leading-relaxed">{active.description}</p>
          <div className="mt-8 border-t-2 border-ink">
            {active.blocks.map((block) => (
              <section key={block.heading} className="py-6 border-b border-line">
                <h2 className="text-[17px] font-bold text-ink">{block.heading}</h2>
                <p className="mt-2 text-[14px] leading-7 text-ink-soft">{block.text}</p>
              </section>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/templates" className="inline-flex items-center gap-2 px-4 py-2 border border-ink bg-ink text-paper font-mono text-[12px] font-bold hover:opacity-80">Browse templates <ArrowRight className="w-3.5 h-3.5" /></Link>
            <Link to="/dashboard" className="inline-flex items-center gap-2 px-4 py-2 border border-line text-ink font-mono text-[12px] hover:border-ink">Open workspace</Link>
          </div>
        </article>
      </main>
    </div>
  );
};
