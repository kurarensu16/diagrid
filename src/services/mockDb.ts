export interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface CanvasNode {
  id: string;
  type: 'table' | 'process' | 'decision' | 'terminal' | 'text' | 'dfd-store' | 'dfd-entity' | 'dfd-process' | 'usecase-actor' | 'usecase-oval' | 'usecase-boundary' | 'sequence-activation' | 'activity-start' | 'activity-end' | 'activity-action' | 'activity-decision' | 'activity-fork';
  label: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  customWidth?: number;
  customHeight?: number;
  fields?: string[]; // Specifically for 'table' (ERD) nodes
  fontSize?: 'sm' | 'md' | 'lg'; // Font size: sm (11px), md (13px), lg (16px)
  customFontSize?: number; // Custom font size in pixels (e.g. 10 to 48)
  textAlign?: 'left' | 'center' | 'right';
  isBold?: boolean;
  borderStyle?: 'none' | 'solid' | 'dashed' | 'dotted';
  borderWidth?: 1 | 2 | 3;
  fillColor?: string; // hex code or transparent
  shadowAccent?: string; // custom hex color, palette color, or 'none'
}

export type EdgeMarkerType = 'none' | 'arrow' | 'one' | 'one-only' | 'zero-one' | 'many' | 'one-many' | 'zero-many';

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: 'top' | 'bottom' | 'left' | 'right';
  targetHandle?: 'top' | 'bottom' | 'left' | 'right';
  label?: string;
  style?: 'solid' | 'dashed';
  arrow?: 'end' | 'none' | 'both';
  sourceMarker?: EdgeMarkerType;
  targetMarker?: EdgeMarkerType;
}

export interface Diagram {
  id: string;
  project_id: string;
  title: string;
  type: 'erd' | 'flowchart' | 'sequence' | 'class' | 'gantt' | 'dfd' | 'usecase' | 'activity';
  content: string; // Serialized JSON string: { nodes: CanvasNode[], edges: CanvasEdge[] }
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: string;
  title: string;
  type: Diagram['type'];
  content: string; // Serialized JSON string
}

