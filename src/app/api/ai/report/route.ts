import { NextRequest, NextResponse } from 'next/server';
import { enforceAuth, canAccessClient } from '@/lib/permissions';
import { generateClientReport } from '@/lib/ai/report';
import { currentMonth, normalizePeriod } from '@/lib/period';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;
  const clientId = request.nextUrl.searchParams.get('clientId');
  const month = normalizePeriod(request.nextUrl.searchParams.get('month') || currentMonth());
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  const hasAccess = await canAccessClient(user.id, user.role, clientId);
  if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from('client_reports')
    .select('*')
    .eq('client_id', clientId)
    .eq('month', month)
    .maybeSingle();
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;
  try {
    const body = await request.json();
    if (!body.clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });
    const hasAccess = await canAccessClient(user.id, user.role, body.clientId);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    const month = normalizePeriod(body.month || currentMonth());
    const report = await generateClientReport(body.clientId, month, user);
    return NextResponse.json(report);
  } catch (err: any) {
    console.error('Report failed:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate report' }, { status: 500 });
  }
}
