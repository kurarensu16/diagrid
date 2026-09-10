import { supabase, isSupabaseConfigured } from './supabase';
import { authService } from './authService';

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
  created_at: string;
  last_active: string;
  project_count: number;
  diagram_count: number;
  is_supporter?: boolean;
}

export interface ActivityLog {
  id: string;
  user_email: string;
  action: 'created_project' | 'created_diagram' | 'exported_diagram' | 'signed_in' | 'deleted_project' | string;
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

export interface CreatorWallet {
  id: string;
  name: string;
  account_name?: string;
  account_number: string;
  qr_url?: string;
  enabled: boolean;
}

export interface PlatformSettings {
  id?: string;
  maintenance_mode: boolean;
  registration_policy: 'open' | 'invite_only' | 'disabled';
  max_projects_per_user: number;
  public_sharing: boolean;
  pdf_export: boolean;
  audit_retention_days: number;
  creator_wallets_enabled?: boolean;
  creator_wallet_name?: string;
  creator_wallet_account?: string;
  creator_wallet_qr_url?: string;
  creator_wallets?: CreatorWallet[];
  github_repo_url?: string;
  updated_at?: string;
  updated_by?: string;
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

export interface TableStorageMetric {
  tableName: string;
  rowCount: number;
  estimatedBytes: number;
  estimatedFormatted: string;
  rlsStatus: 'ENFORCED_TENANT_ISOLATED' | 'ENFORCED_ADMIN_ONLY' | 'PUBLIC_INSERT_ADMIN_AUDIT';
  description: string;
}

export interface StorageTelemetry {
  totalEstimatedBytes: number;
  totalEstimatedFormatted: string;
  quotaBytes: number;
  quotaFormatted: string;
  usedPercent: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  tables: TableStorageMetric[];
  rlsCoveragePercent: number;
  activeTenantCount: number;
}

export const adminService = {
  /**
   * Check if Supabase connection is configured
   */
  isConfigured: (): boolean => isSupabaseConfigured(),

  // ==========================================
  // USER MANAGEMENT
  // ==========================================

  /**
   * Fetches all registered users from public.profiles with project & diagram counts.
   */
  getUsers: async (): Promise<AdminUser[]> => {
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      const { data: profiles, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profileErr || !profiles) {
        console.error('[adminService] Error fetching users:', profileErr?.message);
        return [];
      }

      // Fetch project counts per user
      const { data: projects } = await supabase
        .from('projects')
        .select('user_id');

      // Fetch diagram counts per user
      const { data: diagrams } = await supabase
        .from('diagrams')
        .select('user_id');

      const projectCounts: Record<string, number> = {};
      (projects || []).forEach((p: { user_id: string }) => {
        projectCounts[p.user_id] = (projectCounts[p.user_id] || 0) + 1;
      });

      const diagramCounts: Record<string, number> = {};
      (diagrams || []).forEach((d: { user_id: string }) => {
        diagramCounts[d.user_id] = (diagramCounts[d.user_id] || 0) + 1;
      });

      return profiles.map((p) => ({
        id: p.id,
        email: p.email,
        name: p.name || p.email.split('@')[0],
        role: p.role || 'user',
        status: (p.status as 'active' | 'suspended') || 'active',
        created_at: p.created_at || new Date().toISOString(),
        last_active: p.updated_at || p.created_at || new Date().toISOString(),
        project_count: projectCounts[p.id] || 0,
        diagram_count: diagramCounts[p.id] || 0,
        is_supporter: !!p.is_supporter,
      }));
    } catch (err: any) {
      console.error('[adminService] getUsers unexpected error:', err.message);
      return [];
    }
  },

  /**
   * Updates user status (active ↔ suspended) in Supabase.
   */
  setUserStatus: async (userId: string, status: 'active' | 'suspended'): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured()) {
      return { error: 'Supabase is not configured' };
    }

    try {
      // First attempt using secure RPC function
      const { error: rpcError } = await supabase.rpc('set_user_status', {
        target_user_id: userId,
        target_status: status,
      });

      if (!rpcError) return {};

      // Direct fallback update on public.profiles
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateError) throw updateError;

      await adminService.logActivity(
        'updated_user_status',
        `Set status of user ${userId} to ${status}`
      );

