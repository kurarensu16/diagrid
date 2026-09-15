import { supabase, isSupabaseConfigured } from './supabase';
import { authService } from './authService';
import { mockDb, type Diagram } from './mockDb';
import { projectService } from './projectService';
import { adminService } from './adminService';
import { cloudSaveStatus } from './cloudSaveStatus';
import { offlineSyncService } from './offlineSyncService';

export type DiagramSaveResult =
  | { status: 'cloud-saved'; savedAt: string }
  | { status: 'local-only' }
  | { status: 'cloud-failed' }
  | { status: 'failed' };

export const diagramService = {
  /**
   * Fetches all diagrams for a specific project.
   */
  getDiagrams: async (projectId: string): Promise<Diagram[]> => {
    if (!isSupabaseConfigured() || !authService.getUserSync()) {
      return mockDb.getDiagrams(projectId);
    }

    try {
      await offlineSyncService.syncPending();
      const { data, error } = await supabase
        .from('diagrams')
        .select('*')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false });

      if (error || !data) {
        console.warn('[diagramService] getDiagrams Supabase fallback:', error?.message);
        return mockDb.getDiagrams(projectId);
      }

      // Keep unsynced local diagrams visible alongside cloud results.
      const byId = new Map<string, Diagram>(data.map((d: any) => [d.id, {
        id: d.id,
        project_id: d.project_id,
        title: d.title,
        type: d.type,
        content: typeof d.content === 'string' ? d.content : JSON.stringify(d.content || { nodes: [], edges: [] }),
        thumbnail_url: d.thumbnail_url,
        created_at: d.created_at,
        updated_at: d.updated_at
      }]));
      const user = authService.getUserSync();
      if (user) {
        for (const id of cloudSaveStatus.pendingDiagramDeletionIds(user.id)) byId.delete(id);
        for (const diagram of byId.values()) {
          if (!cloudSaveStatus.isPending(user.id, diagram.id)) {
            try { mockDb.upsertDiagram(diagram); } catch { /* Cloud data is still readable. */ }
          }
        }
        for (const id of cloudSaveStatus.pendingDiagramIds(user.id)) {
          if (cloudSaveStatus.isDiagramDeletionPending(user.id, id)) continue;
          const local = mockDb.getDiagram(id);
          if (local?.project_id === projectId) byId.set(id, local);
        }
      }
      return [...byId.values()];
    } catch (err) {
      console.warn('[diagramService] getDiagrams error, using local fallback:', err);
      return mockDb.getDiagrams(projectId);
    }
  },

  /**
   * Fetches a single diagram by ID.
   */
  getDiagram: async (id: string): Promise<Diagram | null> => {
    const user = authService.getUserSync();
    await offlineSyncService.syncPending();
    if (user && cloudSaveStatus.isDiagramDeletionPending(user.id, id)) return null;
    if (user && cloudSaveStatus.isPending(user.id, id)) {
      const pendingLocalCopy = mockDb.getDiagram(id);
      if (pendingLocalCopy) return pendingLocalCopy;
    }

    if (!isSupabaseConfigured() || !user) {
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

      const diagram: Diagram = {
        id: data.id,
        project_id: data.project_id,
        title: data.title,
        type: data.type,
        content: typeof data.content === 'string' ? data.content : JSON.stringify(data.content || { nodes: [], edges: [] }),
        thumbnail_url: data.thumbnail_url,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
      try {
        mockDb.upsertDiagram(diagram);
      } catch (err) {
        console.warn('[diagramService] local mirror unavailable:', err);
      }
      return diagram;
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

    const id = crypto.randomUUID();
    if (!cloudSaveStatus.markPending(user.id, id)) {
      throw new Error('Could not prepare a safe account sync. Please try again.');
    }
    let diagram: Diagram;
    try {
      diagram = mockDb.createDiagram(projectId, title.trim(), type, JSON.stringify(parsedContent), id);
    } catch (error) {
      if (!mockDb.getDiagram(id)) cloudSaveStatus.clearPendingDiagram(user.id, id);
      throw error;
    }
    await offlineSyncService.syncPending();
    if (!cloudSaveStatus.isPending(user.id, diagram.id)) {
      void adminService.logActivity('created_diagram', `${title.trim()} (${type.toUpperCase()})`, user.email);
    }
    return diagram;
  },

  /**
   * Saves diagram content and optional thumbnail to Supabase.
   */
  saveDiagram: async (
    id: string,
    content: string | object,
    thumbnailUrl?: string
  ): Promise<DiagramSaveResult> => {
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

    // Keep the latest edit in this browser before attempting the account save.
    let localSaved = false;
    try {
      localSaved = Boolean(mockDb.updateDiagram(id, { content: contentStr, ...(thumbnailUrl !== undefined ? { thumbnail_url: thumbnailUrl } : {}) }));
    } catch (err) {
      console.warn('[diagramService] local save failed:', err);
    }

    const user = authService.getUserSync();
    if (!isSupabaseConfigured() || !user) {
      return { status: localSaved ? 'local-only' : 'failed' };
    }

    if (localSaved) {
      if (!cloudSaveStatus.markPending(user.id, id)) return { status: 'cloud-failed' };
      await offlineSyncService.syncPending();
      if (!cloudSaveStatus.isPending(user.id, id)) {
        return { status: 'cloud-saved', savedAt: cloudSaveStatus.getLastConfirmedSave(user.id) || new Date().toISOString() };
      }
      return { status: 'cloud-failed' };
    }

    try {
      const payload: Record<string, any> = {
        content: contentObj,
        updated_at: new Date().toISOString()
      };
      if (thumbnailUrl !== undefined) {
        payload.thumbnail_url = thumbnailUrl;
      }

      const { error, count } = await supabase
        .from('diagrams')
        .update(payload, { count: 'exact' })
        .eq('id', id);

      if (error || count !== 1) {
        console.warn('[diagramService] saveDiagram warning:', error?.message || `Expected one updated diagram, got ${count}`);
        return { status: localSaved ? 'cloud-failed' : 'failed' };
      }
      const savedAt = new Date().toISOString();
      if (!cloudSaveStatus.isPending(user.id, id)) cloudSaveStatus.recordConfirmedSave(user.id, id, savedAt);
      return { status: 'cloud-saved', savedAt };
    } catch (err) {
      console.warn('[diagramService] saveDiagram exception:', err);
      return { status: localSaved ? 'cloud-failed' : 'failed' };
    }
  },

  /**
   * Updates diagram metadata (e.g. title).
   */
  updateDiagramMetadata: async (id: string, updates: { title?: string }): Promise<boolean> => {
    const user = authService.getUserSync();
    const previous = mockDb.getDiagram(id);
    const local = updates.title ? mockDb.updateDiagram(id, { title: updates.title.trim() }) : mockDb.getDiagram(id);

    if (!isSupabaseConfigured() || !user) {
      return true;
    }

    if (local) {
      if (!cloudSaveStatus.markPending(user.id, id)) {
        if (previous && updates.title) mockDb.updateDiagram(id, { title: previous.title });
        return false;
      }
      await offlineSyncService.syncPending();
      return !cloudSaveStatus.isPending(user.id, id);
    }

    try {
      const { error } = await supabase
        .from('diagrams')
        .update({
          ...(updates.title ? { title: updates.title.trim() } : {}),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) cloudSaveStatus.markPending(user.id, id);
      return !error;
    } catch {
      cloudSaveStatus.markPending(user.id, id);
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
    const projectId = mockDb.getDiagram(id)?.project_id;
    const user = authService.getUserSync();
    if (!isSupabaseConfigured() || !user) {
      mockDb.deleteDiagram(id);
      return true;
    }

    if (!cloudSaveStatus.markDiagramDeletion(user.id, id, projectId || 'unknown')) return false;
    try {
      mockDb.deleteDiagram(id);
    } catch {
      cloudSaveStatus.clearDiagramDeletion(user.id, id);
      return false;
    }
    cloudSaveStatus.clearPendingDiagram(user.id, id);
    await offlineSyncService.syncPending();
    if (!cloudSaveStatus.isDiagramDeletionPending(user.id, id)) {
      void adminService.logActivity('deleted_diagram', `Diagram ${id}`, user.email);
    }
    return true;
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
