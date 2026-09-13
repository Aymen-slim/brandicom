import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { enforceAuth, canAccessClient } from '@/lib/permissions';
import { fetchProfileFollowers, fetchPostEngagement, ScrapedSocialMetrics } from '@/lib/apify';
import { addPostMetrics } from '@/lib/engagement';
import { parseDeliverableLinks } from '@/lib/deliverables';
import { fetchClientDetail, logActivity } from '@/lib/data';
import { currentMonth } from '@/lib/period';
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

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty, default to current month
    }

    const targetMonth =
      typeof body?.month === 'string' && /^\d{4}-\d{2}$/.test(body.month)
        ? body.month
        : currentMonth();

    const supabase = createServerSupabaseClient();

    // 1. Fetch client info
    const { data: clientRow, error: clientErr } = await supabase
      .from('clients')
      .select('id, name, logo_url, tags, start_date')
      .eq('id', clientId)
      .maybeSingle();

    if (clientErr) throw clientErr;
    if (!clientRow) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const syncErrors: string[] = [];
    const socialResults: Array<{
      platform: string;
      handle: string;
      before: number | null;
      after: number;
      diff: number;
      profilePicUrl?: string | null;
    }> = [];

    // 2. Fetch & update social accounts (Followers count)
    const { data: socialAccounts, error: socialsErr } = await supabase
      .from('client_social_accounts')
      .select('id, platform, handle, url, followers')
      .eq('client_id', clientId);

    if (socialsErr) throw socialsErr;

    let updatedLogoUrl = clientRow.logo_url;

    if (Array.isArray(socialAccounts) && socialAccounts.length > 0) {
      for (const acc of socialAccounts) {
        if (!acc.handle && !acc.url) continue;
        const rawTarget = acc.handle || acc.url;
        const platform = acc.platform === 'tiktok' ? 'tiktok' : 'instagram';

        try {
          const scraped = await fetchProfileFollowers(rawTarget, platform);
          const oldFollowers = acc.followers ?? null;
          const newFollowers = scraped.followers;
          const diff = oldFollowers != null ? newFollowers - oldFollowers : 0;

          await supabase
            .from('client_social_accounts')
            .update({
              followers: newFollowers,
              followers_updated_at: new Date().toISOString(),
            })
            .eq('id', acc.id);

          // If client has no logo yet, auto-populate with profile picture from Instagram/TikTok
          if (!updatedLogoUrl && scraped.profilePicUrl) {
            updatedLogoUrl = scraped.profilePicUrl;
            await supabase
              .from('clients')
              .update({ logo_url: scraped.profilePicUrl })
              .eq('id', clientId);
          }

          socialResults.push({
            platform,
            handle: scraped.handle,
            before: oldFollowers,
            after: newFollowers,
            diff,
            profilePicUrl: scraped.profilePicUrl,
          });
        } catch (err: any) {
          syncErrors.push(`${platform.toUpperCase()} followers sync failed: ${err.message}`);
        }
      }
    }

    // 2b. Calculate & save month-over-month follower growth
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

    const igResult = socialResults.find((s) => s.platform === 'instagram');
    const ttResult = socialResults.find((s) => s.platform === 'tiktok');
    const curIg = igResult ? igResult.after : (socialAccounts?.find((s: any) => s.platform === 'instagram')?.followers ?? null);
    const curTt = ttResult ? ttResult.after : (socialAccounts?.find((s: any) => s.platform === 'tiktok')?.followers ?? null);
    const totalCurrentFollowers = (curIg || 0) + (curTt || 0);

    const existingHistory = extractClientFollowerHistory(
      clientRow.tags || [],
      initialIg,
      initialTt,
      clientRow.start_date
    );

    const prevMonthStr = getPreviousMonth(targetMonth);
    // Find previous month snapshot, or the latest recorded month before targetMonth
    const exactPrev = existingHistory.find((h) => h.month === prevMonthStr);
    const earlierMonths = existingHistory
      .filter((h) => h.month < targetMonth)
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

    if (prevTotal != null && totalCurrentFollowers > 0) {
      monthlyGain = totalCurrentFollowers - prevTotal;
      monthlyGainPct = (prevTotal > 0 && monthlyGain != null) ? (monthlyGain / prevTotal) * 100 : null;
      monthlyIgGain = (curIg != null && prevIg != null) ? curIg - prevIg : null;
      monthlyTtGain = (curTt != null && prevTt != null) ? curTt - prevTt : null;
    }

    const monthSnapshot: MonthFollowerSnapshot = {
      month: targetMonth,
      instagram: curIg,
      tiktok: curTt,
      total: totalCurrentFollowers,
      gainFromPrevMonth: monthlyGain,
      gainPct: monthlyGainPct,
      igGain: monthlyIgGain,
      ttGain: monthlyTtGain,
      prevMonth: prevMonthLabel,
      prevTotal,
      updatedAt: new Date().toISOString(),
      source: 'sync',
    };

    const updatedTags = packClientFollowerMonthTag(clientRow.tags || [], monthSnapshot);
    await supabase
      .from('clients')
      .update({ tags: updatedTags })
      .eq('id', clientId);

    // 3. Fetch deliverables for this client
    const { data: deliverables, error: delivErr } = await supabase
      .from('deliverables')
      .select('id, idea, title, link, platform, published, status, publish_date, scheduled_at, created_at, thumbnail_url')
      .eq('client_id', clientId);

    if (delivErr) throw delivErr;

    // Filter deliverables matching the target month
    const monthDeliverables = (deliverables || []).filter((d) => {
      const dateStr =
        d.publish_date ||
        (d.scheduled_at ? d.scheduled_at.slice(0, 10) : '') ||
        (d.created_at ? d.created_at.slice(0, 10) : '');
      return dateStr.startsWith(targetMonth);
    });

    const eligibleWithLinks = monthDeliverables.filter(
      (d) => d.link && d.link.trim().length > 0
    );

    const postResults: Array<{
      id: string;
      title: string;
      views: number;
      likes: number;
      comments: number;
      shares: number;
      platform: string;
    }> = [];

    // 4. Concurrently sync live engagement metrics for posts with links
    await Promise.allSettled(
      eligibleWithLinks.map(async (del) => {
        try {
          const parsed = parseDeliverableLinks(del.link, del.platform);
          const { instagramLink, tiktokLink } = parsed;

          let scraped: ScrapedSocialMetrics;
          let noteStr = `Monthly sync (${targetMonth})`;

          if (instagramLink && tiktokLink) {
            const [igRes, ttRes] = await Promise.allSettled([
              fetchPostEngagement(instagramLink),
              fetchPostEngagement(tiktokLink),
            ]);
            const igScraped = igRes.status === 'fulfilled' ? igRes.value : null;
            const ttScraped = ttRes.status === 'fulfilled' ? ttRes.value : null;

            if (!igScraped && !ttScraped) {
              const igErr = igRes.status === 'rejected' ? igRes.reason?.message : 'IG failed';
              const ttErr = ttRes.status === 'rejected' ? ttRes.reason?.message : 'TT failed';
              throw new Error(`Instagram (${igErr}) · TikTok (${ttErr})`);
            }

            scraped = {
              views: (igScraped?.views || 0) + (ttScraped?.views || 0),
              likes: (igScraped?.likes || 0) + (ttScraped?.likes || 0),
              comments: (igScraped?.comments || 0) + (ttScraped?.comments || 0),
              shares: (igScraped?.shares || 0) + (ttScraped?.shares || 0),
              thumbnailUrl: igScraped?.thumbnailUrl || ttScraped?.thumbnailUrl || del.thumbnail_url,
              caption: igScraped?.caption || ttScraped?.caption || null,
              platform: 'both' as any,
            };
            noteStr = `Monthly sync (${targetMonth}) · Dual post`;
          } else {
            const targetUrl = instagramLink || tiktokLink || parsed.primaryLink!;
            scraped = await fetchPostEngagement(targetUrl);
            noteStr = `Monthly sync (${targetMonth}) · ${scraped.platform}`;
          }

          // Insert new metrics snapshot
          await addPostMetrics(del.id, {
            views: scraped.views,
            likes: scraped.likes,
            comments: scraped.comments,
            shares: scraped.shares,
            source: 'api',
            note: noteStr,
          });

          // Mark deliverable as published & update thumbnail if missing
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
          if (!del.platform && scraped.platform !== 'unknown') {
            updates.platform = scraped.platform === 'tiktok' ? 'tiktok' : 'instagram';
          }

          await supabase.from('deliverables').update(updates).eq('id', del.id);

          postResults.push({
            id: del.id,
            title: del.title || del.idea,
            views: scraped.views,
            likes: scraped.likes,
            comments: scraped.comments,
            shares: scraped.shares,
            platform: scraped.platform,
          });
        } catch (err: any) {
          syncErrors.push(`Post "${del.title || del.idea.slice(0, 30)}": ${err.message}`);
        }
      })
    );

    // 5. Log activity
    await logActivity({
      action: 'update',
      entity: 'client',
      entityId: clientId,
      diff: {
        action: 'month_data_sync',
        month: targetMonth,
        socialsSynced: socialResults.length,
        postsSynced: postResults.length,
      },
    });

    // 6. Fetch fresh full detail to return updated client and deliverables
    const detail = await fetchClientDetail(clientId, user);

    const totalViews = postResults.reduce((acc, p) => acc + p.views, 0);
    const totalLikes = postResults.reduce((acc, p) => acc + p.likes, 0);

    return NextResponse.json({
      success: true,
      month: targetMonth,
      client: detail?.client,
      deliverables: detail?.deliverables,
      summary: {
        socials: socialResults,
        followerGain: {
          month: targetMonth,
          total: totalCurrentFollowers,
          prevMonth: prevMonthLabel,
          prevTotal,
          gain: monthlyGain,
          gainPct: monthlyGainPct,
          igGain: monthlyIgGain,
          ttGain: monthlyTtGain,
          instagram: curIg,
          tiktok: curTt,
        },
        posts: postResults,
        totalPostsInMonth: monthDeliverables.length,
        totalPostsWithLinks: eligibleWithLinks.length,
        totalPostsSynced: postResults.length,
        totalViews,
        totalLikes,
        errors: syncErrors,
      },
    });
  } catch (err: any) {
    console.error('Error in monthly client sync:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to sync client monthly data' },
      { status: 500 }
    );
  }
}
