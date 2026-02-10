import { Users, BarChart3, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn, getScoreColor } from '@/lib/utils';

interface StatsRowProps {
  totalClients: number;
  totalAudits: number;
  avgScore: number | null;
  criticalIssues: number;
}

const stats = [
  { key: 'clients', label: 'Active Clients', icon: Users },
  { key: 'audits', label: 'Audits This Week', icon: BarChart3 },
  { key: 'avgScore', label: 'Avg Health Score', icon: TrendingUp },
  { key: 'critical', label: 'Critical Issues', icon: AlertCircle },
] as const;

export function StatsRow({ totalClients, totalAudits, avgScore, criticalIssues }: StatsRowProps) {
  const values: Record<string, { value: string; color?: string }> = {
    clients: { value: String(totalClients) },
    audits: { value: String(totalAudits) },
    avgScore: { value: avgScore != null ? String(avgScore) : '—', color: avgScore != null ? getScoreColor(avgScore) : undefined },
    critical: { value: String(criticalIssues), color: criticalIssues > 0 ? 'text-red-500' : 'text-emerald-500' },
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(({ key, label, icon: Icon }) => (
        <Card key={key}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className={cn('text-2xl font-bold font-heading mt-1', values[key].color)}>
                  {values[key].value}
                </p>
              </div>
              <Icon className="w-8 h-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
