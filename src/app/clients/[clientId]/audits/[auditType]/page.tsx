import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ScoreGauge } from '@/components/ui/score-gauge';
import { StatusBadge } from '@/components/ui/status-badge';
import { TrendChart } from '@/components/dashboard/trend-chart';
import { IssuesTable } from '@/components/dashboard/issues-table';
import { DiffViewer } from '@/components/dashboard/diff-viewer';
import { RunTriggerButton } from '@/components/dashboard/run-trigger-button';
import { getClient, getClientRuns, getSnapshots, getLatestDiff } from '@/lib/data';
import { formatAuditType, formatDateTime, getScoreColor, cn } from '@/lib/utils';
import type { AuditStatus, AuditIssue } from '@/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: { clientId: string; auditType: string };
}

export default async function AuditTypeDetailPage({ params }: Props) {
  const client = await getClient(params.clientId);
  if (!client) notFound();

  const [runs, snapshots, latestDiff] = await Promise.all([
    getClientRuns(params.clientId, params.auditType, 20),
    getSnapshots(params.clientId, params.auditType, 'overall_score', 10),
    getLatestDiff(params.clientId, params.auditType),
  ]);

  const latestRun = runs[0];
  const trendData = snapshots.map(s => ({ date: s.captured_at, score: s.metric_value }));
  const issues = (latestRun?.issues ?? []) as AuditIssue[];

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-accent">Dashboard</Link>
        <span>/</span>
        <Link href={`/clients/${client.id}`} className="hover:text-accent">{client.name}</Link>
        <span>/</span>
        <span className="text-foreground">{formatAuditType(params.auditType)}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold">{formatAuditType(params.auditType)}</h1>
          <p className="text-sm text-muted-foreground mt-1">{client.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <ScoreGauge score={latestRun?.overall_score ?? null} size={80} strokeWidth={6} />
          <RunTriggerButton clientId={client.id} auditType={params.auditType} />
        </div>
      </div>

      {/* Latest run summary */}
      {latestRun?.ai_analysis && (
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm">{latestRun.ai_analysis.summary}</p>
          {latestRun.ai_analysis.scores && (
            <div className="flex flex-wrap gap-3 mt-3">
              {Object.entries(latestRun.ai_analysis.scores).map(([key, value]) => (
                <div key={key} className="text-center">
                  <p className={cn('text-lg font-bold', getScoreColor(value))}>{value}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendChart data={trendData} />
        <DiffViewer diff={latestDiff} />
      </div>

      {/* Issues */}
      {issues.length > 0 && <IssuesTable issues={issues} showCategory={false} />}

      {/* Run History */}
      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <h3 className="font-heading font-bold">Run History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-3 font-medium text-muted-foreground">Date</th>
                <th className="p-3 font-medium text-muted-foreground">Status</th>
                <th className="p-3 font-medium text-muted-foreground text-right">Score</th>
                <th className="p-3 font-medium text-muted-foreground text-right">Issues</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b last:border-0 hover:bg-muted/5">
                  <td className="p-3">
                    <Link
                      href={`/clients/${client.id}/audits/${params.auditType}/${run.id}`}
                      className="hover:text-accent transition-colors"
                    >
                      {formatDateTime(run.started_at)}
                    </Link>
                  </td>
                  <td className="p-3">
                    <StatusBadge status={run.status as AuditStatus} />
                  </td>
                  <td className={cn('p-3 text-right font-bold', getScoreColor(run.overall_score))}>
                    {run.overall_score ?? '—'}
                  </td>
                  <td className="p-3 text-right text-muted-foreground">
                    {(run.issues as AuditIssue[] | null)?.length ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
