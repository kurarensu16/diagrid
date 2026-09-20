import React from 'react';
import { Card } from '../ui/Card';
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';

export interface AdminKpiCardProps {
  label: string;
  value: string | number;
  deltaPct?: number;
  deltaLabel?: string;
  icon: LucideIcon;
  variant?: 'blueprint' | 'signal' | 'ink';
  sparklineData?: number[];
  subtext?: string;
}

export const AdminKpiCard: React.FC<AdminKpiCardProps> = ({
  label,
  value,
  deltaPct,
  deltaLabel = 'vs last period',
  icon: Icon,
  variant = 'blueprint',
  sparklineData,
  subtext,
}) => {
  const isPositive = deltaPct !== undefined && deltaPct > 0;
  const isNegative = deltaPct !== undefined && deltaPct < 0;

  // Render a minimal SVG sparkline if data is provided
  const renderSparkline = () => {
    if (!sparklineData || sparklineData.length < 2) return null;

    const min = Math.min(...sparklineData);
    const max = Math.max(...sparklineData);
    const range = max - min || 1;
    const width = 80;
    const height = 24;
    const padding = 2;

    const points = sparklineData
      .map((val, idx) => {
        const x = (idx / (sparklineData.length - 1)) * (width - padding * 2) + padding;
        const y = height - padding - ((val - min) / range) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(' ');

    const strokeColor =
      variant === 'signal' ? '#D45B33' : variant === 'blueprint' ? '#1E5C8C' : '#15191C';

    return (
      <svg width={width} height={height} className="overflow-visible shrink-0 opacity-80">
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  return (
    <Card variant={variant} className="p-5 flex flex-col justify-between gap-4 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] text-ink-soft uppercase tracking-wider font-bold">
            // {label}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-[32px] sm:text-[36px] font-bold leading-none tracking-tight text-ink">
              {value}
            </span>
          </div>
        </div>
        <div className="p-2 border border-line bg-paper-raised text-ink shrink-0">
          <Icon className={`w-5 h-5 ${variant === 'signal' ? 'text-signal' : variant === 'blueprint' ? 'text-blueprint' : 'text-ink'}`} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-line border-dashed font-mono text-[11px]">
        {deltaPct !== undefined ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 border text-[10px] font-bold ${
                isPositive
                  ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                  : isNegative
                  ? 'border-signal/40 text-signal bg-signal/10'
                  : 'border-line text-ink-soft bg-paper'
              }`}
            >
              {isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : isNegative ? (
                <TrendingDown className="w-3 h-3" />
              ) : (
                <Minus className="w-3 h-3" />
              )}
              <span>
                {isPositive ? '+' : ''}
                {deltaPct}%
              </span>
            </span>
            <span className="text-ink-soft text-[10px] truncate">{deltaLabel}</span>
          </div>
        ) : subtext ? (
          <span className="text-ink-soft text-[10px] truncate">{subtext}</span>
        ) : (
          <span className="text-ink-soft text-[10px]">// telemetry_ok</span>
        )}

        {renderSparkline()}
      </div>
    </Card>
  );
};
