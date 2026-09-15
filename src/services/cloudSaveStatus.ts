const lastSaveKey = (userId: string) => `diagrid_last_account_save_${userId}`;
const pendingKey = (userId: string, diagramId: string) => `diagrid_pending_account_save_${userId}_${diagramId}`;
const pendingProjectKey = (userId: string, projectId: string) => `diagrid_pending_project_${userId}_${projectId}`;
const deleteProjectKey = (userId: string, projectId: string) => `diagrid_pending_delete_project_${userId}_${projectId}`;
const deleteDiagramKey = (userId: string, diagramId: string) => `diagrid_pending_delete_diagram_${userId}_${diagramId}`;
const pendingIds = (prefix: string): string[] => {
  try {
    const ids: string[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix)) ids.push(key.slice(prefix.length));
    }
    return ids;
  } catch {
    return [];
  }
};
const token = () => `${Date.now()}-${Math.random()}`;

export const cloudSaveStatus = {
  getLastConfirmedSave(userId?: string): string | null {
    if (!userId) return null;
    try {
      return localStorage.getItem(lastSaveKey(userId));
    } catch {
      return null;
    }
  },

  recordConfirmedSave(userId: string, diagramId: string, savedAt: string, expectedToken?: string): void {
    try {
      if (expectedToken && localStorage.getItem(pendingKey(userId, diagramId)) !== expectedToken) return;
      localStorage.removeItem(pendingKey(userId, diagramId));
      localStorage.setItem(lastSaveKey(userId), savedAt);
    } catch {
      // A confirmed cloud save remains valid even if local status storage is unavailable.
    }
  },

  markPending(userId: string, diagramId: string): string | null {
    const value = token();
    try {
      localStorage.setItem(pendingKey(userId, diagramId), value);
      return value;
    } catch {
      return null;
    }
  },

  isPending(userId: string, diagramId: string): boolean {
    try {
      return localStorage.getItem(pendingKey(userId, diagramId)) !== null;
    } catch {
      return false;
    }
  },

  pendingDiagramIds(userId: string): string[] {
    return pendingIds(`diagrid_pending_account_save_${userId}_`);
  },

  pendingDiagramToken(userId: string, diagramId: string): string | null {
    try { return localStorage.getItem(pendingKey(userId, diagramId)); } catch { return null; }
  },

  clearPendingDiagram(userId: string, diagramId: string): void {
    try { localStorage.removeItem(pendingKey(userId, diagramId)); } catch { /* unavailable */ }
  },

  markProjectPending(userId: string, projectId: string): string | null {
    const value = token();
    try { localStorage.setItem(pendingProjectKey(userId, projectId), value); return value; } catch { return null; }
  },

  isProjectPending(userId: string, projectId: string): boolean {
    try { return localStorage.getItem(pendingProjectKey(userId, projectId)) !== null; } catch { return false; }
  },

  pendingProjectIds(userId: string): string[] {
    return pendingIds(`diagrid_pending_project_${userId}_`);
  },

  pendingProjectToken(userId: string, projectId: string): string | null {
    try { return localStorage.getItem(pendingProjectKey(userId, projectId)); } catch { return null; }
  },

  clearPendingProject(userId: string, projectId: string, expectedToken?: string): void {
    try {
      if (expectedToken && localStorage.getItem(pendingProjectKey(userId, projectId)) !== expectedToken) return;
      localStorage.removeItem(pendingProjectKey(userId, projectId));
    } catch { /* unavailable */ }
  },

  pendingProjectDeletionIds(userId: string): string[] {
    return pendingIds(`diagrid_pending_delete_project_${userId}_`);
  },

  pendingDiagramDeletionIds(userId: string, projectId?: string): string[] {
    const ids = pendingIds(`diagrid_pending_delete_diagram_${userId}_`);
    if (!projectId) return ids;
    try { return ids.filter(id => localStorage.getItem(deleteDiagramKey(userId, id)) === projectId); } catch { return []; }
  },

  isProjectDeletionPending(userId: string, projectId: string): boolean {
    try { return localStorage.getItem(deleteProjectKey(userId, projectId)) !== null; } catch { return false; }
  },

  isDiagramDeletionPending(userId: string, diagramId: string): boolean {
    try { return localStorage.getItem(deleteDiagramKey(userId, diagramId)) !== null; } catch { return false; }
  },

  markProjectDeletion(userId: string, projectId: string): boolean {
    try { localStorage.setItem(deleteProjectKey(userId, projectId), '1'); return true; } catch { return false; }
  },

  markDiagramDeletion(userId: string, diagramId: string, projectId: string): boolean {
    try { localStorage.setItem(deleteDiagramKey(userId, diagramId), projectId); return true; } catch { return false; }
  },

  clearProjectDeletion(userId: string, projectId: string): void {
    try { localStorage.removeItem(deleteProjectKey(userId, projectId)); } catch { /* unavailable */ }
  },

  clearDiagramDeletion(userId: string, diagramId: string): void {
    try { localStorage.removeItem(deleteDiagramKey(userId, diagramId)); } catch { /* unavailable */ }
  },
};
