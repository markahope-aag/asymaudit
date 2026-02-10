import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { ScoreGauge } from '@/components/ui/score-gauge';
import { AuditCategoryCard } from '@/components/dashboard/audit-category-card';
import { IssuesTable } from '@/components/dashboard/issues-table';
import { RunTriggerButton } from '@/components/dashboard/run-trigger-button';
import { getClient, getClientAuditSummaries, getClientRuns } from '@/lib/data';
import { formatRelativeTime } from '@/lib/utils';
import type { AuditIssue } from '@/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: { clientId: string };
}

export default async function ClientDetailPage({ params }: Props) {
  const client = await getClient(params.clientId);
  if (!client) notFound();

  const [summaries, recentRuns] = await Promise.all([
    getClientAuditSummaries(params.clientId),
    getClientRuns(params.clientId, undefined, 5),
  ]);

  // Latest overall score from most recent complete run
  const latestRun = recentRuns.find(r => r.status === 'complete');
  const overallScore = latestRun?.overall_score ?? null;

  // Aggregate all issues from latest runs per type
  const allIssues: AuditIssue[] = summaries.flatMap(s => {
    const run = recentRuns.find(r => r.audit_type === s.auditType && r.status === 'complete');
    return (run?.issues ?? []) as AuditIssue[];
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Breadcrumb */}
      <Link href="/" className="text-sm text-muted-foreground hover:text-accent inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Dashboard
      </Link>

      {/* Hero */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold">{client.name}</h1>
          <a
            href={client.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-accent inline-flex items-center gap-1 mt-1"
          >
            {client.website_url} <ExternalLink className="w-3 h-3" />
          </a>
          <p className="text-xs text-muted-foreground mt-1">
            Last audit: {formatRelativeTime(latestRun?.started_at)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ScoreGauge score={overallScore} size={96} strokeWidth={7} />
          <div className="flex flex-col gap-2">
            <RunTriggerButton clientId={client.id} label="Run Full Audit" />
            <RunTriggerButton clientId={client.id} auditType="wordpress_health" label="WP Audit" variant="outline" />
          </div>
        </div>
      </div>

      {/* Audit Categories */}
      {summaries.length > 0 ? (
        <div>
          <h2 className="text-lg font-heading font-bold mb-3">Audit Categories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {summaries.map((s) => (
              <AuditCategoryCard key={s.auditType} summary={s} clientId={client.id} />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No audit data yet. Run an audit to see results.
        </div>
      )}

      {/* All Issues */}
      {allIssues.length > 0 && <IssuesTable issues={allIssues} />}
    </div>
  );
}