// Starter seed JSON representations (Broad, Standard Engineering Blueprints)
const SEEDS = {
  erd: JSON.stringify({
    nodes: [
      {
        id: 'n-users',
        type: 'table',
        label: 'users',
        x: 60,
        y: 40,
        fields: ['id uuid pk', 'email text', 'created_at timestamptz']
      },
      {
        id: 'n-projects',
        type: 'table',
        label: 'projects',
        x: 60,
        y: 220,
        fields: ['id uuid pk', 'user_id uuid fk', 'name text']
      },
      {
        id: 'n-diagrams',
        type: 'table',
        label: 'diagrams',
        x: 360,
        y: 40,
        fields: ['id uuid pk', 'project_id uuid fk', 'title text', 'content text']
      }
    ],
    edges: [
      {
        id: 'e-1',
        source: 'n-users',
        target: 'n-projects',
        sourceHandle: 'bottom',
        targetHandle: 'top',
        label: '1:N',
        sourceMarker: 'one',
        targetMarker: 'many'
      },
      {
        id: 'e-2',
        source: 'n-projects',
        target: 'n-diagrams',
        sourceHandle: 'right',
        targetHandle: 'left',
        label: '1:N',
        sourceMarker: 'one',
        targetMarker: 'many'
      }
    ]
  }),
  flowchart: JSON.stringify({
    nodes: [
      {
        id: 'n-start',
        type: 'terminal',
        label: 'Start Flow',
        x: 190,
        y: 40
      },
      {
        id: 'n-drag',
        type: 'process',
        label: 'Submit Request',
        x: 180,
        y: 130
      },
      {
        id: 'n-decision',
        type: 'decision',
        label: 'Is Valid?',
        x: 205,
        y: 230
      },
      {
        id: 'n-success',
        type: 'process',
        label: 'Process Success',
        x: 80,
        y: 350
      },
      {
        id: 'n-end',
        type: 'terminal',
        label: 'Complete',
        x: 320,
        y: 350
      }
    ],
    edges: [
      {
        id: 'e-1',
        source: 'n-start',
        target: 'n-drag',
        sourceHandle: 'bottom',
        targetHandle: 'top'
      },
      {
        id: 'e-2',
        source: 'n-drag',
        target: 'n-decision',
        sourceHandle: 'bottom',
        targetHandle: 'top'
      },
      {
        id: 'e-3',
        source: 'n-decision',
        target: 'n-success',
        sourceHandle: 'left',
        targetHandle: 'top',
        label: 'yes'
      },
      {
        id: 'e-4',
        source: 'n-decision',
        target: 'n-end',
        sourceHandle: 'right',
        targetHandle: 'top',
        label: 'no'
      }
    ]
  }),
  sequence: JSON.stringify({
    nodes: [
      { id: 'n-client', type: 'process', label: 'Client App', x: 60, y: 40 },
      { id: 'n-gateway', type: 'process', label: 'API Gateway', x: 280, y: 40 },
      { id: 'n-db', type: 'process', label: 'Database Server', x: 500, y: 40 },
      { id: 'act-client-1', type: 'sequence-activation', label: '', x: 120, y: 120 },
      { id: 'act-gateway-1', type: 'sequence-activation', label: '', x: 340, y: 140 },
      { id: 'act-db', type: 'sequence-activation', label: '', x: 560, y: 180 },
      { id: 'act-gateway-2', type: 'sequence-activation', label: '', x: 340, y: 260 },
      { id: 'act-client-2', type: 'sequence-activation', label: '', x: 120, y: 290 }
    ],
    edges: [
      { id: 'e-seq-1', source: 'act-client-1', target: 'act-gateway-1', sourceHandle: 'right', targetHandle: 'left', label: 'GET /records' },
      { id: 'e-seq-2', source: 'act-gateway-1', target: 'act-db', sourceHandle: 'right', targetHandle: 'left', label: 'SELECT * FROM tbl' },
      { id: 'e-seq-3', source: 'act-db', target: 'act-gateway-2', sourceHandle: 'left', targetHandle: 'right', label: 'result_data', style: 'dashed' },
      { id: 'e-seq-4', source: 'act-gateway-2', target: 'act-client-2', sourceHandle: 'left', targetHandle: 'right', label: '200 OK (JSON)', style: 'dashed' }
    ]
  }),
  class: JSON.stringify({
    nodes: [
      { id: 'n-c1', type: 'table', label: 'UserController', x: 60, y: 40, fields: ['+String route', '+handleRequest()', '+sendResponse()'] },
      { id: 'n-c2', type: 'table', label: 'UserService', x: 320, y: 40, fields: ['+User findById()', '+saveUser()', '+validateToken()'] },
      { id: 'n-c3', type: 'table', label: 'UserEntity', x: 580, y: 40, fields: ['-UUID id', '-String email', '-String role', '+getEmail()'] }
    ],
    edges: [
      { id: 'e-1', source: 'n-c1', target: 'n-c2', sourceHandle: 'right', targetHandle: 'left', label: 'delegates' },
      { id: 'e-2', source: 'n-c2', target: 'n-c3', sourceHandle: 'right', targetHandle: 'left', label: 'manages' }
    ]
  }),
  gantt: JSON.stringify({
    nodes: [
      { id: 'n-g1', type: 'process', label: 'Phase 1: Specifications & Design', x: 60, y: 60 },
      { id: 'n-g2', type: 'process', label: 'Phase 2: Core Engineering', x: 260, y: 140 },
      { id: 'n-g3', type: 'process', label: 'Phase 3: QA & Deployment', x: 460, y: 220 }
    ],
    edges: [
      { id: 'e-1', source: 'n-g1', target: 'n-g2', sourceHandle: 'right', targetHandle: 'left', label: 'pre-req' },
      { id: 'e-2', source: 'n-g2', target: 'n-g3', sourceHandle: 'right', targetHandle: 'left', label: 'hand-off' }
    ]
  }),
  dfd: JSON.stringify({
    nodes: [
      { id: 'dfd-n1', type: 'dfd-entity', label: 'Customer', x: 40, y: 70 },
      { id: 'dfd-n2', type: 'dfd-process', label: '1.0 Process Order', x: 260, y: 50 },
      { id: 'dfd-n3', type: 'dfd-entity', label: 'Payment Gateway', x: 520, y: 70 },
      { id: 'dfd-s1', type: 'dfd-store', label: 'Orders Store', x: 260, y: 160 },
      { id: 'dfd-n4', type: 'dfd-process', label: '2.0 Generate Invoice', x: 260, y: 260 },
      { id: 'dfd-s2', type: 'dfd-store', label: 'Users Database', x: 40, y: 260 }
    ],
    edges: [
      { id: 'dfd-e1', source: 'dfd-n1', target: 'dfd-n2', sourceHandle: 'right', targetHandle: 'left', label: 'Order Request' },
      { id: 'dfd-e2', source: 'dfd-n2', target: 'dfd-s1', sourceHandle: 'bottom', targetHandle: 'top', label: 'Save Record' },
      { id: 'dfd-e3', source: 'dfd-n2', target: 'dfd-n3', sourceHandle: 'right', targetHandle: 'left', label: 'Payment Request' },
      { id: 'dfd-e4', source: 'dfd-n3', target: 'dfd-n4', sourceHandle: 'bottom', targetHandle: 'right', label: 'Payment Receipt' },
      { id: 'dfd-e5', source: 'dfd-s2', target: 'dfd-n4', sourceHandle: 'right', targetHandle: 'left', label: 'User Profile' },
      { id: 'dfd-e6', source: 'dfd-n4', target: 'dfd-n1', sourceHandle: 'left', targetHandle: 'bottom', label: 'Invoice PDF', style: 'dashed' }
    ]
  }),
  usecase: JSON.stringify({
    nodes: [
      { id: 'uc-n2', type: 'usecase-boundary', label: 'System Platform', x: 160, y: 30 },
      { id: 'uc-n1', type: 'usecase-actor', label: 'Customer', x: 40, y: 70 },
      { id: 'uc-admin', type: 'usecase-actor', label: 'Administrator', x: 40, y: 220 },
      { id: 'uc-n3', type: 'usecase-oval', label: 'Authenticate User', x: 210, y: 60 },
      { id: 'uc-n4', type: 'usecase-oval', label: 'Place Order', x: 210, y: 140 },
      { id: 'uc-n5', type: 'usecase-oval', label: 'View Reports', x: 210, y: 220 }
    ],
    edges: [
      { id: 'uc-e1', source: 'uc-n1', target: 'uc-n3', sourceHandle: 'right', targetHandle: 'left' },
      { id: 'uc-e2', source: 'uc-n1', target: 'uc-n4', sourceHandle: 'right', targetHandle: 'left' },
      { id: 'uc-e3', source: 'uc-admin', target: 'uc-n3', sourceHandle: 'right', targetHandle: 'left' },
      { id: 'uc-e4', source: 'uc-admin', target: 'uc-n5', sourceHandle: 'right', targetHandle: 'left' }
    ]
  }),
  activity: JSON.stringify({
    nodes: [
      { id: 'act-start', type: 'activity-start', label: '', x: 214, y: 20 },
      { id: 'act-receive', type: 'activity-action', label: 'Receive Request', x: 155, y: 70 },
      { id: 'act-check', type: 'activity-decision', label: 'Is Valid?', x: 185, y: 150 },
      { id: 'act-error', type: 'activity-action', label: 'Show Error Message', x: 380, y: 174 },
      { id: 'act-fork', type: 'activity-fork', label: '', x: 130, y: 275 },
      { id: 'act-process', type: 'activity-action', label: 'Process Payment', x: 60, y: 320 },
      { id: 'act-audit', type: 'activity-action', label: 'Log Audit Trail', x: 270, y: 320 },
      { id: 'act-join', type: 'activity-fork', label: '', x: 130, y: 405 },
      { id: 'act-notify', type: 'activity-action', label: 'Send Confirmation', x: 155, y: 440 },
      { id: 'act-end', type: 'activity-end', label: '', x: 212, y: 520 }
    ],
    edges: [
      { id: 'act-e1', source: 'act-start', target: 'act-receive', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'act-e2', source: 'act-receive', target: 'act-check', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'act-e3', source: 'act-check', target: 'act-fork', sourceHandle: 'bottom', targetHandle: 'top', label: '[valid]' },
      { id: 'act-e4', source: 'act-check', target: 'act-error', sourceHandle: 'right', targetHandle: 'left', label: '[invalid]' },
      { id: 'act-e5', source: 'act-error', target: 'act-receive', sourceHandle: 'top', targetHandle: 'right', label: 'retry', style: 'dashed' },
      { id: 'act-e6', source: 'act-fork', target: 'act-process', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'act-e7', source: 'act-fork', target: 'act-audit', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'act-e8', source: 'act-process', target: 'act-join', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'act-e9', source: 'act-audit', target: 'act-join', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'act-e10', source: 'act-join', target: 'act-notify', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'act-e11', source: 'act-notify', target: 'act-end', sourceHandle: 'bottom', targetHandle: 'top' }
    ]
  })
};

