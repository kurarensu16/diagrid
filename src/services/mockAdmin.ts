export interface AdminUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
  created_at: string;
  last_active: string;
  project_count: number;
  diagram_count: number;
}

export interface ActivityLog {
  id: string;
  user_email: string;
  action: 'created_project' | 'created_diagram' | 'exported_diagram' | 'signed_in' | 'deleted_project';
  target: string;
  timestamp: string;
}

export interface PlatformStats {
  total_users: number;
  active_users_24h: number;
  total_projects: number;
  total_diagrams: number;
  diagrams_by_type: Record<string, number>;
  signups_last_7_days: number[];
}

export interface TemplateConfig {
  id: string;
  title: string;
  type: string;
  enabled: boolean;
  featured: boolean;
}

export interface AdminFeedback {
  id: string;
  timestamp: string;
  user: string;
  type: 'feature' | 'bug' | 'general';
  rating: number; // 1 to 5
  ratingLabel: string;
  message: string;
  status: 'new' | 'reviewed' | 'resolved';
}

const STORAGE_KEYS = {
  USERS: 'diagrid_admin_users',
  LOGS: 'diagrid_admin_logs',
  TEMPLATES_CONFIG: 'diagrid_admin_templates_config',
  FEEDBACK: 'diagrid_feedback',
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

const SEED_USERS: AdminUser[] = [
  {
    id: 'u-1',
    email: 'admin@diagrid.dev',
    role: 'admin',
    status: 'active',
    created_at: '2026-06-01T08:00:00Z',
    last_active: new Date().toISOString(),
    project_count: 3,
    diagram_count: 8,
  },
  {
    id: 'u-2',
    email: 'juan.delacruz@up.edu.ph',
    role: 'user',
    status: 'active',
    created_at: '2026-07-02T10:15:00Z',
    last_active: '2026-07-11T12:30:00Z',
    project_count: 2,
    diagram_count: 5,
  },
  {
    id: 'u-3',
    email: 'maria.santos@dlsu.edu.ph',
    role: 'user',
    status: 'active',
    created_at: '2026-07-05T14:20:00Z',
    last_active: '2026-07-10T16:45:00Z',
    project_count: 1,
    diagram_count: 3,
  },
  {
    id: 'u-4',
    email: 'dev.builder@freelance.ph',
    role: 'user',
    status: 'active',
    created_at: '2026-07-07T09:00:00Z',
    last_active: '2026-07-11T20:15:00Z',
    project_count: 4,
    diagram_count: 12,
  },
  {
    id: 'u-5',
    email: 'student.helper@ust.edu.ph',
    role: 'user',
    status: 'suspended',
    created_at: '2026-07-08T11:40:00Z',
    last_active: '2026-07-09T08:20:00Z',
    project_count: 1,
    diagram_count: 1,
  },
  {
    id: 'u-6',
    email: 'code.architect@techcorp.com',
    role: 'user',
    status: 'active',
    created_at: '2026-07-09T16:00:00Z',
    last_active: '2026-07-11T22:10:00Z',
    project_count: 2,
    diagram_count: 6,
  },
  {
    id: 'u-7',
    email: 'design.guru@visuals.io',
    role: 'user',
    status: 'active',
    created_at: '2026-07-10T13:30:00Z',
    last_active: '2026-07-10T18:00:00Z',
    project_count: 0,
    diagram_count: 0,
  },
  {
    id: 'u-8',
    email: 'ana.reyes@ateneo.edu',
    role: 'user',
    status: 'active',
    created_at: '2026-07-09T11:20:00Z',
    last_active: '2026-07-11T14:10:00Z',
    project_count: 3,
    diagram_count: 7,
  },
  {
    id: 'u-9',
    email: 'mark.tan@startup.io',
    role: 'user',
    status: 'active',
    created_at: '2026-07-10T09:45:00Z',
    last_active: '2026-07-11T18:30:00Z',
    project_count: 1,
    diagram_count: 4,
  },
  {
    id: 'u-10',
    email: 'systems.lead@cloudinfra.net',
    role: 'user',
    status: 'suspended',
    created_at: '2026-07-06T15:10:00Z',
    last_active: '2026-07-08T17:00:00Z',
    project_count: 2,
    diagram_count: 5,
  }
];

const SEED_LOGS: ActivityLog[] = [
  {
    id: 'l-1',
    user_email: 'juan.delacruz@up.edu.ph',
    action: 'signed_in',
    target: 'Session started',
    timestamp: '2026-07-11T12:30:00Z'
  },
  {
    id: 'l-2',
    user_email: 'dev.builder@freelance.ph',
    action: 'created_project',
    target: 'Client API Gateway',
    timestamp: '2026-07-11T19:40:00Z'
  },
  {
    id: 'l-3',
    user_email: 'dev.builder@freelance.ph',
    action: 'created_diagram',
    target: 'System Architecture (Flowchart)',
    timestamp: '2026-07-11T19:45:00Z'
  },
  {
    id: 'l-4',
    user_email: 'dev.builder@freelance.ph',
    action: 'exported_diagram',
    target: 'System Architecture (Flowchart) -> PNG',
    timestamp: '2026-07-11T20:15:00Z'
  },
  {
    id: 'l-5',
    user_email: 'code.architect@techcorp.com',
    action: 'created_diagram',
    target: 'Database Schema (ERD)',
    timestamp: '2026-07-11T22:05:00Z'
  },
  {
    id: 'l-6',
    user_email: 'code.architect@techcorp.com',
    action: 'exported_diagram',
    target: 'Database Schema (ERD) -> SVG',
    timestamp: '2026-07-11T22:10:00Z'
  },
  {
    id: 'l-7',
    user_email: 'admin@diagrid.dev',
    action: 'signed_in',
    target: 'Admin dashboard console session',
    timestamp: '2026-07-11T22:15:00Z'
  },
  {
    id: 'l-8',
    user_email: 'ana.reyes@ateneo.edu',
    action: 'created_project',
    target: 'E-Commerce Platform Microservices',
    timestamp: '2026-07-11T22:30:00Z'
  },
  {
    id: 'l-9',
    user_email: 'ana.reyes@ateneo.edu',
    action: 'created_diagram',
    target: 'Checkout Service (Sequence)',
    timestamp: '2026-07-11T22:35:00Z'
  },
  {
    id: 'l-10',
    user_email: 'student.helper@ust.edu.ph',
    action: 'deleted_project',
    target: 'Temporary Sandbox Draft',
    timestamp: '2026-07-09T08:15:00Z'
  }
];

const SEED_TEMPLATES_CONFIG: TemplateConfig[] = [
  { id: 't-erd', title: 'Starter ERD Schema', type: 'erd', enabled: true, featured: true },
  { id: 't-flowchart', title: 'Starter Flowchart Workflow', type: 'flowchart', enabled: true, featured: true },
  { id: 't-sequence', title: 'Starter Sequence Interaction', type: 'sequence', enabled: true, featured: false },
  { id: 't-class', title: 'Starter Class Diagram', type: 'class', enabled: true, featured: false },
  { id: 't-gantt', title: 'Starter Gantt Project Timeline', type: 'gantt', enabled: true, featured: false },
  { id: 't-dfd', title: 'Starter Data Flow Diagram (DFD)', type: 'dfd', enabled: true, featured: true },
  { id: 't-usecase', title: 'Starter Use Case Diagram', type: 'usecase', enabled: true, featured: false },
  { id: 't-activity', title: 'Starter Activity Diagram', type: 'activity', enabled: true, featured: true }
];

export const mockAdmin = {
  seedData: (forceReset = false): void => {
    const users = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!users || forceReset) {
      setStored(STORAGE_KEYS.USERS, SEED_USERS);
    }
    const logs = localStorage.getItem(STORAGE_KEYS.LOGS);
    if (!logs || forceReset) {
      setStored(STORAGE_KEYS.LOGS, SEED_LOGS);
    }
    const configs = localStorage.getItem(STORAGE_KEYS.TEMPLATES_CONFIG);
    if (!configs || forceReset) {
      setStored(STORAGE_KEYS.TEMPLATES_CONFIG, SEED_TEMPLATES_CONFIG);
    }
  },

  getUsers: (): AdminUser[] => {
    mockAdmin.seedData();
    return getStored<AdminUser[]>(STORAGE_KEYS.USERS, SEED_USERS);
  },

  getUserById: (id: string): AdminUser | undefined => {
    const users = mockAdmin.getUsers();
    return users.find(u => u.id === id);
  },

  setUserStatus: (id: string, status: 'active' | 'suspended'): void => {
    const users = mockAdmin.getUsers();
    const updated = users.map(u => u.id === id ? { ...u, status } : u);
    setStored(STORAGE_KEYS.USERS, updated);
  },

  suspendUser: (id: string): void => {
    mockAdmin.setUserStatus(id, 'suspended');
  },

  activateUser: (id: string): void => {
    mockAdmin.setUserStatus(id, 'active');
  },

  getActivityLogs: (): ActivityLog[] => {
    mockAdmin.seedData();
    return getStored<ActivityLog[]>(STORAGE_KEYS.LOGS, SEED_LOGS);
  },

  getActivityLog: (limit?: number): ActivityLog[] => {
    const logs = mockAdmin.getActivityLogs();
    return typeof limit === 'number' ? logs.slice(0, limit) : logs;
  },

  addActivityLog: (userEmail: string, action: ActivityLog['action'], target: string): void => {
    const logs = mockAdmin.getActivityLogs();
    const newLog: ActivityLog = {
      id: `l-${Math.random().toString(36).substr(2, 9)}`,
      user_email: userEmail,
      action,
      target,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newLog);
    if (logs.length > 100) logs.pop(); // Cap logs
    setStored(STORAGE_KEYS.LOGS, logs);
  },

  getPlatformStats: (): PlatformStats => {
    const users = mockAdmin.getUsers();
    
    let totalProjects = 0;
    let totalDiagrams = 0;
    users.forEach(u => {
      totalProjects += u.project_count;
      totalDiagrams += u.diagram_count;
    });

    const activeUsers24h = users.filter(u => {
      const lastActiveDate = new Date(u.last_active);
      const diffMs = new Date().getTime() - lastActiveDate.getTime();
      return diffMs < 24 * 60 * 60 * 1000;
    }).length;

    const diagramsByType: Record<string, number> = {
      erd: 18,
      flowchart: 14,
      sequence: 6,
      class: 4,
      gantt: 3,
      dfd: 7,
      usecase: 5,
      activity: 4
    };

    return {
      total_users: users.length,
      active_users_24h: activeUsers24h,
      total_projects: totalProjects,
      total_diagrams: totalDiagrams,
      diagrams_by_type: diagramsByType,
      signups_last_7_days: [3, 5, 2, 7, 4, 6, 1]
    };
  },

  getTemplateConfigs: (): TemplateConfig[] => {
    mockAdmin.seedData();
    return getStored<TemplateConfig[]>(STORAGE_KEYS.TEMPLATES_CONFIG, SEED_TEMPLATES_CONFIG);
  },

  getTemplateConfig: (): TemplateConfig[] => {
    return mockAdmin.getTemplateConfigs();
  },

  updateTemplateConfig: (id: string, updates: Partial<Pick<TemplateConfig, 'enabled' | 'featured'>>): void => {
    const configs = mockAdmin.getTemplateConfigs();
    const updated = configs.map(c => c.id === id ? { ...c, ...updates } : c);
    setStored(STORAGE_KEYS.TEMPLATES_CONFIG, updated);
  },

  getFeedback: (): AdminFeedback[] => {
    const stored = getStored<AdminFeedback[]>(STORAGE_KEYS.FEEDBACK, []);
    // If no feedback yet, seed initial representative feedback items
    if (stored.length === 0) {
      setStored(STORAGE_KEYS.FEEDBACK, SEED_FEEDBACK);
      return SEED_FEEDBACK;
    }
    return stored;
  },

  updateFeedbackStatus: (id: string, status: 'new' | 'reviewed' | 'resolved'): void => {
    const list = mockAdmin.getFeedback();
    const updated = list.map(item => item.id === id ? { ...item, status } : item);
    setStored(STORAGE_KEYS.FEEDBACK, updated);
  },

  deleteFeedback: (id: string): void => {
    const list = mockAdmin.getFeedback();
    const filtered = list.filter(item => item.id !== id);
    setStored(STORAGE_KEYS.FEEDBACK, filtered);
  },

  getFeedbackStats: () => {
    const items = mockAdmin.getFeedback();
    const total = items.length;
    if (total === 0) {
      return { averageRating: 0, total: 0, byType: { feature: 0, bug: 0, general: 0 }, byStatus: { new: 0, reviewed: 0, resolved: 0 } };
    }
    const sumRatings = items.reduce((acc, curr) => acc + (curr.rating || 5), 0);
    const averageRating = Math.round((sumRatings / total) * 10) / 10;
    
    const byType = {
      feature: items.filter(i => i.type === 'feature').length,
      bug: items.filter(i => i.type === 'bug').length,
      general: items.filter(i => i.type === 'general').length,
    };

    const byStatus = {
      new: items.filter(i => i.status === 'new').length,
      reviewed: items.filter(i => i.status === 'reviewed').length,
      resolved: items.filter(i => i.status === 'resolved').length,
    };

    return { averageRating, total, byType, byStatus };
  }
};

