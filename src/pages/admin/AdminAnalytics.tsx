import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { DiagramAnalyticsCharts } from '../../components/admin/DiagramAnalyticsCharts';
import { DiagramAnalyticsInsights } from '../../components/admin/DiagramAnalyticsInsights';
import { AnalyticsKpiCard, type AnalyticsMetric } from '../../components/admin/AnalyticsKpiCard';
import { getDiagramAnalytics, type AnalyticsFilters, type DiagramAnalytics, type DiagramRecord } from '../../services/analyticsService';

const initialFilters: AnalyticsFilters = { start: '', end: '', project: '', type: '', search: '', bucket: 'month' };
type SortKey = 'title' | 'project_name' | 'type' | 'created_at' | 'updated_at';
const dateLabel = (value: string) => new Date(value).toLocaleString(undefined, { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' });
export function AdminAnalytics() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<DiagramAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [lastRefresh, setLastRefresh] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'created_at', asc: false });
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setPage(1);
    const timer = setTimeout(() => {
      if (filters.start && filters.end && filters.start > filters.end) { setError('Choose an end date on or after the start date.'); setLoading(false); return; }
      getDiagramAnalytics(filters).then(result => { if (active) { setData(result); setLastRefresh(new Date().toLocaleTimeString()); } }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : 'Unable to load analytics.'); }).finally(() => { if (active) setLoading(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [filters, refresh]);
  const rows = useMemo(() => [...(data?.records || [])].sort((a: DiagramRecord, b: DiagramRecord) => {
    const cmp = a[sort.key].localeCompare(b[sort.key]) || a.id.localeCompare(b.id);
    return sort.asc ? cmp : -cmp;
  }), [data, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const currentPage = Math.min(page, pages);
  const update = <K extends keyof AnalyticsFilters>(key: K, value: AnalyticsFilters[K]) => setFilters(old => ({ ...old, [key]: value }));
  const inputClass = 'border border-line bg-paper px-3 py-2 text-sm w-full';
  return <div className="w-full min-w-0 p-6 sm:p-8 max-w-[1440px] mx-auto space-y-6 text-ink">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5"><div><h1 className="text-3xl font-bold">Diagrid Analytics</h1><p className="text-sm text-ink-soft mt-1">Explore your actual diagram records. Creation dates and chart buckets use UTC.</p></div><div className="flex items-center gap-3 text-sm"><span>{lastRefresh && `Refreshed ${lastRefresh}`}</span><button className={inputClass} onClick={() => setRefresh(n => n + 1)} disabled={loading}><RefreshCw className={`inline w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh</button></div></div>
    <Card><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <label className="text-sm">Created from<input aria-label="Created from" type="date" className={inputClass} value={filters.start} onChange={e => update('start', e.target.value)}/></label>
      <label className="text-sm">Created through<input aria-label="Created through" type="date" className={inputClass} value={filters.end} onChange={e => update('end', e.target.value)}/></label>
      <label className="text-sm">Project<select className={inputClass} value={filters.project} onChange={e => update('project', e.target.value)}><option value="">All projects</option>{data?.project_options.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="text-sm">Diagram type<select className={inputClass} value={filters.type} onChange={e => update('type', e.target.value)}><option value="">All types</option>{data?.type_options.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}</select></label>
      <label className="text-sm">Time grouping<select className={inputClass} value={filters.bucket} onChange={e => update('bucket', e.target.value as AnalyticsFilters['bucket'])}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select></label>
      <label className="text-sm">Search records<input className={inputClass} placeholder="Diagram title, project, or type" value={filters.search} onChange={e => update('search', e.target.value)}/></label>
    </div><button className="mt-4 text-sm text-blueprint underline" onClick={() => setFilters(initialFilters)}>Clear filters</button><p className="text-xs text-ink-soft mt-2">All cards, graphs, and records use these filters. Counts represent currently saved diagrams, including those created in the selected period.</p></Card>
    {error ? <Card role="alert"><p className="text-signal">{error}</p><button className="mt-3 underline" onClick={() => setRefresh(n => n + 1)}>Try again</button></Card> : loading ? <p role="status" className="py-12 text-center">Loading diagram analytics…</p> : data && <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">{(['diagrams', 'projects', 'average', 'type'] as AnalyticsMetric[]).map(metric => <AnalyticsKpiCard key={metric} metric={metric} data={data}/>)}</div>
      <DiagramAnalyticsCharts data={data}/>
      <DiagramAnalyticsInsights insights={data.insights} onProject={id => update('project', id)}/>
      <Card><div className="flex flex-wrap justify-between items-center gap-3 mb-4"><h2 className="text-lg font-bold">Diagram Records</h2><span className="text-sm">{rows.length} matching records · dates in UTC</span></div>
        <div className="overflow-auto"><table className="w-full text-sm text-left"><thead><tr>{(['title', 'project_name', 'type', 'created_at', 'updated_at'] as SortKey[]).map((key, i) => <th key={key} className="border-b border-line p-3 whitespace-nowrap" aria-sort={sort.key === key ? sort.asc ? 'ascending' : 'descending' : 'none'}><button onClick={() => setSort({ key, asc: sort.key === key ? !sort.asc : true })}>{['Diagram title', 'Project name', 'Diagram type', 'Created date', 'Last updated'][i]} {sort.key === key ? sort.asc ? '↑' : '↓' : ''}</button></th>)}</tr></thead><tbody>{rows.slice((currentPage - 1) * size, currentPage * size).map(r => <tr key={r.id}><td className="p-3 border-b border-line">{r.title}</td><td className="p-3 border-b border-line">{r.project_name}</td><td className="p-3 border-b border-line">{r.type.toUpperCase()}</td><td className="p-3 border-b border-line whitespace-nowrap">{dateLabel(r.created_at)}</td><td className="p-3 border-b border-line whitespace-nowrap">{dateLabel(r.updated_at)}</td></tr>)}</tbody></table></div>
        {!rows.length && <p className="py-8 text-center text-ink-soft">No diagrams match these filters.</p>}
        <div className="flex flex-wrap justify-between gap-4 mt-4 text-sm"><label>Rows per page <select className="border border-line bg-paper p-1" value={size} onChange={e => { setSize(Number(e.target.value)); setPage(1); }}>{[10, 25, 50].map(n => <option key={n}>{n}</option>)}</select></label><div className="flex items-center gap-4"><button disabled={currentPage === 1} className="disabled:opacity-40" onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pages}</span><button disabled={currentPage === pages} className="disabled:opacity-40" onClick={() => setPage(currentPage + 1)}>Next</button></div></div>
      </Card>
    </>}
  </div>;
}
