import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ScoreGauge } from '@/components/ui/score-gauge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { IssuesTable } from '@/components/dashboard/issues-table';
import { DiffViewer } from '@/components/dashboard/diff-viewer';
import { RunTriggerButton } from '@/components/dashboard/run-trigger-button';
import { RawDataViewer } from '@/components/dashboard/raw-data-viewer';
import { getClient, getAuditRun, getDiffForRun } from '@/lib/data';
import { formatAuditType, formatDateTime, getScoreColor, cn } from '@/lib/utils';
import type { AuditStatus, AuditIssue, AuditRecommendation } from '@/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: { clientId: string; auditType: string; runId: string };
}

export default async function RunDetailPage({ params }: Props) {
  const [client, run, diff] = await Promise.all([
    getClient(params.clientId),
    getAuditRun(params.runId),
    getDiffForRun(params.runId),
  ]);

  if (!client || !run) notFound();

  const issues = (run.issues ?? []) as AuditIssue[];
  const recommendations = (run.recommendations ?? []) as AuditRecommendation[];
  const analysis = run.ai_analysis;

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Link href="/" className="hover:text-accent">Dashboard</Link>
        <span>/</span>
        <Link href={`/clients/${client.id}`} className="hover:text-accent">{client.name}</Link>
        <span>/</span>
        <Link href={`/clients/${client.id}/audits/${run.audit_type}`} className="hover:text-accent">
          {formatAuditType(run.audit_type)}
        </Link>
        <span>/</span>
        <span className="text-foreground">Run Details</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold">{formatAuditType(run.audit_type)} Run</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDateTime(run.started_at)}
            {run.completed_at && ` — Completed ${formatDateTime(run.completed_at)}`}
          </p>
          <StatusBadge status={run.status as AuditStatus} className="mt-2" />
        </div>
        <div className="flex items-center gap-4">
          <ScoreGauge score={run.overall_score} size={96} strokeWidth={7} />
          <RunTriggerButton clientId={client.id} auditType={run.audit_type} label="Re-run" />
        </div>
      </div>

      {/* AI Analysis Summary */}
      {analysis && (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="font-heading font-bold">AI Analysis</h2>
          <p className="text-sm">{analysis.summary}</p>
          {analysis.trendAnalysis && (
            <p className="text-sm text-muted-foreground">{analysis.trendAnalysis}</p>
          )}
          {analysis.scores && Object.keys(analysis.scores).length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Category Scores</h3>
              <div className="flex flex-wrap gap-4">
                {Object.entries(analysis.scores).map(([key, value]) => (
                  <div key={key} className="text-center min-w-[60px]">
                    <p className={cn('text-xl font-bold', getScoreColor(value))}>{value}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="rounded-lg border bg-card p-5 space-y-3">
          <h2 className="font-heading font-bold">Recommendations</h2>
          <div className="space-y-2">
            {recommendations
              .sort((a, b) => {
                const order = { high: 0, medium: 1, low: 2 };
                return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
              })
              .map((rec, i) => (
                <div key={i} className="border rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'warning' : 'info'}>
                      {rec.priority}
                    </Badge>
                    <div>
                      <h4 className="font-medium text-sm">{rec.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                      <div className="flex gap-4 mt-1">
                        {rec.estimatedImpact && <span className="text-xs text-accent">Impact: {rec.estimatedImpact}</span>}
                        {rec.effort && <span className="text-xs text-muted-foreground">Effort: {rec.effort}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Issues */}
      {issues.length > 0 && <IssuesTable issues={issues} showCategory={false} />}

      {/* Diff */}
      <DiffViewer diff={diff} />

      {/* Raw Data */}
      {run.raw_data && <RawDataViewer data={run.raw_data} />}

      {/* Error */}
      {run.error_message && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <h3 className="font-bold text-destructive text-sm">Error</h3>
          <p className="text-sm text-destructive/80 mt-1 font-mono">{run.error_message}</p>
        </div>
      )}
    </div>
  );
}
