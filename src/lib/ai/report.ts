import { createServerSupabaseClient } from '@/lib/supabase/server';
import { fetchClientDetail } from '@/lib/data';
import { clientEngagementSummary } from '@/lib/engagement';
import { CurrentUser } from '@/lib/permissions';
import { periodRange } from '@/lib/period';
import { computeClientGoalsProgress } from '@/lib/clientGoals';
import { aiGenerate } from './runtime';

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function languageLabel(language?: string | null): string {
  if (language === 'fr') return 'French';
  if (language === 'ar') return 'Arabic';
  return 'English';
}

export async function generateClientReport(
  clientId: string,
  month: string,
  user: CurrentUser,
  options?: { language?: string | null }
) {
  const detail = await fetchClientDetail(clientId, user);
  if (!detail) throw new Error('Client not found');

  const { start, end } = periodRange(month);
  const previousMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const [engagement, previousEngagement] = await Promise.all([
    clientEngagementSummary(clientId, month),
    clientEngagementSummary(clientId, previousMonth),
  ]);

  const posts = detail.deliverables
    .filter((deliverable) => deliverable.published && deliverable.publishDate && deliverable.publishDate >= start && deliverable.publishDate <= end)
    .map((deliverable) => ({
      title: deliverable.idea,
      platform: deliverable.platform,
      format: deliverable.format,
      publishDate: deliverable.publishDate,
      views: deliverable.latestMetrics?.views ?? null,
      likes: deliverable.latestMetrics?.likes ?? null,
      comments: deliverable.latestMetrics?.comments ?? null,
      saves: deliverable.latestMetrics?.saves ?? null,
      shares: deliverable.latestMetrics?.shares ?? null,
    }))
    .sort((a, b) => (b.views || 0) - (a.views || 0));

  const plannedNextMonth = detail.deliverables
    .filter((deliverable) => String(deliverable.publishDate || '').startsWith(nextMonth))
    .map((deliverable) => ({
      title: deliverable.idea,
      format: deliverable.format,
      platform: deliverable.platform,
      status: deliverable.status,
      publishDate: deliverable.publishDate,
    }));

  const goals = computeClientGoalsProgress(detail.client, detail.deliverables, month);
  const language = languageLabel(options?.language);

  const prompt = [
    `Write a polished client-facing monthly performance report in ${language} as Markdown.`,
    'Audience: the client. Tone: confident, specific, warm, no jargon. Do not mention internal tools or AI.',
    'Use exactly these sections:',
    '## Executive summary',
    '## What we published',
    '## Results',
    '## Highlights',
    '## Next month',
    '',
    'Rules:',
    '- Use only the data below. Never invent numbers, reach, revenue or results.',
    '- If a metric is missing, say it is not tracked yet rather than guessing.',
    '- Do NOT mention invoices, fees, retainers, profit, expenses, contracts, internal notes or team performance.',
    '- Results should compare this month with the previous month where possible.',
    '- Keep it under 700 words. Use short paragraphs and bullet lists.',
    '- In Next month, use the planned items and call out obvious format gaps. Do not promise specific outcomes.',
    '',
    `CLIENT: ${detail.client.name}`,
    `INDUSTRY: ${detail.client.industry || 'unknown'}`,
    `MONTH: ${month}`,
    `GOALS PROGRESS: ${JSON.stringify({
      visibleGoals: goals.visibleGoals,
      totalTarget: goals.totalTarget,
      totalPublished: goals.totalPublished,
      totalPercent: goals.totalPercent,
      missingSummary: goals.missingSummary,
    })}`,
    `ENGAGEMENT THIS MONTH: ${JSON.stringify(engagement)}`,
    `ENGAGEMENT PREVIOUS MONTH (${previousMonth}): ${JSON.stringify(previousEngagement)}`,
    `PUBLISHED POSTS (${posts.length}): ${JSON.stringify(posts.slice(0, 30))}`,
    `PLANNED NEXT MONTH (${plannedNextMonth.length}): ${JSON.stringify(plannedNextMonth.slice(0, 30))}`,
    `FOLLOWER HISTORY: ${JSON.stringify((detail.client.followerHistory || []).slice(-8))}`,
  ].join('\n');

  const result = await aiGenerate({
    task: 'report',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction:
        'You write accurate, client-ready marketing reports. You never invent metrics or mention internal agency finances. You use clear Markdown.',
      temperature: 0.4,
      maxOutputTokens: 4096,
    },
    meta: { userId: user.id, clientId, feature: 'report' },
  });

  const content = result.text.trim();
  if (!content) throw new Error('The AI returned an empty report. Please try again.');

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('client_reports')
    .upsert(
      {
        client_id: clientId,
        month,
        content_md: content,
        generated_by: user.id,
      },
      { onConflict: 'client_id,month' }
    )
    .select('id, client_id, month, content_md, generated_by, created_at')
    .single();
  if (error) throw error;
  return { ...data, model: result.model };
}
