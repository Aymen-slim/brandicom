import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceAuth } from '@/lib/permissions';
import { fetchCalendarDeliverables, fetchCalendarPage } from '@/lib/data';
import { parsePagination } from '@/lib/pagination';
import { calendarRangeSchema, privateReadHeaders } from '@/lib/listValidation';

export async function GET(request: NextRequest) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;
  const params = request.nextUrl.searchParams;
  try {
    const clientId = z.string().uuid().optional().parse(params.get('clientId') || undefined);
    const range = params.has('from') || params.has('to') ? calendarRangeSchema.parse({ from: params.get('from'), to: params.get('to') }) : undefined;
    const result = params.has('page') && !range
      ? await fetchCalendarPage({ clientId, ...parsePagination({ page: params.get('page')!, pageSize: params.get('pageSize') || undefined }) })
      : await fetchCalendarDeliverables({ clientId, ...range, lightweight: Boolean(range) || params.get('lightweight') === '1' });
    return NextResponse.json(result, { headers: privateReadHeaders });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid calendar parameters' }, { status: 400, headers: privateReadHeaders });
    console.error('Error fetching calendar deliverables:', err);
    return NextResponse.json({ error: 'Failed to fetch deliverables' }, { status: 500, headers: privateReadHeaders });
  }
}
