'use client';

import { useState } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RunTriggerButtonProps {
  clientId: string;
  auditType?: string;
  label?: string;
  variant?: 'default' | 'accent' | 'outline';
  size?: 'default' | 'sm';
}

export function RunTriggerButton({
  clientId,
  auditType,
  label,
  variant = 'accent',
  size = 'sm',
}: RunTriggerButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const endpoint = auditType ? '/api/worker/trigger' : '/api/worker/trigger-all';
      const body = auditType
        ? { clientId, auditType }
        : { clientId };

      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      // Silently fail - user can retry
    } finally {
      setTimeout(() => setLoading(false), 2000);
    }
  }

  const text = label || (auditType ? 'Run Audit' : 'Run All Audits');

  return (
    <Button variant={variant} size={size} disabled={loading} onClick={handleClick}>
      {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Play className="w-4 h-4 mr-1.5" />}
      {text}
    </Button>
  );
}
