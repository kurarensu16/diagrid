import React, { useState, useEffect } from 'react';
import { Megaphone, Download, X, Check, Trash2 } from 'lucide-react';
import { adminService, type SystemBroadcast } from '../../services/adminService';

export const AdminQuickActions: React.FC = () => {
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState<'info' | 'warning' | 'maintenance'>('info');
  const [isSent, setIsSent] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeNotice, setActiveNotice] = useState<SystemBroadcast | null>(() =>
    adminService.getBroadcastNotice()
  );

  useEffect(() => {
    const unsubscribe = adminService.onBroadcastChange((updated) => {
      setActiveNotice(updated);
    });
    return unsubscribe;
  }, []);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;

    await adminService.setBroadcastNotice({
      type: broadcastType,
      message: broadcastMessage.trim(),
      active: true,
    });

    setIsSent(true);
    setTimeout(() => {
      setIsSent(false);
      setIsBroadcastOpen(false);
      setBroadcastMessage('');
    }, 1200);
  };

  const handleClearBroadcast = async () => {
    await adminService.setBroadcastNotice(null);
  };

  const handleExportAuditLogs = async () => {
    setIsExporting(true);
    try {
      const logs = await adminService.getActivityLogs(200);
      const csvHeader = 'ID,User Email,Action,Target,Timestamp\n';
      const csvRows = logs
        .map(
          (l) =>
            `"${l.id}","${l.user_email}","${l.action}","${l.target.replace(/"/g, '""')}","${l.timestamp}"`
        )
        .join('\n');

      const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diagrid_audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export audit logs:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5 font-mono text-[11px]">
        {/* Active Broadcast Indicator & Clear Button */}
        {activeNotice && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 border border-signal/40 bg-signal/10 text-signal font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
            <span className="truncate max-w-[180px]" title={activeNotice.message}>
              broadcast: {activeNotice.message}
            </span>
            <button
              type="button"
              onClick={handleClearBroadcast}
              className="hover:text-ink cursor-pointer ml-1"
              title="Clear active notice"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Broadcast Announcement Button */}
        <button
          type="button"
          onClick={() => setIsBroadcastOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-ink bg-paper hover:bg-paper-raised text-ink transition-colors cursor-pointer font-bold"
        >
          <Megaphone className="w-3.5 h-3.5 text-signal" />
          <span>broadcast_notice()</span>
        </button>

        {/* Export Audit Log Button */}
        <button
          type="button"
          onClick={handleExportAuditLogs}
          disabled={isExporting}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-ink bg-paper hover:bg-paper-raised text-ink transition-colors cursor-pointer font-bold disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5 text-blueprint" />
          <span>{isExporting ? 'exporting...' : 'export_audit_csv()'}</span>
        </button>
      </div>

      {/* Broadcast Modal */}
      {isBroadcastOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md border-2 border-ink bg-paper p-6 shadow-xl flex flex-col gap-4 font-mono text-[12px]">
            <div className="flex justify-between items-center border-b border-line pb-3">
              <div className="flex items-center gap-2 font-bold text-[14px]">
                <Megaphone className="w-4 h-4 text-signal" />
                <span>broadcast_system_notice</span>
              </div>
              <button
                type="button"
                onClick={() => setIsBroadcastOpen(false)}
                className="text-ink-soft hover:text-ink cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-ink-soft leading-normal">
              Dispatches an immediate banner to all users active on the platform.
            </p>

            <form onSubmit={handleSendBroadcast} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-ink-soft uppercase font-bold">
                  // notice_type
                </label>
                <div className="grid grid-cols-3 border border-ink bg-paper">
                  {(['info', 'warning', 'maintenance'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setBroadcastType(type)}
                      className={`py-1.5 text-center uppercase text-[10px] font-bold cursor-pointer border-r last:border-r-0 border-ink ${
                        broadcastType === type
                          ? 'bg-ink text-paper'
                          : 'text-ink-soft hover:text-ink'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-ink-soft uppercase font-bold">
                  // message_content
                </label>
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="e.g. Scheduled database maintenance tonight at 02:00 UTC."
                  rows={3}
                  required
                  className="border border-ink bg-paper-raised p-2 text-ink text-[12px] font-mono focus:border-blueprint focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsBroadcastOpen(false)}
                  className="px-3 py-1.5 border border-line text-ink-soft hover:text-ink cursor-pointer"
                >
                  cancel()
                </button>
                <button
                  type="submit"
                  disabled={!broadcastMessage.trim() || isSent}
                  className="flex items-center gap-1.5 px-4 py-1.5 border border-ink bg-blueprint text-white font-bold cursor-pointer hover:opacity-90 disabled:opacity-50"
                >
                  {isSent ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>broadcast_live!</span>
                    </>
                  ) : (
                    <span>broadcast_now()</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
