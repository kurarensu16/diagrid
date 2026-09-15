import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { templateService } from '../services/templateService';
import { type Template, type Project } from '../services/mockDb';
import { authService } from '../services/authService';
import { projectService } from '../services/projectService';
import { diagramService } from '../services/diagramService';
import { adminService, type TemplateConfig } from '../services/adminService';
import { TemplateThumbnail } from '../components/ui/TemplateThumbnail';
import { 
  Eye, 
  X, 
  Sparkles 
} from 'lucide-react';

// Helpful descriptions tailored to each template
const TEMPLATE_DETAILS: Record<string, { desc: string; nodeCount: string; summary: string }> = {
  't-erd': {
    desc: 'Relational database schema mapping Users, Projects, and Diagrams with PK/FK column attributes and links.',
    nodeCount: '3 Tables • 2 Relations',
    summary: 'Tables: users, projects, diagrams'
  },
  't-flowchart': {
    desc: '5-step workflow tracking start terminal, request action, decision branching, success and complete states.',
    nodeCount: '5 Steps • Decision Diamond',
    summary: 'Terminals, Process, Decision'
  },
  't-sequence': {
    desc: 'Standard message sequence tracing requests across Client App, API Gateway, and Database Server with lifeline activations.',
    nodeCount: '3 Lifelines • 4 Timed Calls',
    summary: 'Lifelines & Async returns'
  },
  't-class': {
    desc: 'Object-oriented clean architecture model showing UserController, UserService, and UserEntity with method signatures.',
    nodeCount: '3 Classes • Method Specs',
    summary: 'UML class model'
  },
  't-gantt': {
    desc: 'Project release roadmap tracking Specifications, Core Engineering, and QA/Deployment milestone dependencies.',
    nodeCount: '3 Phases • Schedule Bar',
    summary: 'Milestones & Dependencies'
  },
  't-dfd': {
    desc: 'Standard Level-1 Data Flow Diagram (Gane-Sarson) with External Entities, Process ID headers, Data Stores, and noun-phrase flows.',
    nodeCount: '2 Entities • 2 Processes • 2 Stores',
    summary: 'Gane-Sarson Level-1 DFD'
  },
  't-usecase': {
    desc: 'UML Use Case model showing System Boundary with Customer & Administrator actors linked to functional use case goals.',
    nodeCount: '2 Actors • 3 Use Cases',
    summary: 'System Boundary & Goals'
  },
  't-activity': {
    desc: 'Concurrent UML activity workflow with initial node (●), validation decision, error loop, fork/join parallel synchronization, and final node (◉).',
    nodeCount: '10 States • Fork/Join Sync',
    summary: 'Parallel execution flow'
  }
};

