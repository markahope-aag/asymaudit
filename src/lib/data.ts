import { createServerClient } from '@/lib/supabase';
import type { Client, ClientWithStats, AuditRun, AuditSchedule, AuditSnapshot, AuditDiff, ClientIntegration, AuditCategorySummary, AuditType } from '@/types';

function getSupabase() {
  return createServerClient();
}

// --- Clients ---

export async function getClients(): Promise<Client[]> {
  const { data, error } = await getSupabase()
    .from('clients')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return (data ?? []) as Client[];
}

export async function getClient(clientId: string): Promise<Client | null> {
  const { data, error } = await getSupabase()
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (error) return null;
  return data as Client;
}

export async function getClientsWithStats(): Promise<ClientWithStats[]> {
  const clients = await getClients();

  const enriched = await Promise.all(
    clients.map(async (client) => {
      // Get the latest 2 completed runs for this client (for score + trend)
      const { data: runs } = await getSupabase()
        .from('audit_runs')
        .select('overall_score, started_at, issues')
        .eq('client_id', client.id)
        .eq('status', 'complete')
        .order('started_at', { ascending: false })
        .limit(2);

      const latest = runs?.[0];
      const previous = runs?.[1];
      const issues = latest?.issues as Array<{ severity: string }> | null;
      const criticalIssues = issues?.filter(i => i.severity === 'critical').length ?? 0;

      // Get total run count
      const { count } = await getSupabase()
        .from('audit_runs')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', client.id);

      return {
        ...client,
        latestScore: latest?.overall_score ?? null,
        previousScore: previous?.overall_score ?? null,
        lastAuditDate: latest?.started_at ?? null,
        criticalIssues,
        totalRuns: count ?? 0,
      } satisfies ClientWithStats;
    })
  );

  return enriched;
}

// --- Audit Runs ---

export async function getRecentRuns(limit = 10): Promise<AuditRun[]> {
  const { data, error } = await getSupabase()
    .from('audit_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as AuditRun[];
}

export async function getClientRuns(clientId: string, auditType?: string, limit = 20): Promise<AuditRun[]> {
  let query = getSupabase()
    .from('audit_runs')
    .select('*')
    .eq('client_id', clientId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (auditType) {
    query = query.eq('audit_type', auditType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AuditRun[];
}

export async function getAuditRun(runId: string): Promise<AuditRun | null> {
  const { data, error } = await getSupabase()
    .from('audit_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (error) return null;
  return data as AuditRun;
}

// --- Snapshots (for trends) ---

export async function getSnapshots(clientId: string, auditType: string, metricKey = 'overall_score', limit = 10): Promise<AuditSnapshot[]> {
  const { data, error } = await getSupabase()
    .from('audit_snapshots')
    .select('*')
    .eq('client_id', clientId)
    .eq('audit_type', auditType)
    .eq('metric_key', metricKey)
    .order('captured_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as AuditSnapshot[];
}

// --- Diffs ---

export async function getLatestDiff(clientId: string, auditType: string): Promise<AuditDiff | null> {
  const { data, error } = await getSupabase()
    .from('audit_diffs')
    .select('*')
    .eq('client_id', clientId)
    .eq('audit_type', auditType)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data as AuditDiff;
}

export async function getDiffForRun(runId: string): Promise<AuditDiff | null> {
  const { data, error } = await getSupabase()
    .from('audit_diffs')
    .select('*')
    .eq('current_run_id', runId)
    .limit(1)
    .single();

  if (error) return null;
  return data as AuditDiff;
}

// --- Integrations ---

export async function getClientIntegrations(clientId: string): Promise<ClientIntegration[]> {
  const { data, error } = await getSupabase()
    .from('client_integrations')
    .select('*')
    .eq('client_id', clientId)
    .order('platform');

  if (error) throw error;
  return (data ?? []) as ClientIntegration[];
}

// --- Schedules ---

export async function getClientSchedules(clientId: string): Promise<AuditSchedule[]> {
  const { data, error } = await getSupabase()
    .from('audit_schedules')
    .select('*')
    .eq('client_id', clientId)
    .order('audit_type');

  if (error) throw error;
  return (data ?? []) as AuditSchedule[];
}

export async function getAllSchedules(): Promise<AuditSchedule[]> {
  const { data, error } = await getSupabase()
    .from('audit_schedules')
    .select('*')
    .order('client_id');

  if (error) throw error;
  return (data ?? []) as AuditSchedule[];
}

// --- Aggregate stats ---

export async function getDashboardStats() {
  const clients = await getClientsWithStats();
  const activeClients = clients.length;

  // Count audits from this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { count: weekAudits } = await getSupabase()
    .from('audit_runs')
    .select('*', { count: 'exact', head: true })
    .gte('started_at', weekAgo.toISOString());

  // Average score across latest runs
  const scores = clients.map(c => c.latestScore).filter((s): s is number => s != null);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  // Total critical issues
  const criticalIssues = clients.reduce((sum, c) => sum + c.criticalIssues, 0);

  return {
    clients,
    totalClients: activeClients,
    totalAudits: weekAudits ?? 0,
    avgScore,
    criticalIssues,
  };
}

// --- Client audit category summaries ---

export async function getClientAuditSummaries(clientId: string): Promise<AuditCategorySummary[]> {
  // Get all completed runs for this client
  const { data: runs } = await getSupabase()
    .from('audit_runs')
    .select('audit_type, overall_score, issues, started_at')
    .eq('client_id', clientId)
    .eq('status', 'complete')
    .order('started_at', { ascending: false });

  if (!runs || runs.length === 0) return [];

  // Group by audit type and get latest + trend
  const byType = new Map<string, typeof runs>();
  for (const run of runs) {
    const existing = byType.get(run.audit_type) || [];
    existing.push(run);
    byType.set(run.audit_type, existing);
  }

  const summaries: AuditCategorySummary[] = [];
  for (const [auditType, typeRuns] of Array.from(byType.entries())) {
    const latest = typeRuns[0];
    const issues = (latest.issues as Array<{ severity: string }>) || [];

    // Build trend from snapshots
    const snapshots = await getSnapshots(clientId, auditType, 'overall_score', 5);
    const trendData = snapshots.map(s => ({
      date: s.captured_at,
      score: s.metric_value,
    }));

    summaries.push({
      auditType: auditType as AuditType,
      latestScore: latest.overall_score,
      issueCount: {
        critical: issues.filter(i => i.severity === 'critical').length,
        warning: issues.filter(i => i.severity === 'warning').length,
        info: issues.filter(i => i.severity === 'info').length,
      },
      lastRunAt: latest.started_at,
      trendData,
    });
  }

  return summaries;
}
