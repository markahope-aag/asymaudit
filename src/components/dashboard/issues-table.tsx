'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, formatAuditType, getSeverityBgColor } from '@/lib/utils';
import type { AuditIssue, IssueSeverity } from '@/types';

interface IssuesTableProps {
  issues: AuditIssue[];
  showCategory?: boolean;
}

const severityOrder: Record<IssueSeverity, number> = { critical: 0, warning: 1, info: 2 };

export function IssuesTable({ issues, showCategory = true }: IssuesTableProps) {
  const [filterSeverity, setFilterSeverity] = useState<IssueSeverity | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const categories = Array.from(new Set(issues.map(i => i.category)));

  const filtered = issues
    .filter(i => filterSeverity === 'all' || i.severity === filterSeverity)
    .filter(i => filterCategory === 'all' || i.category === filterCategory)
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Issues ({filtered.length})</CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as IssueSeverity | 'all')}
              className="rounded-md border bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
            {showCategory && categories.length > 1 && (
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="rounded-md border bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No issues found.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((issue, i) => (
              <div key={i} className="border rounded-md p-3">
                <div className="flex items-start gap-2">
                  <Badge variant={issue.severity === 'critical' ? 'destructive' : issue.severity === 'warning' ? 'warning' : 'info'} className="shrink-0 mt-0.5">
                    {issue.severity}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-sm">{issue.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{issue.description}</p>
                    {issue.recommendation && (
                      <p className="text-xs text-accent mt-1.5">Recommendation: {issue.recommendation}</p>
                    )}
                    {issue.impact && (
                      <p className="text-xs text-muted-foreground mt-0.5">Impact: {issue.impact}</p>
                    )}
                  </div>
                  {showCategory && (
                    <span className="text-[10px] text-muted-foreground shrink-0">{issue.category}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
