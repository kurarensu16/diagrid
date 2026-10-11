import { useId, useRef } from 'react';
import { Info, X } from 'lucide-react';
import { Card } from '../ui/Card';
import type { DiagramAnalytics } from '../../services/analyticsService';

export type AnalyticsMetric = 'diagrams' | 'projects' | 'average' | 'type';
const definitions = {
  diagrams: { label: 'Total diagrams', summary: 'Number of currently saved diagrams that match your filters.', calculation: 'Count of matching diagram records.', note: 'Includes every matching record, not just the current table page. Deleted diagrams are not included.' },
  projects: { label: 'Projects with diagrams', summary: 'Number of distinct projects with at least one matching diagram.', calculation: 'Count distinct project IDs in the matching records.', note: 'Empty projects and projects with no diagrams matching the filters are not counted.' },
  average: { label: 'Average diagrams per project', summary: 'Average number of matching diagrams per represented project.', calculation: 'Total matching diagrams ÷ projects with matching diagrams.', note: 'Rounded to two decimal places. Returns 0.00 when no projects match; empty projects do not contribute to the denominator.' },
  type: { label: 'Most-used diagram type', summary: 'Diagram type with the largest number of matching records.', calculation: 'Group the records by diagram type, count each group, and select the largest.', note: 'The number in parentheses is that type’s count. Ties are resolved alphabetically by diagram type. Shows “No data” when no records match.' },
};

export function AnalyticsKpiCard({ metric, data }: { metric: AnalyticsMetric; data: DiagramAnalytics }) {
  const help = definitions[metric];
  const titleId = useId(), tooltipId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const value = metric === 'diagrams' ? data.total_diagrams : metric === 'projects' ? data.project_count : metric === 'average' ? Number(data.average_per_project).toFixed(2) : data.most_used_type ? `${data.most_used_type.toUpperCase()} (${data.most_used_count})` : 'No data';
  const current = metric === 'diagrams' ? `${data.total_diagrams} matching records = ${data.total_diagrams} diagrams.` : metric === 'projects' ? `${data.total_diagrams} matching diagrams span ${data.project_count} distinct projects.` : metric === 'average' ? data.project_count ? `${data.total_diagrams} ÷ ${data.project_count} = ${Number(data.average_per_project).toFixed(2)} diagrams per project.` : 'No matching projects: the average is 0.00.' : data.most_used_type && data.total_diagrams ? `${data.most_used_type.toUpperCase()}: ${data.most_used_count} of ${data.total_diagrams} diagrams (${(data.most_used_count / data.total_diagrams * 100).toFixed(1)}%).` : 'No matching records: no diagram type can be ranked.';
  return <Card>
    <div className="flex items-start justify-between gap-2"><p className="text-sm text-ink-soft pt-2">{help.label}</p>
      <div className="relative group shrink-0">
        <button type="button" aria-label={`About ${help.label}`} aria-haspopup="dialog" aria-describedby={tooltipId} className="w-10 h-10 flex items-center justify-center text-blueprint border border-transparent hover:border-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-blueprint" onClick={() => dialog.current?.showModal()}><Info className="w-4 h-4" /></button>
        <span id={tooltipId} role="tooltip" className="absolute z-20 right-0 top-full mt-1 w-56 max-w-[70vw] p-3 border border-ink bg-paper-raised shadow-hard-blueprint text-xs text-ink pointer-events-none invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">{help.summary} Click or tap for details.</span>
      </div>
    </div>
    <p className="text-2xl font-bold mt-3 break-words">{value}</p>
    <dialog ref={dialog} aria-labelledby={titleId} className="m-auto w-[calc(100%_-_2rem)] max-w-lg max-h-[85dvh] overflow-y-auto p-0 border-[1.5px] border-ink bg-paper-raised text-ink shadow-hard-blueprint backdrop:bg-black/40" onClick={event => {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) event.currentTarget.close();
    }}>
      <div className="flex items-center justify-between gap-4 p-5 border-b border-line"><h2 id={titleId} className="text-lg font-bold">{help.label}</h2><button type="button" aria-label="Close metric information" className="w-10 h-10 shrink-0 flex items-center justify-center border border-line hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-blueprint" onClick={() => dialog.current?.close()}><X className="w-4 h-4" /></button></div>
      <div className="p-5 space-y-5 text-sm"><p>{help.summary}</p><div><h3 className="font-mono text-xs text-blueprint mb-2">// calculation</h3><p>{help.calculation}</p><p className="font-bold mt-2">{current}</p></div><div><h3 className="font-mono text-xs text-blueprint mb-2">// reading this value</h3><p>{help.note}</p></div><div className="border-t border-line pt-4 text-xs text-ink-soft">Creation date (UTC), project, diagram type, and search affect this value. Time grouping changes chart buckets only. Table sorting and pagination do not change the KPI. These cards describe your full filtered dataset, rather than the advanced section’s 28-day analysis window.</div></div>
    </dialog>
  </Card>;
}
