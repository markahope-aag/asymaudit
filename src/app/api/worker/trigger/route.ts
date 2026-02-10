import { NextRequest, NextResponse } from 'next/server';
import { triggerAudit } from '@/lib/worker-api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, auditType, priority } = body;

    if (!clientId || !auditType) {
      return NextResponse.json({ error: 'clientId and auditType are required' }, { status: 400 });
    }

    const result = await triggerAudit(clientId, auditType, priority);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to trigger audit';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
