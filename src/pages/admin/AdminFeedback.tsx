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
  ChevronsRight,
  Paperclip,
  ExternalLink,
  Mail,
  Eye,
  X,
  Copy,
  Monitor,
  Globe,
  FileText,
  Save,
  ShieldAlert
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { adminService, type AdminFeedback } from '../../services/adminService';

type CategoryFilter = 'all' | 'feature' | 'bug' | 'general';
type StatusFilter = 'all' | 'new' | 'reviewed' | 'resolved';
type PriorityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type RatingFilter = 'all' | '5' | '4' | '3' | 'low';

const PRIORITY_CONFIG: Record<AdminFeedback['priority'], { label: string; color: string; border: string; bg: string }> = {
  critical: { label: 'CRITICAL', color: 'text-signal', border: 'border-signal', bg: 'bg-signal/10' },
  high: { label: 'HIGH', color: 'text-amber-700', border: 'border-amber-600', bg: 'bg-amber-500/10' },
  medium: { label: 'MEDIUM', color: 'text-blueprint', border: 'border-blueprint', bg: 'bg-blueprint/10' },
  low: { label: 'LOW', color: 'text-ink-soft', border: 'border-line', bg: 'bg-paper-raised' },
};

export const AdminFeedbackPage: React.FC = () => {
  const [feedbackList, setFeedbackList] = useState<AdminFeedback[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Selected feedback for detailed diagnostic inspection modal
  const [inspectingItem, setInspectingItem] = useState<AdminFeedback | null>(null);
  const [inspectingNotes, setInspectingNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    setIsRefreshing(true);
    try {
      const data = await adminService.getFeedback();
      setFeedbackList(data);
      // Keep inspectingItem in sync if open
      if (inspectingItem) {
        const updated = data.find(f => f.id === inspectingItem.id);
        if (updated) {
          setInspectingItem(updated);
          setInspectingNotes(updated.adminNotes || '');
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: 'new' | 'reviewed' | 'resolved') => {
    await adminService.updateFeedbackStatus(id, newStatus);
    await loadFeedback();
    showNotice(`Feedback status updated to [${newStatus.toUpperCase()}]`);
  };

  const handlePriorityChange = async (id: string, newPriority: 'low' | 'medium' | 'high' | 'critical') => {
    await adminService.updateFeedbackPriority(id, newPriority);
    await loadFeedback();
    showNotice(`Priority updated to [${newPriority.toUpperCase()}]`);
  };

  const handleSaveNotes = async () => {
    if (!inspectingItem) return;
    setIsSavingNotes(true);
    try {
      await adminService.updateFeedbackAdminNotes(inspectingItem.id, inspectingNotes);
      await loadFeedback();
      showNotice('Internal engineering notes saved.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this feedback submission permanently from Supabase?')) {
      await adminService.deleteFeedback(id);
      if (inspectingItem?.id === id) {
        setInspectingItem(null);
      }
      await loadFeedback();
      showNotice('Feedback entry removed from database.');
    }
  };

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const openInspector = (item: AdminFeedback) => {
    setInspectingItem(item);
    setInspectingNotes(item.adminNotes || '');
    setCopiedJson(false);
  };

  const handleCopyTelemetryJson = async (data: any) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch (err) {
      console.error('Failed to copy telemetry JSON:', err);
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Date', 'User', 'Category', 'Priority', 'Rating', 'RatingLabel', 'Status', 'PageURL', 'AttachmentURL', 'AdminNotes', 'Message'];
    const rows = filteredList.map(item => [
      item.id,
      item.timestamp,
      `"${item.user}"`,
      item.type,
      item.priority,
      item.rating,
      `"${item.ratingLabel}"`,
      item.status,
      `"${item.pageUrl || ''}"`,
      `"${item.attachmentUrl || ''}"`,
      `"${(item.adminNotes || '').replace(/"/g, '""')}"`,
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
  const stats = adminService.getFeedbackStats(feedbackList);

  // Filtering
  const filteredList = feedbackList.filter(item => {
    const matchesSearch = 
      item.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.adminNotes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.pageUrl || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || item.type === categoryFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;

    let matchesRating = true;
    if (ratingFilter === '5') matchesRating = item.rating === 5;
    else if (ratingFilter === '4') matchesRating = item.rating === 4;
    else if (ratingFilter === '3') matchesRating = item.rating === 3;
    else if (ratingFilter === 'low') matchesRating = item.rating <= 2;

    return matchesSearch && matchesCategory && matchesStatus && matchesPriority && matchesRating;
  });

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, statusFilter, priorityFilter, ratingFilter, pageSize]);

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
            // monitor CSAT, bug diagnostics, client telemetry, and triage user feature requests
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
              {Math.round((stats.averageRating / 5) * 100)}% satisfaction
            </span>
          </div>
        </Card>

        {/* Card 2: Priority Triage */}
        <Card variant="signal" className="p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between text-ink-soft font-mono text-[11px]">
            <span className="text-signal">CRITICAL_&_HIGH_PRIORITY</span>
            <ShieldAlert className="w-3.5 h-3.5 text-signal" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-signal">
              {(stats.byPriority?.critical || 0) + (stats.byPriority?.high || 0)}
            </span>
            <span className="font-mono text-[10px] text-signal border border-signal px-1.5 py-0.2">
              {stats.byPriority?.critical || 0} critical
            </span>
          </div>
          <span className="font-mono text-[10px] text-ink-soft">
            Requiring immediate developer triage
          </span>
        </Card>

        {/* Card 3: Feature Ideas */}
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
        <div className="relative flex-1 lg:max-w-[320px]">
          <Search className="w-4 h-4 text-ink-soft absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="search email, message, notes, url..."
            className="w-full pl-9 pr-3 py-2 font-mono text-[12px] bg-paper border border-line text-ink focus:outline-none focus:border-ink transition-colors"
          />
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Tabs */}
          <div className="flex border border-line bg-paper-raised p-1 font-mono text-[11px]">
            {(['all', 'bug', 'feature', 'general'] as CategoryFilter[]).map((cat) => (
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

          {/* Priority filter dropdown */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
            className="px-3 py-1.5 font-mono text-[11px] bg-paper border border-line text-ink focus:outline-none focus:border-ink cursor-pointer"
          >
            <option value="all">Priority: All</option>
            <option value="critical">🚨 Critical Priority</option>
            <option value="high">⚠️ High Priority</option>
            <option value="medium">🔷 Medium Priority</option>
            <option value="low">▫️ Low Priority</option>
          </select>

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

      {/* Main Feedback List Feed */}
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

              const pConf = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.medium;

              return (
                <div key={item.id} className="p-5 flex flex-col gap-3 hover:bg-paper/40 transition-colors">
                  {/* Top line: Score, Category, Priority, Author, Date, Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
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

                      {/* Priority Badge / Dropdown */}
                      <select
                        value={item.priority}
                        onChange={(e) => handlePriorityChange(item.id, e.target.value as any)}
                        className={`font-mono text-[10px] uppercase font-bold px-2 py-0.5 border cursor-pointer focus:outline-none ${pConf.border} ${pConf.color} ${pConf.bg}`}
                        title="Change priority triage level"
                      >
                        <option value="critical">🚨 CRITICAL</option>
                        <option value="high">⚠️ HIGH</option>
                        <option value="medium">🔷 MEDIUM</option>
                        <option value="low">▫️ LOW</option>
                      </select>

                      {/* User handle */}
                      <span className="font-mono text-[12px] font-bold text-ink flex items-center gap-1">
                        {item.user}
                      </span>

                      {/* Attachment indicator icon */}
                      {item.attachmentUrl && (
                        <span 
                          onClick={() => openInspector(item)}
                          className="font-mono text-[10px] text-blueprint border border-blueprint px-1.5 py-0.5 bg-blueprint/5 flex items-center gap-1 cursor-pointer hover:bg-blueprint/15"
                          title="View attached screenshot"
                        >
                          <Paperclip className="w-3 h-3" />
                          screenshot
                        </span>
                      )}

                      {/* Internal note indicator */}
                      {item.adminNotes && (
                        <span 
                          onClick={() => openInspector(item)}
                          className="font-mono text-[10px] text-amber-700 border border-amber-600 px-1.5 py-0.5 bg-amber-500/10 flex items-center gap-1 cursor-pointer"
                          title="Has internal notes"
                        >
                          <FileText className="w-3 h-3" />
                          notes
                        </span>
                      )}
                    </div>

                    {/* Right: Timestamp and Status Controller */}
                    <div className="flex items-center gap-2.5 font-mono text-[11px]">
                      <span className="text-ink-soft text-[10px] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formattedDate}
                      </span>

                      {/* Inspect Diagnostics Button */}
                      <button
                        onClick={() => openInspector(item)}
                        className="px-2.5 py-1 border border-line hover:border-blueprint text-blueprint bg-paper hover:bg-paper-raised transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                        title="Inspect full diagnostics & screenshot"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>inspect()</span>
                      </button>

                      {/* Direct Mailto Reply Button */}
                      <a
                        href={`mailto:${item.user}?subject=Diagrid Support: Re: [${item.type.toUpperCase()}] Feedback&body=Hi there,%0D%0A%0D%0AThank you for sharing your feedback with Diagrid! We are following up regarding your submission:%0D%0A%0D%0A"${encodeURIComponent(item.message)}"%0D%0A%0D%0A`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 border border-line hover:border-ink bg-paper text-ink-soft hover:text-ink transition-colors cursor-pointer"
                        title={`Reply via email to ${item.user}`}
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </a>

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
                  <div className="flex flex-col sm:flex-row gap-3 items-start">
                    <p className="flex-1 font-mono text-[13px] text-ink leading-relaxed bg-paper p-3 border border-line select-text whitespace-pre-wrap">
                      "{item.message}"
                    </p>

                    {item.attachmentUrl && (
                      <div 
                        onClick={() => openInspector(item)}
                        className="w-24 h-24 border border-line bg-paper hover:border-blueprint cursor-pointer overflow-hidden relative shrink-0 group"
                        title="Click to zoom screenshot"
                      >
                        <img 
                          src={item.attachmentUrl} 
                          alt="Screenshot attachment" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                        />
                        <div className="absolute inset-0 bg-ink/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-paper">
                          <Eye className="w-5 h-5" />
                        </div>
                      </div>
                    )}
                  </div>
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

      {/* ========================================================================= */}
      {/* Diagnostic Inspection & Triage Drawer Modal */}
      {/* ========================================================================= */}
      {inspectingItem && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs select-none animate-in fade-in duration-150 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInspectingItem(null);
          }}
        >
          <Card 
            variant="blueprint" 
            className="w-full max-w-[760px] p-0 overflow-hidden shadow-hard-blueprint border-[2px] border-ink bg-paper my-auto max-h-[90vh] flex flex-col"
          >
            {/* Inspector Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-paper-raised shrink-0">
              <div className="flex items-center gap-2.5">
                <Monitor className="w-5 h-5 text-blueprint" />
                <div>
                  <h2 className="font-mono text-[15px] font-bold tracking-tight text-ink flex items-center gap-2">
                    <span>diagnostic_inspector</span>
                    <span className="text-xs text-ink-soft font-normal">#{inspectingItem.id.slice(0, 8)}</span>
                  </h2>
                  <p className="font-mono text-[11px] text-ink-soft">
                    // full user context, screenshot attachment, and client telemetry
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`mailto:${inspectingItem.user}?subject=Diagrid Support: Re: [${inspectingItem.type.toUpperCase()}] Feedback&body=Hi there,%0D%0A%0D%0AThank you for contacting Diagrid! We are following up regarding your feedback submission:%0D%0A%0D%0A"${encodeURIComponent(inspectingItem.message)}"%0D%0A%0D%0A`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-mono text-[11px] border border-line px-3 py-1 bg-paper hover:border-ink text-ink transition-colors cursor-pointer"
                  title="Reply to user via email"
                >
                  <Mail className="w-3.5 h-3.5 text-blueprint" />
                  <span>reply_email()</span>
                </a>

                <button
                  onClick={() => setInspectingItem(null)}
                  className="p-1 hover:bg-paper border border-transparent hover:border-line text-ink-soft hover:text-ink transition-colors cursor-pointer"
                  title="Close inspector"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Inspector Body */}
            <div className="p-6 overflow-y-auto flex flex-col gap-5 font-mono text-[12px]">
              {/* Top Meta Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 border border-line bg-paper-raised/40">
                <div>
                  <span className="text-[10px] text-ink-soft uppercase block">User / Author</span>
                  <span className="font-bold text-ink break-all">{inspectingItem.user}</span>
                </div>
                <div>
                  <span className="text-[10px] text-ink-soft uppercase block">Category</span>
                  <span className="font-bold text-ink uppercase">[{inspectingItem.type}]</span>
                </div>
                <div>
                  <span className="text-[10px] text-ink-soft uppercase block">CSAT Rating</span>
                  <span className="font-bold text-ink">{inspectingItem.rating}/5 ({inspectingItem.ratingLabel})</span>
                </div>
                <div>
                  <span className="text-[10px] text-ink-soft uppercase block">Date & Time</span>
                  <span className="font-bold text-ink">{new Date(inspectingItem.timestamp).toLocaleString()}</span>
                </div>
              </div>

              {/* Status and Priority Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 border border-line bg-paper">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink text-[11px] uppercase">Triage Priority:</span>
                  <select
                    value={inspectingItem.priority}
                    onChange={(e) => {
                      const newP = e.target.value as any;
                      handlePriorityChange(inspectingItem.id, newP);
                      setInspectingItem(prev => prev ? { ...prev, priority: newP } : null);
                    }}
                    className="font-mono text-[11px] font-bold uppercase px-2 py-1 border border-line bg-paper-raised cursor-pointer focus:outline-none"
                  >
                    <option value="critical">🚨 CRITICAL PRIORITY</option>
                    <option value="high">⚠️ HIGH PRIORITY</option>
                    <option value="medium">🔷 MEDIUM PRIORITY</option>
                    <option value="low">▫️ LOW PRIORITY</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink text-[11px] uppercase">Workflow Status:</span>
                  <select
                    value={inspectingItem.status}
                    onChange={(e) => {
                      const newS = e.target.value as any;
                      handleStatusChange(inspectingItem.id, newS);
                      setInspectingItem(prev => prev ? { ...prev, status: newS } : null);
                    }}
                    className="font-mono text-[11px] font-bold uppercase px-2 py-1 border border-line bg-paper-raised cursor-pointer focus:outline-none"
                  >
                    <option value="new">NEW</option>
                    <option value="reviewed">REVIEWED</option>
                    <option value="resolved">RESOLVED</option>
                  </select>
                </div>
              </div>

              {/* User Message */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase text-ink flex items-center justify-between">
                  <span>feedback_message:</span>
                </label>
                <div className="p-3.5 bg-paper border border-line text-ink whitespace-pre-wrap select-text leading-relaxed">
                  {inspectingItem.message}
                </div>
              </div>

              {/* Screenshot Attachment Zoom / Viewer */}
              {inspectingItem.attachmentUrl && (
                <div className="flex flex-col gap-1.5 p-3.5 border border-line bg-paper">
                  <div className="flex items-center justify-between text-[11px] font-bold text-ink">
                    <span className="flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-blueprint" />
                      screenshot_attachment_preview:
                    </span>
                    <a
                      href={inspectingItem.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blueprint hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <ExternalLink className="w-3 h-3" />
                      open_full_resolution()
                    </a>
                  </div>
                  <div className="border border-line bg-paper-raised p-2 flex items-center justify-center max-h-[340px] overflow-hidden">
                    <img 
                      src={inspectingItem.attachmentUrl} 
                      alt="User uploaded screenshot" 
                      className="max-w-full max-h-[320px] object-contain cursor-zoom-in"
                      onClick={() => window.open(inspectingItem.attachmentUrl, '_blank')}
                    />
                  </div>
                </div>
              )}

              {/* Client Telemetry & Diagnostics */}
              <div className="flex flex-col gap-2 p-3.5 border border-line bg-paper-raised/40">
                <div className="flex items-center justify-between text-[11px] font-bold text-ink">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blueprint" />
                    client_environment_telemetry:
                  </span>
                  <button
                    onClick={() => handleCopyTelemetryJson(inspectingItem.clientMetadata || { pageUrl: inspectingItem.pageUrl })}
                    className="text-blueprint hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedJson ? 'copied_json!' : 'copy_json()'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-ink-soft">
                  <div className="bg-paper p-2 border border-line">
                    <span className="text-[10px] block text-ink-soft uppercase">Page URL / Path</span>
                    <span className="font-bold text-ink break-all">
                      {inspectingItem.pageUrl || inspectingItem.clientMetadata?.pathname || '/'}
                    </span>
                  </div>
                  <div className="bg-paper p-2 border border-line">
                    <span className="text-[10px] block text-ink-soft uppercase">OS & Platform</span>
                    <span className="font-bold text-ink">
                      {inspectingItem.clientMetadata?.os || 'Unknown'}
                    </span>
                  </div>
                  <div className="bg-paper p-2 border border-line">
                    <span className="text-[10px] block text-ink-soft uppercase">Browser</span>
                    <span className="font-bold text-ink">
                      {inspectingItem.clientMetadata?.browser || 'Unknown'}
                    </span>
                  </div>
                  <div className="bg-paper p-2 border border-line">
                    <span className="text-[10px] block text-ink-soft uppercase">Viewport</span>
                    <span className="font-bold text-ink">
                      {inspectingItem.clientMetadata?.viewport || 'N/A'} (DPR: {inspectingItem.clientMetadata?.dpr || 1})
                    </span>
                  </div>
                  <div className="bg-paper p-2 border border-line">
                    <span className="text-[10px] block text-ink-soft uppercase">Screen Resolution</span>
                    <span className="font-bold text-ink">
                      {inspectingItem.clientMetadata?.screenRes || 'N/A'}
                    </span>
                  </div>
                  <div className="bg-paper p-2 border border-line">
                    <span className="text-[10px] block text-ink-soft uppercase">Diagram Context</span>
                    <span className="font-bold text-ink">
                      {inspectingItem.clientMetadata?.diagram?.title ? (
                        `${inspectingItem.clientMetadata.diagram.title} (${inspectingItem.clientMetadata.diagram.nodeCount || 0} shapes)`
                      ) : (
                        'No diagram active'
                      )}
                    </span>
                  </div>
                </div>

                {/* Raw JSON viewer */}
                {inspectingItem.clientMetadata && Object.keys(inspectingItem.clientMetadata).length > 0 && (
                  <details className="mt-1">
                    <summary className="text-[10px] text-ink-soft cursor-pointer hover:text-ink font-bold uppercase">
                      [+] view_raw_telemetry_payload
                    </summary>
                    <pre className="mt-2 p-3 bg-paper border border-line text-[10px] text-ink overflow-x-auto select-text font-mono max-h-[140px]">
                      {JSON.stringify(inspectingItem.clientMetadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>

              {/* Internal Engineering Notes */}
              <div className="flex flex-col gap-1.5 p-3.5 border border-line bg-paper">
                <label className="text-[11px] font-bold uppercase text-ink flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-700" />
                    internal_admin_notes:
                  </span>
                  <span className="text-[10px] text-ink-soft font-normal">(visible only to engineers & admins)</span>
                </label>
                <textarea
                  rows={3}
                  value={inspectingNotes}
                  onChange={(e) => setInspectingNotes(e.target.value)}
                  placeholder="Add triage notes, root cause investigation, links to PRs or bug trackers..."
                  className="p-2.5 bg-paper-raised border border-line text-ink font-mono text-[11px] focus:outline-none focus:border-ink transition-colors resize-none"
                />
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px]"
                  >
                    <Save className="w-3 h-3" />
                    {isSavingNotes ? 'saving_notes...' : 'save_internal_notes()'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Inspector Footer */}
            <div className="p-4 border-t border-line bg-paper-raised flex items-center justify-between shrink-0">
              <button
                onClick={() => handleDelete(inspectingItem.id)}
                className="text-signal hover:underline font-mono text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                delete_feedback()
              </button>

              <Button
                type="button"
                variant="primary"
                onClick={() => setInspectingItem(null)}
                className="px-4 py-1.5 text-[12px]"
              >
                close_inspector()
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
