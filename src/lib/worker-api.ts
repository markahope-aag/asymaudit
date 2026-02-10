import type { QueueStatus, TriggerResponse, TriggerAllResponse, WorkerHealth } from '@/types';

const WORKER_URL = process.env.WORKER_SERVICE_URL || 'https://worker.asymmetric.pro';
const WORKER_API_KEY = process.env.WORKER_API_KEY || '';

async function workerFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${WORKER_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': WORKER_API_KEY,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`Worker API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function getWorkerHealth(): Promise<WorkerHealth> {
  return workerFetch<WorkerHealth>('/health');
}

export async function getQueueStatus(): Promise<QueueStatus> {
  return workerFetch<QueueStatus>('/api/queue/status');
}

export async function triggerAudit(
  clientId: string,
  auditType: string,
  priority?: number
): Promise<TriggerResponse> {
  return workerFetch<TriggerResponse>('/api/audit/trigger', {
    method: 'POST',
    body: JSON.stringify({ clientId, auditType, priority }),
  });
}

export async function triggerAllAudits(
  clientId: string,
  priority?: number
): Promise<TriggerAllResponse> {
  return workerFetch<TriggerAllResponse>('/api/audit/trigger-all', {
    method: 'POST',
    body: JSON.stringify({ clientId, priority }),
  });
}

export async function getAuditRunStatus(runId: string) {
  return workerFetch<{ run: Record<string, unknown>; job: Record<string, unknown> | null }>(
    `/api/audit/status/${runId}`
  );
}
