import React, { useState, useEffect } from 'react';
import { adminService, type SystemBroadcast } from '../../services/adminService';
import { Info, AlertTriangle, AlertOctagon, X } from 'lucide-react';

export const BroadcastBanner: React.FC = () => {
  const [notice, setNotice] = useState<SystemBroadcast | null>(() =>
    adminService.getBroadcastNotice()
  );
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = adminService.onBroadcastChange((updated) => {
      setNotice(updated);
      setIsDismissed(false);
    });
    return unsubscribe;
  }, []);

  if (!notice || !notice.active || isDismissed) {
    return null;
  }

  // Check if this specific notice was dismissed in this session
  if (sessionStorage.getItem(`diagrid_dismissed_broadcast_${notice.id}`)) {
    return null;
  }

  const handleDismiss = () => {
    sessionStorage.setItem(`diagrid_dismissed_broadcast_${notice.id}`, 'true');
    setIsDismissed(true);
  };

  const isMaintenance = notice.type === 'maintenance';
  const isWarning = notice.type === 'warning';

  const containerBg = isMaintenance
    ? 'bg-signal text-white border-b-2 border-ink'
    : isWarning
    ? 'bg-amber-500 text-ink border-b-2 border-ink font-semibold'
    : 'bg-blueprint text-white border-b-2 border-ink';

  const Icon = isMaintenance ? AlertOctagon : isWarning ? AlertTriangle : Info;

  return (
    <div
      role="alert"
      className={`w-full py-2 px-4 flex items-center justify-between gap-3 font-mono text-[12px] z-50 select-none shadow-sm transition-all ${containerBg}`}
    >
      <div className="flex items-center gap-2.5 overflow-hidden">
        <span className="flex items-center gap-1.5 shrink-0 uppercase tracking-wider font-bold text-[11px] px-1.5 py-0.2 border border-current bg-black/10">
          <Icon className="w-3.5 h-3.5 shrink-0" />
          // {notice.type}
        </span>
        <span className="truncate">{notice.message}</span>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        className="p-1 hover:bg-black/15 rounded-xs cursor-pointer shrink-0 transition-colors"
        title="Dismiss notice"
        aria-label="Dismiss notice"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
