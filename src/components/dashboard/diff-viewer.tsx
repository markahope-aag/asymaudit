import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AuditDiff, DiffChangeModified } from '@/types';

interface DiffViewerProps {
  diff: AuditDiff | null;
}

export function DiffViewer({ diff }: DiffViewerProps) {
  if (!diff) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Changes vs Previous Run</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">No previous run to compare.</p>
        </CardContent>
      </Card>
    );
  }

  const { changes, severity, summary } = diff;
  const totalChanges = (changes.added?.length ?? 0) + (changes.removed?.length ?? 0) + (changes.changed?.length ?? 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Changes vs Previous Run</CardTitle>
          <Badge variant={severity === 'critical' ? 'destructive' : severity === 'warning' ? 'warning' : 'info'}>
            {severity}
          </Badge>
        </div>
        {summary && <p className="text-xs text-muted-foreground mt-1">{summary}</p>}
      </CardHeader>
      <CardContent>
        {totalChanges === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No significant changes detected.</p>
        ) : (
          <div className="space-y-4 text-sm">
            {changes.added && changes.added.length > 0 && (
              <div>
                <h4 className="font-medium text-emerald-500 mb-1">Added ({changes.added.length})</h4>
                <ul className="space-y-1">
                  {changes.added.map((c, i) => (
                    <li key={i} className="text-xs text-muted-foreground pl-3 border-l-2 border-emerald-500/30">
                      {c.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {changes.removed && changes.removed.length > 0 && (
              <div>
                <h4 className="font-medium text-red-500 mb-1">Removed ({changes.removed.length})</h4>
                <ul className="space-y-1">
                  {changes.removed.map((c, i) => (
                    <li key={i} className="text-xs text-muted-foreground pl-3 border-l-2 border-red-500/30">
                      {c.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {changes.changed && changes.changed.length > 0 && (
              <div>
                <h4 className="font-medium text-amber-500 mb-1">Changed ({changes.changed.length})</h4>
                <ul className="space-y-1">
                  {changes.changed.map((c: DiffChangeModified, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground pl-3 border-l-2 border-amber-500/30">
                      <span>{c.description}</span>
                      {c.direction === 'improved' && <span className="text-emerald-500 ml-1">(improved)</span>}
                      {c.direction === 'degraded' && <span className="text-red-500 ml-1">(degraded)</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