export const TEMPLATES: Template[] = [
  { id: 't-erd', title: 'Starter ERD Schema', type: 'erd', content: SEEDS.erd },
  { id: 't-flowchart', title: 'Starter Flowchart Workflow', type: 'flowchart', content: SEEDS.flowchart },
  { id: 't-sequence', title: 'Starter Sequence Interaction', type: 'sequence', content: SEEDS.sequence },
  { id: 't-class', title: 'Starter Class Diagram', type: 'class', content: SEEDS.class },
  { id: 't-gantt', title: 'Starter Gantt Project Timeline', type: 'gantt', content: SEEDS.gantt },
  { id: 't-dfd', title: 'Starter Data Flow Diagram (DFD)', type: 'dfd', content: SEEDS.dfd },
  { id: 't-usecase', title: 'Starter Use Case Diagram', type: 'usecase', content: SEEDS.usecase },
  { id: 't-activity', title: 'Starter Activity Diagram', type: 'activity', content: SEEDS.activity }
];

const STORAGE_KEYS = {
  PROJECTS: 'diagrid_projects',
  DIAGRAMS: 'diagrid_diagrams',
};

const getStored = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key);
  if (!data) return defaultValue;
  try {
    return JSON.parse(data);
  } catch {
    return defaultValue;
  }
};

