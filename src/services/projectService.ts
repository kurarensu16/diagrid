import { supabase, isSupabaseConfigured } from './supabase';
import { authService } from './authService';
import { mockDb, type Project } from './mockDb';

export interface ProjectWithStats extends Project {
  diagramCount?: number;
}

// Track whether initial migration from localStorage has run in this session
let hasMigratedLocal = false;

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
      // Auto-migrate local projects once per session
      if (!hasMigratedLocal) {
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
        return mockDb.getProjects().map(p => ({
          ...p,
          diagramCount: mockDb.getDiagrams(p.id).length
        }));
      }

      if (!data) return [];

      return data.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        created_at: p.created_at,
        updated_at: p.updated_at,
        diagramCount: Array.isArray(p.diagrams) && p.diagrams[0] ? p.diagrams[0].count : (p.diagrams?.count || 0)
      }));
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
    if (!isSupabaseConfigured() || !authService.getUserSync()) {
      return mockDb.getProject(id) || null;
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        // Check local fallback in case of hybrid migration
        return mockDb.getProject(id) || null;
      }

      return {
        id: data.id,
        name: data.name,
        description: data.description || '',
        created_at: data.created_at,
        updated_at: data.updated_at
      };
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

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: name.trim(),
          description: description.trim(),
          user_id: user.id
        })
        .select()
        .single();

      if (error || !data) {
        console.warn('[projectService] createProject Supabase failed, using local fallback:', error?.message);
        return mockDb.createProject(name, description);
      }

      const newProj: Project = {
        id: data.id,
        name: data.name,
        description: data.description || '',
        created_at: data.created_at,
        updated_at: data.updated_at
      };

      // Keep local mockDb mirrored
      mockDb.createProject(name, description);
      return newProj;
    } catch {
      return mockDb.createProject(name, description);
    }
  },

  /**
   * Updates project details (name, description).
   */
  updateProject: async (id: string, updates: Partial<Project>): Promise<Project | null> => {
    if (!isSupabaseConfigured() || !authService.getUserSync()) {
      return mockDb.updateProject(id, updates) || null;
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
    if (!isSupabaseConfigured() || !authService.getUserSync()) {
      mockDb.deleteProject(id);
      return true;
    }

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      mockDb.deleteProject(id);
      return !error;
    } catch {
      mockDb.deleteProject(id);
      return true;
    }
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
      if (count && count > 0) return;

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
