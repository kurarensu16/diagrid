import { supabase, isSupabaseConfigured } from './supabase';
import { authService } from './authService';
import { mockDb, type Diagram } from './mockDb';
import { projectService } from './projectService';
import { adminService } from './adminService';

export const diagramService = {
  /**
   * Fetches all diagrams for a specific project.
   */
  getDiagrams: async (projectId: string): Promise<Diagram[]> => {
    if (!isSupabaseConfigured() || !authService.getUserSync()) {
      return mockDb.getDiagrams(projectId);
    }

    try {
      const { data, error } = await supabase
        .from('diagrams')
        .select('*')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false });

      if (error || !data) {
        console.warn('[diagramService] getDiagrams Supabase fallback:', error?.message);
        return mockDb.getDiagrams(projectId);
      }

      // Format content so it behaves consistently as a JSON string
      return data.map((d: any) => ({
        id: d.id,
        project_id: d.project_id,
        title: d.title,
        type: d.type,
        content: typeof d.content === 'string' ? d.content : JSON.stringify(d.content || { nodes: [], edges: [] }),
        created_at: d.created_at,
        updated_at: d.updated_at
      }));
    } catch (err) {
      console.warn('[diagramService] getDiagrams error, using local fallback:', err);
      return mockDb.getDiagrams(projectId);
    }
  },

  /**
   * Fetches a single diagram by ID.
   */
  getDiagram: async (id: string): Promise<Diagram | null> => {
    if (!isSupabaseConfigured() || !authService.getUserSync()) {
      return mockDb.getDiagram(id) || null;
    }

    try {
      const { data, error } = await supabase
        .from('diagrams')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return mockDb.getDiagram(id) || null;
      }

      return {
        id: data.id,
        project_id: data.project_id,
        title: data.title,
        type: data.type,
        content: typeof data.content === 'string' ? data.content : JSON.stringify(data.content || { nodes: [], edges: [] }),
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    } catch {
      return mockDb.getDiagram(id) || null;
    }
  },

  /**
   * Creates a new diagram under a project.
   */
  createDiagram: async (
    projectId: string,
    title: string,
    type: Diagram['type'],
    initialContent?: string
  ): Promise<Diagram> => {
    const user = authService.getUserSync();

    // Determine starter content from templates if not supplied
    let contentString = initialContent;
    if (!contentString) {
      const template = mockDb.getTemplates().find(t => t.type === type);
      contentString = template ? template.content : JSON.stringify({ nodes: [], edges: [] });
    }

    let parsedContent: any = { nodes: [], edges: [] };
    try {
      parsedContent = JSON.parse(contentString);
    } catch {
      parsedContent = { nodes: [], edges: [] };
    }

    if (!isSupabaseConfigured() || !user) {
      const local = mockDb.createDiagram(projectId, title, type);
      if (initialContent) {
        mockDb.updateDiagram(local.id, { content: contentString });
        local.content = contentString;
      }
      return local;
    }

    try {
      const { data, error } = await supabase
        .from('diagrams')
        .insert({
          project_id: projectId,
          user_id: user.id,
          title: title.trim(),
          type,
          content: parsedContent
        })
        .select()
        .single();

      if (error || !data) {
        console.warn('[diagramService] createDiagram Supabase error, falling back:', error?.message);
        return mockDb.createDiagram(projectId, title, type);
      }

      // Also mirror to mockDb for instant local fallback with matching ID
      try {
        mockDb.upsertDiagram({
          id: data.id,
          project_id: data.project_id,
          title: data.title,
          type: data.type,
          content: typeof data.content === 'string' ? data.content : JSON.stringify(data.content || parsedContent),
          created_at: data.created_at,
          updated_at: data.updated_at
        });
      } catch {
        // ignore mirror fail
      }

      // Record audit trail event asynchronously
      if (user) {
        adminService.logActivity('created_diagram', `${title.trim()} (${type.toUpperCase()})`, user.email);
      }

      return {
        id: data.id,
        project_id: data.project_id,
        title: data.title,
        type: data.type,
        content: typeof data.content === 'string' ? data.content : JSON.stringify(data.content || parsedContent),
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    } catch {
      return mockDb.createDiagram(projectId, title, type);
    }
  },

  /**
   * Saves diagram content and optional thumbnail to Supabase.
   */
  saveDiagram: async (
    id: string,
    content: string | object,
    thumbnailUrl?: string
  ): Promise<boolean> => {
    let contentObj: any;
    let contentStr: string;

    if (typeof content === 'string') {
      contentStr = content;
      try {
        contentObj = JSON.parse(content);
      } catch {
        contentObj = { nodes: [], edges: [] };
      }
    } else {
      contentObj = content;
      contentStr = JSON.stringify(content);
    }

    // Always update mockDb mirror
    mockDb.updateDiagram(id, { content: contentStr });

    if (!isSupabaseConfigured() || !authService.getUserSync()) {
      return true;
    }

    try {
      const payload: Record<string, any> = {
        content: contentObj,
        updated_at: new Date().toISOString()
      };
      if (thumbnailUrl !== undefined) {
        payload.thumbnail_url = thumbnailUrl;
      }

      const { error } = await supabase
        .from('diagrams')
        .update(payload)
        .eq('id', id);

      if (error) {
        console.warn('[diagramService] saveDiagram warning:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[diagramService] saveDiagram exception:', err);
      return false;
    }
  },

  /**
   * Updates diagram metadata (e.g. title).
   */
  updateDiagramMetadata: async (id: string, updates: { title?: string }): Promise<boolean> => {
    if (updates.title) {
      mockDb.updateDiagram(id, { title: updates.title.trim() });
    }

    if (!isSupabaseConfigured() || !authService.getUserSync()) {
      return true;
    }

    try {
      const { error } = await supabase
        .from('diagrams')
        .update({
          ...(updates.title ? { title: updates.title.trim() } : {}),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Duplicates an existing diagram.
   */
  duplicateDiagram: async (id: string): Promise<Diagram | null> => {
    const original = await diagramService.getDiagram(id);
    if (!original) return null;

    const copyTitle = `${original.title} (Copy)`;
    return diagramService.createDiagram(
      original.project_id,
      copyTitle,
      original.type,
      original.content
    );
  },

  /**
   * Deletes a diagram.
   */
  deleteDiagram: async (id: string): Promise<boolean> => {
    mockDb.deleteDiagram(id);

    if (!isSupabaseConfigured() || !authService.getUserSync()) {
      return true;
    }

    try {
      const { error } = await supabase
        .from('diagrams')
        .delete()
        .eq('id', id);

      const user = authService.getUserSync();
      if (!error && user) {
        adminService.logActivity('deleted_diagram', `Diagram ${id}`, user.email);
      }

      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Fetches a diagram for public read-only viewers/embeds (accessible without authentication).
   */
  getPublicDiagram: async (id: string): Promise<Diagram | null> => {
    // 1. Try local mockDb first
    const local = mockDb.getDiagram(id);
    if (local) {
      console.log('[diagramService] getPublicDiagram: found in local mockDb', { id, title: local.title, contentType: typeof local.content, contentLength: typeof local.content === 'string' ? local.content.length : 0 });
      return local;
    }
    console.log('[diagramService] getPublicDiagram: not in local mockDb, trying Supabase for id:', id);

    // 2. Try Supabase cloud fetch
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('diagrams')
          .select('*')
          .eq('id', id)
          .single();

        console.log('[diagramService] getPublicDiagram Supabase result:', { hasData: !!data, hasError: !!error, errorMsg: error?.message, contentType: data ? typeof data.content : 'N/A' });

        if (data && !error) {
          return {
            id: data.id,
            project_id: data.project_id,
            title: data.title,
            type: data.type,
            content: typeof data.content === 'string' ? data.content : JSON.stringify(data.content || { nodes: [], edges: [] }),
            created_at: data.created_at,
            updated_at: data.updated_at
          };
        }
      } catch (err) {
        console.warn('[diagramService] getPublicDiagram Supabase fetch error:', err);
      }
    } else {
      console.log('[diagramService] getPublicDiagram: Supabase not configured');
    }

    return null;
  },

  /**
   * Clones a shared/public diagram into the current user's workspace.
   */
  cloneSharedDiagram: async (sourceDiagramId: string, targetProjectId?: string): Promise<Diagram | null> => {
    const source = await diagramService.getPublicDiagram(sourceDiagramId);
    if (!source) return null;

    let destinationProjectId = targetProjectId;
    if (!destinationProjectId) {
      const projects = await projectService.getProjects();
      if (projects.length > 0) {
        destinationProjectId = projects[0].id;
      } else {
        const newProj = await projectService.createProject('My First Project', 'Default workspace project');
        destinationProjectId = newProj.id;
      }
    }

    const clonedTitle = `${source.title} (Forked)`;
    return diagramService.createDiagram(
      destinationProjectId,
      clonedTitle,
      source.type,
      source.content
    );
  }
};
