import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCurrentUser } from '../services/mockAuth';
import { Avatar } from '../components/ui/Avatar';
import { Logo } from '../components/ui/Logo';
import { TemplateThumbnail } from '../components/ui/TemplateThumbnail';
import { mockDb, type Template } from '../services/mockDb';
import { FeedbackModal } from '../components/ui/FeedbackModal';
import { 
  Database, 
  GitCommit, 
  Workflow, 
  Layers, 
  Calendar, 
  HardDrive, 
  Users, 
  Activity, 
  ArrowRight, 
  Check, 
  X, 
  Sliders, 
  ExternalLink,
  ShieldAlert,
  Code,
  MessageSquare,
  MousePointer,
  Hand,
  PenTool,
  Sparkles
} from 'lucide-react';

interface DemoField {
  name: string;
  type: string;
  isKey?: boolean;
}

interface DemoNode {
  id: string;
  label: string;
  x: number;
  y: number;
  type: 'table' | 'process' | 'decision' | 'terminal' | 'actor';
  color: 'blueprint' | 'signal' | 'ink';
  fields?: DemoField[];
  subtitle?: string;
}

const ERD_NODES: DemoNode[] = [
  { 
    id: 'erd-users', 
    label: 'users', 
    x: 16, 
    y: 16, 
    type: 'table', 
    color: 'blueprint',
    fields: [
      { name: 'id', type: 'uuid', isKey: true },
      { name: 'email', type: 'varchar' },
      { name: 'role', type: 'text' }
    ]
  },
  { 
    id: 'erd-orders', 
    label: 'orders', 
    x: 16, 
    y: 175, 
    type: 'table', 
    color: 'blueprint',
    fields: [
      { name: 'id', type: 'uuid', isKey: true },
      { name: 'user_id', type: 'uuid' },
      { name: 'total_usd', type: 'numeric' }
    ]
  },
  { 
    id: 'erd-diagrams', 
    label: 'diagrams', 
    x: 218, 
    y: 40, 
    type: 'table', 
    color: 'ink',
    fields: [
      { name: 'id', type: 'uuid', isKey: true },
      { name: 'title', type: 'varchar' },
      { name: 'schema_type', type: 'enum' }
    ]
  },
];

const FLOW_NODES: DemoNode[] = [
  { id: 'flow-start', label: 'START_CHECKOUT', x: 20, y: 20, type: 'terminal', color: 'ink' },
  { id: 'flow-process', label: 'Validate Token', x: 18, y: 95, type: 'process', color: 'blueprint', subtitle: 'auth_service.verify()' },
  { id: 'flow-decision', label: 'Funds OK?', x: 215, y: 75, type: 'decision', color: 'signal' },
  { id: 'flow-end', label: 'CONFIRM_ORDER', x: 200, y: 195, type: 'terminal', color: 'blueprint' },
];

const SEQUENCE_NODES: DemoNode[] = [
  { id: 'seq-client', label: 'Client User', x: 16, y: 16, type: 'actor', color: 'ink', subtitle: 'Web Frontend' },
  { id: 'seq-gateway', label: 'API Gateway', x: 140, y: 16, type: 'actor', color: 'blueprint', subtitle: 'Edge Router' },
  { id: 'seq-db', label: 'Postgres DB', x: 260, y: 16, type: 'actor', color: 'signal', subtitle: 'Main Cluster' },
];

