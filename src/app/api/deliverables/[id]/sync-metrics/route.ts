import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { enforceAuth, canAccessClient } from '@/lib/permissions';
import { fetchPostEngagement, ScrapedSocialMetrics } from '@/lib/apify';
import { addPostMetrics } from '@/lib/engagement';
import { parseDeliverableLinks } from '@/lib/deliverables';
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

    const parsedLinks = parseDeliverableLinks(del.link, del.platform);
    const { instagramLink, tiktokLink } = parsedLinks;

    if (!instagramLink && !tiktokLink && !parsedLinks.primaryLink) {
      return NextResponse.json(
        { error: 'No live link found for this deliverable. Please attach an Instagram or TikTok URL first.' },
        { status: 400 }
      );
    }

    // 2. Fetch engagement metrics from Apify
    let scraped: ScrapedSocialMetrics;
    let breakdown: {
      instagram?: ScrapedSocialMetrics;
      tiktok?: ScrapedSocialMetrics;
    } | null = null;
    let noteStr = 'Synced via Apify';

    if (instagramLink && tiktokLink) {
      // Both platforms present: fetch both concurrently!
      const [igResult, ttResult] = await Promise.allSettled([
        fetchPostEngagement(instagramLink),
        fetchPostEngagement(tiktokLink),
      ]);

      const igScraped = igResult.status === 'fulfilled' ? igResult.value : null;
      const ttScraped = ttResult.status === 'fulfilled' ? ttResult.value : null;

      if (!igScraped && !ttScraped) {
        const igErr = igResult.status === 'rejected' ? igResult.reason?.message : 'IG failed';
        const ttErr = ttResult.status === 'rejected' ? ttResult.reason?.message : 'TikTok failed';
        throw new Error(`Failed to sync stats: Instagram (${igErr}) · TikTok (${ttErr})`);
      }

      breakdown = {
        ...(igScraped ? { instagram: igScraped } : {}),
        ...(ttScraped ? { tiktok: ttScraped } : {}),
      };

      const totalViews = (igScraped?.views || 0) + (ttScraped?.views || 0);
      const totalLikes = (igScraped?.likes || 0) + (ttScraped?.likes || 0);
      const totalComments = (igScraped?.comments || 0) + (ttScraped?.comments || 0);
      const totalShares = (igScraped?.shares || 0) + (ttScraped?.shares || 0);
      const thumbnailUrl = igScraped?.thumbnailUrl || ttScraped?.thumbnailUrl || del.thumbnail_url;

      scraped = {
        views: totalViews,
        likes: totalLikes,
        comments: totalComments,
        shares: totalShares,
        thumbnailUrl,
        caption: igScraped?.caption || ttScraped?.caption || null,
        platform: 'both' as any,
      };

      const noteParts: string[] = [];
      if (igScraped) noteParts.push(`Instagram: ${igScraped.views.toLocaleString()} views, ${igScraped.likes.toLocaleString()} likes`);
      if (ttScraped) noteParts.push(`TikTok: ${ttScraped.views.toLocaleString()} views, ${ttScraped.likes.toLocaleString()} likes`);
      noteStr = `Synced via Apify (${noteParts.join(' · ')})`;
    } else {
      // Single platform
      const targetUrl = instagramLink || tiktokLink || parsedLinks.primaryLink!;
      scraped = await fetchPostEngagement(targetUrl);
      noteStr = `Synced via Apify (${scraped.platform})`;
      breakdown = {
        [scraped.platform]: scraped,
      };
    }

    // 3. Save snapshot to post_metrics with source: 'api'
    const metricRecord = await addPostMetrics(deliverableId, {
      views: scraped.views,
      likes: scraped.likes,
      comments: scraped.comments,
      shares: scraped.shares,
      source: 'api',
      note: noteStr,
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
    if (!del.platform) {
      const p = scraped.platform as string;
      updates.platform = p === 'tiktok' ? 'tiktok' : 'instagram';
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
      breakdown,
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

