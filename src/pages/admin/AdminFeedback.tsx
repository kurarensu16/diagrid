import React, { useState, useEffect } from 'react';
import { 
  Star, 
  Search, 
  RefreshCw, 
  Download, 
  Trash2, 
  Bug, 
  Sparkles, 
  MessageSquare, 
  Check, 
  Clock, 
  AlertCircle,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { mockAdmin, type AdminFeedback } from '../../services/mockAdmin';

type CategoryFilter = 'all' | 'feature' | 'bug' | 'general';
type StatusFilter = 'all' | 'new' | 'reviewed' | 'resolved';
type RatingFilter = 'all' | '5' | '4' | '3' | 'low';

export const AdminFeedbackPage: React.FC = () => {
  const [feedbackList, setFeedbackList] = useState<AdminFeedback[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setFeedbackList(mockAdmin.getFeedback());
      setIsRefreshing(false);
    }, 150);
  };

  const handleStatusChange = (id: string, newStatus: 'new' | 'reviewed' | 'resolved') => {
    mockAdmin.updateFeedbackStatus(id, newStatus);
    setFeedbackList(mockAdmin.getFeedback());
    showNotice(`Feedback status updated to [${newStatus.toUpperCase()}]`);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this feedback submission permanently?')) {
      mockAdmin.deleteFeedback(id);
      setFeedbackList(mockAdmin.getFeedback());
      showNotice('Feedback entry removed from database.');
    }
  };

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Date', 'User', 'Category', 'Rating', 'RatingLabel', 'Status', 'Message'];
    const rows = filteredList.map(item => [
      item.id,
      item.timestamp,
      `"${item.user}"`,
      item.type,
      item.rating,
      `"${item.ratingLabel}"`,
      item.status,
      `"${item.message.replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `diagrid_feedback_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotice('Exported feedback CSV successfully.');
  };

  // Stats
  const stats = mockAdmin.getFeedbackStats();

  // Filtering
  const filteredList = feedbackList.filter(item => {
    const matchesSearch = 
      item.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.message.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || item.type === categoryFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

    let matchesRating = true;
    if (ratingFilter === '5') matchesRating = item.rating === 5;
    else if (ratingFilter === '4') matchesRating = item.rating === 4;
    else if (ratingFilter === '3') matchesRating = item.rating === 3;
    else if (ratingFilter === 'low') matchesRating = item.rating <= 2;

    return matchesSearch && matchesCategory && matchesStatus && matchesRating;
  });

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, statusFilter, ratingFilter, pageSize]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedList = filteredList.slice(startIndex, startIndex + pageSize);

  return (
    <div className="p-8 flex flex-col gap-6 text-ink select-none">
      {/* Header */}
      <div className="border-b border-line pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight">user_feedback</h1>
          <p className="text-[13px] text-ink-soft font-mono mt-1">
            // monitor customer satisfaction (CSAT), bug reports, and user feature requests
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 font-mono text-[11px] border border-line px-3 py-1.5 hover:border-ink hover:bg-paper-raised transition-colors cursor-pointer"
            title="Download CSV report"
          >
            <Download className="w-3.5 h-3.5" />
            export_csv()
          </button>
          <button
            onClick={loadFeedback}
            className="flex items-center gap-1.5 font-mono text-[11px] border border-line px-3 py-1.5 hover:border-ink hover:bg-paper-raised transition-colors cursor-pointer"
            title="Reload feedback items"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            sync_feed()
          </button>
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="bg-blueprint/10 border border-blueprint text-blueprint px-4 py-2.5 font-mono text-[12px] flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>STATUS: {actionNotice}</span>
        </div>
      )}

      {/* Top Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Average CSAT */}
        <Card variant="blueprint" className="p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between text-ink-soft font-mono text-[11px]">
            <span>AVG_CSAT_RATING</span>
            <TrendingUp className="w-3.5 h-3.5 text-blueprint" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-ink">
              {stats.averageRating.toFixed(1)}
            </span>
            <span className="font-mono text-xs text-ink-soft">/ 5.0</span>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star 
                key={s} 
                className={`w-3.5 h-3.5 ${
                  s <= Math.round(stats.averageRating)
                    ? 'fill-[#F59E0B] text-[#D97706]'
                    : 'text-line fill-transparent'
                }`}
              />
            ))}
            <span className="font-mono text-[10px] text-emerald-800 ml-1 font-bold">
              {Math.round((stats.averageRating / 5) * 100)}% positive
            </span>
          </div>
        </Card>

        {/* Card 2: Feature Requests */}
        <Card variant="blueprint" className="p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between text-ink-soft font-mono text-[11px]">
            <span>FEATURE_REQUESTS</span>
            <Sparkles className="w-3.5 h-3.5 text-blueprint" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-ink">
              {stats.byType.feature}
            </span>
            <span className="font-mono text-[10px] text-blueprint border border-blueprint px-1.5 py-0.2">
              ideas
            </span>
          </div>
          <span className="font-mono text-[10px] text-ink-soft">
            User enhancement suggestions
          </span>
        </Card>

        {/* Card 3: Bug Reports */}
        <Card variant="signal" className="p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between text-ink-soft font-mono text-[11px]">
            <span className="text-signal">BUG_REPORTS</span>
            <Bug className="w-3.5 h-3.5 text-signal" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-signal">
              {stats.byType.bug}
            </span>
            <span className="font-mono text-[10px] text-signal border border-signal px-1.5 py-0.2">
              triage
            </span>
          </div>
          <span className="font-mono text-[10px] text-ink-soft">
            Reported client or export bugs
          </span>
        </Card>

        {/* Card 4: Action Required / New */}
        <Card variant="ink" className="p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between text-ink-soft font-mono text-[11px]">
            <span>PENDING_REVIEW</span>
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-ink">
              {stats.byStatus.new}
            </span>
            <span className="font-mono text-[10px] text-amber-800 bg-amber-500/10 border border-amber-600 px-1.5 py-0.2 font-bold">
              unresolved
            </span>
          </div>
          <span className="font-mono text-[10px] text-ink-soft">
            {stats.byStatus.resolved} items already resolved
          </span>
        </Card>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
        {/* Search */}
        <div className="relative flex-1 lg:max-w-[340px]">
          <Search className="w-4 h-4 text-ink-soft absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="search by email or notes..."
            className="w-full pl-9 pr-3 py-2 font-mono text-[12px] bg-paper border border-line text-ink focus:outline-none focus:border-ink transition-colors"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex border border-line bg-paper-raised p-1 font-mono text-[11px]">
            {(['all', 'feature', 'bug', 'general'] as CategoryFilter[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 transition-colors cursor-pointer capitalize ${
                  categoryFilter === cat
                    ? 'bg-ink text-paper font-bold'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>

          {/* Status filter dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-1.5 font-mono text-[11px] bg-paper border border-line text-ink focus:outline-none focus:border-ink cursor-pointer"
          >
            <option value="all">Status: All</option>
            <option value="new">Status: New</option>
            <option value="reviewed">Status: Reviewed</option>
            <option value="resolved">Status: Resolved</option>
          </select>

          {/* Rating filter dropdown */}
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value as RatingFilter)}
            className="px-3 py-1.5 font-mono text-[11px] bg-paper border border-line text-ink focus:outline-none focus:border-ink cursor-pointer"
          >
            <option value="all">Rating: All</option>
            <option value="5">★ 5 Stars Only</option>
            <option value="4">★ 4 Stars Only</option>
            <option value="3">★ 3 Stars Only</option>
            <option value="low">★ 1-2 Stars (Low)</option>
          </select>
        </div>
      </div>

      {/* Main Feedback List Table / Feed */}
      <div className="border border-line bg-paper-raised overflow-hidden">
        {paginatedList.length === 0 ? (
          <div className="p-12 text-center font-mono text-ink-soft text-[13px]">
            // no feedback entries found matching active filters
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {paginatedList.map((item) => {
              const formattedDate = new Date(item.timestamp).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div key={item.id} className="p-5 flex flex-col gap-3 hover:bg-paper/40 transition-colors">
                  {/* Top line: Score, Category, Author, Date, Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Rating Stars */}
                      <div className="flex items-center gap-1 bg-paper px-2 py-1 border border-line">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= item.rating
                                ? 'fill-[#F59E0B] text-[#D97706]'
                                : 'text-line fill-transparent'
                            }`}
                          />
                        ))}
                        <span className="font-mono text-[11px] font-bold text-ink ml-1">
                          {item.rating}/5
                        </span>
                      </div>

                      {/* Category Badge */}
                      <span 
                        className={`font-mono text-[10px] uppercase font-bold px-2 py-0.5 border flex items-center gap-1 ${
                          item.type === 'feature'
                            ? 'border-blueprint text-blueprint bg-blueprint/5'
                            : item.type === 'bug'
                            ? 'border-signal text-signal bg-signal/5'
                            : 'border-line text-ink-soft bg-paper'
                        }`}
                      >
                        {item.type === 'feature' && <Sparkles className="w-3 h-3" />}
                        {item.type === 'bug' && <Bug className="w-3 h-3" />}
                        {item.type === 'general' && <MessageSquare className="w-3 h-3" />}
                        [{item.type}]
                      </span>

                      {/* User handle */}
                      <span className="font-mono text-[12px] font-bold text-ink">
                        {item.user}
                      </span>
                    </div>

                    {/* Right: Timestamp and Status Controller */}
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span className="text-ink-soft text-[10px] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formattedDate}
                      </span>

                      {/* Status Dropdown */}
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value as any)}
                        className={`px-2 py-0.5 border font-bold text-[10px] uppercase cursor-pointer focus:outline-none ${
                          item.status === 'new'
                            ? 'border-amber-600 text-amber-800 bg-amber-500/10'
                            : item.status === 'reviewed'
                            ? 'border-blueprint text-blueprint bg-blueprint/10'
                            : 'border-emerald-600 text-emerald-800 bg-emerald-500/10'
                        }`}
                      >
                        <option value="new">NEW</option>
                        <option value="reviewed">REVIEWED</option>
                        <option value="resolved">RESOLVED</option>
                      </select>

                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1 text-ink-soft hover:text-signal transition-colors cursor-pointer"
                        title="Delete feedback entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Message body */}
                  <p className="font-mono text-[13px] text-ink leading-relaxed bg-paper p-3 border border-line select-text">
                    "{item.message}"
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 font-mono text-[12px] text-ink-soft">
        <div className="flex items-center gap-4">
          <span>
            showing {filteredList.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + pageSize, filteredList.length)} of {filteredList.length} items
          </span>

          {/* Page size selector */}
          <div className="flex items-center gap-1.5">
            <span>rows:</span>
            {[5, 10, 25].map((size) => (
              <button
                key={size}
                onClick={() => setPageSize(size)}
                className={`px-2 py-0.5 border transition-colors cursor-pointer ${
                  pageSize === size
                    ? 'border-ink bg-ink text-paper font-bold'
                    : 'border-line hover:border-ink text-ink-soft hover:text-ink'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Page Nav Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="p-1.5 border border-line hover:border-ink disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            title="First page"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 border border-line hover:border-ink disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            title="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <span className="px-3 py-1 border border-line bg-paper text-ink font-bold text-[11px]">
            {currentPage} / {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 border border-line hover:border-ink disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            title="Next page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="p-1.5 border border-line hover:border-ink disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            title="Last page"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