// Presets for the Code & Notes to Diagram compiler
const CODE_PRESETS = {
  erd: {
    title: 'E-Commerce Database Schema',
    lang: 'Schema Notes (DBML / SQL)',
    tabName: 'store_schema.erd',
    code: `Table users {
  id uuid [pk]
  email varchar
  role text
}

Table orders {
  id uuid [pk]
  user_id uuid [ref: > users.id]
  total_usd numeric
}`,
  },
  flowchart: {
    title: 'Payment Checkout Flow',
    lang: 'Flowchart Outline (Mermaid)',
    tabName: 'checkout_flow.chart',
    code: `flowchart TD
  Start([Start Checkout])
  -> Validate[Validate Card]
  -> Balance{Sufficient Funds?}
  Balance -- Yes --> Success([Charge & Receipt])
  Balance -- No --> Alert[Decline Notice]`,
  },
  sequence: {
    title: 'Login Authentication Steps',
    lang: 'Sequence Notes (Mermaid)',
    tabName: 'auth_sequence.seq',
    code: `sequenceDiagram
  actor User as Client App
  participant API as API Gateway
  database DB as User Database

  User ->> API: 1. POST /login (credentials)
  API ->> DB: 2. verify_user_record()
  DB -->> API: 3. auth_verified (hash ok)
  API -->> User: 4. 200 OK (access_token)`,
  },
};

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Template map for gallery cards
  const allTemplates = React.useMemo(() => mockDb.getTemplates(), []);
  const templateMap = React.useMemo(() => {
    const map: Record<string, Template> = {};
    allTemplates.forEach(t => { map[t.type] = t; });
    return map;
  }, [allTemplates]);

  // Active template in hero sandbox: erd, flowchart, or sequence
  const [heroTab, setHeroTab] = useState<'erd' | 'flowchart' | 'sequence'>('erd');
  const [demoNodes, setDemoNodes] = useState<DemoNode[]>(ERD_NODES);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Gallery filter category
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'data' | 'logic' | 'planning'>('all');

  // Code vs Canvas preset state
  const [activeCodePreset, setActiveCodePreset] = useState<'sequence' | 'erd' | 'flowchart'>('sequence');

  const handleStart = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  const switchHeroTemplate = (tab: 'erd' | 'flowchart' | 'sequence') => {
    setHeroTab(tab);
    if (tab === 'erd') setDemoNodes(ERD_NODES);
    else if (tab === 'flowchart') setDemoNodes(FLOW_NODES);
    else setDemoNodes(SEQUENCE_NODES);
  };

  // Dragging event handlers for the landing page interactive mockup
  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const node = demoNodes.find((n) => n.id === id);
    if (!node) return;
    setDraggedNodeId(id);
    dragOffset.current = {
      x: e.clientX - node.x,
      y: e.clientY - node.y,
    };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!draggedNodeId) return;
    setDemoNodes((prev) =>
      prev.map((node) => {
        if (node.id === draggedNodeId) {
          const targetX = e.clientX - dragOffset.current.x;
          const targetY = e.clientY - dragOffset.current.y;
          // Snap dragging to 10px grid
          return {
            ...node,
            x: Math.max(5, Math.min(230, Math.round(targetX / 10) * 10)),
            y: Math.max(5, Math.min(210, Math.round(targetY / 10) * 10)),
          };
        }
        return node;
      })
    );
  };

  const handleMouseUp = () => {
    setDraggedNodeId(null);
  };

  // 8 Diagram Profiles explained in plain English
  const diagramProfiles = [
    {
      id: 'erd',
      title: 'Database Structure (ERD)',
      category: 'data',
      desc: 'Map out your database tables, what columns they have, and how tables link together with lines.',
      icon: Database,
      nodeCount: 'Table Cards',
      features: ['Primary ID tags', 'Linked connections', 'Column types'],
    },
    {
      id: 'flowchart',
      title: 'Step-by-Step Flowchart',
      category: 'logic',
      desc: 'Show how a task or decision works from start to finish, with simple Yes and No branching paths.',
      icon: GitCommit,
      nodeCount: 'Step & Decision Boxes',
      features: ['Yes/No questions', 'Start & Finish shapes', 'Action steps'],
    },
    {
      id: 'sequence',
      title: 'Message & Request Flow',
      category: 'planning',
      desc: 'See how messages travel back and forth between users, servers, and databases in order of time.',
      icon: Workflow,
      nodeCount: 'Role Timelines',
      features: ['Step-by-step arrows', 'Reply lines', 'User & Server columns'],
    },
    {
      id: 'class',
      title: 'Code Architecture (Class Diagram)',
      category: 'planning',
      desc: 'Organize pieces of code, showing what functions they have and how they share features.',
      icon: Layers,
      nodeCount: 'Code Object Boxes',
      features: ['Public & Private parts', 'Parent & Child links', 'Action lists'],
    },
    {
      id: 'gantt',
      title: 'Project Timeline (Schedule)',
      category: 'planning',
      desc: 'Plan project tasks, phases, and deadlines on an easy-to-read calendar bar schedule.',
      icon: Calendar,
      nodeCount: 'Task Timeline Bars',
      features: ['Milestone dates', 'Step order links', 'Phase bars'],
    },
    {
      id: 'dfd',
      title: 'Data Movement Map (DFD)',
      category: 'data',
      desc: 'Follow the journey of information: where it comes from, where it gets processed, and where it gets saved.',
      icon: HardDrive,
      nodeCount: 'Storage & Process Blocks',
      features: ['Data storage spots', 'Action bubbles', 'External source boxes'],
    },
    {
      id: 'usecase',
      title: 'User Story Map (Use Case)',
      category: 'logic',
      desc: 'Show what different kinds of people (admins, customers, guests) can do inside your system.',
      icon: Users,
      nodeCount: 'People & Goal Shapes',
      features: ['User types (People)', 'System borders', 'Goal bubbles'],
    },
    {
      id: 'activity',
      title: 'Parallel Task Flow',
      category: 'logic',
      desc: 'Map tasks that happen at the same time and show where they join back together.',
      icon: Activity,
      nodeCount: 'Split & Join Bars',
      features: ['Multi-task branches', 'Checkpoint decisions', 'Done markers'],
    },
  ];

  const filteredGallery = diagramProfiles.filter((d) => 
    galleryFilter === 'all' || d.category === galleryFilter
  );

  return (
    <div className="min-h-screen bg-paper flex flex-col justify-between text-ink select-none" onMouseUp={handleMouseUp}>
      {/* 0. High-Contrast Dark Top Navbar */}
      <nav className="flex justify-between items-center py-4 px-6 lg:px-12 border-b-2 border-ink bg-[#15191C] text-paper sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 select-none group text-paper hover:text-white transition-colors">
            <Logo variant="paper" size="md" />
          </Link>
          <span className="font-mono text-[10px] border border-[#2D363C] px-2 py-0.5 text-[#9AA5A0] uppercase tracking-wider hidden sm:inline-block bg-[#1B2125]">
            Simple Diagram Maker
          </span>
        </div>

        <div className="hidden md:flex gap-8 text-[13px] text-[#A6B2AD] font-mono">
          <a href="#diagrams" className="hover:text-white transition-colors">Diagrams</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
          <a href="#code-to-diagram" className="hover:text-white transition-colors">Code to Diagram</a>
          <a href="#comparison" className="hover:text-white transition-colors">Why Diagrid?</a>
          <Link to="/templates" className="hover:text-white transition-colors">Templates</Link>
          <Link to="/docs" className="hover:text-white transition-colors">Help & Docs</Link>
        </div>

        <div className="flex items-center gap-3 font-mono">
          {user ? (
            <div className="flex items-center gap-3">
              <Link 
                to="/settings" 
                className="flex items-center gap-2 hover:opacity-85 transition-opacity" 
                title="Profile Settings"
              >
                <Avatar user={user} size="xs" showStatus={true} statusOnline={true} />
                <span className="text-[#A6B2AD] text-[12px] hidden sm:inline">
                  {user.name || user.email.split('@')[0]}
                </span>
              </Link>
              <Link 
                to="/dashboard" 
                className="text-[12px] border border-paper text-paper px-4 py-1.5 hover:bg-paper hover:text-ink transition-colors font-bold flex items-center gap-1.5 shadow-sm"
              >
                My Workspace
              </Link>
            </div>
          ) : (
            <Link 
              to="/auth" 
              className="text-[12px] bg-blueprint text-paper border border-blueprint px-4 py-1.5 hover:bg-white hover:text-ink hover:border-white transition-colors font-bold shadow-sm"
            >
              Sign In
            </Link>
          )}
        </div>
      </nav>

      {/* 1. Hero Section in Plain English */}
      <section className="grid grid-cols-1 lg:grid-cols-2 flex-1 border-b-2 border-ink bg-paper">
        {/* Left text column */}
        <div className="p-8 sm:p-12 lg:p-20 border-b-2 lg:border-b-0 lg:border-r-2 border-ink flex flex-col justify-center bg-paper">
          <div className="font-mono text-[11.5px] text-blueprint tracking-wider mb-4 inline-flex items-center gap-2 bg-blueprint bg-opacity-10 border border-blueprint px-3 py-1 self-start font-bold">
            <span className="w-2 h-2 bg-blueprint inline-block animate-pulse"></span>
            <span>Easy Drag-and-Drop Diagramming</span>
          </div>

          <h1 className="text-[40px] sm:text-[48px] lg:text-[54px] leading-[1.06] font-bold tracking-tight mb-5 text-ink">
            Draw neat diagrams <span className="text-blueprint underline decoration-2 underline-offset-4">in seconds</span>.<br />
            No tangled lines.
          </h1>

          <p className="text-[15.5px] sm:text-[16.5px] text-[#2C3439] leading-relaxed max-w-[490px] mb-8 font-sans font-medium">
            Create clean database plans, step-by-step flowcharts, and system maps that snap neatly into place. Just drag boxes, connect lines, and download your image — without fighting complicated tools.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={handleStart}
              className="bg-ink text-paper border-2 border-ink px-6 py-3 font-mono text-[13.5px] hover:bg-blueprint hover:border-blueprint transition-colors active:translate-y-[1px] shadow-hard-blueprint flex items-center gap-2 cursor-pointer font-bold"
            >
              Start Drawing Free
              <ArrowRight className="w-4 h-4" />
            </button>

            <Link
              to="/templates"
              className="border-2 border-ink bg-paper-raised px-6 py-3 font-mono text-[13.5px] hover:bg-ink hover:text-paper text-center transition-colors active:translate-y-[1px] cursor-pointer shadow-hard-ink font-bold"
            >
              Browse Templates
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-6 mt-10 pt-6 border-t-2 border-ink border-dashed font-mono text-[11px] text-ink font-bold">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-blueprint" />
              Works offline in your browser
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-blueprint" />
              No signup or credit card needed
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-blueprint" />
              Crystal-clear image downloads
            </span>
          </div>
        </div>

        {/* Right demo column: Authentic Diagrid Canvas Studio */}
        <div className="bg-[#EAEFEA] p-6 sm:p-8 lg:p-12 flex flex-col justify-center select-none relative border-b-2 lg:border-b-0 border-ink">
          <div className="border-2 border-ink flex flex-col bg-paper-raised shadow-hard-blueprint max-w-[580px] mx-auto w-full overflow-hidden">
            {/* Editor Window Chrome */}
            <div className="h-9 border-b-2 border-ink bg-[#15191C] text-paper px-3.5 flex items-center justify-between font-mono text-[11px] select-none">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 mr-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
                </div>
                <span className="font-bold text-paper hidden sm:inline">workspace //</span>
                <span className="text-white font-bold">{heroTab === 'erd' ? 'store_schema.erd' : heroTab === 'flowchart' ? 'checkout_flow.chart' : 'auth_sequence.seq'}</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="text-[#38BDF8] bg-[#0E2439] border border-[#1E5C8C] px-1.5 py-0.2 font-bold">
                  LIVE DRAFT
                </span>
                <span className="text-[#9AA5A0] hidden sm:inline">ZOOM: 100%</span>
              </div>
            </div>

            {/* Top Toolbar (Matching Diagrid App) */}
            <div className="border-b-2 border-ink bg-paper px-3 py-1.5 flex items-center justify-between text-[11px] font-mono">
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-1 bg-ink text-paper px-2 py-0.5 font-bold border border-ink shadow-xs">
                  <MousePointer className="w-3 h-3 text-[#00FF66]" />
                  <span>Select [V]</span>
                </div>
                <div className="flex items-center gap-1 text-ink-soft hover:text-ink px-2 py-0.5 cursor-pointer">
                  <GitCommit className="w-3 h-3" />
                  <span>Connect [C]</span>
                </div>
                <div className="flex items-center gap-1 text-ink-soft hover:text-ink px-2 py-0.5 cursor-pointer hidden sm:flex">
                  <Hand className="w-3 h-3" />
                  <span>Pan [H]</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-ink-soft font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>GRID: 20PX SNAP</span>
              </div>
            </div>

            {/* Split layout: Template starters on left, Real Canvas on right */}
            <div className="flex overflow-hidden min-h-[350px]">
              {/* Mini Palette Sidebar */}
              <div className="w-[125px] border-r-2 border-ink bg-[#F1F4F1] p-2.5 flex flex-col gap-2 shrink-0">
                <div className="font-mono text-[9px] text-blueprint uppercase tracking-wider mb-0.5 font-bold flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Templates</span>
                </div>
                <button
                  onClick={() => switchHeroTemplate('erd')}
                  className={`w-full border-2 py-1.5 px-2 font-mono text-[10.5px] text-left select-none transition-colors cursor-pointer truncate font-bold ${
                    heroTab === 'erd' 
                      ? 'bg-ink text-paper border-ink shadow-hard-ink' 
                      : 'border-line bg-paper-raised hover:border-ink'
                  }`}
                >
                  Database
                </button>
                <button
                  onClick={() => switchHeroTemplate('flowchart')}
                  className={`w-full border-2 py-1.5 px-2 font-mono text-[10.5px] text-left select-none transition-colors cursor-pointer truncate font-bold ${
                    heroTab === 'flowchart' 
                      ? 'bg-ink text-paper border-ink shadow-hard-ink' 
                      : 'border-line bg-paper-raised hover:border-ink'
                  }`}
                >
                  Flowchart
                </button>
                <button
                  onClick={() => switchHeroTemplate('sequence')}
                  className={`w-full border-2 py-1.5 px-2 font-mono text-[10.5px] text-left select-none transition-colors cursor-pointer truncate font-bold ${
                    heroTab === 'sequence' 
                      ? 'bg-ink text-paper border-ink shadow-hard-ink' 
                      : 'border-line bg-paper-raised hover:border-ink'
                  }`}
                >
                  Step Flow
                </button>

                <div className="mt-auto pt-3 border-t-2 border-ink border-dashed font-mono text-[9px] text-ink-soft leading-tight">
                  <strong className="block text-ink font-bold mb-0.5">// drag_to_test</strong>
                  Lines auto-bend at 90° angles
                </div>
              </div>

              {/* Realistic Diagrid Canvas Area */}
              <div
                onMouseMove={handleCanvasMouseMove}
                className="flex-1 bg-grid relative p-4 overflow-hidden cursor-crosshair bg-paper"
              >
                {/* SVG connection lines with Orthogonal routing & Crow's foot markers */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                  <defs>
                    <marker id="arrow-demo" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#15191C" />
                    </marker>
                    <marker id="arrow-blue-demo" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#1E5C8C" />
                    </marker>
                    <marker id="crows-one-demo" viewBox="0 0 16 16" refX="16" refY="8" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
                      <line x1="0" y1="8" x2="16" y2="8" stroke="#15191C" strokeWidth="1.75" />
                      <line x1="7" y1="2" x2="7" y2="14" stroke="#15191C" strokeWidth="1.75" strokeLinecap="round" />
                      <line x1="12" y1="2" x2="12" y2="14" stroke="#15191C" strokeWidth="1.75" strokeLinecap="round" />
                    </marker>
                    <marker id="crows-many-demo" viewBox="0 0 16 16" refX="16" refY="8" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
                      <line x1="0" y1="8" x2="16" y2="8" stroke="#15191C" strokeWidth="1.75" />
                      <line x1="4" y1="2" x2="4" y2="14" stroke="#15191C" strokeWidth="1.75" strokeLinecap="round" />
                      <line x1="5" y1="8" x2="15.5" y2="2" stroke="#15191C" strokeWidth="1.75" strokeLinecap="round" />
                      <line x1="5" y1="8" x2="15.5" y2="14" stroke="#15191C" strokeWidth="1.75" strokeLinecap="round" />
                    </marker>
                  </defs>

                  {/* ERD Connections */}
                  {heroTab === 'erd' && (() => {
                    const u = demoNodes.find(n => n.id === 'erd-users');
                    const o = demoNodes.find(n => n.id === 'erd-orders');
                    const d = demoNodes.find(n => n.id === 'erd-diagrams');
                    if (!u || !o || !d) return null;

                    // u to o (vertical orthogonal)
                    const uX = u.x + 85;
                    const uY = u.y + 88;
                    const oX = o.x + 85;
                    const oY = o.y;

                    // o to d (orthogonal turn)
                    const oRightX = o.x + 175;
                    const oMidY = o.y + 44;
                    const dLeftX = d.x;
                    const dMidY = d.y + 44;
                    const midX = (oRightX + dLeftX) / 2;

                    return (
                      <>
                        <path 
                          d={`M ${uX} ${uY} L ${uX} ${(uY + oY) / 2} L ${oX} ${(uY + oY) / 2} L ${oX} ${oY}`} 
                          fill="none" 
                          stroke="#1E5C8C" 
                          strokeWidth="2" 
                          markerStart="url(#crows-one-demo)"
                          markerEnd="url(#crows-many-demo)"
                        />
                        <path 
                          d={`M ${oRightX} ${oMidY} L ${midX} ${oMidY} L ${midX} ${dMidY} L ${dLeftX} ${dMidY}`} 
                          fill="none" 
                          stroke="#15191C" 
                          strokeWidth="2" 
                          markerEnd="url(#crows-one-demo)"
                        />
                      </>
                    );
                  })()}

                  {/* Flowchart Connections */}
                  {heroTab === 'flowchart' && (() => {
                    const start = demoNodes.find(n => n.id === 'flow-start');
                    const proc = demoNodes.find(n => n.id === 'flow-process');
                    const dec = demoNodes.find(n => n.id === 'flow-decision');
                    const end = demoNodes.find(n => n.id === 'flow-end');
                    if (!start || !proc || !dec || !end) return null;

                    return (
                      <>
                        <path 
                          d={`M ${start.x + 70} ${start.y + 32} L ${proc.x + 70} ${proc.y}`} 
                          fill="none" 
                          stroke="#15191C" 
                          strokeWidth="2" 
                          markerEnd="url(#arrow-demo)"
                        />
                        <path 
                          d={`M ${proc.x + 140} ${proc.y + 24} L ${dec.x} ${proc.y + 24} L ${dec.x} ${dec.y + 30}`} 
                          fill="none" 
                          stroke="#1E5C8C" 
                          strokeWidth="2" 
                          markerEnd="url(#arrow-blue-demo)"
                        />
                        <path 
                          d={`M ${dec.x + 30} ${dec.y + 60} L ${dec.x + 30} ${end.y + 16} L ${end.x} ${end.y + 16}`} 
                          fill="none" 
                          stroke="#D45B33" 
                          strokeWidth="2" 
                          markerEnd="url(#arrow-demo)"
                        />
                      </>
                    );
                  })()}

                  {/* Sequence Connections */}
                  {heroTab === 'sequence' && (() => {
                    const c = demoNodes.find(n => n.id === 'seq-client');
                    const g = demoNodes.find(n => n.id === 'seq-gateway');
                    const d = demoNodes.find(n => n.id === 'seq-db');
                    if (!c || !g || !d) return null;

                    const cX = c.x + 50;
                    const gX = g.x + 50;
                    const dX = d.x + 50;

                    return (
                      <>
                        {/* Lifelines */}
                        <line x1={cX} y1={c.y + 40} x2={cX} y2={280} stroke="#15191C" strokeWidth="1.5" strokeDasharray="4 4" />
                        <line x1={gX} y1={g.y + 40} x2={gX} y2={280} stroke="#1E5C8C" strokeWidth="1.5" strokeDasharray="4 4" />
                        <line x1={dX} y1={d.y + 40} x2={dX} y2={280} stroke="#D45B33" strokeWidth="1.5" strokeDasharray="4 4" />

                        {/* Request Call */}
                        <path d={`M ${cX} 100 L ${gX} 100`} stroke="#15191C" strokeWidth="2" markerEnd="url(#arrow-demo)" />
                        <text x={(cX + gX) / 2} y={92} fill="#15191C" fontSize="8.5" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                          POST /login
                        </text>

                        {/* DB Query */}
                        <path d={`M ${gX} 160 L ${dX} 160`} stroke="#1E5C8C" strokeWidth="2" markerEnd="url(#arrow-blue-demo)" />
                        <text x={(gX + dX) / 2} y={152} fill="#1E5C8C" fontSize="8.5" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                          verify_auth()
                        </text>

                        {/* Response */}
                        <path d={`M ${gX} 220 L ${cX} 220`} stroke="#064E3B" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#arrow-demo)" />
                        <text x={(cX + gX) / 2} y={212} fill="#064E3B" fontSize="8.5" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                          200 OK (JWT)
                        </text>
                      </>
                    );
                  })()}
                </svg>

                {/* Nodes on Canvas with Authentic Diagrid Styling */}
                {demoNodes.map((node) => {
                  return (
                    <div
                      key={node.id}
                      onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                      style={{
                        left: `${node.x}px`,
                        top: `${node.y}px`,
                      }}
                      className="absolute select-none cursor-grab active:cursor-grabbing z-20"
                    >
                      {/* 1. Database Table Node (Authentic ERD) */}
                      {node.type === 'table' && (
                        <div className="w-[175px] border-2 border-ink bg-paper-raised shadow-hard-blueprint relative">
                          {/* Connection Ports on 4 Edges */}
                          <div className="w-2.5 h-2.5 rounded-full bg-blueprint border border-ink absolute -top-1.5 left-1/2 -translate-x-1/2 pointer-events-none" />
                          <div className="w-2.5 h-2.5 rounded-full bg-blueprint border border-ink absolute -bottom-1.5 left-1/2 -translate-x-1/2 pointer-events-none" />
                          <div className="w-2.5 h-2.5 rounded-full bg-blueprint border border-ink absolute -left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <div className="w-2.5 h-2.5 rounded-full bg-blueprint border border-ink absolute -right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />

                          {/* Table Header */}
                          <div className="bg-blueprint text-white font-mono font-bold text-[11px] px-2.5 py-1.5 border-b-2 border-ink flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Database className="w-3 h-3" />
                              <span>{node.label}</span>
                            </div>
                            <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                          </div>

                          {/* Field Rows */}
                          <div className="p-2 flex flex-col gap-1 font-mono text-[10px]">
                            {node.fields?.map((f, i) => (
                              <div key={i} className="flex items-center justify-between">
                                <span className={f.isKey ? 'font-bold text-ink' : 'text-[#333C42]'}>
                                  {f.name}
                                </span>
                                <div className="flex items-center gap-1">
                                  {f.isKey && (
                                    <span className="text-[8px] bg-amber-200 border border-ink px-1 text-ink font-bold">
                                      PK
                                    </span>
                                  )}
                                  <span className="text-ink-soft text-[9px]">{f.type}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 2. Decision Diamond Node */}
                      {node.type === 'decision' && (
                        <div className="w-[60px] h-[60px] relative flex items-center justify-center">
                          {/* Connection Ports on 4 Vertices */}
                          <div className="w-2.5 h-2.5 rounded-full bg-signal border border-ink absolute -top-1.5 left-1/2 -translate-x-1/2 pointer-events-none z-30" />
                          <div className="w-2.5 h-2.5 rounded-full bg-signal border border-ink absolute -bottom-1.5 left-1/2 -translate-x-1/2 pointer-events-none z-30" />
                          <div className="w-2.5 h-2.5 rounded-full bg-signal border border-ink absolute -left-1.5 top-1/2 -translate-y-1/2 pointer-events-none z-30" />
                          <div className="w-2.5 h-2.5 rounded-full bg-signal border border-ink absolute -right-1.5 top-1/2 -translate-y-1/2 pointer-events-none z-30" />

                          <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" viewBox="0 0 60 60">
                            <polygon points="32,2 62,32 32,62 2,32" fill="#D45B33" opacity="0.3" />
                            <polygon points="30,0 60,30 30,60 0,30" fill="#FFFFFF" stroke="#15191C" strokeWidth="2" />
                          </svg>
                          <span className="relative z-20 font-mono text-[9px] font-bold text-center px-1 text-signal">
                            {node.label}
                          </span>
                        </div>
                      )}

                      {/* 3. Terminal Capsule Node */}
                      {node.type === 'terminal' && (
                        <div className="rounded-full border-2 border-ink bg-paper-raised px-4 py-1.5 shadow-hard-ink font-mono font-bold text-[10.5px] flex items-center justify-center gap-1.5 relative">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-ink">{node.label}</span>
                        </div>
                      )}

                      {/* 4. Process Card Node */}
                      {node.type === 'process' && (
                        <div className="w-[140px] border-2 border-ink bg-paper-raised p-2 shadow-hard-blueprint relative font-mono">
                          <div className="w-2.5 h-2.5 rounded-full bg-blueprint border border-ink absolute -top-1.5 left-1/2 -translate-x-1/2 pointer-events-none" />
                          <div className="w-2.5 h-2.5 rounded-full bg-blueprint border border-ink absolute -right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <div className="font-bold text-[11px] text-ink">{node.label}</div>
                          {node.subtitle && <div className="text-[9px] text-ink-soft mt-0.5">{node.subtitle}</div>}
                        </div>
                      )}

                      {/* 5. Sequence Actor Node */}
                      {node.type === 'actor' && (
                        <div className="w-[100px] border-2 border-ink bg-paper-raised p-1.5 text-center shadow-hard-ink font-mono">
                          <div className="font-bold text-[11px] text-ink">{node.label}</div>
                          {node.subtitle && <div className="text-[8.5px] text-ink-soft">{node.subtitle}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Floating Bottom Toolbar Pill (Matching Editor) */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center bg-paper-raised border-2 border-ink rounded-full shadow-hard-ink px-3 py-1 gap-2.5 font-mono text-[10px] select-none">
                  <span className="text-blueprint font-bold flex items-center gap-1">
                    <MousePointer className="w-3 h-3" /> Select
                  </span>
                  <span className="text-line">|</span>
                  <span className="text-ink-soft flex items-center gap-1">
                    <GitCommit className="w-3 h-3" /> Connect
                  </span>
                  <span className="text-line">|</span>
                  <span className="text-ink-soft flex items-center gap-1 hidden sm:inline-flex">
                    <PenTool className="w-3 h-3" /> Draw
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Highlights Ribbon in Plain English */}
      <div className="border-b-2 border-ink bg-[#101417] text-[#9AA5A0] px-8 py-3.5 overflow-x-auto select-none">
        <div className="flex items-center gap-8 min-w-max font-mono text-[12px] mx-auto justify-between max-w-6xl">
          <div className="flex items-center gap-2 text-white font-bold">
            <Sliders className="w-4 h-4 text-blueprint" />
            <span>Why it works better:</span>
          </div>
          <div>Lines: <strong className="text-blueprint font-bold">Straight Right Angles (No Spaghetti)</strong></div>
          <div>Alignment: <strong className="text-white font-bold">Snaps into Place Automatically</strong></div>
          <div>Privacy: <strong className="text-[#38A169] font-bold">Saved 100% on Your Computer</strong></div>
          <div>Export: <strong className="text-white font-bold">Sharp Images for School & Work</strong></div>
        </div>
      </div>

      {/* 3. Supported Diagrams Showcase (8 Types in Plain English) */}
      <section id="diagrams" className="p-8 sm:p-12 lg:p-16 border-b-2 border-ink bg-paper">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b-2 border-ink pb-6">
            <div>
              <div className="font-mono text-[11px] text-blueprint uppercase tracking-wider mb-1 font-bold">
                Supported Diagrams
              </div>
              <h2 className="text-[30px] sm:text-[36px] font-bold tracking-tight text-ink">
                Every Diagram You Need for Projects & Reports
              </h2>
              <p className="text-[14px] text-[#333C42] font-mono mt-1 font-medium">
                Choose the kind of drawing you want to make — all ready to use.
              </p>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex border-2 border-ink font-mono text-[11px] bg-paper-raised self-start md:self-auto shadow-hard-ink">
              {(['all', 'data', 'logic', 'planning'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setGalleryFilter(cat)}
                  className={`px-3.5 py-2 border-r-2 last:border-r-0 border-ink uppercase tracking-wide transition-colors cursor-pointer font-bold ${
                    galleryFilter === cat 
                      ? 'bg-ink text-paper' 
                      : 'text-[#333C42] hover:bg-ink hover:text-paper'
                  }`}
                >
                  {cat === 'all' ? 'All (8)' : cat === 'data' ? 'Databases' : cat === 'logic' ? 'Flowcharts' : 'Planning'}
                </button>
              ))}
            </div>
          </div>

          {/* 8 Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredGallery.map((diag) => {
              const Icon = diag.icon;
              const tmpl = templateMap[diag.id];

              return (
                <div 
                  key={diag.id}
                  className="border-2 border-ink bg-paper-raised p-5 flex flex-col justify-between hover:border-blueprint hover:shadow-hard-blueprint transition-all shadow-hard-ink group"
                >
                  <div className="flex flex-col gap-3">
                    {/* Visual Vector Diagram Preview Thumbnail */}
                    <div className="h-28 border-2 border-ink bg-paper relative overflow-hidden -mx-5 -mt-5 mb-1 group-hover:border-blueprint transition-colors pointer-events-none">
                      <TemplateThumbnail 
                        content={tmpl?.content || '{}'} 
                        type={diag.id as any} 
                        className="w-full h-full"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 border-2 border-ink bg-ink text-paper flex items-center justify-center group-hover:bg-blueprint group-hover:border-blueprint transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="font-mono text-[10px] uppercase border border-ink px-1.5 py-0.5 text-ink font-bold bg-paper">
                        {diag.category === 'data' ? 'Database' : diag.category === 'logic' ? 'Flow' : 'Planning'}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-[16px] tracking-tight text-ink group-hover:text-blueprint transition-colors">
                        {diag.title}
                      </h3>
                      <p className="text-[12.5px] text-[#333C42] mt-1.5 leading-relaxed font-sans font-medium">
                        {diag.desc}
                      </p>
                    </div>

                    {/* Features checklist */}
                    <div className="flex flex-col gap-1 border-t-2 border-ink border-dashed pt-3 mt-1 font-mono text-[11px] text-ink font-bold">
                      {diag.features.map((feat) => (
                        <div key={feat} className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 bg-blueprint"></div>
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t-2 border-ink flex justify-between items-center font-mono text-[11px]">
                    <span className="text-[#333C42] font-bold text-[10px]">{diag.nodeCount}</span>
                    <Link
                      to={`/templates`}
                      className="text-blueprint hover:underline flex items-center gap-1 font-bold"
                    >
                      Use Template
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. "How Diagrid Works" — 3 Simple Steps */}
      <section id="how-it-works" className="border-b-2 border-ink bg-paper-raised">
        <div className="max-w-6xl mx-auto">
          <div className="p-8 sm:p-12 border-b-2 border-ink">
            <div className="font-mono text-[11px] text-blueprint uppercase tracking-wider mb-1 font-bold">
              Simple 3-Step Process
            </div>
            <h2 className="text-[30px] sm:text-[36px] font-bold tracking-tight text-ink">
              From Idea to Finished Diagram in 3 Steps
            </h2>
            <p className="text-[14px] text-[#333C42] font-mono mt-1 font-medium">
              No learning curve. No confusing menus.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3">
            {/* Step 1 */}
            <div className="p-8 sm:p-10 border-b-2 md:border-b-0 md:border-r-2 border-ink flex flex-col justify-between gap-6 bg-paper">
              <div className="flex flex-col gap-3">
                <span className="font-mono text-[11px] bg-blueprint text-paper px-2 py-0.5 self-start font-bold">
                  STEP 1
                </span>
                <h3 className="text-[20px] font-bold tracking-tight text-ink">
                  Pick a starting template
                </h3>
                <p className="text-[14px] text-[#2C3439] leading-relaxed font-sans font-medium">
                  Start with a fresh blank page, or pick a ready-to-use template for databases, flowcharts, timelines, or app planning.
                </p>
              </div>
              <div className="font-mono text-[11px] bg-ink text-[#A6E22E] p-3 border-2 border-ink shadow-sm">
                ✓ Ready in 1 click
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-8 sm:p-10 border-b-2 md:border-b-0 md:border-r-2 border-ink flex flex-col justify-between gap-6 bg-paper-raised">
              <div className="flex flex-col gap-3">
                <span className="font-mono text-[11px] bg-signal text-paper px-2 py-0.5 self-start font-bold">
                  STEP 2
                </span>
                <h3 className="text-[20px] font-bold tracking-tight text-ink">
                  Drag boxes & connect lines
                </h3>
                <p className="text-[14px] text-[#2C3439] leading-relaxed font-sans font-medium">
                  Move boxes around with your mouse. Drag lines from one box to another — they automatically bend at 90° angles so lines stay neat and never cross awkwardly.
                </p>
              </div>
              <div className="font-mono text-[11px] bg-ink text-[#A6E22E] p-3 border-2 border-ink shadow-sm">
                ✓ Lines snap neatly
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-8 sm:p-10 flex flex-col justify-between gap-6 bg-paper">
              <div className="flex flex-col gap-3">
                <span className="font-mono text-[11px] bg-blueprint text-paper px-2 py-0.5 self-start font-bold">
                  STEP 3
                </span>
                <h3 className="text-[20px] font-bold tracking-tight text-ink">
                  Download images or export code
                </h3>
                <p className="text-[14px] text-[#2C3439] leading-relaxed font-sans font-medium">
                  Export as crystal-clear images (SVG & PNG) or copy clean diagram code (Mermaid JS & PlantUML). Paste straight into Word, Google Docs, PowerPoint, GitHub, or school thesis reports.
                </p>
              </div>
              <div className="font-mono text-[11px] bg-ink text-[#A6E22E] p-3 border-2 border-ink shadow-sm">
                ✓ SVG, PNG, Mermaid & PlantUML
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Code & Notes to Diagram Compiler */}
      <section id="code-to-diagram" className="p-8 sm:p-12 lg:p-16 border-b-2 border-ink bg-paper">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b-2 border-ink pb-6">
            <div>
              <div className="font-mono text-[11px] text-blueprint uppercase tracking-wider mb-1 font-bold flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5" />
                <span>Mode 2: Code & Notes to Diagram</span>
              </div>
              <h2 className="text-[30px] sm:text-[36px] font-bold tracking-tight text-ink">
                Prefer Typing? Turn Plain Notes Into Clean Diagrams
              </h2>
              <p className="text-[14px] text-[#333C42] font-mono mt-1 font-medium max-w-2xl">
                The studio at the top is for dragging and drawing with your mouse. If you prefer typing out bullet points, database schemas, or Mermaid code, Diagrid converts your text into clean diagrams instantly.
              </p>
            </div>

            {/* Preset switcher */}
            <div className="flex border-2 border-ink font-mono text-[11px] bg-paper-raised shadow-hard-ink">
              {(['erd', 'flowchart', 'sequence'] as const).map((presetKey) => (
                <button
                  key={presetKey}
                  onClick={() => setActiveCodePreset(presetKey)}
                  className={`px-3.5 py-2 border-r-2 last:border-r-0 border-ink uppercase tracking-wide transition-colors cursor-pointer font-bold ${
                    activeCodePreset === presetKey 
                      ? 'bg-ink text-paper' 
                      : 'text-ink hover:bg-ink hover:text-paper'
                  }`}
                >
                  {presetKey === 'erd' ? 'Database (ERD)' : presetKey === 'flowchart' ? 'Checkout Flow' : 'Login Steps'}
                </button>
              ))}
            </div>
          </div>

          {/* Split Screen Component */}
          <div className="grid grid-cols-1 lg:grid-cols-2 border-2 border-ink shadow-hard-blueprint overflow-hidden bg-paper-raised">
            {/* Left: Description / Code Editor */}
            <div className="border-b-2 lg:border-b-0 lg:border-r-2 border-ink bg-[#101417] flex flex-col text-paper">
              <div className="h-9 border-b-2 border-ink px-4 flex items-center justify-between font-mono text-[11px] bg-[#161B1F]">
                <div className="flex items-center gap-2">
                  <Code className="w-3.5 h-3.5 text-blueprint" />
                  <span className="font-bold text-white">{CODE_PRESETS[activeCodePreset].tabName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">Live Compiler</span>
                </div>
              </div>

              {/* Code editor view with line numbers */}
              <div className="p-4 sm:p-5 font-mono text-[12px] sm:text-[12.5px] leading-relaxed overflow-x-auto text-[#E2E8F0] flex gap-3">
                {/* Line numbers gutter */}
                <div className="select-none text-[#5A6872] flex flex-col text-right font-mono pr-2 border-r border-[#263138]">
                  {CODE_PRESETS[activeCodePreset].code.split('\n').map((_, idx) => (
                    <span key={idx} className="leading-relaxed text-[11px]">{idx + 1}</span>
                  ))}
                </div>
                {/* Code content */}
                <pre className="whitespace-pre font-mono text-[#E2E8F0] flex-1 leading-relaxed">
                  {CODE_PRESETS[activeCodePreset].code}
                </pre>
              </div>

              <div className="mt-auto border-t-2 border-ink p-3 font-mono text-[10.5px] text-[#8E9B97] flex justify-between bg-[#161B1F] font-bold">
                <span className="flex items-center gap-1.5 text-paper">
                  <Sparkles className="w-3 h-3 text-blueprint" />
                  {CODE_PRESETS[activeCodePreset].lang}
                </span>
                <span className="text-emerald-400">✓ Compiled in 12ms</span>
              </div>
            </div>

            {/* Right: Authentic Diagrid App Canvas Output */}
            <div className="flex flex-col bg-paper-raised">
              <div className="h-9 border-b-2 border-ink px-4 flex items-center justify-between font-mono text-[11px] text-ink bg-paper">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-blueprint" />
                  <span className="font-bold text-ink">{CODE_PRESETS[activeCodePreset].title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#38A169] bg-emerald-50 border border-emerald-300 font-mono text-[9px] uppercase font-bold px-1.5 py-0.5">
                    DIAGRID RENDERER
                  </span>
                  <span className="text-ink-soft text-[10px] hidden sm:inline">SNAP: 20PX</span>
                </div>
              </div>

              <div className="p-6 min-h-[360px] flex-1 bg-grid relative flex items-center justify-center overflow-hidden">
                {/* SVG Definitions for Arrows and Connectors */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                  <defs>
                    <marker id="arrow-sec5" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#15191C" />
                    </marker>
                    <marker id="arrow-sec5-blue" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#1E5C8C" />
                    </marker>
                    <marker id="arrow-sec5-green" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#064E3B" />
                    </marker>
                    <marker id="crows-many-sec5" viewBox="0 0 20 20" refX="16" refY="10" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
                      <line x1="2" y1="2" x2="16" y2="10" stroke="#1E5C8C" strokeWidth="2" strokeLinecap="round" />
                      <line x1="2" y1="18" x2="16" y2="10" stroke="#1E5C8C" strokeWidth="2" strokeLinecap="round" />
                      <line x1="2" y1="10" x2="16" y2="10" stroke="#1E5C8C" strokeWidth="2" strokeLinecap="round" />
                      <line x1="8" y1="3" x2="8" y2="17" stroke="#1E5C8C" strokeWidth="2" strokeLinecap="round" />
                    </marker>
                    <marker id="crows-one-sec5" viewBox="0 0 20 20" refX="6" refY="10" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
                      <line x1="6" y1="3" x2="6" y2="17" stroke="#1E5C8C" strokeWidth="2" strokeLinecap="round" />
                      <line x1="12" y1="3" x2="12" y2="17" stroke="#1E5C8C" strokeWidth="2" strokeLinecap="round" />
                    </marker>
                  </defs>

                  {/* 1. ERD Connections (Orthogonal line with Crow's Foot) */}
                  {activeCodePreset === 'erd' && (
                    <path
                      d="M 175 140 L 210 140 L 210 140 L 245 140"
                      fill="none"
                      stroke="#1E5C8C"
                      strokeWidth="2"
                      markerStart="url(#crows-one-sec5)"
                      markerEnd="url(#crows-many-sec5)"
                    />
                  )}

                  {/* 2. Sequence Diagram Lines & Arrows */}
                  {activeCodePreset === 'sequence' && (
                    <>
                      {/* Lifelines */}
                      <line x1="75" y1="48" x2="75" y2="280" stroke="#15191C" strokeWidth="1.5" strokeDasharray="4 4" />
                      <line x1="210" y1="48" x2="210" y2="280" stroke="#1E5C8C" strokeWidth="1.5" strokeDasharray="4 4" />
                      <line x1="345" y1="48" x2="345" y2="280" stroke="#D45B33" strokeWidth="1.5" strokeDasharray="4 4" />

                      {/* 1. POST /login */}
                      <path d="M 75 90 L 210 90" stroke="#15191C" strokeWidth="2" markerEnd="url(#arrow-sec5)" />
                      <text x="142" y="82" fill="#15191C" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                        1. POST /login
                      </text>

                      {/* 2. verify_user_record() */}
                      <path d="M 210 145 L 345 145" stroke="#1E5C8C" strokeWidth="2" markerEnd="url(#arrow-sec5-blue)" />
                      <text x="277" y="137" fill="#1E5C8C" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                        2. verify_user()
                      </text>

                      {/* 3. auth_verified */}
                      <path d="M 345 200 L 210 200" stroke="#15191C" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#arrow-sec5)" />
                      <text x="277" y="192" fill="#15191C" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                        3. verified (ok)
                      </text>

                      {/* 4. 200 OK (access_token) */}
                      <path d="M 210 255 L 75 255" stroke="#064E3B" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#arrow-sec5-green)" />
                      <text x="142" y="247" fill="#064E3B" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                        4. 200 OK (jwt)
                      </text>
                    </>
                  )}

                  {/* 3. Flowchart Lines & Arrows */}
                  {activeCodePreset === 'flowchart' && (
                    <>
                      {/* Start to Validate */}
                      <path d="M 210 40 L 210 70" stroke="#15191C" strokeWidth="2" markerEnd="url(#arrow-sec5)" />
                      {/* Validate to Decision */}
                      <path d="M 210 115 L 210 145" stroke="#15191C" strokeWidth="2" markerEnd="url(#arrow-sec5)" />
                      {/* Decision -> YES -> Complete */}
                      <path d="M 245 175 L 330 175 L 330 220" fill="none" stroke="#064E3B" strokeWidth="2" markerEnd="url(#arrow-sec5-green)" />
                      <text x="280" y="167" fill="#064E3B" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                        YES
                      </text>
                      {/* Decision -> NO -> Decline */}
                      <path d="M 175 175 L 90 175 L 90 220" fill="none" stroke="#D45B33" strokeWidth="2" markerEnd="url(#arrow-sec5)" />
                      <text x="135" y="167" fill="#D45B33" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                        NO
                      </text>
                    </>
                  )}
                </svg>

                {/* Live Canvas Content Matching Diagrid Real App */}

                {/* A. ERD Blueprint Presentation */}
                {activeCodePreset === 'erd' && (
                  <div className="flex items-center justify-between w-full max-w-[420px] relative z-20">
                    {/* Users Table */}
                    <div className="w-[170px] border-2 border-ink bg-paper-raised shadow-hard-blueprint relative">
                      <div className="w-2.5 h-2.5 rounded-full bg-blueprint border border-ink absolute -right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <div className="bg-blueprint text-white font-mono font-bold text-[11px] px-2.5 py-1.5 border-b-2 border-ink flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Database className="w-3 h-3" />
                          <span>users</span>
                        </div>
                        <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
                      </div>
                      <div className="p-2 flex flex-col gap-1 font-mono text-[10px]">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-ink">id</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] bg-amber-200 border border-ink px-1 text-ink font-bold">PK</span>
                            <span className="text-ink-soft text-[9px]">uuid</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[#333C42]">
                          <span>email</span>
                          <span className="text-ink-soft text-[9px]">varchar</span>
                        </div>
                        <div className="flex items-center justify-between text-[#333C42]">
                          <span>role</span>
                          <span className="text-ink-soft text-[9px]">text</span>
                        </div>
                      </div>
                    </div>

                    {/* Orders Table */}
                    <div className="w-[170px] border-2 border-ink bg-paper-raised shadow-hard-blueprint relative">
                      <div className="w-2.5 h-2.5 rounded-full bg-blueprint border border-ink absolute -left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <div className="bg-blueprint text-white font-mono font-bold text-[11px] px-2.5 py-1.5 border-b-2 border-ink flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Database className="w-3 h-3" />
                          <span>orders</span>
                        </div>
                        <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
                      </div>
                      <div className="p-2 flex flex-col gap-1 font-mono text-[10px]">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-ink">id</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] bg-amber-200 border border-ink px-1 text-ink font-bold">PK</span>
                            <span className="text-ink-soft text-[9px]">uuid</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-blueprint">user_id</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] bg-sky-200 border border-ink px-1 text-ink font-bold">FK</span>
                            <span className="text-ink-soft text-[9px]">uuid</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[#333C42]">
                          <span>total_usd</span>
                          <span className="text-ink-soft text-[9px]">numeric</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* B. Sequence Diagram Presentation */}
                {activeCodePreset === 'sequence' && (
                  <div className="w-full max-w-[420px] h-[280px] relative font-mono text-[11px] z-20">
                    {/* Actors at top */}
                    <div className="flex justify-between items-center">
                      <div className="border-2 border-ink bg-paper-raised p-1.5 text-center shadow-hard-ink w-24">
                        <div className="font-bold text-ink text-[10.5px]">Client App</div>
                        <div className="text-[8px] text-ink-soft">Frontend</div>
                      </div>
                      <div className="border-2 border-ink bg-paper-raised p-1.5 text-center shadow-hard-blueprint w-24">
                        <div className="font-bold text-blueprint text-[10.5px]">API Gateway</div>
                        <div className="text-[8px] text-ink-soft">Edge Router</div>
                      </div>
                      <div className="border-2 border-ink bg-paper-raised p-1.5 text-center shadow-hard-ink w-24">
                        <div className="font-bold text-ink text-[10.5px]">User DB</div>
                        <div className="text-[8px] text-ink-soft">Postgres</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* C. Flowchart Presentation */}
                {activeCodePreset === 'flowchart' && (
                  <div className="w-full max-w-[420px] h-[280px] relative font-mono text-[11px] z-20 flex flex-col items-center">
                    {/* Start Capsule */}
                    <div className="rounded-full border-2 border-ink bg-paper-raised px-4 py-1 font-bold text-[10.5px] shadow-hard-ink flex items-center gap-1.5 absolute top-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>START CHECKOUT</span>
                    </div>

                    {/* Validate Process Card */}
                    <div className="w-[170px] border-2 border-ink bg-paper-raised p-2 shadow-hard-blueprint absolute top-[70px] text-center">
                      <div className="font-bold text-[10.5px] text-ink">Validate Card Details</div>
                      <div className="text-[8.5px] text-ink-soft mt-0.5">auth_gateway.check()</div>
                    </div>

                    {/* Decision Diamond */}
                    <div className="w-[70px] h-[60px] absolute top-[145px] flex items-center justify-center">
                      <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" viewBox="0 0 70 60">
                        <polygon points="37,2 72,32 37,62 2,32" fill="#D45B33" opacity="0.25" />
                        <polygon points="35,0 70,30 35,60 0,30" fill="#FFFFFF" stroke="#15191C" strokeWidth="2" />
                      </svg>
                      <span className="relative z-20 font-mono text-[8.5px] font-bold text-center px-1 text-signal leading-tight">
                        Funds OK?
                      </span>
                    </div>

                    {/* Decline Alert (Left Branch) */}
                    <div className="w-[120px] border-2 border-signal bg-paper-raised p-1.5 shadow-hard-signal absolute top-[220px] left-[30px] text-center">
                      <div className="font-bold text-[9.5px] text-signal">Decline Notice</div>
                      <div className="text-[8px] text-ink-soft">Retry payment</div>
                    </div>

                    {/* Success (Right Branch) */}
                    <div className="rounded-full border-2 border-emerald-600 bg-emerald-50 px-3 py-1.5 font-bold text-[9.5px] shadow-hard-ink text-emerald-800 flex items-center gap-1.5 absolute top-[220px] right-[30px]">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      <span>Confirm & Receipt</span>
                    </div>
                  </div>
                )}

                {/* Floating Bottom App Toolbar */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 flex items-center bg-paper-raised border-2 border-ink rounded-full shadow-hard-ink px-3 py-0.5 gap-2 font-mono text-[9.5px] select-none text-ink-soft">
                  <span className="text-blueprint font-bold">App Studio Engine</span>
                  <span className="text-line">|</span>
                  <span>Auto-Formatted</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Comparison Table in Plain English */}
      <section id="comparison" className="p-8 sm:p-12 lg:p-16 border-b-2 border-ink bg-paper-raised">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">
          <div>
            <div className="font-mono text-[11px] text-blueprint uppercase tracking-wider mb-1 font-bold">
              Comparison
            </div>
            <h2 className="text-[30px] sm:text-[36px] font-bold tracking-tight text-ink">
              Why People Prefer Diagrid Over Other Tools
            </h2>
            <p className="text-[14px] text-[#333C42] font-mono mt-1 font-medium">
              See the difference between messy whiteboard apps and clean structured diagrams.
            </p>
          </div>

          <div className="border-2 border-ink shadow-hard-ink overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-[12.5px]">
              <thead>
                <tr className="border-b-2 border-ink bg-ink text-paper font-bold">
                  <th className="p-4 uppercase tracking-wider">What You Need</th>
                  <th className="p-4 uppercase tracking-wider text-[#A6B2AD]">Other Whiteboard Tools</th>
                  <th className="p-4 uppercase tracking-wider text-blueprint bg-[#1F272C]">
                    Diagrid
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b-2 border-ink hover:bg-paper">
                  <td className="p-4 font-bold text-ink bg-paper-raised">Connecting Lines</td>
                  <td className="p-4 text-[#4A5359]">
                    <span className="flex items-center gap-1.5 text-signal font-bold">
                      <X className="w-4 h-4 shrink-0" />
                      Messy curved lines that tangle and cross over boxes
                    </span>
                  </td>
                  <td className="p-4 bg-blueprint bg-opacity-10 font-bold text-ink border-l-2 border-blueprint">
                    <span className="flex items-center gap-1.5 text-blueprint font-bold">
                      <Check className="w-4 h-4 shrink-0" />
                      Neat 90-degree lines that turn cleanly and never tangle
                    </span>
                  </td>
                </tr>

                <tr className="border-b-2 border-ink hover:bg-paper">
                  <td className="p-4 font-bold text-ink bg-paper-raised">Database Tables</td>
                  <td className="p-4 text-[#4A5359]">
                    <span className="flex items-center gap-1.5 text-signal font-bold">
                      <X className="w-4 h-4 shrink-0" />
                      Plain sticky notes where you have to type everything by hand
                    </span>
                  </td>
                  <td className="p-4 bg-blueprint bg-opacity-10 font-bold text-ink border-l-2 border-blueprint">
                    <span className="flex items-center gap-1.5 text-blueprint font-bold">
                      <Check className="w-4 h-4 shrink-0" />
                      Pre-made tables with built-in Key tags and column types
                    </span>
                  </td>
                </tr>

                <tr className="border-b-2 border-ink hover:bg-paper">
                  <td className="p-4 font-bold text-ink bg-paper-raised">Look & Feel</td>
                  <td className="p-4 text-[#4A5359]">
                    <span className="flex items-center gap-1.5 text-signal font-bold">
                      <X className="w-4 h-4 shrink-0" />
                      Random fonts and distracting neon colors
                    </span>
                  </td>
                  <td className="p-4 bg-blueprint bg-opacity-10 font-bold text-ink border-l-2 border-blueprint">
                    <span className="flex items-center gap-1.5 text-blueprint font-bold">
                      <Check className="w-4 h-4 shrink-0" />
                      Clean, professional blueprint style ready for any report
                    </span>
                  </td>
                </tr>

                <tr className="border-b-2 border-ink hover:bg-paper">
                  <td className="p-4 font-bold text-ink bg-paper-raised">For Reports & Papers</td>
                  <td className="p-4 text-[#4A5359]">
                    <span className="flex items-center gap-1.5 text-signal font-bold">
                      <X className="w-4 h-4 shrink-0" />
                      Blurry screenshots that look messy when printed
                    </span>
                  </td>
                  <td className="p-4 bg-blueprint bg-opacity-10 font-bold text-ink border-l-2 border-blueprint">
                    <span className="flex items-center gap-1.5 text-blueprint font-bold">
                      <Check className="w-4 h-4 shrink-0" />
                      Crisp PNG & SVG images plus Mermaid & PlantUML code exports
                    </span>
                  </td>
                </tr>

                <tr className="hover:bg-paper">
                  <td className="p-4 font-bold text-ink bg-paper-raised">Getting Started</td>
                  <td className="p-4 text-[#4A5359]">
                    <span className="flex items-center gap-1.5 text-signal font-bold">
                      <X className="w-4 h-4 shrink-0" />
                      Requires creating accounts, passwords, or paying monthly fees
                    </span>
                  </td>
                  <td className="p-4 bg-blueprint bg-opacity-10 font-bold text-ink border-l-2 border-blueprint">
                    <span className="flex items-center gap-1.5 text-blueprint font-bold">
                      <Check className="w-4 h-4 shrink-0" />
                      Click and start drawing immediately — 100% free in your browser
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 7. Bottom Call-to-Action (CTA) Banner in Plain English */}
      <section className="p-8 sm:p-12 lg:p-16 border-b-2 border-ink bg-paper">
        <div className="max-w-4xl mx-auto border-2 border-ink bg-[#15191C] text-paper p-8 sm:p-12 shadow-hard-blueprint flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[11px] text-signal uppercase tracking-wider font-bold">
              Ready to draw?
            </span>
            <h2 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-white">
              Start drawing in seconds.<br />No account needed.
            </h2>
            <p className="text-[14px] text-[#A6B2AD] max-w-[440px] font-sans">
              Open a fresh canvas right now or pick one of our ready-to-use templates.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0 w-full sm:w-auto font-mono">
            <button
              onClick={handleStart}
              className="bg-blueprint text-paper border-2 border-blueprint hover:bg-white hover:text-ink hover:border-white px-6 py-3 text-[13.5px] transition-colors text-center cursor-pointer shadow-hard-ink flex items-center justify-center gap-2 font-bold"
            >
              Start Drawing Free
              <ArrowRight className="w-4 h-4" />
            </button>
            <Link
              to="/templates"
              className="border-2 border-paper text-paper bg-transparent px-6 py-3 text-[13.5px] hover:bg-paper hover:text-ink text-center transition-colors cursor-pointer font-bold"
            >
              Browse Templates
            </Link>
          </div>
        </div>
      </section>

      {/* 8. High-Contrast Dark Footer */}
      <footer className="py-8 px-8 lg:px-12 flex flex-col sm:flex-row justify-between items-center gap-4 font-mono text-[12px] bg-[#101417] text-[#9AA5A0] border-t-2 border-ink">
        <div className="flex items-center gap-3">
          <Logo variant="paper" size="sm" />
          <span>•</span>
          <span>Made for people who want neat diagrams without the hassle.</span>
        </div>

        <div className="flex items-center gap-6 text-[12px]">
          <a href="#diagrams" className="hover:text-white transition-colors">Diagrams</a>
          <Link to="/templates" className="hover:text-white transition-colors">Templates</Link>
          <Link to="/docs" className="hover:text-white transition-colors">Help & Docs</Link>
          <button
            onClick={() => setIsFeedbackOpen(true)}
            className="hover:text-white transition-colors text-[#9AA5A0] flex items-center gap-1.5 cursor-pointer bg-transparent border-none p-0 font-mono text-[12px]"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Feedback
          </button>
          <Link to="/admin" className="hover:text-white transition-colors text-signal flex items-center gap-1 font-bold">
            <ShieldAlert className="w-3.5 h-3.5" />
            Admin Console
          </Link>
        </div>
      </footer>

      {/* Feedback Modal */}
      <FeedbackModal 
        isOpen={isFeedbackOpen} 
        onClose={() => setIsFeedbackOpen(false)} 
      />
    </div>
  );
};
