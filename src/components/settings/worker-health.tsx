'use client';

import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function WorkerHealthCheck() {
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  async function check() {
    setLoading(true);
    try {
      const res = await fetch('/api/worker/queue-status');
      setHealthy(res.ok);
    } catch {
      setHealthy(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { check(); }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Worker Service</CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={check}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {healthy === null ? (
          <p className="text-sm text-muted-foreground">Checking...</p>
        ) : healthy ? (
          <div className="flex items-center gap-2 text-sm text-emerald-500">
            <Wifi className="w-4 h-4" />
            <span>Worker service is healthy (worker.asymmetric.pro)</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <WifiOff className="w-4 h-4" />
            <span>Worker service is unreachable</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
