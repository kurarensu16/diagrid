import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { type Diagram, type Project } from '../../services/mockDb';
import { projectService } from '../../services/projectService';
import { diagramService } from '../../services/diagramService';
import { Folder, FileText, Trash2, Search } from 'lucide-react';

interface ContentItem {
  project: Project;
  ownerEmail: string;
  diagrams: Diagram[];
}

export const AdminContent: React.FC = () => {
  const [contentList, setContentList] = useState<ContentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    const allProjects = await projectService.getProjects();
    
    const mapped: ContentItem[] = await Promise.all(
      allProjects.map(async (p) => {
        let ownerEmail = 'dev.builder@freelance.ph';
        if (p.id === 'p-default') {
          ownerEmail = 'juan.delacruz@up.edu.ph';
        }
        
        const diags = await diagramService.getDiagrams(p.id);
        return {
          project: p,
          ownerEmail,
          diagrams: diags
        };
      })
    );

    setContentList(mapped);
  };

  const handleDeleteDiagram = async (e: React.MouseEvent, diagramId: string) => {
    e.stopPropagation();
    if (confirm('ADMIN OVERRIDE: Are you sure you want to permanently delete this diagram? This cannot be undone.')) {
      await diagramService.deleteDiagram(diagramId);
      await loadContent();
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (confirm('ADMIN OVERRIDE: Are you sure you want to permanently delete this project and all nested diagrams? This cannot be undone.')) {
      await projectService.deleteProject(projectId);
      await loadContent();
    }
  };

  const filteredContent = contentList.filter((item) => 
    item.project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.ownerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.diagrams.some(d => d.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-8 flex flex-col gap-6 text-ink">
      {/* Header */}
      <div className="border-b border-line pb-6">
        <h1 className="text-[32px] font-bold tracking-tight">content_browser</h1>
        <p className="text-[13px] text-ink-soft font-mono mt-1">// inspect and manage diagrams and projects across all active developers</p>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-[360px]">
          <Search className="w-4 h-4 text-ink-soft absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 border border-line bg-paper-raised text-[13px] font-mono focus:border-ink focus:outline-none w-full"
            placeholder="search_project_owner_diagram..."
          />
        </div>
      </div>

      {/* Content list */}
      <div className="flex flex-col gap-4">
        {filteredContent.length === 0 ? (
          <Card variant="blueprint" className="py-12 text-center text-ink-soft font-mono text-[13px]">
            // no projects or diagrams matching search constraints found
          </Card>
        ) : (
          filteredContent.map(({ project, ownerEmail, diagrams }) => {
            const isExpanded = expandedProjectId === project.id;
            return (
              <Card 
                key={project.id} 
                variant="blueprint" 
                className="p-5 flex flex-col gap-4 transition-all"
              >
                {/* Project Header Row */}
                <div 
                  onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                  className="flex justify-between items-center cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <Folder className="w-5 h-5 text-blueprint shrink-0" />
                    <div>
                      <h3 className="text-[16px] font-bold tracking-tight text-ink hover:text-blueprint transition-colors">
                        {project.name}
                      </h3>
                      <div className="font-mono text-[10.5px] text-ink-soft mt-0.5 flex gap-3">
                        <span>OWNER: {ownerEmail}</span>
                        <span>DIAGRAMS: {diagrams.length} sheets</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={(e) => handleDeleteProject(e, project.id)}
                      className="p-1.5 border border-transparent hover:border-line hover:text-signal text-ink-soft transition-colors cursor-pointer"
                      title="Permanently Delete Project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className="font-mono text-[12px] text-blueprint font-bold">
                      {isExpanded ? '[- collapse]' : '[+ expand]'}
                    </span>
                  </div>
                </div>

                {/* Expanded Diagram Sheets list */}
                {isExpanded && (
                  <div className="border-t border-line pt-4 flex flex-col gap-2 bg-paper bg-opacity-30 p-3">
                    <div className="font-mono text-[10px] text-blueprint uppercase tracking-wider mb-1">// nested_diagram_sheets</div>
                    {diagrams.length === 0 ? (
                      <span className="font-mono text-[11px] text-ink-soft italic pl-7">// project namespace is currently empty</span>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {diagrams.map((diag) => (
                          <div 
                            key={diag.id} 
                            className="flex justify-between items-center border border-line p-3 bg-paper-raised font-mono text-[12px]"
                          >
                            <div className="flex items-center gap-2.5">
                              <FileText className="w-4 h-4 text-ink-soft shrink-0" />
                              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                                <span className="font-bold text-ink text-[13px]">{diag.title}</span>
                                <span className="text-[10px] text-blueprint border border-blueprint px-1 py-0.5 uppercase shrink-0">
                                  {diag.type}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4 text-ink-soft text-[11px]">
                              <span>
                                UPDATED: {new Date(diag.updated_at).toLocaleDateString()}
                              </span>
                              <button
                                onClick={(e) => handleDeleteDiagram(e, diag.id)}
                                className="p-1 border border-transparent hover:border-line hover:text-signal transition-colors cursor-pointer"
                                title="Permanently Delete Diagram Sheet"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
