'use client';

import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { BRAND } from '@/lib/constants';

interface SparklineChartProps {
  data: { date: string; score: number }[];
}

export function SparklineChart({ data }: SparklineChartProps) {
  if (data.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="score"
          stroke={BRAND.gold}
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