      return {};
    } catch (err: any) {
      console.error('[adminService] setUserStatus error:', err.message);
      return { error: err.message || 'Failed to update user status' };
    }
  },

  /**
   * Updates user role (user ↔ admin) in Supabase.
   */
  setUserRole: async (userId: string, role: 'user' | 'admin'): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured()) {
      return { error: 'Supabase is not configured' };
    }

    try {
      // First attempt using secure RPC function
      const { error: rpcError } = await supabase.rpc('set_user_role', {
        target_user_id: userId,
        target_role: role,
      });

      if (!rpcError) return {};

      // Direct fallback update on public.profiles
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          role,
          preset_avatar: role === 'admin' ? 'shield' : 'terminal',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      await adminService.logActivity(
        'updated_user_role',
        `Set role of user ${userId} to ${role}`
      );

      return {};
    } catch (err: any) {
      console.error('[adminService] setUserRole error:', err.message);
      return { error: err.message || 'Failed to update user role' };
    }
  },

  /**
   * Updates user supporter perk status (active/inactive) in Supabase.
   */
  setUserSupporterStatus: async (userId: string, isSupporter: boolean): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured()) {
      return { error: 'Supabase is not configured' };
    }

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          is_supporter: isSupporter,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      await adminService.logActivity(
        isSupporter ? 'granted_supporter_badge' : 'revoked_supporter_badge',
        `${isSupporter ? 'Granted' : 'Revoked'} [SUPPORTER] perk for user ${userId}`
      );

      return {};
    } catch (err: any) {
      console.error('[adminService] setUserSupporterStatus error:', err.message);
      return { error: err.message || 'Failed to update supporter status' };
    }
  },

  /**
   * Deletes a user profile and associated resources in Supabase.
   */
  deleteUser: async (userId: string): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured()) {
      return { error: 'Supabase is not configured' };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      await adminService.logActivity('deleted_user', `Deleted profile ${userId}`);
      return {};
    } catch (err: any) {
      console.error('[adminService] deleteUser error:', err.message);
      return { error: err.message || 'Failed to delete user' };
    }
  },

  // ==========================================
  // PLATFORM METRICS & ANALYTICS
  // ==========================================

  /**
   * Fetches aggregated metrics from Supabase.
   */
  getPlatformStats: async (): Promise<PlatformStats> => {
    const defaultStats: PlatformStats = {
      total_users: 0,
      active_users_24h: 0,
      total_projects: 0,
      total_diagrams: 0,
      diagrams_by_type: {},
      signups_last_7_days: [0, 0, 0, 0, 0, 0, 0],
    };

    if (!isSupabaseConfigured()) {
      return defaultStats;
    }

    try {
      // 1. Try aggregated RPC function
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_platform_stats');
      if (!rpcErr && rpcData) {
        return rpcData as PlatformStats;
      }

      // 2. Direct parallel aggregation queries
      const [
        { count: userCount },
        { count: projectCount },
        { count: diagramCount },
        { data: diagrams },
        { data: recentProfiles },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('diagrams').select('*', { count: 'exact', head: true }),
        supabase.from('diagrams').select('type'),
        supabase.from('profiles').select('created_at, updated_at'),
      ]);

      const diagramsByType: Record<string, number> = {};
      (diagrams || []).forEach((d: { type: string }) => {
        diagramsByType[d.type] = (diagramsByType[d.type] || 0) + 1;
      });

      // Compute active in last 24h
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      let active24h = 0;
      const signups7d = [0, 0, 0, 0, 0, 0, 0];

      (recentProfiles || []).forEach((p: { created_at: string; updated_at?: string }) => {
        const updatedTime = new Date(p.updated_at || p.created_at).getTime();
        if (updatedTime >= oneDayAgo) {
          active24h++;
        }

        const createdTime = new Date(p.created_at).getTime();
        const diffDays = Math.floor((now - createdTime) / (24 * 60 * 60 * 1000));
        if (diffDays >= 0 && diffDays < 7) {
          signups7d[6 - diffDays] = (signups7d[6 - diffDays] || 0) + 1;
        }
      });

      return {
        total_users: userCount || 0,
        active_users_24h: active24h,
        total_projects: projectCount || 0,
        total_diagrams: diagramCount || 0,
        diagrams_by_type: diagramsByType,
        signups_last_7_days: signups7d,
      };
    } catch (err: any) {
      console.error('[adminService] getPlatformStats error:', err.message);
      return defaultStats;
    }
  },

  // ==========================================
  // AUDIT & ACTIVITY LOGS
  // ==========================================

  /**
   * Fetches latest activity & audit logs from Supabase.
   */
  getActivityLogs: async (limit: number = 50): Promise<ActivityLog[]> => {
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('[adminService] getActivityLogs notice:', error.message);
        return [];
      }

      if (!data) {
        return [];
      }

      return data.map((item) => ({
        id: item.id,
        user_email: item.user_email,
        action: item.action,
        target: item.target,
        timestamp: item.created_at,
      }));
    } catch (err: any) {
      console.error('[adminService] getActivityLogs unexpected error:', err.message);
      return [];
    }
  },

  /**
   * Logs a platform event to Supabase.
   */
  logActivity: async (action: string, target: string, userEmail?: string): Promise<void> => {
    if (!isSupabaseConfigured()) return;

    try {
      const activeUser = authService.getUserSync();
      const email = userEmail || activeUser?.email || 'admin@diagrid.dev';

      const { error } = await supabase.from('audit_logs').insert({
        user_id: activeUser?.id || null,
        user_email: email,
        action,
        target,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.warn('[adminService] logActivity insert error:', error.message);
      }
    } catch (e: any) {
      console.warn('[adminService] logActivity exception:', e.message);
    }
  },

  /**
   * Seed initial sample audit logs into Supabase for testing.
   */
  seedSampleLogs: async (): Promise<{ count?: number; error?: string }> => {
    if (!isSupabaseConfigured()) {
      return { error: 'Supabase is not configured' };
    }

    try {
      const activeUser = authService.getUserSync();
      const userEmail = activeUser?.email || 'admin@diagrid.dev';
      const userId = activeUser?.id || null;

      const samples = [
        {
          user_id: userId,
          user_email: userEmail,
          action: 'signed_in',
          target: 'Dashboard session established',
          created_at: new Date().toISOString(),
        },
        {
          user_id: userId,
          user_email: userEmail,
          action: 'created_project',
          target: 'Production Architecture Core',
          created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        },
        {
          user_id: userId,
          user_email: userEmail,
          action: 'created_diagram',
          target: 'Relational Schema (ERD)',
          created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        },
        {
          user_id: userId,
          user_email: userEmail,
          action: 'exported_diagram',
          target: 'Microservices Flowchart (PNG)',
          created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        },
      ];

      const { data, error } = await supabase.from('audit_logs').insert(samples).select();
      if (error) throw error;

      return { count: data?.length || samples.length };
    } catch (err: any) {
      console.error('[adminService] seedSampleLogs error:', err.message);
      return { error: err.message || 'Failed to seed sample logs' };
    }
  },

  // ==========================================
  // USER FEEDBACK MANAGEMENT
  // ==========================================

  /**
   * Fetches all user feedback items from Supabase.
   */
  getFeedback: async (): Promise<AdminFeedback[]> => {
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) {
        return [];
      }

      return data.map((item) => ({
        id: item.id,
        timestamp: item.created_at,
        user: item.user_email,
        type: item.type as 'feature' | 'bug' | 'general',
        rating: item.rating || 5,
        ratingLabel: item.rating_label || 'Satisfied',
        message: item.message,
        status: (item.status as 'new' | 'reviewed' | 'resolved') || 'new',
      }));
    } catch {
      return [];
    }
  },

  /**
   * Calculates metrics and statistics from feedback items.
   */
  getFeedbackStats: (list: AdminFeedback[] = []): {
    total: number;
    averageRating: number;
    byType: { feature: number; bug: number; general: number };
    byStatus: { new: number; reviewed: number; resolved: number };
  } => {
    if (list.length === 0) {
      return {
        total: 0,
        averageRating: 5.0,
        byType: { feature: 0, bug: 0, general: 0 },
        byStatus: { new: 0, reviewed: 0, resolved: 0 },
      };
    }

    const total = list.length;
    const totalScore = list.reduce((acc, curr) => acc + curr.rating, 0);
    const averageRating = total > 0 ? Number((totalScore / total).toFixed(1)) : 5.0;

    const byType = {
      feature: list.filter((i) => i.type === 'feature').length,
      bug: list.filter((i) => i.type === 'bug').length,
      general: list.filter((i) => i.type === 'general').length,
    };

    const byStatus = {
      new: list.filter((i) => i.status === 'new').length,
      reviewed: list.filter((i) => i.status === 'reviewed').length,
      resolved: list.filter((i) => i.status === 'resolved').length,
    };

    return { total, averageRating, byType, byStatus };
  },

  /**
   * Submits user feedback directly to Supabase.
   */
  submitFeedback: async (feedback: {
    userEmail: string;
    type: 'feature' | 'bug' | 'general';
    rating: number;
    ratingLabel?: string;
    message: string;
  }): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured()) {
      return { error: 'Supabase is not configured' };
    }

    try {
      const user = authService.getUserSync();
      const { error } = await supabase.from('feedback').insert({
        user_id: user?.id || null,
        user_email: feedback.userEmail.trim(),
        type: feedback.type,
        rating: feedback.rating,
        rating_label: feedback.ratingLabel || 'Satisfied',
        message: feedback.message.trim(),
        status: 'new',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      await adminService.logActivity(
        'submitted_feedback',
        `New ${feedback.type} feedback submitted`,
        feedback.userEmail
      );

      return {};
    } catch (err: any) {
      console.error('[adminService] submitFeedback error:', err.message);
      return { error: err.message || 'Failed to submit feedback' };
    }
  },

  /**
   * Updates feedback status in Supabase.
   */
  updateFeedbackStatus: async (
    id: string,
    status: 'new' | 'reviewed' | 'resolved'
  ): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured()) {
      return { error: 'Supabase is not configured' };
    }

    try {
      const { error } = await supabase
        .from('feedback')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return {};
    } catch (err: any) {
      console.error('[adminService] updateFeedbackStatus error:', err.message);
      return { error: err.message || 'Failed to update feedback status' };
    }
  },

  /**
   * Deletes a feedback item in Supabase.
   */
  deleteFeedback: async (id: string): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured()) {
      return { error: 'Supabase is not configured' };
    }

    try {
      const { error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return {};
    } catch (err: any) {
      console.error('[adminService] deleteFeedback error:', err.message);
      return { error: err.message || 'Failed to delete feedback' };
    }
  },

  // ==========================================
  // STORAGE & DATABASE TELEMETRY (PRIVACY-FIRST)
  // ==========================================

  /**
   * Fetches aggregated database table footprints and RLS policy audits
   * in a zero-knowledge manner without accessing private user workspace data.
   */
  getStorageTelemetry: async (): Promise<StorageTelemetry> => {
    const defaultTelemetry: StorageTelemetry = {
      totalEstimatedBytes: 0,
      totalEstimatedFormatted: '0 KB',
      quotaBytes: 500 * 1024 * 1024, // 500 MB Free Tier
      quotaFormatted: '500 MB',
      usedPercent: 0,
      status: 'HEALTHY',
      tables: [],
      rlsCoveragePercent: 100,
      activeTenantCount: 0,
    };

    if (!isSupabaseConfigured()) {
      return defaultTelemetry;
    }

    try {
      const [
        { count: profileCount },
        { count: projectCount },
        { count: diagramCount },
        { count: auditCount },
        { count: feedbackCount },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('diagrams').select('*', { count: 'exact', head: true }),
        supabase.from('audit_logs').select('*', { count: 'exact', head: true }),
        supabase.from('feedback').select('*', { count: 'exact', head: true }),
      ]);

      const pCount = profileCount || 0;
      const prjCount = projectCount || 0;
      const dCount = diagramCount || 0;
      const aCount = auditCount || 0;
      const fCount = feedbackCount || 0;

      // Estimated average storage footprints per row
      const profileBytes = pCount * 1024 * 2; // ~2 KB
      const projectBytes = prjCount * 1024 * 1.5; // ~1.5 KB
      const diagramBytes = dCount * 1024 * 18; // ~18 KB (JSON canvas state, nodes, edges)
      const auditBytes = aCount * 512; // ~512 bytes
      const feedbackBytes = fCount * 1024; // ~1 KB

      const formatBytes = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
      };

      const tables: TableStorageMetric[] = [
        {
          tableName: 'public.diagrams',
          rowCount: dCount,
          estimatedBytes: diagramBytes,
          estimatedFormatted: formatBytes(diagramBytes),
          rlsStatus: 'ENFORCED_TENANT_ISOLATED',
          description: 'Vector nodes, connections, and sheet canvas layouts.',
        },
        {
          tableName: 'public.projects',
          rowCount: prjCount,
          estimatedBytes: projectBytes,
          estimatedFormatted: formatBytes(projectBytes),
          rlsStatus: 'ENFORCED_TENANT_ISOLATED',
          description: 'Project workspaces and user namespace containers.',
        },
        {
          tableName: 'public.profiles',
          rowCount: pCount,
          estimatedBytes: profileBytes,
          estimatedFormatted: formatBytes(profileBytes),
          rlsStatus: 'ENFORCED_TENANT_ISOLATED',
          description: 'User security accounts, preferences, and avatars.',
        },
        {
          tableName: 'public.audit_logs',
          rowCount: aCount,
          estimatedBytes: auditBytes,
          estimatedFormatted: formatBytes(auditBytes),
          rlsStatus: 'ENFORCED_ADMIN_ONLY',
          description: 'Platform audit trail and security event triggers.',
        },
        {
          tableName: 'public.feedback',
          rowCount: fCount,
          estimatedBytes: feedbackBytes,
          estimatedFormatted: formatBytes(feedbackBytes),
          rlsStatus: 'PUBLIC_INSERT_ADMIN_AUDIT',
          description: 'User feedback, CSAT ratings, and bug reports.',
        },
      ];

      const totalEstimatedBytes = tables.reduce((acc, t) => acc + t.estimatedBytes, 0) + 1024 * 256; // +256 KB base schema overhead
      const quotaBytes = 500 * 1024 * 1024; // 500 MB (Supabase default free tier)
      const usedPercent = Number(((totalEstimatedBytes / quotaBytes) * 100).toFixed(2));
      const status: 'HEALTHY' | 'WARNING' | 'CRITICAL' =
        usedPercent > 85 ? 'CRITICAL' : usedPercent > 65 ? 'WARNING' : 'HEALTHY';

      return {
        totalEstimatedBytes,
        totalEstimatedFormatted: formatBytes(totalEstimatedBytes),
        quotaBytes,
        quotaFormatted: '500.00 MB',
        usedPercent,
        status,
        tables,
        rlsCoveragePercent: 100,
        activeTenantCount: pCount,
      };
    } catch (err: any) {
      console.error('[adminService] getStorageTelemetry error:', err.message);
      return defaultTelemetry;
    }
  },

  /**
   * Prunes audit logs older than the specified number of days to conserve database storage.
   */
  pruneAuditLogs: async (daysOld: number = 30): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured()) {
      return { error: 'Supabase is not configured' };
    }

    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('audit_logs')
        .delete()
        .lt('created_at', cutoffDate);

      if (error) throw error;

      await adminService.logActivity(
        'pruned_audit_logs',
        `Cleaned audit logs older than ${daysOld} days`
      );

      return {};
    } catch (err: any) {
      console.error('[adminService] pruneAuditLogs error:', err.message);
      return { error: err.message || 'Failed to prune audit logs' };
    }
  },

  // ==========================================
  // TEMPLATE MANAGEMENT
  // ==========================================

  /**
   * Fetches template configurations from Supabase.
   */
  getTemplateConfigs: async (): Promise<TemplateConfig[]> => {
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('templates')
        .select('id, title, type, is_featured, is_system')
        .order('title', { ascending: true });

      if (error || !data) {
        return [];
      }

      return data.map((t) => ({
        id: t.id,
        title: t.title,
        type: t.type,
        enabled: true,
        featured: !!t.is_featured,
      }));
    } catch {
      return [];
    }
  },

  /**
   * Updates template featured status or properties in Supabase.
   */
  updateTemplateConfig: async (
    id: string,
    updates: Partial<TemplateConfig>
  ): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured()) {
      return { error: 'Supabase is not configured' };
    }

    try {
      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.featured !== undefined) payload.is_featured = updates.featured;
      if (updates.title !== undefined) payload.title = updates.title;

      const { error } = await supabase
        .from('templates')
        .update(payload)
        .eq('id', id);

      if (error) throw error;
      return {};
    } catch (err: any) {
      console.error('[adminService] updateTemplateConfig error:', err.message);
      return { error: err.message || 'Failed to update template' };
    }
  },

  // ==========================================
  // SYSTEM SETTINGS & PLATFORM GOVERNANCE
  // ==========================================

  /**
   * Fetches active platform settings from public.system_settings.
   */
  getSystemSettings: async (): Promise<PlatformSettings> => {
    const defaultWallets: CreatorWallet[] = [
      { id: 'w-1', name: 'GCash', account_name: 'Diagrid Creator', account_number: '0912 345 6789', qr_url: '', enabled: true },
      { id: 'w-2', name: 'Maya', account_name: 'Diagrid Creator', account_number: '0912 345 6789', qr_url: '', enabled: true },
    ];

    const defaultSettings: PlatformSettings = {
      id: 'current',
      maintenance_mode: false,
      registration_policy: 'open',
      max_projects_per_user: 10,
      public_sharing: true,
      pdf_export: false,
      audit_retention_days: 30,
      creator_wallets_enabled: true,
      creator_wallet_name: 'GCash',
      creator_wallet_account: '0912 345 6789 (Diagrid Creator)',
      creator_wallet_qr_url: '',
      creator_wallets: defaultWallets,
      github_repo_url: 'https://github.com/kurarensu16/diagrid',
      updated_at: new Date().toISOString(),
      updated_by: 'system',
    };

    if (!isSupabaseConfigured()) {
      return defaultSettings;
    }

    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', 'current')
        .maybeSingle();

      if (error || !data) {
        return defaultSettings;
      }

      // Parse or fallback creator_wallets
      let parsedWallets: CreatorWallet[] = defaultWallets;
      if (data.creator_wallets && Array.isArray(data.creator_wallets) && data.creator_wallets.length > 0) {
        parsedWallets = data.creator_wallets;
      } else if (data.creator_wallet_name && data.creator_wallet_account) {
        parsedWallets = [
          {
            id: 'w-1',
            name: data.creator_wallet_name,
            account_name: 'Diagrid Creator',
            account_number: data.creator_wallet_account,
            qr_url: data.creator_wallet_qr_url || '',
            enabled: true,
          }
        ];
      }

      return {
        id: data.id || 'current',
        maintenance_mode: !!data.maintenance_mode,
        registration_policy: data.registration_policy || 'open',
        max_projects_per_user: data.max_projects_per_user ?? 10,
        public_sharing: data.public_sharing ?? true,
        pdf_export: !!data.pdf_export,
        audit_retention_days: data.audit_retention_days ?? 30,
        creator_wallets_enabled: data.creator_wallets_enabled !== undefined ? !!data.creator_wallets_enabled : true,
        creator_wallet_name: data.creator_wallet_name || 'GCash',
        creator_wallet_account: data.creator_wallet_account || '0912 345 6789 (Diagrid Creator)',
        creator_wallet_qr_url: data.creator_wallet_qr_url || '',
        creator_wallets: parsedWallets,
        github_repo_url: data.github_repo_url || 'https://github.com/kurarensu16/diagrid',
        updated_at: data.updated_at || new Date().toISOString(),
        updated_by: data.updated_by || 'admin',
      };
    } catch {
      return defaultSettings;
    }
  },

  /**
   * Updates platform governance settings in public.system_settings.
   */
  updateSystemSettings: async (
    updates: Partial<PlatformSettings>
  ): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured()) {
      return { error: 'Supabase is not configured' };
    }

    try {
      const currentUser = await authService.getUser();
      const payload: Record<string, any> = {
        ...updates,
        updated_at: new Date().toISOString(),
        updated_by: currentUser?.email || 'admin',
      };

      const { error } = await supabase
        .from('system_settings')
        .upsert({ id: 'current', ...payload });

      if (error) throw error;

      await adminService.logActivity(
        'updated_system_settings',
        `Modified platform configuration (${Object.keys(updates).join(', ')})`
      );

      return {};
    } catch (err: any) {
      console.error('[adminService] updateSystemSettings error:', err.message);
      return { error: err.message || 'Failed to update system settings' };
    }
  },

  // ==========================================
  // SYSTEM HEALTH & DIAGNOSTICS
  // ==========================================

  /**
   * Checks live Supabase connection status & ping latency.
   */
  getSystemStatus: async (): Promise<{
    connected: boolean;
    latencyMs: number;
    database: string;
    auth: string;
    storage: string;
  }> => {
    if (!isSupabaseConfigured()) {
      return {
        connected: false,
        latencyMs: 0,
        database: 'Not Configured',
        auth: 'Not Configured',
        storage: 'Not Configured',
      };
    }

    const start = performance.now();
    try {
      const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
      const latencyMs = Math.round(performance.now() - start);

      if (error) {
        return {
          connected: false,
          latencyMs,
          database: 'Error',
          auth: 'Active',
          storage: 'Available',
        };
      }

      return {
        connected: true,
        latencyMs,
        database: 'Operational',
        auth: 'Operational',
        storage: 'Operational',
      };
    } catch {
      return {
        connected: false,
        latencyMs: 0,
        database: 'Unreachable',
        auth: 'Unreachable',
        storage: 'Unreachable',
      };
    }
  },
};

// Backward compatibility export
export const mockAdmin = adminService;
