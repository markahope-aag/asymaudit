import { NextRequest, NextResponse } from 'next/server';
import { triggerAllAudits } from '@/lib/worker-api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, priority } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    const result = await triggerAllAudits(clientId, priority);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to trigger audits';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
