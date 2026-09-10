import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { projectService } from '../../services/projectService';
import type { Project, Diagram } from '../../services/mockDb';
import { 
  Settings, 
  X, 
  Trash2, 
  Download, 
  Check, 
  Folder, 
  AlertTriangle
} from 'lucide-react';

export interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  diagrams: Diagram[];
  onProjectUpdated: (updated: Project) => void;
  onRequestDeleteProject: () => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  isOpen,
  onClose,
  project,
  diagrams,
  onProjectUpdated,
  onRequestDeleteProject,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'backup' | 'danger'>('general');
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(project.name);
      setDescription(project.description || '');
      setSaveSuccess(false);
      setIsSaving(false);
    }
  }, [isOpen, project]);

  if (!isOpen) return null;

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSaving) return;

    setIsSaving(true);
    try {
      const updated = await projectService.updateProject(project.id, {
        name: name.trim(),
        description: description.trim()
      });
      if (updated) {
        onProjectUpdated(updated);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err) {
      console.error('[ProjectSettingsModal] Failed to update project:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Export full project JSON archive
  const handleExportProjectJson = () => {
    const payload = {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        created_at: project.created_at,
        updated_at: project.updated_at
      },
      diagrams: diagrams.map(d => ({
        id: d.id,
        title: d.title,
        type: d.type,
        content: typeof d.content === 'string' ? JSON.parse(d.content || '{}') : d.content,
        created_at: d.created_at,
        updated_at: d.updated_at
      })),
      exported_at: new Date().toISOString(),
      generator: 'Diagrid Studio'
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_backup.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Compute total nodes and links across all diagrams
  let totalNodes = 0;
  let totalEdges = 0;
  diagrams.forEach(d => {
    try {
      const parsed = typeof d.content === 'string' ? JSON.parse(d.content || '{}') : d.content;
      totalNodes += parsed.nodes?.length || 0;
      totalEdges += parsed.edges?.length || 0;
    } catch {
      // ignore
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-[2px] animate-fadeIn select-none">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-xl z-10">
        <Card variant="blueprint" className="p-0 overflow-hidden shadow-hard-ink border-2 border-ink bg-paper-raised flex flex-col">
          {/* Header */}
          <div className="px-5 py-3.5 border-b-2 border-ink bg-ink text-paper flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-[12px] font-bold uppercase tracking-wider">
              <Settings className="w-4 h-4 text-blueprint" />
              <span>// project_settings: {project.name}</span>
            </div>
            <button
              onClick={onClose}
              className="text-paper/70 hover:text-paper p-0.5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b-2 border-ink bg-paper font-mono text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`flex-1 py-2.5 px-3 border-r border-ink flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                activeTab === 'general' ? 'bg-paper-raised text-blueprint border-b-2 border-b-blueprint' : 'text-ink-soft hover:text-ink hover:bg-paper-raised'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>General</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('backup')}
              className={`flex-1 py-2.5 px-3 border-r border-ink flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                activeTab === 'backup' ? 'bg-paper-raised text-blueprint border-b-2 border-b-blueprint' : 'text-ink-soft hover:text-ink hover:bg-paper-raised'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Data & Backup</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('danger')}
              className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                activeTab === 'danger' ? 'bg-signal text-paper font-bold' : 'text-signal hover:bg-signal/10'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Danger Zone</span>
            </button>
          </div>

          {/* Tab 1: General Settings */}
          {activeTab === 'general' && (
            <form onSubmit={handleSaveGeneral} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono text-ink-soft font-bold uppercase">
                  Project Workspace Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme SaaS Platform"
                  required
                  className="w-full px-3 py-2 border-2 border-ink bg-paper text-[13px] font-mono focus:border-blueprint focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono text-ink-soft font-bold uppercase">
                  Description / Purpose
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Houses database schemas, API flows, and system architecture blueprints."
                  rows={3}
                  className="w-full px-3 py-2 border-2 border-ink bg-paper text-[12px] font-mono focus:border-blueprint focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-line mt-2">
                <div className="font-mono text-[11px] text-blueprint flex items-center gap-1">
                  {saveSuccess && (
                    <>
                      <Check className="w-3.5 h-3.5 text-blueprint" />
                      <span>Project settings saved successfully!</span>
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-ink bg-paper hover:bg-paper-raised text-ink text-[12px] font-mono font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <Button type="submit" disabled={isSaving || !name.trim()}>
                    {isSaving ? 'saving...' : 'save_changes()'}
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* Tab 2: Data & Backup */}
          {activeTab === 'backup' && (
            <div className="p-6 flex flex-col gap-4 font-mono text-[12px]">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 border border-line bg-paper flex flex-col gap-1">
                  <span className="text-[10px] text-ink-soft uppercase font-bold">Total Diagrams</span>
                  <span className="text-[18px] font-bold text-blueprint">{diagrams.length}</span>
                </div>

                <div className="p-3 border border-line bg-paper flex flex-col gap-1">
                  <span className="text-[10px] text-ink-soft uppercase font-bold">Total Nodes & Elements</span>
                  <span className="text-[18px] font-bold text-ink">{totalNodes} nodes</span>
                </div>

                <div className="p-3 border border-line bg-paper flex flex-col gap-1">
                  <span className="text-[10px] text-ink-soft uppercase font-bold">Total Connections</span>
                  <span className="text-[18px] font-bold text-ink">{totalEdges} edges</span>
                </div>

                <div className="p-3 border border-line bg-paper flex flex-col gap-1">
                  <span className="text-[10px] text-ink-soft uppercase font-bold">Created Date</span>
                  <span className="text-[11px] font-bold text-ink">
                    {project.created_at ? new Date(project.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="p-4 border-2 border-ink bg-paper flex flex-col gap-2 mt-2">
                <div className="flex items-center gap-2 font-bold text-ink text-[13px]">
                  <Download className="w-4 h-4 text-blueprint" />
                  <span>Full Project Workspace Backup</span>
                </div>
                <p className="text-[11.5px] text-ink-soft leading-relaxed">
                  Export all diagrams, node coordinates, connections, and freehand annotations contained in this workspace into a single portable JSON file.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleExportProjectJson}
                    className="py-2 px-3.5 border-2 border-ink bg-ink text-paper hover:bg-blueprint transition-colors text-[11.5px] font-bold flex items-center gap-2 cursor-pointer shadow-hard-ink"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Project Backup (.json)</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-line mt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-ink bg-paper hover:bg-paper-raised text-ink text-[12px] font-mono font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: Danger Zone */}
          {activeTab === 'danger' && (
            <div className="p-6 flex flex-col gap-4 font-mono text-[12px]">
              <div className="p-4 border-2 border-signal bg-signal/10 flex flex-col gap-2">
                <div className="flex items-center gap-2 font-bold text-signal text-[13px]">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Permanent Workspace Deletion</span>
                </div>
                <p className="text-[11.5px] text-ink leading-relaxed">
                  Deleting this project will permanently erase all <strong className="font-bold text-signal">{diagrams.length} diagram(s)</strong> and associated schematics. This action cannot be undone.
                </p>
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onRequestDeleteProject();
                    }}
                    className="py-2 px-4 border-2 border-signal bg-signal text-paper hover:bg-signal/90 transition-colors font-bold text-[11.5px] flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Project Workspace</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-line mt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-ink bg-paper hover:bg-paper-raised text-ink text-[12px] font-mono font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
