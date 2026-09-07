import { NextRequest, NextResponse } from 'next/server';
import { enforceAuth } from '@/lib/permissions';
import { fetchCalendarDeliverables } from '@/lib/data';

export async function GET(request: NextRequest) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId') || undefined;

  try {
    const deliverables = await fetchCalendarDeliverables({ clientId });
    return NextResponse.json(deliverables);
  } catch (err: any) {
    console.error('Error fetching calendar deliverables:', err);
    return NextResponse.json({ error: 'Failed to fetch deliverables' }, { status: 500 });
  }
}
