import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { enforceAuth, canAccessClient } from '@/lib/permissions';
import { fetchPostEngagement } from '@/lib/apify';
import { addPostMetrics } from '@/lib/engagement';
import {
  mapDeliverableRow,
  getDeliverableSelect,
  isFilmingDateSupported,
  DELIVERABLE_SELECT_BASE,
  logActivity,
} from '@/lib/data';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const deliverableId = params.id;

  try {
    const supabase = createServerSupabaseClient();

    // 1. Fetch deliverable and verify access
    const { data: del, error: delErr } = await supabase
      .from('deliverables')
      .select('id, client_id, link, thumbnail_url, platform, published, status, publish_date')
      .eq('id', deliverableId)
      .maybeSingle();

    if (delErr) throw delErr;
    if (!del) {
      return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });
    }

    const hasAccess = await canAccessClient(user.id, user.role, del.client_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!del.link || !del.link.trim()) {
      return NextResponse.json(
        { error: 'No live link found for this deliverable. Please attach an Instagram or TikTok URL first.' },
        { status: 400 }
      );
    }

    // 2. Fetch engagement metrics from Apify (Actor shu8hvrXbJbY3Eb9W for IG, clockworks for TikTok)
    const scraped = await fetchPostEngagement(del.link);

    // 3. Save snapshot to post_metrics with source: 'api'
    const metricRecord = await addPostMetrics(deliverableId, {
      views: scraped.views,
      likes: scraped.likes,
      comments: scraped.comments,
      shares: scraped.shares,
      source: 'api',
      note: `Synced via Apify (${scraped.platform})`,
    });

    // 4. Mark deliverable as published and update metadata so it appears on Client Engagement page
    const updates: Record<string, unknown> = {
      published: true,
      status: 'published',
    };
    if (!del.publish_date) {
      updates.publish_date = new Date().toISOString().slice(0, 10);
    }
    if (!del.thumbnail_url && scraped.thumbnailUrl) {
      updates.thumbnail_url = scraped.thumbnailUrl;
    }
    if (!del.platform && (scraped.platform === 'instagram' || scraped.platform === 'tiktok')) {
      updates.platform = scraped.platform;
    }

    await supabase
      .from('deliverables')
      .update(updates)
      .eq('id', deliverableId);

    // 5. Log activity
    await logActivity({
      action: 'update',
      entity: 'deliverable',
      entityId: deliverableId,
      actorId: user.id,
      diff: {
        views: scraped.views,
        likes: scraped.likes,
        comments: scraped.comments,
        source: 'api',
        platform: scraped.platform,
      },
    });

    // 6. Fetch complete refreshed deliverable to return to client
    const supportsFilming = await isFilmingDateSupported(supabase);
    const selectQuery = getDeliverableSelect(supportsFilming);

    const { data: updatedData, error: fetchErr } = await supabase
      .from('deliverables')
      .select(selectQuery)
      .eq('id', deliverableId)
      .maybeSingle();

    const deliverablePayload = fetchErr
      ? (
          await supabase
            .from('deliverables')
            .select(DELIVERABLE_SELECT_BASE)
            .eq('id', deliverableId)
            .single()
        ).data
      : updatedData;

    return NextResponse.json({
      success: true,
      metrics: metricRecord,
      scraped,
      deliverable: mapDeliverableRow(deliverablePayload),
    });
  } catch (err: any) {
    console.error('Error syncing deliverable metrics:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to sync metrics from Apify' },
      { status: 500 }
    );
  }
}
