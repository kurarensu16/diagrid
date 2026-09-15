import { authService } from './authService';
import { cloudSaveStatus } from './cloudSaveStatus';
import { mockDb } from './mockDb';
import { isSupabaseConfigured, supabase } from './supabase';

const inFlight = new Map<string, Promise<void>>();

const syncForUser = async (userId: string): Promise<void> => {
  let syncedAny = false;
  for (const id of cloudSaveStatus.pendingDiagramDeletionIds(userId)) {
    try {
      const { error } = await supabase.from('diagrams').delete().eq('id', id);
      if (!error) {
        cloudSaveStatus.clearDiagramDeletion(userId, id);
        syncedAny = true;
      }
    } catch (error) {
      console.warn('[offlineSync] diagram deletion remains pending:', error);
    }
  }

  for (const id of cloudSaveStatus.pendingProjectDeletionIds(userId)) {
    try {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (!error) {
        cloudSaveStatus.clearProjectDeletion(userId, id);
        syncedAny = true;
      }
    } catch (error) {
      console.warn('[offlineSync] project deletion remains pending:', error);
    }
  }

  // Projects must exist in the account before their diagrams can be uploaded.
  for (const id of cloudSaveStatus.pendingProjectIds(userId)) {
    if (cloudSaveStatus.isProjectDeletionPending(userId, id)) continue;
    const project = mockDb.getProject(id);
    const marker = cloudSaveStatus.pendingProjectToken(userId, id);
    if (!project || !marker) continue;

    try {
      const { error } = await supabase.from('projects').upsert({
        id: project.id,
        user_id: userId,
        name: project.name,
        description: project.description,
        created_at: project.created_at,
        updated_at: project.updated_at,
      }, { onConflict: 'id' });
      if (!error) {
        cloudSaveStatus.clearPendingProject(userId, id, marker);
        syncedAny = true;
      }
      else console.warn('[offlineSync] project remains on this device:', error.message);
    } catch (error) {
      console.warn('[offlineSync] project upload failed:', error);
    }
  }

  for (const id of cloudSaveStatus.pendingDiagramIds(userId)) {
    if (cloudSaveStatus.isDiagramDeletionPending(userId, id)) continue;
    const diagram = mockDb.getDiagram(id);
    const marker = cloudSaveStatus.pendingDiagramToken(userId, id);
    if (!diagram || !marker || cloudSaveStatus.isProjectPending(userId, diagram.project_id)) continue;

    try {
      const { error } = await supabase.from('diagrams').upsert({
        id: diagram.id,
        project_id: diagram.project_id,
        user_id: userId,
        title: diagram.title,
        type: diagram.type,
        content: JSON.parse(diagram.content || '{}'),
        ...(diagram.thumbnail_url !== undefined ? { thumbnail_url: diagram.thumbnail_url } : {}),
        created_at: diagram.created_at,
        updated_at: diagram.updated_at,
      }, { onConflict: 'id' });
      if (!error) {
        cloudSaveStatus.recordConfirmedSave(userId, id, new Date().toISOString(), marker);
        syncedAny = true;
      }
      else console.warn('[offlineSync] diagram remains on this device:', error.message);
    } catch (error) {
      console.warn('[offlineSync] diagram upload failed:', error);
    }
  }
  if (syncedAny && typeof window !== 'undefined') window.dispatchEvent(new Event('diagrid:sync-complete'));
};

export const offlineSyncService = {
  async syncPending(): Promise<void> {
    const user = authService.getUserSync();
    if (!isSupabaseConfigured() || !user) return;
    if (cloudSaveStatus.pendingProjectIds(user.id).length === 0 &&
      cloudSaveStatus.pendingDiagramIds(user.id).length === 0 &&
      cloudSaveStatus.pendingProjectDeletionIds(user.id).length === 0 &&
      cloudSaveStatus.pendingDiagramDeletionIds(user.id).length === 0) return;
    const existing = inFlight.get(user.id);
    if (existing) {
      await existing;
      return offlineSyncService.syncPending();
    }
    const task = syncForUser(user.id).finally(() => inFlight.delete(user.id));
    inFlight.set(user.id, task);
    return task;
  },
};
