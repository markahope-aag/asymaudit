import { NextRequest, NextResponse } from 'next/server';
import { getAuditRunStatus } from '@/lib/worker-api';

export async function GET(
  _request: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const result = await getAuditRunStatus(params.runId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch audit status';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
