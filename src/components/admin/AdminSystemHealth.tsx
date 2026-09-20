import React from 'react';
import { Card } from '../ui/Card';
import type { PlatformHealthMetric } from '../../services/adminService';
import { ShieldCheck, AlertTriangle, XCircle, HardDrive, ArrowRight, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface AdminSystemHealthProps {
  healthMetrics?: PlatformHealthMetric[];
  storageUsedBytes?: number;
  storageQuotaBytes?: number;
  unresolvedFeedbackCount?: number;
}

export const AdminSystemHealth: React.FC<AdminSystemHealthProps> = ({
  healthMetrics = [],
  storageUsedBytes = 42_800_000,
  storageQuotaBytes = 524_288_000, // 500 MB
  unresolvedFeedbackCount = 0,
}) => {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = (bytes / Math.pow(k, i)).toFixed(2);
    return `${val} ${sizes[i]}`;
  };

  const rawPct = (storageUsedBytes / (storageQuotaBytes || 1)) * 100;
  const storagePctFormatted = rawPct < 1 && rawPct > 0 ? `${rawPct.toFixed(2)}%` : `${Math.round(rawPct)}%`;
  const storagePct = Math.min(Math.round(rawPct), 100);
  const barWidthPct = Math.max(Math.min(rawPct, 100), rawPct > 0 ? 1.5 : 0);

  return (
    <Card variant="blueprint" className="p-6 flex flex-col justify-between gap-6">
      {/* Header */}
      <div className="flex justify-between items-start border-b border-line pb-3">
        <div>
          <h2 className="text-[18px] font-bold tracking-tight text-ink flex items-center gap-2">
            <Activity className="w-4 h-4 text-blueprint" />
            system_diagnostics
          </h2>
          <p className="text-[11px] text-ink-soft font-mono mt-0.5">
            // infrastructure telemetry and storage health
          </p>
        </div>
        <Link
          to="/admin/system"
          className="font-mono text-[11px] text-blueprint hover:underline flex items-center gap-1"
        >
          <span>full_diagnostics()</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Storage allocation progress bar */}
      <div className="flex flex-col gap-2 p-3.5 border border-line bg-paper">
        <div className="flex justify-between items-center font-mono text-[11px]">
          <span className="flex items-center gap-1.5 font-bold text-ink">
            <HardDrive className="w-3.5 h-3.5 text-blueprint" />
            Storage Allocation:
          </span>
          <span className="text-ink-soft">
            <strong className="text-ink">{formatBytes(storageUsedBytes)}</strong> /{' '}
            {formatBytes(storageQuotaBytes)} ({storagePctFormatted})
          </span>
        </div>
        <div className="w-full h-3 border border-line bg-paper-raised overflow-hidden">
          <div
            style={{ width: `${barWidthPct}%` }}
            className={`h-full transition-all duration-500 border-r border-ink ${
              storagePct > 85 ? 'bg-signal' : 'bg-blueprint'
            }`}
          />
        </div>
        <div className="flex justify-between font-mono text-[10px] text-ink-soft">
          <span>Tier Limit: 500 MB</span>
          <Link to="/admin/storage" className="text-blueprint hover:underline">
            inspect_tables()
          </Link>
        </div>
      </div>

      {/* Health services list */}
      <div className="flex flex-col gap-2.5">
        <span className="font-mono text-[10px] text-ink-soft uppercase tracking-wider font-bold">
          // core_services_status
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {healthMetrics.map((service) => {
            const isHealthy = service.status === 'healthy';
            const isDegraded = service.status === 'degraded';

            return (
              <div
                key={service.id}
                className="flex items-center justify-between p-2.5 border border-line bg-paper font-mono text-[11px]"
              >
                <div className="flex items-center gap-2">
                  {isHealthy ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : isDegraded ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-signal shrink-0" />
                  )}
                  <span className="text-ink font-bold truncate max-w-[130px]">
                    {service.name}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {service.latencyMs > 0 && (
                    <span className="text-ink-soft text-[10px]">{service.latencyMs}ms</span>
                  )}
                  <span
                    className={`px-1.5 py-0.2 text-[9px] uppercase font-bold border ${
                      isHealthy
                        ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                        : isDegraded
                        ? 'border-amber-500/30 text-amber-600 bg-amber-500/10'
                        : 'border-signal/30 text-signal bg-signal/10'
                    }`}
                  >
                    {service.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending feedback badge */}
      {unresolvedFeedbackCount > 0 && (
        <div className="flex items-center justify-between p-3 border border-amber-500/40 bg-amber-500/5 font-mono text-[11px]">
          <span className="text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            {unresolvedFeedbackCount} user feedback item(s) awaiting review
          </span>
          <Link to="/admin/feedback" className="text-blueprint hover:underline font-bold">
            review_now()
          </Link>
        </div>
      )}
    </Card>
  );
};
