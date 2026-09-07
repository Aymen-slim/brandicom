import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { enforceAuth, canAccessClient } from '@/lib/permissions';
import { addPostMetrics } from '@/lib/engagement';

export async function POST(request: NextRequest) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  try {
    const body = await request.json();
    if (!body.deliverableId || typeof body.deliverableId !== 'string') {
      return NextResponse.json({ error: 'deliverableId is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data: del, error: delErr } = await supabase
      .from('deliverables')
      .select('id, client_id')
      .eq('id', body.deliverableId)
      .maybeSingle();
    if (delErr) throw delErr;
    if (!del) return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });

    const hasAccess = await canAccessClient(user.id, user.role, del.client_id);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const row = await addPostMetrics(body.deliverableId, {
      views: Number(body.views || 0),
      likes: Number(body.likes || 0),
      comments: Number(body.comments || 0),
      shares: Number(body.shares || 0),
      saves: Number(body.saves || 0),
      reach: Number(body.reach || 0),
      impressions: Number(body.impressions || 0),
      linkClicks: Number(body.linkClicks || 0),
      followersGained: Number(body.followersGained || 0),
      note: body.note || null,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    console.error('Error adding metrics:', err);
    return NextResponse.json({ error: 'Failed to save metrics' }, { status: 500 });
  }
}
