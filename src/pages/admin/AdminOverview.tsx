import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '../../components/ui/Card';
import {
  adminService,
  type PlatformStats,
  type ActivityLog,
  type AdminTimeRange,
} from '../../services/adminService';
import { Users, Folder, FileText, Activity, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AdminKpiCard } from '../../components/admin/AdminKpiCard';
import { AdminDateRangeSelector } from '../../components/admin/AdminDateRangeSelector';
import { AdminGrowthChart } from '../../components/admin/AdminGrowthChart';
import { AdminSystemHealth } from '../../components/admin/AdminSystemHealth';
import { AdminQuickActions } from '../../components/admin/AdminQuickActions';

export const AdminOverview: React.FC = () => {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<AdminTimeRange>('7d');
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(60); // default 60s
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchMetrics = useCallback(
    async (range: AdminTimeRange = timeRange, isBackground = false) => {
      if (!isBackground) setLoading(true);
      try {
        const [s, logs] = await Promise.all([
          adminService.getPlatformStats(range),
          adminService.getActivityLogs(6),
        ]);
        setStats(s);
        setRecentLogs(logs);
        setLastRefreshed(new Date());
      } catch (err) {
        console.error('Failed to fetch platform metrics:', err);
      } finally {
        if (!isBackground) setLoading(false);
      }
    },
    [timeRange]
  );

  // Initial load and time range changes
  useEffect(() => {
    void fetchMetrics(timeRange, false);
  }, [fetchMetrics, timeRange]);

  // Auto-refresh interval timer
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (autoRefreshInterval > 0) {
      timerRef.current = setInterval(() => {
        void fetchMetrics(timeRange, true);
      }, autoRefreshInterval * 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefreshInterval, fetchMetrics, timeRange]);

  if (loading && !stats) {
    return (
      <div className="p-16 flex flex-col items-center justify-center gap-3 text-ink-soft font-mono">
        <Loader2 className="w-6 h-6 animate-spin text-blueprint" />
        <span>// loading_platform_metrics()...</span>
      </div>
    );
  }

  if (!stats) return null;

  // Find max value in diagram type count to calculate percentage bars
  const diagramCounts = Object.values(stats.diagrams_by_type);
  const maxDiagramCount = diagramCounts.length > 0 ? Math.max(...diagramCounts, 1) : 1;

  return (
    <div className="p-6 sm:p-8 flex flex-col gap-6 text-ink max-w-[1440px] mx-auto">
      {/* Header & Quick Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight">
            overview
          </h1>
          <p className="text-[12px] sm:text-[13px] text-ink-soft font-mono mt-0.5">
            // platform metrics and system telemetry
          </p>
        </div>
        <AdminQuickActions />
      </div>

      {/* Global Filter Bar: Time Range & Auto-Refresh */}
      <AdminDateRangeSelector
        timeRange={timeRange}
        onTimeRangeChange={(r) => setTimeRange(r)}
        autoRefreshInterval={autoRefreshInterval}
        onAutoRefreshIntervalChange={(sec) => setAutoRefreshInterval(sec)}
        lastRefreshed={lastRefreshed}
        onRefresh={() => void fetchMetrics(timeRange, false)}
        isLoading={loading}
      />

      {/* Top Grid: KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <AdminKpiCard
          label="total_users"
          value={stats.total_users}
          deltaPct={stats.user_growth_pct}
          deltaLabel="vs last period"
          icon={Users}
          variant="blueprint"
          sparklineData={stats.signups_last_7_days}
        />

        <AdminKpiCard
          label="active_24h"
          value={stats.active_users_24h}
          deltaPct={stats.active_users_24h > 0 ? 5.8 : 0}
          deltaLabel="concurrency"
          icon={Activity}
          variant="signal"
          subtext="// active sessions today"
        />

        <AdminKpiCard
          label="total_projects"
          value={stats.total_projects}
          deltaPct={stats.projects_growth_pct}
          deltaLabel="vs last period"
          icon={Folder}
          variant="ink"
          subtext="// project workspaces"
        />

        <AdminKpiCard
          label="total_diagrams"
          value={stats.total_diagrams}
          deltaPct={stats.diagrams_growth_pct}
          deltaLabel="vs last period"
          icon={FileText}
          variant="blueprint"
          sparklineData={stats.time_series?.map((t) => t.diagrams)}
        />
      </div>

      {/* Analytics Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interactive Growth Trajectory Chart */}
        <AdminGrowthChart
          data={stats.time_series || []}
          title="platform_activity_trend"
          subtitle="// interactive volume analysis for developer signups and diagram sheets"
        />

        {/* Diagrams by Type Distribution Card */}
        <Card variant="ink" className="p-6 flex flex-col gap-4">
          <div className="flex justify-between items-start border-b border-line pb-3">
            <div>
              <h2 className="text-[18px] font-bold tracking-tight text-ink">diagrams_by_type</h2>
              <p className="text-[11px] text-ink-soft font-mono mt-0.5">
                // distribution of created visual sheets
              </p>
            </div>
            <div className="font-mono text-[11px] font-bold px-2 py-0.5 border border-line bg-paper-raised text-ink">
              {stats.total_diagrams} total
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-1">
            {Object.entries(stats.diagrams_by_type).map(([type, count]) => {
              const pct = maxDiagramCount > 0 ? (count / maxDiagramCount) * 100 : 0;
              const percentOfTotal =
                stats.total_diagrams > 0 ? Math.round((count / stats.total_diagrams) * 100) : 0;

              return (
                <div key={type} className="flex flex-col gap-1.5 font-mono text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="uppercase font-bold text-ink">{type}</span>
                    <span className="text-ink-soft">
                      <strong className="text-ink">{count}</strong> units ({percentOfTotal}%)
                    </span>
                  </div>
                  {/* Visual Bar */}
                  <div className="w-full h-5 border border-line bg-paper overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full bg-blueprint border-r border-ink transition-all duration-300"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Diagnostics & Recent Events Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Health & Storage Telemetry */}
        <AdminSystemHealth
          healthMetrics={stats.health_metrics}
          storageUsedBytes={stats.storage_used_bytes}
          storageQuotaBytes={stats.storage_quota_bytes}
          unresolvedFeedbackCount={stats.unresolved_feedback_count}
        />

        {/* Real-time Activity Feed */}
        <Card variant="blueprint" className="p-6 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-line pb-3">
              <div>
                <h2 className="text-[18px] font-bold tracking-tight text-ink">recent_events</h2>
                <p className="text-[11px] text-ink-soft font-mono mt-0.5">
                  // live stream of developer activity across the platform
                </p>
              </div>
              <Link
                to="/admin/activity"
                className="font-mono text-[11px] text-blueprint hover:underline"
              >
                view_all_logs()
              </Link>
            </div>

            <div className="flex flex-col gap-3 font-mono text-[12px]">
              {recentLogs.length === 0 ? (
                <div className="text-ink-soft text-[11px] py-4 text-center">
                  // no_recent_events_logged
                </div>
              ) : (
                recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex justify-between items-start gap-4 border-b border-line border-dashed pb-2.5 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      <span className="text-ink font-bold break-all text-[11px]">
                        {log.user_email}
                      </span>
                      <span className="text-ink-soft text-[11px] truncate">
                        {log.action === 'created_project'
                          ? 'created project'
                          : log.action === 'created_diagram'
                          ? 'created diagram'
                          : log.action === 'exported_diagram'
                          ? 'exported'
                          : log.action === 'signed_in'
                          ? 'signed in'
                          : log.action.replace(/_/g, ' ')}
                        :{' '}
                        <span className="text-blueprint font-bold">{log.target}</span>
                      </span>
                    </div>
                    <span className="text-ink-soft text-[10px] shrink-0 pt-0.5">
                      {new Date(log.timestamp).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
