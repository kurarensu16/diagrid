import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { adminService, type ActivityLog } from '../../services/adminService';
import { Calendar, User, Info, Search, RefreshCw, Trash2, ArrowUpRight, LogIn, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

type FilterTab = 'all' | 'sign_ins' | 'creates' | 'exports' | 'deletes';

export const AdminActivity: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    handleRefresh();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab, pageSize]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const data = await adminService.getActivityLogs(100);
      setLogs(data);
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
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

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + pageSize);

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
        {isLoading ? (
          <Card variant="blueprint" className="py-12 text-center text-ink-soft font-mono text-[13px] flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blueprint" />
            <span>// fetching real-time audit logs from supabase...</span>
          </Card>
        ) : filteredLogs.length === 0 ? (
          <Card variant="blueprint" className="p-8 flex flex-col items-center justify-center gap-2 text-center font-mono text-[13px]">
            <p className="text-ink font-bold">// No audit log entries recorded yet.</p>
            <p className="text-[12px] text-ink-soft max-w-md">
              Audit logs are automatically captured in real time whenever users sign in, create or delete projects/diagrams, or export diagrams.
            </p>
          </Card>
        ) : (
          paginatedLogs.map((log) => {
            let badgeStyle = "border-line text-ink-soft";
            let Icon = Info;
            let actionVerb = log.action.replace('_', ' ');

            if (log.action === 'signed_in') {
              badgeStyle = "border-[#1E5C8C] text-[#1E5C8C] dark:text-[#388BFD] bg-[#EBF3FA] dark:bg-[#152332]";
              Icon = LogIn;
              actionVerb = "session login";
            } else if (log.action === 'created_project' || log.action === 'created_diagram') {
              badgeStyle = "border-ink text-ink bg-paper";
              Icon = Plus;
            } else if (log.action === 'exported_diagram') {
              badgeStyle = "border-[#D45B33] text-[#D45B33] dark:text-[#F78166] bg-[#FDF2EC] dark:bg-[#2C1610]";
              Icon = ArrowUpRight;
            } else if (log.action === 'deleted_project' || log.action === 'deleted_diagram') {
              badgeStyle = "border-rose-600 text-rose-800 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 font-bold";
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

      {!isLoading && filteredLogs.length > 0 && (
        <div className="border border-line bg-paper-raised px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-[11px]">
          <div className="flex items-center gap-4 text-ink-soft">
            <span>
              showing <strong className="text-ink">{startIndex + 1}</strong>-
              <strong className="text-ink">{Math.min(startIndex + pageSize, filteredLogs.length)}</strong> of{' '}
              <strong className="text-ink">{filteredLogs.length}</strong> entries
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold">per_page:</span>
              <div className="flex border border-line bg-paper">
                {[10, 25, 50].map((size) => (
                  <button
                    key={size}
                    onClick={() => setPageSize(size)}
                    className={`px-2 py-0.5 border-r last:border-r-0 border-line text-[10px] cursor-pointer transition-colors ${
                      pageSize === size ? 'bg-ink text-paper font-bold' : 'text-ink-soft hover:bg-paper-raised hover:text-ink'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={validCurrentPage === 1}
                className="p-1.5 border border-line disabled:opacity-30 hover:border-ink cursor-pointer disabled:cursor-not-allowed"
                title="First page"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={validCurrentPage === 1}
                className="p-1.5 border border-line disabled:opacity-30 hover:border-ink cursor-pointer disabled:cursor-not-allowed"
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="min-w-[70px] text-center text-ink-soft">page {validCurrentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={validCurrentPage === totalPages}
                className="p-1.5 border border-line disabled:opacity-30 hover:border-ink cursor-pointer disabled:cursor-not-allowed"
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={validCurrentPage === totalPages}
                className="p-1.5 border border-line disabled:opacity-30 hover:border-ink cursor-pointer disabled:cursor-not-allowed"
                title="Last page"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
