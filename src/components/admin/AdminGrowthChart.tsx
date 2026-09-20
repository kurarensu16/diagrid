import React, { useState } from 'react';
import { Card } from '../ui/Card';
import type { TimeSeriesPoint } from '../../services/adminService';
import { TrendingUp, Users, FileText } from 'lucide-react';

export interface AdminGrowthChartProps {
  data: TimeSeriesPoint[];
  title?: string;
  subtitle?: string;
}

export const AdminGrowthChart: React.FC<AdminGrowthChartProps> = ({
  data,
  title = 'platform_growth_metrics',
  subtitle = '// time-series trajectory of signups, active users, and diagram creations',
}) => {
  const [activeMetric, setActiveMetric] = useState<'users' | 'diagrams'>('users');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <Card variant="ink" className="p-6">
        <div className="font-mono text-ink-soft text-[12px]">// no_time_series_data_available</div>
      </Card>
    );
  }

  // Chart dimensions
  const height = 220;
  const paddingX = 40;
  const paddingTop = 20;
  const paddingBottom = 30;
  const chartHeight = height - paddingTop - paddingBottom;

  // Values calculation
  const valuesPrimary = activeMetric === 'users' ? data.map((d) => d.signups) : data.map((d) => d.diagrams);
  const valuesSecondary = activeMetric === 'users' ? data.map((d) => d.activeUsers) : [];

  const allValues = [...valuesPrimary, ...valuesSecondary];
  const maxVal = Math.max(...allValues, 1);

  // SVG coordinates generator
  const getPoints = (vals: number[], width: number) => {
    return vals.map((v, i) => {
      const x = paddingX + (i / (vals.length - 1 || 1)) * (width - paddingX * 2);
      const y = paddingTop + chartHeight - (v / maxVal) * chartHeight;
      return { x, y, value: v };
    });
  };

  const totalPrimary = valuesPrimary.reduce((a, b) => a + b, 0);

  return (
    <Card variant="ink" className="p-6 flex flex-col gap-4">
      {/* Header with Metric Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h2 className="text-[18px] font-bold tracking-tight text-ink">{title}</h2>
          <p className="text-[11px] text-ink-soft font-mono mt-0.5">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Total badge */}
          <div className="font-mono text-[11px] font-bold px-2 py-0.5 border border-line bg-paper-raised text-ink">
            {activeMetric === 'users' ? `+${totalPrimary} signups` : `+${totalPrimary} diagrams`}
          </div>

          {/* Metric Switcher */}
          <div className="inline-flex border border-ink bg-paper p-0.5 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setActiveMetric('users')}
              className={`flex items-center gap-1.5 px-2.5 py-1 font-bold cursor-pointer transition-colors ${
                activeMetric === 'users'
                  ? 'bg-ink text-paper'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>Users</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMetric('diagrams')}
              className={`flex items-center gap-1.5 px-2.5 py-1 font-bold cursor-pointer transition-colors ${
                activeMetric === 'diagrams'
                  ? 'bg-ink text-paper'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>Diagrams</span>
            </button>
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="w-full relative">
        <svg
          viewBox={`0 0 700 ${height}`}
          className="w-full h-[220px] overflow-visible select-none"
          preserveAspectRatio="none"
        >
          {/* Horizontal Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = paddingTop + chartHeight * (1 - ratio);
            const valLabel = Math.round(maxVal * ratio);
            return (
              <g key={ratio}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={700 - paddingX}
                  y2={y}
                  stroke="currentColor"
                  className="text-line"
                  strokeDasharray="2 2"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="font-mono text-[9px] fill-ink-soft"
                >
                  {valLabel}
                </text>
              </g>
            );
          })}

          {/* Render Active Users Area & Line (Secondary when viewing Users) */}
          {activeMetric === 'users' && (() => {
            const pts = getPoints(valuesSecondary, 700);
            const pathD = pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
            const areaD = `${pathD} L ${pts[pts.length - 1].x} ${paddingTop + chartHeight} L ${pts[0].x} ${paddingTop + chartHeight} Z`;

            return (
              <g>
                <path d={areaD} fill="#1E5C8C" fillOpacity="0.08" />
                <path
                  d={pathD}
                  fill="none"
                  stroke="#1E5C8C"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  strokeOpacity="0.7"
                />
              </g>
            );
          })()}

          {/* Render Primary Line and Area */}
          {(() => {
            const pts = getPoints(valuesPrimary, 700);
            const pathD = pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
            const areaD = `${pathD} L ${pts[pts.length - 1].x} ${paddingTop + chartHeight} L ${pts[0].x} ${paddingTop + chartHeight} Z`;
            const strokeColor = activeMetric === 'users' ? '#D45B33' : '#1E5C8C';

            return (
              <g>
                <path d={areaD} fill={strokeColor} fillOpacity="0.12" />
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Data point dots */}
                {pts.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r={hoveredIndex === idx ? 5 : 3}
                    fill={hoveredIndex === idx ? '#fff' : strokeColor}
                    stroke={strokeColor}
                    strokeWidth={hoveredIndex === idx ? 2 : 1}
                    className="transition-all"
                  />
                ))}
              </g>
            );
          })()}

          {/* Interactive vertical hover line */}
          {hoveredIndex !== null && (() => {
            const x = paddingX + (hoveredIndex / (data.length - 1 || 1)) * (700 - paddingX * 2);
            return (
              <line
                x1={x}
                y1={paddingTop}
                x2={x}
                y2={paddingTop + chartHeight}
                stroke="#15191C"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
            );
          })()}

          {/* X Axis Labels */}
          {data.map((d, idx) => {
            const x = paddingX + (idx / (data.length - 1 || 1)) * (700 - paddingX * 2);
            // On long sets, show fewer labels
            const step = data.length > 15 ? Math.ceil(data.length / 7) : 1;
            if (idx % step !== 0 && idx !== data.length - 1) return null;

            return (
              <text
                key={idx}
                x={x}
                y={height - 8}
                textAnchor="middle"
                className={`font-mono text-[10px] ${
                  hoveredIndex === idx ? 'fill-ink font-bold' : 'fill-ink-soft'
                }`}
              >
                {d.label}
              </text>
            );
          })}

          {/* Transparent interactive hover overlay strips */}
          {data.map((_, idx) => {
            const segW = (700 - paddingX * 2) / (data.length - 1 || 1);
            const x = paddingX + idx * segW - segW / 2;
            return (
              <rect
                key={idx}
                x={Math.max(x, 0)}
                y={paddingTop}
                width={segW}
                height={chartHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredIndex !== null && data[hoveredIndex] && (
          <div
            className="absolute top-2 pointer-events-none border-2 border-ink bg-paper shadow-md px-3 py-2 font-mono text-[11px] z-10"
            style={{
              left: `${Math.min(
                Math.max(
                  (hoveredIndex / (data.length - 1 || 1)) * 100,
                  10
                ),
                85
              )}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-bold text-ink border-b border-line pb-1 mb-1">
              {data[hoveredIndex].date} ({data[hoveredIndex].label})
            </div>
            {activeMetric === 'users' ? (
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between gap-3 text-signal font-bold">
                  <span>Signups:</span>
                  <span>+{data[hoveredIndex].signups}</span>
                </div>
                <div className="flex justify-between gap-3 text-blueprint">
                  <span>Active Users:</span>
                  <span>{data[hoveredIndex].activeUsers}</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-between gap-3 text-blueprint font-bold">
                <span>Diagrams Created:</span>
                <span>+{data[hoveredIndex].diagrams}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart Legend */}
      <div className="flex items-center justify-between border-t border-line pt-3 font-mono text-[11px] text-ink-soft">
        <div className="flex items-center gap-4">
          {activeMetric === 'users' ? (
            <>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1 bg-signal" />
                <span>New Developer Signups</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1 bg-blueprint border-b border-dashed border-blueprint" />
                <span>Active Users (Concurrency)</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1 bg-blueprint" />
              <span>Canvas Sheets Created</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <TrendingUp className="w-3 h-3 text-emerald-600" />
          <span>Real-time aggregate</span>
        </div>
      </div>
    </Card>
  );
};
