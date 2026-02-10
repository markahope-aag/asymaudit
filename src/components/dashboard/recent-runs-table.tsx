import Link from 'next/link';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn, formatRelativeTime, formatAuditType, getScoreColor } from '@/lib/utils';
import type { AuditRun, AuditStatus, Client } from '@/types';

interface RecentRunsTableProps {
  runs: (AuditRun & { client_name?: string })[];
  clients: Client[];
}

export function RecentRunsTable({ runs, clients }: RecentRunsTableProps) {
  const clientMap = new Map(clients.map(c => [c.id, c.name]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Audit Runs</CardTitle>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No audit runs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium text-muted-foreground">Client</th>
                  <th className="pb-2 font-medium text-muted-foreground">Audit Type</th>
                  <th className="pb-2 font-medium text-muted-foreground">Status</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Score</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b last:border-0 hover:bg-muted/5">
                    <td className="py-2.5">
                      <Link
                        href={`/clients/${run.client_id}`}
                        className="font-medium hover:text-accent transition-colors"
                      >
                        {clientMap.get(run.client_id) || 'Unknown'}
                      </Link>
                    </td>
                    <td className="py-2.5">
                      <Link
                        href={`/clients/${run.client_id}/audits/${run.audit_type}`}
                        className="hover:text-accent transition-colors"
                      >
                        {formatAuditType(run.audit_type)}
                      </Link>
                    </td>
                    <td className="py-2.5">
                      <StatusBadge status={run.status as AuditStatus} />
                    </td>
                    <td className={cn('py-2.5 text-right font-bold', getScoreColor(run.overall_score))}>
                      {run.overall_score != null ? run.overall_score : '—'}
                    </td>
                    <td className="py-2.5 text-right text-muted-foreground">
                      {formatRelativeTime(run.started_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
