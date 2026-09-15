import { supabase, isSupabaseConfigured } from './supabase';
import { authService } from './authService';
import { mockDb, type Project } from './mockDb';
import { adminService } from './adminService';
import { cloudSaveStatus } from './cloudSaveStatus';
import { offlineSyncService } from './offlineSyncService';

export interface ProjectWithStats extends Project {
  diagramCount?: number;
}

// Track whether initial migration from localStorage has run in this session
let hasMigratedLocal = false;

const withPendingProjects = (projects: ProjectWithStats[], userId: string): ProjectWithStats[] => {
  const byId = new Map(projects.map(project => [project.id, project]));
  for (const id of cloudSaveStatus.pendingProjectDeletionIds(userId)) byId.delete(id);
  for (const id of cloudSaveStatus.pendingProjectIds(userId)) {
    if (cloudSaveStatus.isProjectDeletionPending(userId, id)) continue;
    const local = mockDb.getProject(id);
    if (local) byId.set(id, { ...local, diagramCount: mockDb.getDiagrams(id).length });
  }
  return [...byId.values()];
};

export const projectService = {
  /**
   * Fetches all projects for the current user.
   * Pulls from Supabase if authenticated, falling back to local mockDb.
   */
  getProjects: async (): Promise<ProjectWithStats[]> => {
    if (!isSupabaseConfigured()) {
      return mockDb.getProjects().map(p => ({
        ...p,
        diagramCount: mockDb.getDiagrams(p.id).length
      }));
    }

    const user = authService.getUserSync();
    if (!user) {
      return mockDb.getProjects().map(p => ({
        ...p,
        diagramCount: mockDb.getDiagrams(p.id).length
      }));
    }

    try {
      await offlineSyncService.syncPending();
      // Auto-migrate local projects once per session
      if (!hasMigratedLocal && cloudSaveStatus.pendingProjectIds(user.id).length === 0) {
        hasMigratedLocal = true;
        await projectService.migrateLocalProjects(user.id);
      }

      // Fetch projects with diagram counts from Supabase
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          description,
          created_at,
          updated_at,
          diagrams(count)
        `)
        .order('updated_at', { ascending: false });

      if (error) {
        console.warn('[projectService] getProjects notice:', error.message);
        return withPendingProjects(mockDb.getProjects().map(p => ({
          ...p,
          diagramCount: mockDb.getDiagrams(p.id).length
        })), user.id);
      }

      if (!data) return withPendingProjects([], user.id);

      const cloudProjects = data.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        created_at: p.created_at,
        updated_at: p.updated_at,
        diagramCount: Array.isArray(p.diagrams) && p.diagrams[0] ? p.diagrams[0].count : (p.diagrams?.count || 0)
      }));
      for (const project of cloudProjects) {
        if (!cloudSaveStatus.isProjectPending(user.id, project.id) && !cloudSaveStatus.isProjectDeletionPending(user.id, project.id)) {
          try { mockDb.upsertProject(project); } catch { /* Cloud data is still readable. */ }
        }
      }
      return withPendingProjects(cloudProjects, user.id);
    } catch (err) {
      console.warn('[projectService] getProjects error, using fallback:', err);
      return mockDb.getProjects().map(p => ({
        ...p,
        diagramCount: mockDb.getDiagrams(p.id).length
      }));
    }
  },

  /**
   * Fetches a single project by ID.
   */
  getProject: async (id: string): Promise<Project | null> => {
    const user = authService.getUserSync();
    if (!isSupabaseConfigured() || !user) {
      return mockDb.getProject(id) || null;
    }

    try {
      await offlineSyncService.syncPending();
      if (cloudSaveStatus.isProjectDeletionPending(user.id, id)) return null;
      if (cloudSaveStatus.isProjectPending(user.id, id)) {
        return mockDb.getProject(id) || null;
      }
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        // Check local fallback in case of hybrid migration
        return mockDb.getProject(id) || null;
      }

      const project: Project = {
        id: data.id,
        name: data.name,
        description: data.description || '',
        created_at: data.created_at,
        updated_at: data.updated_at
      };
      try { mockDb.upsertProject(project); } catch { /* Cloud data is still readable. */ }
      return project;
    } catch {
      return mockDb.getProject(id) || null;
    }
  },

  /**
   * Creates a new project in Supabase.
   */
  createProject: async (name: string, description: string): Promise<Project> => {
    const user = authService.getUserSync();

    if (!isSupabaseConfigured() || !user) {
      return mockDb.createProject(name, description);
    }

    // One UUID is used by the browser and account, so a failed or uncertain
    // request can be retried without making a duplicate project.
    const now = new Date().toISOString();
    const project: Project = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      created_at: now,
      updated_at: now,
    };
    if (!cloudSaveStatus.markProjectPending(user.id, project.id)) {
      throw new Error('Could not prepare a safe account sync. Please try again.');
    }
    try {
      mockDb.upsertProject(project);
    } catch (error) {
      cloudSaveStatus.clearPendingProject(user.id, project.id);
      throw error;
    }
    await offlineSyncService.syncPending();
    if (!cloudSaveStatus.isProjectPending(user.id, project.id)) {
      void adminService.logActivity('created_project', name.trim(), user.email);
    }
    return project;
  },

  /**
   * Updates project details (name, description).
   */
  updateProject: async (id: string, updates: Partial<Project>): Promise<Project | null> => {
    const user = authService.getUserSync();
    if (!isSupabaseConfigured() || !user) {
      return mockDb.updateProject(id, updates) || null;
    }

    if (mockDb.getProject(id) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      if (!cloudSaveStatus.markProjectPending(user.id, id)) return null;
      const local = mockDb.updateProject(id, updates);
      if (!local) return null;
      await offlineSyncService.syncPending();
      return local;
    }

    try {
      const payload: Record<string, any> = {};
      if (updates.name !== undefined) payload.name = updates.name.trim();
      if (updates.description !== undefined) payload.description = updates.description.trim();

      const { data, error } = await supabase
        .from('projects')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return mockDb.updateProject(id, updates) || null;
      }

      mockDb.updateProject(id, updates);
      return {
        id: data.id,
        name: data.name,
        description: data.description || '',
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    } catch {
      return mockDb.updateProject(id, updates) || null;
    }
  },

  /**
   * Deletes a project and all associated diagrams (cascades automatically).
   */
  deleteProject: async (id: string): Promise<boolean> => {
    const user = authService.getUserSync();
    if (!isSupabaseConfigured() || !user) {
      mockDb.deleteProject(id);
      return true;
    }

    if (!cloudSaveStatus.markProjectDeletion(user.id, id)) return false;
    const childIds = mockDb.getDiagrams(id).map(diagram => diagram.id);
    try {
      mockDb.deleteProject(id);
    } catch {
      cloudSaveStatus.clearProjectDeletion(user.id, id);
      return false;
    }
    cloudSaveStatus.clearPendingProject(user.id, id);
    for (const diagramId of childIds) cloudSaveStatus.clearPendingDiagram(user.id, diagramId);
    await offlineSyncService.syncPending();
    if (!cloudSaveStatus.isProjectDeletionPending(user.id, id)) {
      void adminService.logActivity('deleted_project', `Project ${id}`, user.email);
    }
    return true;
  },

  /**
   * Seamlessly uploads existing localStorage projects & diagrams into Supabase
   * when a user signs in for the first time.
   */
  migrateLocalProjects: async (userId: string): Promise<void> => {
    try {
      const localProjects = mockDb.getProjects();
      if (!localProjects || localProjects.length === 0) return;

      // Check if user already has cloud projects in Supabase
      const { count } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true });

      // If user already has projects in cloud, skip auto-import
      if (count !== 0) return;

      for (const proj of localProjects) {
        const { data: newProj } = await supabase
          .from('projects')
          .insert({
            name: proj.name,
            description: proj.description,
            user_id: userId
          })
          .select()
          .single();

        if (newProj) {
          const diagrams = mockDb.getDiagrams(proj.id);
          if (diagrams && diagrams.length > 0) {
            const diagramPayloads = diagrams.map(d => ({
              project_id: newProj.id,
              user_id: userId,
              title: d.title,
              type: d.type,
              content: typeof d.content === 'string' ? JSON.parse(d.content || '{}') : d.content
            }));

            await supabase.from('diagrams').insert(diagramPayloads);
          }
        }
      }
    } catch (e) {
      console.warn('[projectService] Auto-migration notice:', e);
    }
  }
};
