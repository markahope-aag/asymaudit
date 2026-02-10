'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QUEUE_POLL_INTERVAL } from '@/lib/constants';
import type { QueueStatus as QueueStatusType } from '@/types';

export function QueueStatusWidget() {
  const [status, setStatus] = useState<QueueStatusType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/worker/queue-status');
      if (!res.ok) throw new Error('Worker unreachable');
      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch {
      setError('Worker offline');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, QUEUE_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Queue Status</CardTitle>
          <Button variant="ghost" size="icon" onClick={fetchStatus} className="h-8 w-8">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <WifiOff className="w-4 h-4" />
            <span>{error}</span>
          </div>
        ) : loading && !status ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Connecting...</span>
          </div>
        ) : status ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-emerald-500 mb-3">
              <Wifi className="w-4 h-4" />
              <span>Worker connected</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active</span>
                <span className="font-medium">{status.active}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Waiting</span>
                <span className="font-medium">{status.waiting}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed</span>
                <span className="font-medium">{status.completed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Failed</span>
                <span className="font-medium text-destructive">{status.failed}</span>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
