'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RawDataViewerProps {
  data: Record<string, unknown>;
}

export function RawDataViewer({ data }: RawDataViewerProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <Button
          variant="ghost"
          className="justify-start p-0 h-auto hover:bg-transparent"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown className="w-4 h-4 mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
          <CardTitle className="text-base">Raw Data</CardTitle>
        </Button>
      </CardHeader>
      {expanded && (
        <CardContent>
          <pre className="text-xs overflow-auto max-h-96 p-3 rounded bg-background border font-mono">
            {JSON.stringify(data, null, 2)}
          </pre>
        </CardContent>
      )}
    </Card>
  );
}
