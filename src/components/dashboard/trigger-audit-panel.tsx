'use client';

import { useState } from 'react';
import { Play, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatAuditType } from '@/lib/utils';
import { AUDIT_TYPES_BY_PLATFORM } from '@/lib/constants';
import type { Client, AuditType } from '@/types';

interface TriggerAuditPanelProps {
  clients: Client[];
}

type TriggerState = 'idle' | 'loading' | 'success' | 'error';

export function TriggerAuditPanel({ clients }: TriggerAuditPanelProps) {
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedAudit, setSelectedAudit] = useState('');
  const [state, setState] = useState<TriggerState>('idle');
  const [message, setMessage] = useState('');

  const allAuditTypes = Object.values(AUDIT_TYPES_BY_PLATFORM).flat();

  async function handleTrigger() {
    if (!selectedClient) return;
    setState('loading');
    setMessage('');

    try {
      const endpoint = selectedAudit ? '/api/worker/trigger' : '/api/worker/trigger-all';
      const body = selectedAudit
        ? { clientId: selectedClient, auditType: selectedAudit }
        : { clientId: selectedClient };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to trigger audit');
      }

      setState('success');
      setMessage(selectedAudit ? `Audit started (Run ID: ${data.runId})` : `${data.totalAudits} audits started`);
      setTimeout(() => { setState('idle'); setMessage(''); }, 5000);
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Unknown error');
      setTimeout(() => { setState('idle'); setMessage(''); }, 5000);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Trigger Audit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <select
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Select client...</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={selectedAudit}
          onChange={(e) => setSelectedAudit(e.target.value)}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All audits (full suite)</option>
          {allAuditTypes.map((type) => (
            <option key={type} value={type}>{formatAuditType(type)}</option>
          ))}
        </select>

        <Button
          variant="accent"
          className="w-full"
          disabled={!selectedClient || state === 'loading'}
          onClick={handleTrigger}
        >
          {state === 'loading' ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running...</>
          ) : state === 'success' ? (
            <><CheckCircle2 className="w-4 h-4 mr-2" /> Started</>
          ) : state === 'error' ? (
            <><XCircle className="w-4 h-4 mr-2" /> Failed</>
          ) : (
            <><Play className="w-4 h-4 mr-2" /> {selectedAudit ? 'Run Audit' : 'Run All Audits'}</>
          )}
        </Button>

        {message && (
          <p className={`text-xs ${state === 'error' ? 'text-destructive' : 'text-emerald-500'}`}>
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
