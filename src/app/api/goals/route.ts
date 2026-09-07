import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { enforceAuth, enforceAdmin } from '@/lib/permissions';
import { computeGoalsAndMetrics } from '@/lib/goals';
import { currentMonth, normalizePeriod } from '@/lib/period';

const GOAL_METRICS = [
  'revenue',
  'profit',
  'deliverables',
  'new_clients',
  'retention',
  'views',
  'followers_gained',
  'engagement_rate',
];

export async function GET(request: NextRequest) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const { searchParams } = new URL(request.url);
  const period = normalizePeriod(searchParams.get('period') || currentMonth());

  try {
    const metrics = await computeGoalsAndMetrics(period);
    return NextResponse.json(metrics);
  } catch (err: any) {
    console.error('Error computing goals:', err);
    return NextResponse.json({ error: 'Failed to compute goals' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { user, error } = await enforceAdmin();
  if (error || !user) return error;

  try {
    const body = await request.json();
    const { periodType, periodValue, metric, target } = body;

    if (!periodType || !['year', 'month'].includes(periodType)) {
      return NextResponse.json({ error: "periodType must be 'year' or 'month'" }, { status: 400 });
    }

    if (!periodValue || typeof periodValue !== 'string') {
      return NextResponse.json({ error: 'periodValue is required' }, { status: 400 });
    }

    if (!metric || !GOAL_METRICS.includes(metric)) {
      return NextResponse.json({ error: 'Valid metric is required' }, { status: 400 });
    }

    if (target === undefined || target === null || isNaN(Number(target))) {
      return NextResponse.json({ error: 'Valid target number is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data: upserted, error: upsertError } = await supabase
      .from('goals')
      .upsert(
        {
          period_type: periodType,
          period_value: periodValue,
          metric,
          target: parseFloat(target),
        },
        { onConflict: 'period_type,period_value,metric' }
      )
      .select('*')
      .single();

    if (upsertError) throw upsertError;

    return NextResponse.json({
      id: upserted.id,
      periodType: upserted.period_type,
      periodValue: upserted.period_value,
      metric: upserted.metric,
      target: Number(upserted.target),
    });
  } catch (err: any) {
    console.error('Error upserting goal target:', err);
    return NextResponse.json({ error: 'Failed to upsert goal target' }, { status: 500 });
  }
}