export const Templates: React.FC = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [templateConfigs, setTemplateConfigs] = useState<Record<string, TemplateConfig>>({});
  const [activeTab, setActiveTab] = useState<'all' | Template['type']>('all');

  // Preview Modal state
  const [previewingTemplate, setPreviewingTemplate] = useState<Template | null>(null);

  // Creation State
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [targetProjectId, setTargetProjectId] = useState('');
  const [newDiagramTitle, setNewDiagramTitle] = useState('');

  useEffect(() => {
    templateService.getTemplates().then((tmpls) => {
      setTemplates(tmpls);
    });
    projectService.getProjects().then((projs) => {
      setProjects(projs);
    });
    
    // Load admin configs to check for 'featured' and 'enabled' statuses
    adminService.getTemplateConfigs().then((configs) => {
      const map: Record<string, TemplateConfig> = {};
      configs.forEach((c) => { map[c.id] = c; });
      setTemplateConfigs(map);
    }).catch(() => {
      // fallback
    });
  }, []);

  const handleCreateFromTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate || !targetProjectId || !newDiagramTitle.trim()) return;

    const newDiag = await diagramService.createDiagram(
      targetProjectId,
      newDiagramTitle,
      selectedTemplate.type,
      selectedTemplate.content
    );

    setSelectedTemplate(null);
    setPreviewingTemplate(null);
    setNewDiagramTitle('');
    navigate(`/editor/${newDiag.id}`);
  };

  const openUseModal = (tmpl: Template) => {
    if (!authService.getUserSync()) {
      navigate('/auth');
      return;
    }
    setSelectedTemplate(tmpl);
    setNewDiagramTitle(`${tmpl.title} (Draft)`);
    if (projects.length > 0) {
      setTargetProjectId(projects[0].id);
    }
  };

  const filteredTemplates = (activeTab === 'all'
    ? templates
    : templates.filter(t => t.type === activeTab)
  ).sort((a, b) => {
    // Show featured templates first
    const isAFeatured = templateConfigs[a.id]?.featured ? 1 : 0;
    const isBFeatured = templateConfigs[b.id]?.featured ? 1 : 0;
    return isBFeatured - isAFeatured;
  });

  const tabs: { value: 'all' | Template['type']; label: string }[] = [
    { value: 'all', label: 'all templates (8)' },
    { value: 'erd', label: 'database (erd)' },
    { value: 'flowchart', label: 'flowchart' },
    { value: 'sequence', label: 'sequence' },
    { value: 'class', label: 'class diagram' },
    { value: 'gantt', label: 'timeline (gantt)' },
    { value: 'dfd', label: 'data flow (dfd)' },
    { value: 'usecase', label: 'use case' },
    { value: 'activity', label: 'activity' },
  ];

  return (
    <div className="p-6 sm:p-8 lg:p-10 flex flex-col gap-6 text-ink max-w-7xl mx-auto w-full">
      {/* Header section */}
      <div className="border-b-2 border-ink pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] text-blueprint uppercase tracking-wider mb-1 font-bold">
            // starter_blueprints
          </div>
          <h1 className="text-[32px] sm:text-[36px] font-bold tracking-tight text-ink">
            Blueprint Templates
          </h1>
          <p className="text-[14px] text-ink-soft font-mono mt-1">
            Pick a pre-assembled visual schematic to jumpstart your diagrams.
          </p>
        </div>

        <div className="font-mono text-[12px] text-ink-soft">
          SHOWING: {filteredTemplates.length} OF {templates.length} TEMPLATES
        </div>
      </div>

      {/* Tabs list with High Contrast */}
      <div className="flex flex-nowrap max-w-full overflow-x-auto border-2 border-ink font-mono text-[11px] w-fit bg-paper-raised select-none shadow-hard-ink">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2.5 min-h-[44px] whitespace-nowrap border-r-2 last:border-r-0 border-ink uppercase tracking-wide transition-colors cursor-pointer font-bold ${
              activeTab === tab.value 
                ? 'bg-ink text-paper' 
                : 'text-ink-soft hover:bg-ink hover:text-paper'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Templates Grid with Visual Blueprint Previews */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((tmpl) => {
          const detail = TEMPLATE_DETAILS[tmpl.id] || {
            desc: 'Quick start diagram layout with pre-connected nodes and schema properties.',
            nodeCount: 'Pre-configured Schema',
            summary: tmpl.type.toUpperCase()
          };
          const isFeatured = templateConfigs[tmpl.id]?.featured;

          return (
            <Card
              key={tmpl.id}
              variant="blueprint"
              className="flex flex-col justify-between p-5 border-2 border-ink shadow-hard-ink hover:shadow-hard-blueprint hover:-translate-y-0.5 transition-all bg-paper-raised"
            >
              <div className="flex flex-col gap-3">
                {/* Top badges row */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-blueprint border-2 border-blueprint px-2 py-0.5 uppercase tracking-wider font-bold bg-[#EBF3FA] dark:bg-[#152332]">
                      {tmpl.type}
                    </span>
                    {isFeatured && (
                      <span className="font-mono text-[10px] text-signal border-2 border-signal px-2 py-0.5 uppercase tracking-wider font-bold bg-[#FFF1EB] dark:bg-[#2A1510] flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        FEATURED
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[10.5px] text-ink-soft font-bold">
                    {detail.nodeCount}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-[18px] font-bold tracking-tight text-ink">
                  {tmpl.title}
                </h3>

                {/* VISUAL BLUEPRINT PREVIEW BOX */}
                <div 
                  onClick={() => setPreviewingTemplate(tmpl)}
                  className="w-full h-44 border-2 border-ink bg-paper relative overflow-hidden group cursor-pointer shadow-sm hover:border-blueprint transition-colors"
                  title="Click to view full preview"
                >
                  <TemplateThumbnail content={tmpl.content} type={tmpl.type} />

                  {/* Hover Overlay with Preview Trigger */}
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 text-paper font-mono text-[12px] font-bold backdrop-blur-[1px]">
                    <div className="flex items-center gap-1.5 border border-paper px-3 py-1.5 bg-ink">
                      <Eye className="w-4 h-4 text-blueprint" />
                      <span>inspect_preview()</span>
                    </div>
                    <span className="text-[10px] text-[#A6B2AD]">// click to zoom diagram</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[13px] text-ink-soft leading-relaxed font-sans font-medium mt-1">
                  {detail.desc}
                </p>
              </div>

              {/* Action Buttons Row */}
              <div className="border-t-2 border-ink pt-4 mt-5 flex justify-between items-center font-mono">
                <button
                  type="button"
                  onClick={() => setPreviewingTemplate(tmpl)}
                  className="text-[11.5px] border border-line hover:border-ink px-2.5 py-1.5 min-h-[44px] text-ink-soft hover:text-ink transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  preview()
                </button>

                <Button
                  variant="primary"
                  onClick={() => openUseModal(tmpl)}
                  className="py-1.5 px-3 min-h-[44px] text-[12px] flex items-center gap-1.5 font-bold shadow-sm"
                >
                  use_template →
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Full Screen Interactive Template Preview Modal */}
      {previewingTemplate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-paper border-2 border-ink shadow-hard-blueprint flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="h-12 border-b-2 border-ink bg-ink text-paper px-6 flex items-center justify-between font-mono select-none">
              <div className="flex items-center gap-3">
                <span className="text-blueprint border border-blueprint px-1.5 py-0.2 text-[10px] uppercase font-bold bg-paper">
                  {previewingTemplate.type}
                </span>
                <span className="font-bold text-white text-[15px]">{previewingTemplate.title}</span>
              </div>
              <button
                onClick={() => setPreviewingTemplate(null)}
                className="p-1 border border-[#2D363C] text-paper hover:bg-paper hover:text-ink transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Large Preview Canvas */}
            <div className="flex-1 bg-grid p-6 overflow-auto min-h-[380px] flex items-center justify-center bg-paper-raised relative">
              <div className="w-full h-[360px] border-2 border-ink bg-paper relative shadow-hard-ink overflow-hidden">
                <TemplateThumbnail content={previewingTemplate.content} type={previewingTemplate.type} />
              </div>
            </div>

            {/* Modal Description & Actions Bar */}
            <div className="border-t-2 border-ink p-6 bg-paper flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-mono">
              <div className="flex flex-col gap-1">
                <span className="text-[12px] text-ink font-bold">
                  {TEMPLATE_DETAILS[previewingTemplate.id]?.nodeCount || 'Pre-built layout'}
                </span>
                <p className="text-[12px] text-ink-soft max-w-xl font-sans font-medium">
                  {TEMPLATE_DETAILS[previewingTemplate.id]?.desc || 'Start drafting instantly with this blueprint setup.'}
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                <Button 
                  variant="secondary" 
                  onClick={() => setPreviewingTemplate(null)}
                  className="px-4 py-2 text-[12px]"
                >
                  close()
                </Button>
                <Button 
                  variant="primary" 
                  onClick={() => openUseModal(previewingTemplate)}
                  className="px-5 py-2 text-[12px] font-bold flex items-center gap-2"
                >
                  use_this_template →
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Select Project Dialog */}
      {selectedTemplate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="w-full max-w-[480px]">
            <Card variant="blueprint" className="p-8 border-2 border-ink shadow-hard-blueprint">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-[20px] font-bold tracking-tight text-ink">use_template()</h2>
                <button 
                  onClick={() => setSelectedTemplate(null)}
                  className="p-1 border border-line hover:border-ink transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[12px] text-ink-soft font-mono mb-6">// select a destination project for this diagram sheet</p>

              {projects.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <p className="text-[13px] text-ink-soft font-mono mb-6">// you must create a project folder first before seeding diagrams</p>
                  <Button onClick={() => navigate('/dashboard')}>
                    go_to_dashboard
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleCreateFromTemplate} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[11px] text-ink font-bold">DIAGRAM_TITLE</label>
                    <input
                      type="text"
                      required
                      value={newDiagramTitle}
                      onChange={(e) => setNewDiagramTitle(e.target.value)}
                      className="w-full border-2 border-ink bg-paper px-3 py-2.5 text-[14px] font-mono focus:border-blueprint focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[11px] text-ink font-bold">DESTINATION_PROJECT</label>
                    <select
                      value={targetProjectId}
                      onChange={(e) => setTargetProjectId(e.target.value)}
                      className="w-full border-2 border-ink bg-paper px-3 py-2.5 text-[13px] font-mono focus:border-blueprint focus:outline-none cursor-pointer"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end gap-3 mt-4 pt-4 border-t-2 border-ink">
                    <Button type="button" variant="secondary" onClick={() => setSelectedTemplate(null)}>
                      cancel
                    </Button>
                    <Button type="submit" variant="primary" className="font-bold">
                      create_diagram →
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
