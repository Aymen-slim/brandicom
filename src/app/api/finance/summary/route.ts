import { NextRequest, NextResponse } from 'next/server';
import { enforceAdmin } from '@/lib/permissions';
import { fetchFinanceSummary } from '@/lib/finance';
import { currentMonth, normalizePeriod } from '@/lib/period';

export async function GET(request: NextRequest) {
  const { user, error } = await enforceAdmin();
  if (error || !user) return error;

  const period = normalizePeriod(request.nextUrl.searchParams.get('period') || currentMonth());
  try {
    const summary = await fetchFinanceSummary(period);
    return NextResponse.json(summary);
  } catch (err: any) {
    console.error('Error fetching finance summary:', err);
    return NextResponse.json({ error: 'Failed to fetch finance summary' }, { status: 500 });
  }
}
