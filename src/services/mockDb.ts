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

// Starter seed JSON representations
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
        y: 240,
        fields: ['id uuid pk', 'user_id uuid fk', 'name text']
      },
      {
        id: 'n-diagrams',
        type: 'table',
        label: 'diagrams',
        x: 380,
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
        label: 'Drag Box to Canvas',
        x: 180,
        y: 140
      },
      {
        id: 'n-decision',
        type: 'decision',
        label: 'Is Connected?',
        x: 205,
        y: 240
      },
      {
        id: 'n-success',
        type: 'process',
        label: 'Render Line Edge',
        x: 80,
        y: 360
      },
      {
        id: 'n-end',
        type: 'terminal',
        label: 'Done',
        x: 320,
        y: 360
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
      { id: 'n-client', type: 'process', label: 'Client User', x: 60, y: 60 },
      { id: 'n-gateway', type: 'process', label: 'API Gateway', x: 260, y: 60 },
      { id: 'n-db', type: 'process', label: 'Postgres DB', x: 460, y: 60 },
      { id: 'act-client-1', type: 'sequence-activation', label: 'Client Req', x: 120, y: 140 },
      { id: 'act-gateway-1', type: 'sequence-activation', label: 'Gateway Proc', x: 320, y: 160 },
      { id: 'act-db', type: 'sequence-activation', label: 'DB Query', x: 520, y: 200 },
      { id: 'act-gateway-2', type: 'sequence-activation', label: 'Gateway Resp', x: 320, y: 280 },
      { id: 'act-client-2', type: 'sequence-activation', label: 'Client UI', x: 120, y: 300 }
    ],
    edges: [
      { id: 'e-seq-1', source: 'act-client-1', target: 'act-gateway-1', sourceHandle: 'right', targetHandle: 'left', label: 'GET /projects' },
      { id: 'e-seq-2', source: 'act-gateway-1', target: 'act-db', sourceHandle: 'right', targetHandle: 'left', label: 'query_records()' },
      { id: 'e-seq-3', source: 'act-db', target: 'act-gateway-2', sourceHandle: 'left', targetHandle: 'right', label: 'records', style: 'dashed' },
      { id: 'e-seq-4', source: 'act-gateway-2', target: 'act-client-2', sourceHandle: 'left', targetHandle: 'right', label: '200 OK (JSON)', style: 'dashed' }
    ]
  }),
  class: JSON.stringify({
    nodes: [
      { id: 'n-c1', type: 'table', label: 'UserAccount', x: 80, y: 50, fields: ['+String username', '+login()'] },
      { id: 'n-c2', type: 'table', label: 'BillingPlan', x: 340, y: 50, fields: ['+Double amount', '+charge()'] }
    ],
    edges: [
      { id: 'e-1', source: 'n-c1', target: 'n-c2', sourceHandle: 'right', targetHandle: 'left', label: 'has_plan' }
    ]
  }),
  gantt: JSON.stringify({
    nodes: [
      { id: 'n-g1', type: 'process', label: 'Sprint 1: Base Setup', x: 100, y: 100 },
      { id: 'n-g2', type: 'process', label: 'Sprint 2: Direct Direct Canvas', x: 360, y: 180 }
    ],
    edges: [
      { id: 'e-1', source: 'n-g1', target: 'n-g2', sourceHandle: 'right', targetHandle: 'left', label: 'pre-req' }
    ]
  }),
  dfd: JSON.stringify({
    nodes: [
      { id: 'dfd-n1', type: 'dfd-entity', label: 'Client User', x: 40, y: 80 },
      { id: 'dfd-n2', type: 'dfd-process', label: '1.0 Verify User Login', x: 220, y: 80 },
      { id: 'dfd-n3', type: 'dfd-store', label: 'Users DB Store', x: 440, y: 80 }
    ],
    edges: [
      { id: 'dfd-e1', source: 'dfd-n1', target: 'dfd-n2', sourceHandle: 'right', targetHandle: 'left', label: 'credentials' },
      { id: 'dfd-e2', source: 'dfd-n2', target: 'dfd-n3', sourceHandle: 'right', targetHandle: 'left', label: 'verify_query' }
    ]
  }),
  usecase: JSON.stringify({
    nodes: [
      { id: 'uc-n1', type: 'usecase-actor', label: 'System Admin', x: 40, y: 120 },
      { id: 'uc-n2', type: 'usecase-boundary', label: 'Diagrid Service Boundary', x: 160, y: 30 },
      { id: 'uc-n3', type: 'usecase-oval', label: 'Authenticate User', x: 200, y: 60 },
      { id: 'uc-n4', type: 'usecase-oval', label: 'Audit Access Logs', x: 200, y: 160 }
    ],
    edges: [
      { id: 'uc-e1', source: 'uc-n1', target: 'uc-n3', sourceHandle: 'right', targetHandle: 'left' },
      { id: 'uc-e2', source: 'uc-n1', target: 'uc-n4', sourceHandle: 'right', targetHandle: 'left' }
    ]
  }),
  activity: JSON.stringify({
    nodes: [
      { id: 'act-start', type: 'activity-start', label: 'Start', x: 224, y: 20 },
      { id: 'act-validate', type: 'activity-action', label: 'Validate Input', x: 165, y: 80 },
      { id: 'act-check', type: 'activity-decision', label: 'Is Valid?', x: 195, y: 160 },
      { id: 'act-error', type: 'activity-action', label: 'Show Error Message', x: 380, y: 160 },
      { id: 'act-fork', type: 'activity-fork', label: 'Fork', x: 140, y: 280 },
      { id: 'act-payment', type: 'activity-action', label: 'Process Payment', x: 60, y: 340 },
      { id: 'act-confirm', type: 'activity-action', label: 'Send Confirmation', x: 280, y: 340 },
      { id: 'act-join', type: 'activity-fork', label: 'Join', x: 140, y: 420 },
      { id: 'act-end', type: 'activity-end', label: 'End', x: 222, y: 480 }
    ],
    edges: [
      { id: 'act-e1', source: 'act-start', target: 'act-validate', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'act-e2', source: 'act-validate', target: 'act-check', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'act-e3', source: 'act-check', target: 'act-fork', sourceHandle: 'bottom', targetHandle: 'top', label: '[valid]' },
      { id: 'act-e4', source: 'act-check', target: 'act-error', sourceHandle: 'right', targetHandle: 'left', label: '[invalid]' },
      { id: 'act-e5', source: 'act-error', target: 'act-validate', sourceHandle: 'top', targetHandle: 'right', label: 'retry', style: 'dashed' },
      { id: 'act-e6', source: 'act-fork', target: 'act-payment', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'act-e7', source: 'act-fork', target: 'act-confirm', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'act-e8', source: 'act-payment', target: 'act-join', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'act-e9', source: 'act-confirm', target: 'act-join', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'act-e10', source: 'act-join', target: 'act-end', sourceHandle: 'bottom', targetHandle: 'top' }
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
