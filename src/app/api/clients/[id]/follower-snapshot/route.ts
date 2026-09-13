import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { enforceAuth, canAccessClient } from '@/lib/permissions';
import { fetchClientDetail, logActivity } from '@/lib/data';
import {
  MonthFollowerSnapshot,
  getPreviousMonth,
  extractClientFollowerHistory,
  packClientFollowerMonthTag,
} from '@/lib/clientFollowers';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const clientId = params.id;

  try {
    const hasAccess = await canAccessClient(user.id, user.role, clientId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const month = typeof body.month === 'string' && /^\d{4}-\d{2}$/.test(body.month) ? body.month : null;
    if (!month) {
      return NextResponse.json({ error: 'Valid month (YYYY-MM) is required' }, { status: 400 });
    }

    const igFollowers = typeof body.instagram === 'number' ? body.instagram : null;
    const ttFollowers = typeof body.tiktok === 'number' ? body.tiktok : null;
    const total = typeof body.total === 'number' ? body.total : ((igFollowers || 0) + (ttFollowers || 0));

    const supabase = createServerSupabaseClient();
    const { data: clientRow, error: clientErr } = await supabase
      .from('clients')
      .select('id, name, tags, start_date')
      .eq('id', clientId)
      .maybeSingle();

    if (clientErr) throw clientErr;
    if (!clientRow) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Baseline followers
    let initialIg: number | null = null;
    let initialTt: number | null = null;
    for (const t of clientRow.tags || []) {
      if (typeof t === 'string' && t.startsWith('baseline:instagram:')) {
        const p = parseInt(t.slice('baseline:instagram:'.length), 10);
        if (!isNaN(p)) initialIg = p;
      } else if (typeof t === 'string' && t.startsWith('baseline:tiktok:')) {
        const p = parseInt(t.slice('baseline:tiktok:'.length), 10);
        if (!isNaN(p)) initialTt = p;
      }
    }

    const existingHistory = extractClientFollowerHistory(
      clientRow.tags || [],
      initialIg,
      initialTt,
      clientRow.start_date
    );

    const prevMonthStr = getPreviousMonth(month);
    const exactPrev = existingHistory.find((h) => h.month === prevMonthStr);
    const earlierMonths = existingHistory
      .filter((h) => h.month < month)
      .sort((a, b) => b.month.localeCompare(a.month));
    const prevSnapshot = exactPrev || earlierMonths[0] || null;

    let prevTotal: number | null = null;
    let prevMonthLabel: string | null = null;
    let prevIg: number | null = null;
    let prevTt: number | null = null;

    if (prevSnapshot) {
      prevTotal = prevSnapshot.total;
      prevMonthLabel = prevSnapshot.month;
      prevIg = prevSnapshot.instagram;
      prevTt = prevSnapshot.tiktok;
    } else if (initialIg != null || initialTt != null) {
      prevTotal = (initialIg || 0) + (initialTt || 0);
      prevMonthLabel = clientRow.start_date ? clientRow.start_date.slice(0, 7) : 'Baseline';
      prevIg = initialIg;
      prevTt = initialTt;
    }

    let monthlyGain: number | null = null;
    let monthlyGainPct: number | null = null;
    let monthlyIgGain: number | null = null;
    let monthlyTtGain: number | null = null;

    if (prevTotal != null) {
      monthlyGain = total - prevTotal;
      monthlyGainPct = (prevTotal > 0 && monthlyGain != null) ? (monthlyGain / prevTotal) * 100 : null;
      monthlyIgGain = (igFollowers != null && prevIg != null) ? igFollowers - prevIg : null;
      monthlyTtGain = (ttFollowers != null && prevTt != null) ? ttFollowers - prevTt : null;
    }

    const snapshot: MonthFollowerSnapshot = {
      month,
      instagram: igFollowers,
      tiktok: ttFollowers,
      total,
      gainFromPrevMonth: monthlyGain,
      gainPct: monthlyGainPct,
      igGain: monthlyIgGain,
      ttGain: monthlyTtGain,
      prevMonth: prevMonthLabel,
      prevTotal,
      updatedAt: new Date().toISOString(),
      source: 'manual',
    };

    const updatedTags = packClientFollowerMonthTag(clientRow.tags || [], snapshot);
    await supabase.from('clients').update({ tags: updatedTags }).eq('id', clientId);

    await logActivity({
      action: 'update',
      entity: 'client',
      entityId: clientId,
      diff: { action: 'manual_follower_snapshot', month, total, gain: monthlyGain },
    });

    const detail = await fetchClientDetail(clientId, user);

    return NextResponse.json({
      success: true,
      snapshot,
      client: detail?.client,
    });
  } catch (err: any) {
    console.error('Error saving follower snapshot:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to save follower snapshot' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const clientId = params.id;

  try {
    const hasAccess = await canAccessClient(user.id, user.role, clientId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const month = body.month;
    if (!month) {
      return NextResponse.json({ error: 'Month is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data: clientRow, error: clientErr } = await supabase
      .from('clients')
      .select('id, tags')
      .eq('id', clientId)
      .maybeSingle();

    if (clientErr) throw clientErr;
    if (!clientRow) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const prefix = `f_month:${month}:`;
    const updatedTags = (clientRow.tags || []).filter(
      (t: string) => typeof t === 'string' && !t.startsWith(prefix)
    );

    await supabase.from('clients').update({ tags: updatedTags }).eq('id', clientId);

    const detail = await fetchClientDetail(clientId, user);

    return NextResponse.json({
      success: true,
      client: detail?.client,
    });
  } catch (err: any) {
    console.error('Error deleting follower snapshot:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to delete follower snapshot' },
      { status: 500 }
    );
  }
}
