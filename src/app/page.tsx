import { StatsRow } from '@/components/dashboard/stats-row';
import { ClientHealthGrid } from '@/components/dashboard/client-health-grid';
import { RecentRunsTable } from '@/components/dashboard/recent-runs-table';
import { QueueStatusWidget } from '@/components/dashboard/queue-status';
import { TriggerAuditPanel } from '@/components/dashboard/trigger-audit-panel';
import { getDashboardStats, getRecentRuns, getClients } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [stats, recentRuns, clients] = await Promise.all([
    getDashboardStats(),
    getRecentRuns(10),
    getClients(),
  ]);

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-heading font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Marketing audit overview for all clients</p>
      </div>

      <StatsRow
        totalClients={stats.totalClients}
        totalAudits={stats.totalAudits}
        avgScore={stats.avgScore}
        criticalIssues={stats.criticalIssues}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="text-lg font-heading font-bold mb-3">Clients</h2>
            <ClientHealthGrid clients={stats.clients} />
          </div>
          <RecentRunsTable runs={recentRuns} clients={clients} />
        </div>

        <div className="space-y-4">
          <TriggerAuditPanel clients={clients} />
          <QueueStatusWidget />
        </div>
      </div>
    </div>
  );
}
