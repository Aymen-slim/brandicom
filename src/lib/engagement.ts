import { createServerSupabaseClient } from './supabase/server';
import { EngagementSummary, PostMetricsData } from '@/types';
import { periodRange } from './period';

export function engagementRate(m: { likes: number; comments: number; shares: number; saves: number; reach: number }): number {
  if (!m.reach) return 0;
  return ((m.likes + m.comments + m.shares + m.saves) / m.reach) * 100;
}

function emptySummary(): EngagementSummary {
  return {
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    reach: 0,
    impressions: 0,
    followersGained: 0,
    engagementRate: 0,
    posts: 0,
  };
}

export async function addPostMetrics(
  deliverableId: string,
  metrics: Partial<Omit<PostMetricsData, 'id' | 'deliverableId' | 'capturedAt' | 'source'>> & { note?: string | null }
) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('post_metrics')
    .insert({
      deliverable_id: deliverableId,
      views: Number(metrics.views || 0),
      likes: Number(metrics.likes || 0),
      comments: Number(metrics.comments || 0),
      shares: Number(metrics.shares || 0),
      saves: Number(metrics.saves || 0),
      reach: Number(metrics.reach || 0),
      impressions: Number(metrics.impressions || 0),
      link_clicks: Number(metrics.linkClicks || 0),
      followers_gained: Number(metrics.followersGained || 0),
      source: 'manual',
      note: metrics.note || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function clientEngagementSummary(clientId: string, period: string): Promise<EngagementSummary> {
  const { start, end } = periodRange(period);
  const supabase = createServerSupabaseClient();
  const { data: dels, error } = await supabase
    .from('deliverables')
    .select('id, publish_date, published, post_metrics(views, likes, comments, shares, saves, reach, impressions, followers_gained, captured_at)')
    .eq('client_id', clientId)
    .eq('published', true)
    .gte('publish_date', start)
    .lte('publish_date', end);
  if (error) throw error;
  return summarize(dels || []);
}

export async function agencyEngagementSummary(period: string): Promise<EngagementSummary> {
  const { start, end } = periodRange(period);
  const supabase = createServerSupabaseClient();
  const { data: dels, error } = await supabase
    .from('deliverables')
    .select('id, publish_date, published, post_metrics(views, likes, comments, shares, saves, reach, impressions, followers_gained, captured_at)')
    .eq('published', true)
    .gte('publish_date', start)
    .lte('publish_date', end);
  if (error) throw error;
  return summarize(dels || []);
}

function summarize(dels: any[]): EngagementSummary {
  const acc = emptySummary();
  for (const d of dels) {
    const rows = d.post_metrics || [];
    if (!rows.length) continue;
    acc.posts += 1;
    const latest = [...rows].sort(
      (a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
    )[0];
    acc.views += Number(latest.views || 0);
    acc.likes += Number(latest.likes || 0);
    acc.comments += Number(latest.comments || 0);
    acc.shares += Number(latest.shares || 0);
    acc.saves += Number(latest.saves || 0);
    acc.reach += Number(latest.reach || 0);
    acc.impressions += Number(latest.impressions || 0);
    acc.followersGained += Number(latest.followers_gained || 0);
  }
  acc.engagementRate = engagementRate(acc);
  return acc;
}