const setStored = <T>(key: string, value: T): void => {
  localStorage.setItem(key, JSON.stringify(value));
};

// Seed initial projects and diagrams if empty
export const seedInitialData = (): void => {
  const projects = getStored<Project[]>(STORAGE_KEYS.PROJECTS, []);

  if (projects.length === 0) {
    const defaultProject: Project = {
      id: 'p-default',
      name: 'Sample Project',
      description: 'Your first Diagrid workspace housing sample ERD and flowchart templates.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const initialDiagrams: Diagram[] = [
      {
        id: 'd-sample-erd',
        project_id: 'p-default',
        title: 'Database Schema',
        type: 'erd',
        content: SEEDS.erd,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'd-sample-flowchart',
        project_id: 'p-default',
        title: 'Application Flow',
        type: 'flowchart',
        content: SEEDS.flowchart,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    ];

    setStored(STORAGE_KEYS.PROJECTS, [defaultProject]);
    setStored(STORAGE_KEYS.DIAGRAMS, initialDiagrams);
  }
};

export const mockDb = {
  // Templates
  getTemplates: (): Template[] => TEMPLATES,
  getTemplate: (id: string): Template | undefined => TEMPLATES.find(t => t.id === id),

  // Projects
  getProjects: (): Project[] => {
    seedInitialData();
    return getStored<Project[]>(STORAGE_KEYS.PROJECTS, []);
  },
  
  getProject: (id: string): Project | undefined => {
    return mockDb.getProjects().find(p => p.id === id);
  },

  createProject: (name: string, description: string = ''): Project => {
    const projects = mockDb.getProjects();
    const newProject: Project = {
      id: `p-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    projects.push(newProject);
    setStored(STORAGE_KEYS.PROJECTS, projects);
    return newProject;
  },

  updateProject: (id: string, updates: Partial<Pick<Project, 'name' | 'description'>>): Project | undefined => {
    const projects = mockDb.getProjects();
    const idx = projects.findIndex(p => p.id === id);
    if (idx === -1) return undefined;

    const updated = {
      ...projects[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    projects[idx] = updated;
    setStored(STORAGE_KEYS.PROJECTS, projects);
    return updated;
  },

  deleteProject: (id: string): void => {
    const projects = mockDb.getProjects().filter(p => p.id !== id);
    setStored(STORAGE_KEYS.PROJECTS, projects);

    const diagrams = getStored<Diagram[]>(STORAGE_KEYS.DIAGRAMS, []).filter(d => d.project_id !== id);
    setStored(STORAGE_KEYS.DIAGRAMS, diagrams);
  },

  // Diagrams
  getDiagrams: (projectId?: string): Diagram[] => {
    seedInitialData();
    const diagrams = getStored<Diagram[]>(STORAGE_KEYS.DIAGRAMS, []);
    if (projectId) {
      return diagrams.filter(d => d.project_id === projectId);
    }
    return diagrams;
  },

  getDiagram: (id: string): Diagram | undefined => {
    return mockDb.getDiagrams().find(d => d.id === id);
  },

  createDiagram: (projectId: string, title: string, type: Diagram['type'], customContent?: string, customId?: string): Diagram => {
    const diagrams = mockDb.getDiagrams();
    const template = TEMPLATES.find(t => t.type === type);
    const newDiagram: Diagram = {
      id: customId || `d-${Math.random().toString(36).substr(2, 9)}`,
      project_id: projectId,
      title,
      type,
      content: customContent || template?.content || JSON.stringify({ nodes: [], edges: [] }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    diagrams.push(newDiagram);
    setStored(STORAGE_KEYS.DIAGRAMS, diagrams);

    mockDb.updateProject(projectId, {});
    return newDiagram;
  },

  upsertDiagram: (diagram: Diagram): void => {
    const diagrams = mockDb.getDiagrams();
    const idx = diagrams.findIndex(d => d.id === diagram.id);
    if (idx >= 0) {
      diagrams[idx] = { ...diagram, updated_at: new Date().toISOString() };
    } else {
      diagrams.push(diagram);
    }
    setStored(STORAGE_KEYS.DIAGRAMS, diagrams);
  },

  updateDiagram: (id: string, updates: Partial<Pick<Diagram, 'title' | 'content' | 'type'>>): Diagram | undefined => {
    const diagrams = mockDb.getDiagrams();
    const idx = diagrams.findIndex(d => d.id === id);
    if (idx === -1) return undefined;

    const updated = {
      ...diagrams[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    diagrams[idx] = updated;
    setStored(STORAGE_KEYS.DIAGRAMS, diagrams);

    mockDb.updateProject(updated.project_id, {});
    return updated;
  },

  deleteDiagram: (id: string): void => {
    const diagrams = mockDb.getDiagrams();
    const diagram = diagrams.find(d => d.id === id);
    if (!diagram) return;

    const filtered = diagrams.filter(d => d.id !== id);
    setStored(STORAGE_KEYS.DIAGRAMS, filtered);

    mockDb.updateProject(diagram.project_id, {});
  },

  duplicateDiagram: (id: string): Diagram | undefined => {
    const src = mockDb.getDiagram(id);
    if (!src) return undefined;

    return mockDb.createDiagram(
      src.project_id,
      `${src.title} (Copy)`,
      src.type,
      src.content
    );
  }
};
