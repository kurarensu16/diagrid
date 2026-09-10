import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { projectService, type ProjectWithStats } from '../services/projectService';
import { Plus, Search, Trash2, Edit3, Folder, Calendar, RefreshCw } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals / Dialog states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const data = await projectService.getProjects();
      setProjects(data);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await projectService.createProject(projectName, projectDesc);
      setProjectName('');
      setProjectDesc('');
      setIsCreateModalOpen(false);
      await loadProjects();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await projectService.updateProject(editingProjectId, {
        name: editName,
        description: editDesc
      });
      setEditingProjectId('');
      setEditName('');
      setEditDesc('');
      setIsEditModalOpen(false);
      await loadProjects();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project? This will delete all diagrams within it.')) {
      await projectService.deleteProject(id);
      await loadProjects();
    }
  };

  const openEditModal = (e: React.MouseEvent, project: ProjectWithStats) => {
    e.stopPropagation();
    setEditingProjectId(project.id);
    setEditName(project.name);
    setEditDesc(project.description);
    setIsEditModalOpen(true);
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 flex flex-col gap-6 text-ink">
      {/* Header section with search and creation trigger */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-line pb-6">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight">projects</h1>
          <p className="text-[13px] text-ink-soft font-mono mt-1">// manage your cloud diagram workspaces</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Search box */}
          <div className="relative flex-1 md:flex-none">
            <Search className="w-4 h-4 text-ink-soft absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2.5 border border-line bg-paper-raised text-[13px] font-mono focus:border-ink focus:outline-none w-full md:w-[240px]"
              placeholder="find_project..."
            />
          </div>
          
          <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-1.5 shrink-0">
            <Plus className="w-4 h-4" />
            create_project()
          </Button>
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <Card variant="blueprint" className="flex flex-col items-center justify-center py-16 text-center">
          <RefreshCw className="w-6 h-6 text-blueprint animate-spin mb-3" />
          <p className="text-[13px] text-ink-soft font-mono">// loading cloud workspaces...</p>
        </Card>
      ) : filteredProjects.length === 0 ? (
        <Card variant="blueprint" className="flex flex-col items-center justify-center py-16 text-center">
          <Folder className="w-12 h-12 text-ink-soft mb-4 stroke-1" />
          <h3 className="text-[16px] font-bold mb-1">No projects found</h3>
          <p className="text-[13px] text-ink-soft font-mono mb-6">// create your first project folder to host diagrams</p>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            create_project()
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjects.map((project) => {
            const count = project.diagramCount ?? 0;
            return (
              <Card 
                key={project.id} 
                variant="blueprint"
                onClick={() => navigate(`/project/${project.id}`)}
                className="cursor-pointer hover:border-blueprint group p-6 flex flex-col justify-between min-h-[180px]"
              >
                <div>
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="text-[18px] font-bold tracking-tight text-ink group-hover:text-blueprint transition-colors line-clamp-1">
                      {project.name}
                    </h3>
                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => openEditModal(e, project)}
                        className="p-1 hover:text-blueprint text-ink-soft transition-colors"
                        title="Rename Project"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteProject(e, project.id)}
                        className="p-1 hover:text-signal text-ink-soft transition-colors"
                        title="Delete Project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-[13px] text-ink-soft mt-2 line-clamp-2 min-h-[38px]">
                    {project.description || 'No description provided.'}
                  </p>
                </div>

                <div className="flex justify-between items-center border-t border-line pt-4 mt-6 font-mono text-[11px] text-ink-soft">
                  <span className="bg-paper border border-line px-2 py-0.5 font-mono text-ink text-[10px] uppercase">
                    {count} {count === 1 ? 'diagram' : 'diagrams'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(project.updated_at).toLocaleDateString(undefined, {
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

      {/* Creation Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-ink bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-[480px]">
            <Card variant="blueprint" className="p-8">
              <h2 className="text-[20px] font-bold tracking-tight mb-2">create_project()</h2>
              <p className="text-[12px] text-ink-soft font-mono mb-6">// initialize a new diagram directory</p>
              
              <form onSubmit={handleCreateProject} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[11px] text-ink-soft">PROJECT_NAME</label>
                  <input
                    type="text"
                    required
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full border border-line bg-paper px-3 py-2 text-[14px] font-mono focus:border-ink focus:outline-none"
                    placeholder="my-awesome-api"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[11px] text-ink-soft">DESCRIPTION (OPTIONAL)</label>
                  <textarea
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                    className="w-full border border-line bg-paper px-3 py-2 text-[14px] font-mono focus:border-ink focus:outline-none h-[80px] resize-none"
                    placeholder="Short summary of this system's architecture docs"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
                    cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={isSubmitting}>
                    {isSubmitting ? 'creating...' : 'create'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-ink bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-[480px]">
            <Card variant="blueprint" className="p-8">
              <h2 className="text-[20px] font-bold tracking-tight mb-2">rename_project()</h2>
              <p className="text-[12px] text-ink-soft font-mono mb-6">// modify project directory properties</p>
              
              <form onSubmit={handleUpdateProject} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[11px] text-ink-soft">PROJECT_NAME</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full border border-line bg-paper px-3 py-2 text-[14px] font-mono focus:border-ink focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[11px] text-ink-soft">DESCRIPTION (OPTIONAL)</label>
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full border border-line bg-paper px-3 py-2 text-[14px] font-mono focus:border-ink focus:outline-none h-[80px] resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)}>
                    cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={isSubmitting}>
                    {isSubmitting ? 'saving...' : 'save_changes'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
