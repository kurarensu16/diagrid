import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { mockAdmin, type ActivityLog } from '../../services/mockAdmin';
import { Calendar, User, Info, Search, RefreshCw, Trash2, ArrowUpRight, LogIn, Plus } from 'lucide-react';

type FilterTab = 'all' | 'sign_ins' | 'creates' | 'exports' | 'deletes';

export const AdminActivity: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    handleRefresh();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Simulated live refresh
    setTimeout(() => {
      setLogs(mockAdmin.getActivityLogs());
      setIsRefreshing(false);
    }, 200);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      log.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.target.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesCategory = true;
    if (activeTab === 'sign_ins') matchesCategory = log.action === 'signed_in';
    else if (activeTab === 'creates') matchesCategory = log.action === 'created_project' || log.action === 'created_diagram';
    else if (activeTab === 'exports') matchesCategory = log.action === 'exported_diagram';
    else if (activeTab === 'deletes') matchesCategory = log.action === 'deleted_project';

    return matchesSearch && matchesCategory;
  });

  const filterTabs: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: logs.length },
    { id: 'sign_ins', label: 'Sign-ins', count: logs.filter(l => l.action === 'signed_in').length },
    { id: 'creates', label: 'Creates', count: logs.filter(l => l.action === 'created_project' || l.action === 'created_diagram').length },
    { id: 'exports', label: 'Exports', count: logs.filter(l => l.action === 'exported_diagram').length },
    { id: 'deletes', label: 'Deletes', count: logs.filter(l => l.action === 'deleted_project').length },
  ];

  return (
    <div className="p-8 flex flex-col gap-6 text-ink">
      {/* Header */}
      <div className="border-b border-line pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight">activity_log</h1>
          <p className="text-[13px] text-ink-soft font-mono mt-1">// trace audit logs and platform execution triggers</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 font-mono text-[11px] border border-line px-3 py-1.5 hover:border-ink hover:bg-paper-raised transition-colors cursor-pointer"
            title="Refresh event stream"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            sync_feed()
          </button>
          <div className="font-mono text-[12px] text-ink-soft">
            ENTRIES: {filteredLogs.length}
          </div>
        </div>
      </div>

      {/* Filter and search controls */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
        {/* Search */}
        <div className="relative flex-1 lg:max-w-[340px]">
          <Search className="w-4 h-4 text-ink-soft absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 border border-line bg-paper-raised text-[13px] font-mono focus:border-ink focus:outline-none w-full"
            placeholder="search_user_or_target..."
          />
        </div>

        {/* Action filter tabs: All, Sign-ins, Creates, Exports, Deletes */}
        <div className="flex flex-wrap border border-line font-mono text-[11px] bg-paper select-none">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 border-r last:border-r-0 border-line uppercase tracking-wide transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === tab.id ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-paper-raised hover:text-ink'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[9px] px-1 py-0.2 rounded border ${
                activeTab === tab.id ? 'border-paper text-paper' : 'border-line text-ink-soft'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Timeline flow */}
      <div className="flex flex-col gap-3.5 select-text">
        {filteredLogs.length === 0 ? (
          <Card variant="blueprint" className="py-12 text-center text-ink-soft font-mono text-[13px]">
            // no activity log records matching current filter constraints
          </Card>
        ) : (
          filteredLogs.map((log) => {
            let badgeStyle = "border-line text-ink-soft";
            let Icon = Info;
            let actionVerb = log.action.replace('_', ' ');

            if (log.action === 'signed_in') {
              badgeStyle = "border-blueprint text-blueprint bg-blueprint bg-opacity-5";
              Icon = LogIn;
              actionVerb = "session login";
            } else if (log.action === 'created_project' || log.action === 'created_diagram') {
              badgeStyle = "border-ink text-ink bg-paper";
              Icon = Plus;
            } else if (log.action === 'exported_diagram') {
              badgeStyle = "border-signal text-signal bg-signal bg-opacity-5";
              Icon = ArrowUpRight;
            } else if (log.action === 'deleted_project') {
              badgeStyle = "border-signal text-paper bg-signal font-bold";
              Icon = Trash2;
            }

            return (
              <Card 
                key={log.id} 
                variant="blueprint" 
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-[12.5px] hover:border-ink transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Action badge */}
                  <span className={`px-2 py-0.5 border text-[10px] uppercase tracking-wide rounded-[3px] shrink-0 mt-0.5 flex items-center gap-1 font-bold ${badgeStyle}`}>
                    <Icon className="w-3 h-3" />
                    {actionVerb}
                  </span>
                  
                  <div className="flex flex-col gap-0.5">
                    <span className="text-ink font-bold break-all flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-ink-soft shrink-0" />
                      {log.user_email}
                    </span>
                    <span className="text-ink-soft text-[12px] flex items-center gap-1.5">
                      <span className="text-line">//</span>
                      <span>target: <strong className="text-ink">{log.target}</strong></span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-ink-soft text-[11px] shrink-0 md:self-center">
                  <Calendar className="w-3.5 h-3.5 shrink-0 text-line" />
                  {new Date(log.timestamp).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'medium',
                  })}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