const SEED_FEEDBACK: AdminFeedback[] = [
  {
    id: 'fb-1',
    timestamp: '2026-09-08T18:40:00Z',
    user: 'dev.builder@freelance.ph',
    type: 'feature',
    rating: 5,
    ratingLabel: 'Very Satisfied',
    message: 'The Crow’s Foot ERD notation is textbook exact! Could we also get automatic foreign key relationship line snapping between primary keys?',
    status: 'new'
  },
  {
    id: 'fb-2',
    timestamp: '2026-09-08T16:15:00Z',
    user: 'juan.delacruz@up.edu.ph',
    type: 'bug',
    rating: 3,
    ratingLabel: 'Neutral',
    message: 'Export to SVG sometimes cuts off long entity attribute names when exported at extreme 25% zoom levels.',
    status: 'reviewed'
  },
  {
    id: 'fb-3',
    timestamp: '2026-09-07T21:05:00Z',
    user: 'maria.santos@dlsu.edu.ph',
    type: 'general',
    rating: 5,
    ratingLabel: 'Very Satisfied',
    message: 'The freehand pencil curve smoothing feels organic and responsive. Great work on the retro-blueprint aesthetic!',
    status: 'resolved'
  },
  {
    id: 'fb-4',
    timestamp: '2026-09-07T14:20:00Z',
    user: 'paolo.reyes@techph.io',
    type: 'feature',
    rating: 4,
    ratingLabel: 'Satisfied',
    message: 'Would love an AWS / GCP cloud infrastructure shape library or icon set alongside the standard Flowchart nodes.',
    status: 'new'
  },
  {
    id: 'fb-5',
    timestamp: '2026-09-06T11:30:00Z',
    user: 'sofia.castro@gmail.com',
    type: 'general',
    rating: 4,
    ratingLabel: 'Satisfied',
    message: 'The highlighter stroke opacity works wonderfully over blueprint grid lines.',
    status: 'reviewed'
  },
  {
    id: 'fb-6',
    timestamp: '2026-09-05T09:45:00Z',
    user: 'student.helper@ust.edu.ph',
    type: 'bug',
    rating: 2,
    ratingLabel: 'Dissatisfied',
    message: 'Pinch-to-zoom on precision trackpads occasionally triggers browser back navigation if swiping too abruptly near canvas edges.',
    status: 'new'
  },
  {
    id: 'fb-7',
    timestamp: '2026-09-04T17:10:00Z',
    user: 'miguel.torres@gmail.com',
    type: 'feature',
    rating: 5,
    ratingLabel: 'Very Satisfied',
    message: 'Mermaid live editor roundtrip is seamless. Would be great to have a copy-to-clipboard button for the generated Mermaid code block.',
    status: 'resolved'
  }
];

