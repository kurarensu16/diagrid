import React from 'react';
import type { AdminTimeRange } from '../../services/adminService';
import { RefreshCw, Clock } from 'lucide-react';

export interface AdminDateRangeSelectorProps {
  timeRange: AdminTimeRange;
  onTimeRangeChange: (range: AdminTimeRange) => void;
  autoRefreshInterval: number; // 0 for off, or seconds (e.g. 30, 60, 300)
  onAutoRefreshIntervalChange: (interval: number) => void;
  lastRefreshed: Date | null;
  onRefresh: () => void;
  isLoading: boolean;
}

export const AdminDateRangeSelector: React.FC<AdminDateRangeSelectorProps> = ({
  timeRange,
  onTimeRangeChange,
  autoRefreshInterval,
  onAutoRefreshIntervalChange,
  lastRefreshed,
  onRefresh,
  isLoading,
}) => {
  const ranges: { value: AdminTimeRange; label: string }[] = [
    { value: '24h', label: '24 Hours' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: 'all', label: 'All Time' },
  ];

  const intervals = [
    { value: 0, label: 'Auto: Off' },
    { value: 30, label: '30s' },
    { value: 60, label: '60s' },
    { value: 300, label: '5m' },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-3 px-4 border border-line bg-paper-raised font-mono text-[12px]">
      {/* Time Range Pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-ink-soft uppercase tracking-wider font-bold mr-1 flex items-center gap-1">
          <Clock className="w-3 h-3 text-blueprint" />
          Range:
        </span>
        <div className="inline-flex border border-ink bg-paper p-0.5">
          {ranges.map((r) => {
            const isActive = timeRange === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => onTimeRangeChange(r.value)}
                className={`px-3 py-1 text-[11px] font-bold cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-ink text-paper'
                    : 'text-ink-soft hover:text-ink hover:bg-paper-raised'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Auto-Refresh + Refresh Button */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Auto Refresh Dropdown */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-ink-soft uppercase tracking-wider font-bold">
            Interval:
          </span>
          <select
            value={autoRefreshInterval}
            onChange={(e) => onAutoRefreshIntervalChange(Number(e.target.value))}
            className="border border-ink bg-paper px-2 py-1 text-[11px] text-ink font-mono focus:border-blueprint focus:outline-none cursor-pointer"
          >
            {intervals.map((int) => (
              <option key={int.value} value={int.value}>
                {int.label}
              </option>
            ))}
          </select>
        </div>

        {/* Last Refreshed Timestamp */}
        {lastRefreshed && (
          <span className="text-[10px] text-ink-soft hidden sm:inline">
            // synced:{' '}
            {lastRefreshed.toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        )}

        {/* Live Indicator */}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          LIVE
        </span>

        {/* Manual Refresh Button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1 border border-ink bg-paper hover:bg-paper-raised text-ink transition-colors cursor-pointer disabled:opacity-50"
          title="Refresh metrics"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blueprint' : ''}`} />
          <span className="font-bold text-[11px]">pull()</span>
        </button>
      </div>
    </div>
  );
};
