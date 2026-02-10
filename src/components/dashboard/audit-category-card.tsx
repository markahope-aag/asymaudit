import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScoreGauge } from '@/components/ui/score-gauge';
import { SparklineChart } from '@/components/dashboard/sparkline-chart';
import { formatAuditType, formatRelativeTime } from '@/lib/utils';
import type { AuditCategorySummary } from '@/types';

interface AuditCategoryCardProps {
  summary: AuditCategorySummary;
  clientId: string;
}

export function AuditCategoryCard({ summary, clientId }: AuditCategoryCardProps) {
  return (
    <Link href={`/clients/${clientId}/audits/${summary.auditType}`}>
      <Card className="hover:border-accent/50 transition-colors cursor-pointer h-full">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-heading font-bold text-sm">{formatAuditType(summary.auditType)}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatRelativeTime(summary.lastRunAt)}
              </p>
            </div>
            <ScoreGauge score={summary.latestScore} size={48} strokeWidth={4} />
          </div>

          <div className="flex items-center gap-1.5 mt-3">
            {summary.issueCount.critical > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{summary.issueCount.critical}</Badge>
            )}
            {summary.issueCount.warning > 0 && (
              <Badge variant="warning" className="text-[10px] px-1.5 py-0">{summary.issueCount.warning}</Badge>
            )}
            {summary.issueCount.info > 0 && (
              <Badge variant="info" className="text-[10px] px-1.5 py-0">{summary.issueCount.info}</Badge>
            )}
          </div>

          {summary.trendData.length > 1 && (
            <div className="mt-2 h-8">
              <SparklineChart data={summary.trendData} />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
