import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { getClients, getClientIntegrations, getAllSchedules } from '@/lib/data';
import { formatAuditType } from '@/lib/utils';
import { WorkerHealthCheck } from '@/components/settings/worker-health';
import { ClientList } from '@/components/settings/client-list';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [clients, schedules] = await Promise.all([
    getClients(),
    getAllSchedules(),
  ]);

  // Fetch integrations for each client
  const clientIntegrations = await Promise.all(
    clients.map(async (client) => ({
      client,
      integrations: await getClientIntegrations(client.id),
      schedules: schedules.filter(s => s.client_id === client.id),
    }))
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-heading font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage clients, integrations, and audit schedules</p>
      </div>

      <WorkerHealthCheck />

      <div>
        <h2 className="text-lg font-heading font-bold mb-3">Clients & Integrations</h2>
        <div className="space-y-4">
          {clientIntegrations.map(({ client, integrations, schedules: clientSchedules }) => (
            <Card key={client.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{client.name}</CardTitle>
                    <CardDescription>{client.website_url}</CardDescription>
                  </div>
                  <Badge variant={client.is_active ? 'success' : 'secondary'}>
                    {client.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Integrations */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Integrations</h4>
                  {integrations.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No integrations configured.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {integrations.map((integration) => (
                        <Badge
                          key={integration.id}
                          variant={integration.is_active ? 'info' : 'outline'}
                        >
                          {integration.platform.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Schedules */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Audit Schedules</h4>
                  {clientSchedules.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No schedules configured.</p>
                  ) : (
                    <div className="space-y-1">
                      {clientSchedules.map((schedule) => (
                        <div key={schedule.id} className="flex items-center justify-between text-xs py-1">
                          <span>{formatAuditType(schedule.audit_type)}</span>
                          <div className="flex items-center gap-2">
                            <code className="text-muted-foreground font-mono">{schedule.cron_expression}</code>
                            <Badge variant={schedule.is_active ? 'success' : 'outline'} className="text-[10px]">
                              {schedule.is_active ? 'On' : 'Off'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
