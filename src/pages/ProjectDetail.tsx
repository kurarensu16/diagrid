import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { projectService } from '../services/projectService';
import { diagramService } from '../services/diagramService';
import { mockDb, type Project, type Diagram } from '../services/mockDb';
import { Plus, Search, Trash2, Copy, FileText, ChevronRight, Calendar, ArrowLeft, X, Sparkles, RefreshCw } from 'lucide-react';
import { TemplateThumbnail } from '../components/ui/TemplateThumbnail';

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [isLoadingDiagrams, setIsLoadingDiagrams] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & triggers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [diagramTitle, setDiagramTitle] = useState('');
  const [diagramType, setDiagramType] = useState<Diagram['type']>('erd');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const allTemplates = React.useMemo(() => mockDb.getTemplates(), []);

  const diagramTemplates = React.useMemo(() => [
    { type: 'erd' as const, label: 'Entity Relationship (ERD)', desc: 'Document schemas, keys, constraints, and table relationships', nodeCount: '3 Tables • 2 Relations', summary: 'Tables: users, projects, diagrams' },
    { type: 'flowchart' as const, label: 'Flowchart', desc: 'Map system execution workflows, logic branching, and conditional loops', nodeCount: '5 Steps • Decision Diamond', summary: 'Terminals, Process, Decision' },
    { type: 'sequence' as const, label: 'Sequence Diagram', desc: 'Track request-response lifetimes between actors, endpoints, and caches', nodeCount: '3 Actors • 4 Timed Calls', summary: 'Lifelines & Async returns' },
    { type: 'class' as const, label: 'Class Diagram', desc: 'Visualize structure classes, instance variables, methods, and inheritances', nodeCount: '2 Classes • Method Specs', summary: 'UML class model' },
    { type: 'gantt' as const, label: 'Gantt Chart', desc: 'Build technical timeline schedules, milestones, sprints, and task durations', nodeCount: '2 Sprints • Schedule Bar', summary: 'Milestones & Dependencies' },
    { type: 'dfd' as const, label: 'Data Flow Diagram (DFD)', desc: 'Map logical data streams between external entities, processes, and stores', nodeCount: 'Entity • Process • Store', summary: 'Gane-Sarson data flow' },
    { type: 'usecase' as const, label: 'Use Case Diagram', desc: 'Visualize actors communication relationships with system bounds and actions', nodeCount: '1 Actor • 2 Use Cases', summary: 'System boundary & Goals' },
    { type: 'activity' as const, label: 'Activity Diagram', desc: 'Model action flows with branching, forking, and synchronization bars', nodeCount: '9 States • Fork/Join Sync', summary: 'Parallel execution flow' }
  ], []);

  const activeTemplate = React.useMemo(() => {
    return allTemplates.find(t => t.type === diagramType);
  }, [allTemplates, diagramType]);

  const activeTemplateMeta = React.useMemo(() => {
    return diagramTemplates.find(t => t.type === diagramType);
  }, [diagramTemplates, diagramType]);

  useEffect(() => {
    if (id) {
      let isMounted = true;
      projectService.getProject(id).then((p) => {
        if (!isMounted) return;
        if (p) {
          setProject(p);
          loadDiagrams(id);
        } else {
          navigate('/dashboard');
        }
      });
      return () => { isMounted = false; };
    }
  }, [id, navigate]);

  const loadDiagrams = async (projId: string) => {
    setIsLoadingDiagrams(true);
    try {
      const data = await diagramService.getDiagrams(projId);
      setDiagrams(data);
    } finally {
      setIsLoadingDiagrams(false);
    }
  };

  const handleCreateDiagram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !diagramTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const newDiag = await diagramService.createDiagram(id, diagramTitle, diagramType);
      setDiagramTitle('');
      setIsCreateModalOpen(false);
      navigate(`/editor/${newDiag.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDiagram = async (e: React.MouseEvent, diagId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this diagram?')) {
      await diagramService.deleteDiagram(diagId);
      if (id) loadDiagrams(id);
    }
  };

  const handleDuplicateDiagram = async (e: React.MouseEvent, diagId: string) => {
    e.stopPropagation();
    await diagramService.duplicateDiagram(diagId);
    if (id) loadDiagrams(id);
  };

  const filteredDiagrams = diagrams.filter((d) =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!project) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px] text-ink-soft font-mono text-[13px]">
        <RefreshCw className="w-5 h-5 text-blueprint animate-spin mr-2" />
        Loading workspace project...
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-6 text-ink">
      {/* Breadcrumb row */}
      <div className="flex items-center gap-2 font-mono text-[12px] text-ink-soft select-none mb-1">
        <Link to="/dashboard" className="hover:text-ink transition-colors">projects</Link>
        <ChevronRight className="w-3.5 h-3.5 text-line" />
        <span className="text-ink">// {project.name}</span>
      </div>

      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="p-1 hover:bg-paper-raised border border-transparent hover:border-line text-ink-soft hover:text-ink transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-[32px] font-bold tracking-tight">{project.name}</h1>
          </div>
          <p className="text-[13px] text-ink-soft font-mono mt-1">// {project.description || 'no description provided'}</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 md:flex-none">
            <Search className="w-4 h-4 text-ink-soft absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2.5 border border-line bg-paper-raised text-[13px] font-mono focus:border-ink focus:outline-none w-full md:w-[240px]"
              placeholder="find_diagram..."
            />
          </div>

          <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-1.5 shrink-0">
            <Plus className="w-4 h-4" />
            create_diagram()
          </Button>
        </div>
      </div>

      {/* Diagrams layout */}
      {isLoadingDiagrams ? (
        <Card variant="blueprint" className="flex flex-col items-center justify-center py-16 text-center">
          <RefreshCw className="w-6 h-6 text-blueprint animate-spin mb-3" />
          <p className="text-[13px] text-ink-soft font-mono">// loading diagrams...</p>
        </Card>
      ) : filteredDiagrams.length === 0 ? (
        <Card variant="blueprint" className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="w-12 h-12 text-ink-soft mb-4 stroke-1" />
          <h3 className="text-[16px] font-bold mb-1">No diagrams found</h3>
          <p className="text-[13px] text-ink-soft font-mono mb-6">// create your first diagram drafting sheet</p>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            create_diagram()
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredDiagrams.map((diag) => {
            let stats = { nodes: 0, edges: 0, drawings: 0 };
            try {
              const p = typeof diag.content === 'string' ? JSON.parse(diag.content || '{}') : diag.content;
              stats = {
                nodes: p.nodes?.length || 0,
                edges: p.edges?.length || 0,
                drawings: p.drawings?.length || 0
              };
            } catch {
              // fallback
            }

            return (
              <Card
                key={diag.id}
                variant="blueprint"
                onClick={() => navigate(`/editor/${diag.id}`)}
                className="cursor-pointer hover:border-blueprint group p-5 flex flex-col justify-between overflow-hidden transition-all hover:shadow-hard-blueprint"
              >
                <div>
                  {/* Live Vector Blueprint Preview Frame */}
                  <div className="w-full h-36 border border-line bg-paper overflow-hidden relative mb-4 group-hover:border-blueprint transition-colors rounded-xs shadow-inner">
                    <TemplateThumbnail
                      content={diag.content}
                      type={diag.type}
                      className="w-full h-full transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-paper/90 backdrop-blur-xs border border-line p-1 shadow-sm">
                      <button
                        onClick={(e) => handleDuplicateDiagram(e, diag.id)}
                        className="p-1 hover:text-blueprint text-ink-soft transition-colors"
                        title="Duplicate"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteDiagram(e, diag.id)}
                        className="p-1 hover:text-signal text-ink-soft transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Diagram Meta */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-blueprint border border-blueprint px-1.5 py-0.5 uppercase tracking-wide">
                      {diag.type}
                    </span>
                    <span className="font-mono text-[10px] text-ink-soft">
                      {stats.nodes} {stats.nodes === 1 ? 'node' : 'nodes'}
                      {stats.edges > 0 ? ` • ${stats.edges} edges` : ''}
                      {stats.drawings > 0 ? ' • sketch' : ''}
                    </span>
                  </div>

                  <h3 className="text-[17px] font-bold tracking-tight text-ink group-hover:text-blueprint transition-colors mt-2 line-clamp-1">
                    {diag.title}
                  </h3>
                </div>

                {/* Timestamp footer */}
                <div className="flex justify-between items-center border-t border-line pt-3 mt-5 font-mono text-[11px] text-ink-soft">
                  <span className="group-hover:text-ink font-bold transition-colors">// open_editor →</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(diag.updated_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Creation Modal with Rich Previews */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-[960px]">
            <Card variant="blueprint" className="p-6 sm:p-8 max-h-[92vh] overflow-y-auto flex flex-col gap-6 shadow-hard-ink">
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-line pb-4">
                <div>
                  <h2 className="text-[20px] font-bold tracking-tight font-mono text-ink">
                    create_diagram()
                  </h2>
                  <p className="text-[12px] text-ink-soft font-mono mt-1">
                    // Select a diagram type starter template to initialize your workspace
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1 hover:bg-paper text-ink-soft hover:text-ink cursor-pointer border border-transparent hover:border-line transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateDiagram} className="flex flex-col gap-5">
                {/* Diagram Title */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-mono text-[11px] font-bold text-ink-soft">
                      DIAGRAM_TITLE
                    </label>
                    <span className="font-mono text-[10px] text-signal font-bold">[REQUIRED]</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={diagramTitle}
                    onChange={(e) => setDiagramTitle(e.target.value)}
                    className="w-full border border-line bg-paper px-3 py-2 text-[14px] font-mono focus:border-ink focus:outline-none placeholder-ink-soft/50"
                    placeholder="e.g. User Checkout Flow"
                    autoFocus
                  />
                </div>

                {/* Templates Selector Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Template Options with Mini Thumbnails */}
                  <div className="lg:col-span-7 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="font-mono text-[11px] font-bold text-ink-soft">
                        SELECT_TEMPLATE ({diagramTemplates.length} AVAILABLE)
                      </label>
                      <span className="font-mono text-[10px] text-ink-soft">CLICK TO PREVIEW</span>
                    </div>

                    <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
                      {diagramTemplates.map((tmpl) => {
                        const isSelected = diagramType === tmpl.type;
                        const tmplObj = allTemplates.find(t => t.type === tmpl.type);

                        return (
                          <div
                            key={tmpl.type}
                            onClick={() => setDiagramType(tmpl.type)}
                            className={`p-2.5 border flex gap-3 items-center cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-ink text-paper border-ink shadow-hard-blueprint'
                                : 'border-line hover:border-ink hover:bg-paper bg-paper-raised text-ink'
                            }`}
                          >
                            {/* Mini Visual Diagram Thumbnail Preview */}
                            <div className={`w-20 h-14 shrink-0 border overflow-hidden relative pointer-events-none ${
                              isSelected ? 'border-line/40' : 'border-line bg-paper'
                            }`}>
                              <TemplateThumbnail 
                                content={tmplObj?.content || '{}'} 
                                type={tmpl.type} 
                                className="w-full h-full"
                              />
                            </div>

                            {/* Template Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[12px] uppercase font-bold tracking-tight truncate">
                                  {tmpl.label}
                                </span>
                                <span className={`text-[10px] font-mono px-1.5 py-0.5 border shrink-0 ${
                                  isSelected 
                                    ? 'border-line/40 text-paper bg-white/10' 
                                    : 'border-line text-ink-soft bg-paper'
                                }`}>
                                  {tmpl.nodeCount.split('•')[0]}
                                </span>
                              </div>
                              <p className={`text-[11px] mt-0.5 line-clamp-2 ${
                                isSelected ? 'text-line' : 'text-ink-soft'
                              }`}>
                                {tmpl.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Live Large Diagram Preview */}
                  <div className="lg:col-span-5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="font-mono text-[11px] font-bold text-blueprint flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        PREVIEW: [{activeTemplateMeta?.label.toUpperCase()}]
                      </label>
                      <span className="font-mono text-[10px] bg-blueprint text-white px-1.5 py-0.2">
                        STARTER
                      </span>
                    </div>

                    {/* Big Preview Frame */}
                    <div className="border border-line bg-paper-raised p-2 flex flex-col gap-3 shadow-sm">
                      <div className="h-[220px] w-full border border-line bg-paper overflow-hidden relative">
                        <TemplateThumbnail 
                          content={activeTemplate?.content || '{}'} 
                          type={diagramType} 
                          className="w-full h-full"
                        />
                      </div>

                      {/* Architecture Specs */}
                      <div className="bg-paper border border-line p-2.5 flex flex-col gap-1.5 font-mono text-[11px]">
                        <div className="flex items-center justify-between text-ink font-bold">
                          <span>// structure_overview</span>
                          <span className="text-[10px] text-blueprint">{activeTemplateMeta?.nodeCount}</span>
                        </div>
                        <p className="text-ink-soft text-[11px] leading-relaxed">
                          {activeTemplateMeta?.desc}
                        </p>
                        <div className="border-t border-line/60 pt-1.5 text-[10px] text-ink-soft flex items-center justify-between">
                          <span>Includes: {activeTemplateMeta?.summary}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex justify-between items-center border-t border-line pt-4 mt-2">
                  <span className="font-mono text-[11px] text-ink-soft hidden sm:inline">
                    Canvas will initialize with pre-wired schematic nodes
                  </span>
                  <div className="flex items-center gap-3">
                    <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
                      cancel
                    </Button>
                    <Button type="submit" variant="primary" disabled={isSubmitting}>
                      {isSubmitting ? 'creating...' : 'create_diagram →'}
                    </Button>
                  </div>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
