import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { adminService, type StorageTelemetry } from '../../services/adminService';
import { 
  Database, 
  Activity, 
  RefreshCw, 
  Trash2, 
  HardDrive, 
  CheckCircle2, 
  Sparkles,
  FileText,
  Folder,
  Server
} from 'lucide-react';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

export const AdminStorage: React.FC = () => {
  const [telemetry, setTelemetry] = useState<StorageTelemetry | null>(null);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [, setIsPruning] = useState(false);
  const [pruneModalOpen, setPruneModalOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    void loadTelemetry();
  }, []);

  const loadTelemetry = async () => {
    setIsLoading(true);
    try {
      const [storageData, systemStatus] = await Promise.all([
        adminService.getStorageTelemetry(),
        adminService.getSystemStatus(),
      ]);
      setTelemetry(storageData);
      setLatencyMs(systemStatus.latencyMs);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePruneLogs = async () => {
    setIsPruning(true);
    try {
      const res = await adminService.pruneAuditLogs(30);
      if (res.error) {
        showNotice(`Pruning failed: ${res.error}`);
      } else {
        showNotice('Successfully pruned audit log entries older than 30 days.');
        await loadTelemetry();
      }
    } finally {
      setIsPruning(false);
      setPruneModalOpen(false);
    }
  };

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  if (isLoading && !telemetry) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3 text-ink-soft font-mono">
        <RefreshCw className="w-6 h-6 animate-spin text-blueprint" />
        <span>// querying_storage_telemetry()...</span>
      </div>
    );
  }

  const data = telemetry || {
    totalEstimatedBytes: 0,
    totalEstimatedFormatted: '0 KB',
    quotaBytes: 500 * 1024 * 1024,
    quotaFormatted: '500.00 MB',
    usedPercent: 0,
    status: 'HEALTHY' as const,
    tables: [],
    totalDiagrams: 0,
    totalProjects: 0,
    totalUsers: 0,
  };

  return (
    <div className="p-8 flex flex-col gap-6 text-ink select-none">
      {/* Header */}
      <div className="border-b border-line pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight">storage_telemetry</h1>
          <p className="text-[13px] text-ink-soft font-mono mt-1">
            // monitor database capacity, table distribution, and storage utilization
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void loadTelemetry()}
            disabled={isLoading}
            className="flex items-center gap-1.5 font-mono text-[11px] border border-line px-3 py-1.5 hover:border-ink hover:bg-paper-raised transition-colors cursor-pointer"
            title="Refresh database telemetry metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            sync_telemetry()
          </button>
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="bg-blueprint/10 border border-blueprint text-blueprint px-4 py-2.5 font-mono text-[12px] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>STATUS: {actionNotice}</span>
        </div>
      )}

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Storage Quota */}
        <Card variant="blueprint" className="p-5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between font-mono text-[11px] text-ink-soft">
            <span>STORAGE_CAPACITY</span>
            <HardDrive className="w-4 h-4 text-blueprint" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-bold font-mono text-ink">
              {data.totalEstimatedFormatted}
            </span>
            <span className="font-mono text-[11px] text-ink-soft">/ {data.quotaFormatted}</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-paper border border-line overflow-hidden">
            <div 
              style={{ width: `${Math.max(data.usedPercent, 1.5)}%` }} 
              className="h-full bg-blueprint transition-all duration-500" 
            />
          </div>
          <div className="flex justify-between items-center font-mono text-[10px] text-ink-soft">
            <span>{data.usedPercent}% utilized</span>
            <span className="text-emerald-800 dark:text-emerald-400 font-bold border border-emerald-600/40 px-1 py-0.2 bg-emerald-500/10">
              [{data.status}]
            </span>
          </div>
        </Card>

        {/* Card 2: Total Stored Diagrams */}
        <Card variant="blueprint" className="p-5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between font-mono text-[11px] text-ink-soft">
            <span>STORED_DIAGRAMS</span>
            <FileText className="w-4 h-4 text-blueprint" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-bold font-mono text-ink">
              {data.totalDiagrams}
            </span>
            <span className="font-mono text-[11px] text-ink-soft">diagrams</span>
          </div>
          <p className="font-mono text-[10.5px] text-ink-soft leading-tight">
            Vector nodes, connector edges, and serialized JSON canvas state payloads.
          </p>
        </Card>

        {/* Card 3: Active Projects */}
        <Card variant="signal" className="p-5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between font-mono text-[11px] text-ink-soft">
            <span>PROJECT_CONTAINERS</span>
            <Folder className="w-4 h-4 text-signal" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-bold font-mono text-signal">
              {data.totalProjects}
            </span>
            <span className="font-mono text-[11px] text-ink-soft">workspaces</span>
          </div>
          <p className="font-mono text-[10.5px] text-ink-soft leading-tight">
            User project namespaces grouping multiple architecture and flow diagrams.
          </p>
        </Card>

        {/* Card 4: Database Latency */}
        <Card variant="ink" className="p-5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between font-mono text-[11px] text-ink-soft">
            <span>DATABASE_LATENCY</span>
            <Activity className="w-4 h-4 text-ink" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-bold font-mono text-ink">
              {latencyMs}ms
            </span>
            <span className="font-mono text-[10px] text-emerald-800 dark:text-emerald-400 border border-emerald-600/40 px-1 py-0.2 bg-emerald-500/10 font-bold">
              OPERATIONAL
            </span>
          </div>
          <p className="font-mono text-[10.5px] text-ink-soft leading-tight">
            Supabase Managed PostgreSQL response latency for transactional queries.
          </p>
        </Card>
      </div>

      {/* Main Table Distribution Breakdown */}
      <Card variant="blueprint" className="p-6 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-line pb-4">
          <div>
            <h2 className="text-[18px] font-bold tracking-tight">table_distribution & storage_weight</h2>
            <p className="text-[11px] text-ink-soft font-mono mt-0.5">
              // database table footprints and estimated disk usage
            </p>
          </div>
          <div className="font-mono text-[11px] text-ink-soft flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-blueprint" />
            <span>ENCRYPTION: AES-256 AT REST</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-[12px]">
            <thead>
              <tr className="border-b border-line bg-paper text-ink-soft font-bold">
                <th className="p-3.5 uppercase tracking-wide">database_table</th>
                <th className="p-3.5 uppercase tracking-wide text-center">total_rows</th>
                <th className="p-3.5 uppercase tracking-wide text-center">disk_weight</th>
                <th className="p-3.5 uppercase tracking-wide">table_purpose</th>
              </tr>
            </thead>
            <tbody>
              {data.tables.map((t) => (
                <tr key={t.tableName} className="border-b border-line last:border-0 hover:bg-paper hover:bg-opacity-40">
                  <td className="p-3.5 font-bold text-ink flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-blueprint shrink-0" />
                    <span>{t.tableName}</span>
                  </td>
                  <td className="p-3.5 text-center font-bold text-ink">
                    {t.rowCount}
                  </td>
                  <td className="p-3.5 text-center text-ink-soft font-bold">
                    {t.estimatedFormatted}
                  </td>
                  <td className="p-3.5 text-ink-soft text-[11px]">
                    {t.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Storage Maintenance & Guidelines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Maintenance Utilities */}
        <Card variant="blueprint" className="p-6 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[15px] font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blueprint" />
              storage_maintenance_utilities()
            </h3>
            <p className="font-mono text-[11px] text-ink-soft leading-relaxed">
              Execute routine database hygiene routines to clean stale audit trails and optimize storage allocation.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => setPruneModalOpen(true)}
              className="flex items-center gap-1.5 font-mono text-[11px] border border-signal text-signal hover:bg-signal hover:text-paper px-3.5 py-2 transition-colors cursor-pointer uppercase font-bold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              prune_old_audit_logs(30d)
            </button>
          </div>
        </Card>

        {/* Storage Guidelines Card */}
        <Card variant="ink" className="p-6 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-blueprint" />
            <h3 className="font-mono text-[15px] font-bold tracking-tight">
              storage_guidelines
            </h3>
          </div>

          <div className="font-mono text-[11.5px] text-ink-soft flex flex-col gap-2 leading-relaxed">
            <div className="border-b border-line border-dashed pb-2">
              <strong className="text-ink">1. Free Tier Quota:</strong> Standard capacity is capped at 500.00 MB across all JSON canvas state payloads and relational tables.
            </div>
            <div className="border-b border-line border-dashed pb-2">
              <strong className="text-ink">2. Audit Retention:</strong> Pruning audit logs older than 30 days regularly frees table weight without impacting active diagrams or user workspaces.
            </div>
            <div>
              <strong className="text-ink">3. JSON Serialization:</strong> Diagrams are serialized into compact node/edge structures to minimize disk storage overhead.
            </div>
          </div>
        </Card>
      </div>

      {/* Prune Confirmation Modal */}
      <ConfirmModal
        isOpen={pruneModalOpen}
        onClose={() => setPruneModalOpen(false)}
        onConfirm={handlePruneLogs}
        title="PRUNE_AUDIT_LOGS"
        message="Prune audit event logs older than 30 days?"
        description="This will permanently delete historical audit log records older than 30 days to free up PostgreSQL storage. Active user projects and diagrams will NOT be affected."
        confirmText="Confirm Prune"
      />
    </div>
  );
};
