'use client';

import { cn } from '@/lib/utils';

interface ScoreGaugeProps {
  score: number | null | undefined;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
}

export function ScoreGauge({ score, size = 80, strokeWidth = 6, className, showLabel = true }: ScoreGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = score != null ? Math.max(0, Math.min(100, score)) : 0;
  const offset = circumference - (normalizedScore / 100) * circumference;

  const color = score == null
    ? 'stroke-muted-foreground'
    : score >= 75
      ? 'stroke-emerald-500'
      : score >= 50
        ? 'stroke-amber-500'
        : 'stroke-red-500';

  const textColor = score == null
    ? 'text-muted-foreground'
    : score >= 75
      ? 'text-emerald-500'
      : score >= 50
        ? 'text-amber-500'
        : 'text-red-500';

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-border"
        />
        {/* Score arc */}
        {score != null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn(color, 'animate-gauge-fill')}
            style={{ '--gauge-offset': offset } as React.CSSProperties}
          />
        )}
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-bold', textColor, size >= 80 ? 'text-lg' : 'text-sm')}>
            {score != null ? score : '—'}
          </span>
        </div>
      )}
    </div>
  );
}
