import { NextResponse } from 'next/server';
import { getQueueStatus } from '@/lib/worker-api';

export async function GET() {
  try {
    const status = await getQueueStatus();
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch queue status';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
