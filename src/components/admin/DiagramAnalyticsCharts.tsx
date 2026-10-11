import { Card } from '../ui/Card';
import type { DiagramAnalytics } from '../../services/analyticsService';

const colors = ['#1E5C8C', '#D45B33', '#237B65', '#8254A0', '#A27619', '#518CAF', '#B25676', '#686D75', '#375641'];
export function DiagramAnalyticsCharts({ data }: { data: DiagramAnalytics }) {
  let angle = -Math.PI / 2;
  const max = Math.max(1, ...data.series.map(p => p.count));
  const points = data.series.map((p, i) => `${50 + i / Math.max(1, data.series.length - 1) * 560},${210 - p.count / max * 170}`).join(' ');
  const top = data.projects.slice(0, 10);
  const maxProject = Math.max(1, ...top.map(p => p.count));
  return <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
    <Card><h2 className="text-lg font-bold">Diagram types</h2><p className="text-sm text-ink-soft mb-4">Share of matching diagrams</p>
      {!data.total_diagrams ? <p>No diagrams match these filters.</p> : <div className="flex flex-wrap items-center gap-6">
        <svg viewBox="0 0 220 220" className="w-56 h-56" role="img" aria-label="Pie chart of diagram types">
          {data.types.map((t, i) => {
            const next = angle + t.count / data.total_diagrams * Math.PI * 2;
            const path = `M 110 110 L ${110 + 95 * Math.cos(angle)} ${110 + 95 * Math.sin(angle)} A 95 95 0 ${next - angle > Math.PI ? 1 : 0} 1 ${110 + 95 * Math.cos(next)} ${110 + 95 * Math.sin(next)} Z`;
            angle = next;
            const label = `${t.label}: ${t.count} (${(t.count / data.total_diagrams * 100).toFixed(1)}%)`;
            return t.count === data.total_diagrams ? <circle key={t.label} cx="110" cy="110" r="95" fill={colors[i % colors.length]} tabIndex={0}><title>{label}</title></circle> : <path key={t.label} d={path} fill={colors[i % colors.length]} stroke="var(--color-paper, white)" tabIndex={0}><title>{label}</title></path>;
          })}
        </svg>
        <ul className="flex-1 min-w-40 space-y-2 text-sm">{data.types.map((t, i) => <li key={t.label} className="flex items-center gap-2"><span className="w-3 h-3 shrink-0" style={{ background: colors[i % colors.length] }} /><span className="flex-1">{t.label.toUpperCase()}</span><span>{t.count} · {(t.count / data.total_diagrams * 100).toFixed(1)}%</span></li>)}</ul>
      </div>}
    </Card>
    <Card><h2 className="text-lg font-bold">Diagrams created over time</h2><p className="text-sm text-ink-soft mb-4">Per {data.bucket} · UTC · current records by creation date</p>
      {!data.total_diagrams ? <p>No diagrams match these filters.</p> : <svg viewBox="0 0 650 260" className="w-full" role="img" aria-label={`Line chart of diagrams created per ${data.bucket}`}>
        {[0, .5, 1].map(r => <g key={r}><line x1="50" x2="610" y1={210 - r * 170} y2={210 - r * 170} stroke="currentColor" opacity=".15"/><text x="40" y={215 - r * 170} textAnchor="end" fill="currentColor" fontSize="12">{(max * r).toFixed(max % 2 ? 1 : 0)}</text></g>)}
        <polyline points={points} fill="none" stroke="#1E5C8C" strokeWidth="3"/>
        {data.series.map((p, i) => <circle key={p.date} cx={50 + i / Math.max(1, data.series.length - 1) * 560} cy={210 - p.count / max * 170} r="4" fill="#D45B33" tabIndex={0}><title>{p.date}: {p.count} diagrams</title></circle>)}
        {data.series.filter((_, i) => i === 0 || i === data.series.length - 1 || i === Math.floor(data.series.length / 2)).map(p => <text key={p.date} x={50 + data.series.indexOf(p) / Math.max(1, data.series.length - 1) * 560} y="240" textAnchor="middle" fill="currentColor" fontSize="12">{p.date}</text>)}
      </svg>}
      <details className="mt-3 text-sm"><summary className="cursor-pointer">Exact time-series values</summary><div className="max-h-48 overflow-auto mt-2">{data.series.map(p => <p key={p.date}>{p.date}: {p.count} diagrams</p>)}</div></details>
    </Card>
    <Card className="xl:col-span-2"><h2 className="text-lg font-bold">{data.projects.length > 10 ? 'Top 10 projects by diagram count' : 'Diagrams by project'}</h2><p className="text-sm text-ink-soft mb-4">Matching diagrams per project · records below include all projects</p>
      {!top.length ? <p>No diagrams match these filters.</p> : <div role="img" aria-label="Horizontal bar chart of diagrams by project" className="space-y-3">{top.map(p => <div key={p.id} className="grid grid-cols-[minmax(90px,1fr)_3fr_40px] gap-3 items-center text-sm"><span className="truncate" title={p.label}>{p.label}</span><div className="h-6 bg-paper border border-line"><div className="h-full bg-blueprint" style={{ width: `${p.count / maxProject * 100}%` }} title={`${p.label}: ${p.count} diagrams`} /></div><span>{p.count}</span></div>)}</div>}
    </Card>
  </div>;
}
