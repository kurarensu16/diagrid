const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function loadService(file, imports, globals = {}) {
  const source = fs.readFileSync(path.join(root, 'src/services', file), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    require: (name) => {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
    console: { warn() {} },
    crypto: require('node:crypto').webcrypto,
    Date,
    Math,
    Map,
    Event,
    ...globals,
  });
  vm.runInContext(outputText, context, { filename: file });
  return module.exports;
}

class MemoryStorage {
  items = new Map();
  failPrefix = null;
  get length() { return this.items.size; }
  key(index) { return [...this.items.keys()][index] ?? null; }
  getItem(key) { return this.items.get(key) ?? null; }
  setItem(key, value) {
    if (this.failPrefix && key.startsWith(this.failPrefix)) throw new Error('Storage full');
    this.items.set(key, String(value));
  }
  removeItem(key) { this.items.delete(key); }
}

test('offline creation keeps the latest diagram and syncs each item once after reconnect', async () => {
  const localStorage = new MemoryStorage();
  const { cloudSaveStatus } = loadService('cloudSaveStatus.ts', {}, { localStorage });
  const projects = new Map();
  const diagrams = new Map();
  const mockDb = {
    getProjects: () => [...projects.values()],
    getProject: id => projects.get(id),
    getDiagram: id => diagrams.get(id),
    getDiagrams: projectId => [...diagrams.values()].filter(d => d.project_id === projectId),
    getTemplates: () => [],
    createProject(name, description, id) {
      const now = new Date().toISOString();
      const project = { id, name, description, created_at: now, updated_at: now };
      projects.set(id, project);
      return project;
    },
    upsertProject(project) { projects.set(project.id, project); },
    createDiagram(projectId, title, type, content, id) {
      const now = new Date().toISOString();
      const diagram = { id, project_id: projectId, title, type, content, created_at: now, updated_at: now };
      diagrams.set(id, diagram);
      return diagram;
    },
    updateDiagram(id, updates) {
      const existing = diagrams.get(id);
      if (!existing) return undefined;
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      diagrams.set(id, updated);
      return updated;
    },
    deleteDiagram(id) { diagrams.delete(id); },
    deleteProject(id) {
      projects.delete(id);
      for (const [diagramId, diagram] of diagrams) {
        if (diagram.project_id === id) diagrams.delete(diagramId);
      }
    },
  };
  const user = { id: '11111111-1111-4111-8111-111111111111', email: 'test@example.com' };
  const authService = { getUserSync: () => user };
  let offline = true;
  const accountProjects = new Map();
  const accountDiagrams = new Map();
  const writes = [];
  let beforeUpload;
  const supabase = {
    from(table) {
      return {
        select() {
          return {
            async order() { return { data: [], error: null }; },
            eq() { return { async order() { return { data: [], error: null }; } }; },
          };
        },
        async upsert(value) {
          if (offline) return { error: { message: 'Network unavailable' } };
          if (beforeUpload) beforeUpload(table);
          writes.push(table);
          (table === 'projects' ? accountProjects : accountDiagrams).set(value.id, value);
          return { error: null };
        },
        delete() {
          return {
            async eq(_column, id) {
              if (offline) return { error: { message: 'Network unavailable' } };
              writes.push(`delete ${table}`);
              (table === 'projects' ? accountProjects : accountDiagrams).delete(id);
              return { error: null };
            },
          };
        },
      };
    },
  };
  const supabaseModule = { supabase, isSupabaseConfigured: () => true };
  const offlineSyncService = loadService('offlineSyncService.ts', {
    './authService': { authService },
    './cloudSaveStatus': { cloudSaveStatus },
    './mockDb': { mockDb },
    './supabase': supabaseModule,
  }, { window: { dispatchEvent() {} } }).offlineSyncService;
  const projectService = loadService('projectService.ts', {
    './supabase': supabaseModule,
    './authService': { authService },
    './mockDb': { mockDb },
    './adminService': { adminService: { logActivity() {} } },
    './cloudSaveStatus': { cloudSaveStatus },
    './offlineSyncService': { offlineSyncService },
  }).projectService;
  const diagramService = loadService('diagramService.ts', {
    './supabase': supabaseModule,
    './authService': { authService },
    './mockDb': { mockDb },
    './projectService': { projectService },
    './adminService': { adminService: { logActivity() {} } },
    './cloudSaveStatus': { cloudSaveStatus },
    './offlineSyncService': { offlineSyncService },
  }).diagramService;

  const project = await projectService.createProject('Offline project', 'Saved here first');
  const diagram = await diagramService.createDiagram(project.id, 'Offline diagram', 'flowchart');
  assert.match(project.id, /^[0-9a-f-]{36}$/);
  assert.match(diagram.id, /^[0-9a-f-]{36}$/);
  assert.equal(cloudSaveStatus.isProjectPending(user.id, project.id), true);
  assert.equal(cloudSaveStatus.isPending(user.id, diagram.id), true);
  assert.equal(accountProjects.size, 0);
  assert.equal(accountDiagrams.size, 0);
  assert.equal((await projectService.getProjects()).find(p => p.id === project.id)?.name, 'Offline project');
  assert.equal((await diagramService.getDiagrams(project.id)).find(d => d.id === diagram.id)?.title, 'Offline diagram');

  const latestContent = JSON.stringify({ nodes: [{ id: 'latest' }], edges: [] });
  assert.equal((await diagramService.saveDiagram(diagram.id, latestContent)).status, 'cloud-failed');
  assert.equal(diagrams.get(diagram.id).content, latestContent);

  offline = false;
  // Recreate the service as a page reload would; the queue lives in storage.
  const reloadedSyncService = loadService('offlineSyncService.ts', {
    './authService': { authService },
    './cloudSaveStatus': { cloudSaveStatus },
    './mockDb': { mockDb },
    './supabase': supabaseModule,
  }, { window: { dispatchEvent() {} } }).offlineSyncService;
  await reloadedSyncService.syncPending();
  assert.deepEqual(writes, ['projects', 'diagrams']);
  assert.equal(accountProjects.size, 1);
  assert.equal(accountDiagrams.size, 1);
  assert.equal(accountDiagrams.get(diagram.id).project_id, project.id);
  assert.equal(accountDiagrams.get(diagram.id).content.nodes[0].id, 'latest');
  assert.equal(cloudSaveStatus.isProjectPending(user.id, project.id), false);
  assert.equal(cloudSaveStatus.isPending(user.id, diagram.id), false);
  assert.ok(cloudSaveStatus.getLastConfirmedSave(user.id));

  await reloadedSyncService.syncPending();
  assert.deepEqual(writes, ['projects', 'diagrams']);

  // An edit made while an older upload is in flight must stay queued.
  mockDb.updateDiagram(diagram.id, { content: JSON.stringify({ nodes: [{ id: 'older' }] }) });
  cloudSaveStatus.markPending(user.id, diagram.id);
  beforeUpload = table => {
    if (table === 'diagrams') {
      mockDb.updateDiagram(diagram.id, { content: JSON.stringify({ nodes: [{ id: 'newer' }] }) });
      cloudSaveStatus.markPending(user.id, diagram.id);
      beforeUpload = undefined;
    }
  };
  await reloadedSyncService.syncPending();
  assert.equal(cloudSaveStatus.isPending(user.id, diagram.id), true);
  await reloadedSyncService.syncPending();
  assert.equal(accountDiagrams.get(diagram.id).content.nodes[0].id, 'newer');
  assert.equal(cloudSaveStatus.isPending(user.id, diagram.id), false);

  localStorage.failPrefix = `diagrid_pending_account_save_${user.id}_`;
  const unavailableMarkerContent = JSON.stringify({ nodes: [{ id: 'not-yet-uploaded' }] });
  assert.equal((await diagramService.saveDiagram(diagram.id, unavailableMarkerContent)).status, 'cloud-failed');
  assert.equal(accountDiagrams.get(diagram.id).content.nodes[0].id, 'newer');
  localStorage.failPrefix = null;
  assert.equal((await diagramService.saveDiagram(diagram.id, unavailableMarkerContent)).status, 'cloud-saved');
  assert.equal(accountDiagrams.get(diagram.id).content.nodes[0].id, 'not-yet-uploaded');

  offline = true;
  await diagramService.deleteDiagram(diagram.id);
  await projectService.deleteProject(project.id);
  assert.equal(cloudSaveStatus.isDiagramDeletionPending(user.id, diagram.id), true);
  assert.equal(cloudSaveStatus.isProjectDeletionPending(user.id, project.id), true);
  offline = false;
  await reloadedSyncService.syncPending();
  assert.equal(accountDiagrams.size, 0);
  assert.equal(accountProjects.size, 0);
  assert.equal(cloudSaveStatus.isDiagramDeletionPending(user.id, diagram.id), false);
  assert.equal(cloudSaveStatus.isProjectDeletionPending(user.id, project.id), false);
});
