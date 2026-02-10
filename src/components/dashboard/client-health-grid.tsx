import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ScoreGauge } from '@/components/ui/score-gauge';
import { Badge } from '@/components/ui/badge';
import { cn, formatRelativeTime, getTrendArrow, getTrendColor } from '@/lib/utils';
import type { ClientWithStats } from '@/types';

interface ClientHealthGridProps {
  clients: ClientWithStats[];
}

export function ClientHealthGrid({ clients }: ClientHealthGridProps) {
  if (clients.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No clients found. Add clients in Settings.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {clients.map((client) => (
        <Link key={client.id} href={`/clients/${client.id}`}>
          <Card className="hover:border-accent/50 transition-colors cursor-pointer h-full">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading font-bold text-base truncate">{client.name}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    {client.website_url.replace(/^https?:\/\//, '')}
                  </p>
                </div>
                <ScoreGauge score={client.latestScore} size={64} strokeWidth={5} />
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-medium', getTrendColor(client.latestScore, client.previousScore))}>
                    {getTrendArrow(client.latestScore, client.previousScore)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(client.lastAuditDate)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {client.criticalIssues > 0 && (
                    <Badge variant="destructive">{client.criticalIssues} critical</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
