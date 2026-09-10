import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { adminService, type PlatformStats, type ActivityLog } from '../../services/adminService';
import { Users, Folder, FileText, Activity, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminOverview: React.FC = () => {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      adminService.getPlatformStats(),
      adminService.getActivityLogs(5)
    ]).then(([s, logs]) => {
      if (isMounted) {
        setStats(s);
        setRecentLogs(logs);
        setLoading(false);
      }
    }).catch(() => {
      if (isMounted) setLoading(false);
    });
    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3 text-ink-soft font-mono">
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
    <div className="p-8 flex flex-col gap-6 text-ink">
      {/* Header */}
      <div className="border-b border-line pb-6">
        <h1 className="text-[32px] font-bold tracking-tight">platform_overview</h1>
        <p className="text-[13px] text-ink-soft font-mono mt-1">// real-time platform diagnostics and metrics aggregation</p>
      </div>

      {/* Grid statistics cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card variant="blueprint" className="p-6 flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] text-ink-soft uppercase">// total_users</span>
            <span className="text-[36px] font-bold leading-none tracking-tight">{stats.total_users}</span>
          </div>
          <Users className="w-5 h-5 text-blueprint shrink-0 mt-0.5" />
        </Card>

        <Card variant="signal" className="p-6 flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] text-ink-soft uppercase">// active_24h</span>
            <span className="text-[36px] font-bold leading-none tracking-tight text-signal">{stats.active_users_24h}</span>
          </div>
          <Activity className="w-5 h-5 text-signal shrink-0 mt-0.5" />
        </Card>

        <Card variant="ink" className="p-6 flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] text-ink-soft uppercase">// total_projects</span>
            <span className="text-[36px] font-bold leading-none tracking-tight">{stats.total_projects}</span>
          </div>
          <Folder className="w-5 h-5 text-ink shrink-0 mt-0.5" />
        </Card>

        <Card variant="blueprint" className="p-6 flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] text-ink-soft uppercase">// total_diagrams</span>
            <span className="text-[36px] font-bold leading-none tracking-tight">{stats.total_diagrams}</span>
          </div>
          <FileText className="w-5 h-5 text-blueprint shrink-0 mt-0.5" />
        </Card>
      </div>

      {/* Analytics breakdown columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
        {/* Diagrams type list metrics bar chart */}
        <Card variant="ink" className="p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-[18px] font-bold tracking-tight">diagrams_by_type</h2>
            <p className="text-[11px] text-ink-soft font-mono mt-0.5">// distribution of created canvas sheets</p>
          </div>

          <div className="flex flex-col gap-3.5 mt-2">
            {Object.entries(stats.diagrams_by_type).map(([type, count]) => {
              const pct = maxDiagramCount > 0 ? (count / maxDiagramCount) * 100 : 0;
              return (
                <div key={type} className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center font-mono text-[11px]">
                    <span className="uppercase font-bold text-ink">{type}</span>
                    <span className="text-ink-soft">{count} units</span>
                  </div>
                  {/* Bar */}
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

        {/* Right column: Signups trend + Activity feed */}
        <div className="flex flex-col gap-6">
          {/* Signups trend: 7-day sparkline bar chart */}
          <Card variant="signal" className="p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-[18px] font-bold tracking-tight text-signal">signups_trend</h2>
                <p className="text-[11px] text-ink-soft font-mono mt-0.5">// new developer registrations (last 7 days)</p>
              </div>
              <div className="font-mono text-[12px] font-bold text-[#D45B33] dark:text-[#F78166] bg-[#FDF2EC] dark:bg-[#2C1610] border border-signal px-2 py-0.5">
                +{stats.signups_last_7_days.reduce((a, b) => a + b, 0)} total
              </div>
            </div>

            <div className="pt-4 pb-2">
              <div className="flex items-end justify-between gap-3 h-32 border-b border-line pb-2">
                {stats.signups_last_7_days.map((val, idx) => {
                  const maxVal = Math.max(...stats.signups_last_7_days, 1);
                  const heightPct = Math.max((val / maxVal) * 100, 10);
                  const dayLabels = ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'today'];
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                      <span className="font-mono text-[10px] text-ink-soft group-hover:text-signal font-bold transition-colors">
                        {val}
                      </span>
                      <div className="w-full max-w-[36px] bg-paper-raised border border-line overflow-hidden flex items-end">
                        <div 
                          style={{ height: `${heightPct}%` }}
                          className="w-full bg-signal group-hover:opacity-80 transition-all border-t border-ink"
                        />
                      </div>
                      <span className="font-mono text-[10px] text-ink-soft uppercase group-hover:text-ink">
                        {dayLabels[idx]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Activity log summary feed */}
          <Card variant="blueprint" className="p-6 flex flex-col justify-between flex-1">
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-line pb-3">
                <div>
                  <h2 className="text-[18px] font-bold tracking-tight">recent_events</h2>
                  <p className="text-[11px] text-ink-soft font-mono mt-0.5">// latest actions across the platform</p>
                </div>
                <Link 
                  to="/admin/activity" 
                  className="font-mono text-[11px] text-blueprint hover:underline"
                >
                  view_all_logs()
                </Link>
              </div>

              <div className="flex flex-col gap-3 font-mono text-[12px] mt-2">
                {recentLogs.map((log) => (
                  <div key={log.id} className="flex justify-between items-start gap-4 border-b border-line border-dashed pb-2.5 last:border-0 last:pb-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-ink font-bold break-all">{log.user_email}</span>
                      <span className="text-ink-soft">
                        {log.action === 'created_project' ? 'created project' : 
                         log.action === 'created_diagram' ? 'created diagram' : 
                         log.action === 'exported_diagram' ? 'exported' : 
                         log.action === 'signed_in' ? 'signed in' : 'deleted project'}:{' '}
                        <span className="text-blueprint font-bold">{log.target}</span>
                      </span>
                    </div>
                    <span className="text-ink-soft text-[10px] shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
