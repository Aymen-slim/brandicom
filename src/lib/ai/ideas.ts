import { Type } from '@google/genai';
import { z } from 'zod';
import { fetchClientDetail } from '@/lib/data';
import { CurrentUser } from '@/lib/permissions';
import { AI_DEFAULT_LANGUAGE } from './config';
import { aiGenerateJson } from './runtime';
import { currentMonth } from '@/lib/period';
import { ContentIdea, DeliverableFormat, Platform } from '@/types';

const FORMATS = ['reel', 'photo', 'story', 'carousel'] as const;
const PLATFORMS = ['instagram', 'tiktok', 'facebook', 'youtube'] as const;

const IdeaRowSchema = z.object({
  title: z.string().min(1).max(120),
  hook: z.string().max(300).optional().default(''),
  format: z.string().optional(),
  platform: z.string().optional(),
  why_it_fits: z.string().max(1200).optional(),
  whyItFits: z.string().max(1200).optional(),
  script_outline: z.string().max(2000).optional(),
  scriptOutline: z.string().max(2000).optional(),
});

const IdeasPayloadSchema = z.union([
  z.object({ ideas: z.array(IdeaRowSchema).min(1) }),
  z.array(IdeaRowSchema).min(1),
]);

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    ideas: {
      type: Type.ARRAY,
      description: 'Exactly 8 distinct content ideas.',
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'Specific post title, max 80 characters.' },
          hook: { type: Type.STRING, description: 'Opening line or visual hook, max 140 characters.' },
          format: { type: Type.STRING, enum: [...FORMATS] },
          platform: { type: Type.STRING, enum: [...PLATFORMS] },
          why_it_fits: {
            type: Type.STRING,
            description: 'Why this fits the client goals, audience and past performance. Reference concrete data.',
          },
          script_outline: {
            type: Type.STRING,
            description: '3 to 5 shootable beats, one per line. Include shot/action and on-screen text.',
          },
        },
        required: ['title', 'hook', 'format', 'platform', 'why_it_fits', 'script_outline'],
      },
    },
  },
  required: ['ideas'],
};

function normalizeFormat(value: unknown): DeliverableFormat {
  return (FORMATS.includes(String(value) as any) ? String(value) : 'reel') as DeliverableFormat;
}

function normalizePlatform(value: unknown): Platform {
  return (PLATFORMS.includes(String(value) as any) ? String(value) : 'instagram') as Platform;
}

export function parseIdeasPayload(payload: unknown): ContentIdea[] {
  const parsed = IdeasPayloadSchema.parse(payload);
  const rows = Array.isArray(parsed) ? parsed : parsed.ideas;
  return rows.slice(0, 8).map((row) => ({
    title: row.title.trim(),
    hook: (row.hook || '').trim(),
    format: normalizeFormat(row.format),
    platform: normalizePlatform(row.platform),
    whyItFits: (row.why_it_fits || row.whyItFits || '').trim(),
    scriptOutline: (row.script_outline || row.scriptOutline || '').trim(),
  }));
}

export async function generateIdeas(
  clientId: string,
  user: CurrentUser,
  options?: { month?: string | null; language?: string | null }
): Promise<{ ideas: ContentIdea[]; model: string; month: string }> {
  const detail = await fetchClientDetail(clientId, user);
  if (!detail) throw new Error('Client not found');

  const month = options?.month && /^\d{4}-\d{2}$/.test(options.month) ? options.month : currentMonth();
  const language = options?.language === 'fr' || options?.language === 'ar' ? options.language : AI_DEFAULT_LANGUAGE;

  const withMetrics = detail.deliverables.filter((deliverable) => deliverable.latestMetrics);
  const top = [...withMetrics]
    .sort((a, b) => (b.latestMetrics?.views || 0) - (a.latestMetrics?.views || 0))
    .slice(0, 8)
    .map((deliverable) => ({
      title: deliverable.idea,
      format: deliverable.format,
      platform: deliverable.platform,
      views: deliverable.latestMetrics?.views || 0,
      likes: deliverable.latestMetrics?.likes || 0,
      saves: deliverable.latestMetrics?.saves || 0,
      comments: deliverable.latestMetrics?.comments || 0,
    }));

  const weakest = [...withMetrics]
    .sort((a, b) => (a.latestMetrics?.views || 0) - (b.latestMetrics?.views || 0))
    .slice(0, 5)
    .map((deliverable) => ({
      title: deliverable.idea,
      format: deliverable.format,
      platform: deliverable.platform,
      views: deliverable.latestMetrics?.views || 0,
    }));

  const monthDeliverables = detail.deliverables.filter((deliverable) =>
    String(deliverable.publishDate || '').startsWith(month)
  );
  const plannedByFormat = monthDeliverables.reduce<Record<string, number>>((counts, deliverable) => {
    const key = deliverable.format || 'other';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  const inspirations = (detail.client.inspirations || []).slice(0, 8).map((inspiration) => ({
    title: inspiration.title,
    platform: inspiration.platform,
    format: inspiration.format,
    notes: (inspiration.notes || '').slice(0, 300),
  }));

  const content = [
    'You are a senior content strategist at Brandicom, a Tunisian marketing agency.',
    `Write in ${language === 'fr' ? 'French' : language === 'ar' ? 'Arabic' : 'English'}.`,
    'Create exactly 8 distinct content ideas for the client below. Ideas must be specific, shootable and non-generic.',
    'Do not repeat the client’s recent top posts. Use the top posts as evidence of what works, and the weakest posts as evidence of what to avoid.',
    'Keep Tunisian audience sensibilities and realistic production constraints in mind. No expensive stunts.',
    'For each idea:',
    '- title: specific working title (max 80 chars), not a category.',
    '- hook: first line or visual hook (max 140 chars).',
    '- format: reel | photo | story | carousel.',
    '- platform: instagram | tiktok | facebook | youtube.',
    '- why_it_fits: connect to the client goals, audience and actual performance data. Mention numbers when useful.',
    '- script_outline: 3–5 shootable beats, one per line, with shot/action and on-screen text.',
    'Return JSON only, matching the schema.',
    '',
    `MONTH: ${month}`,
    `CLIENT: ${detail.client.name}`,
    `INDUSTRY: ${detail.client.industry || 'unknown'}`,
    `LOCATION: ${detail.client.location || 'Tunisia'}`,
    `SERVICES: ${(detail.client.services || []).join(', ') || 'unknown'}`,
    `BRAND NOTES: ${(detail.client.notes || '').slice(0, 1200) || 'none'}`,
    `SOCIALS: ${
      (detail.client.socialAccounts || [])
        .map((social) => `${social.platform} ${social.handle || ''} (${social.followers ?? '?'} followers)`)
        .join(', ') || 'none'
    }`,
    `MONTHLY GOALS: ${JSON.stringify(detail.client.monthlyGoals || {})}`,
    `PLANNED THIS MONTH BY FORMAT: ${JSON.stringify(plannedByFormat)}`,
    `DELIVERABLES THIS MONTH: ${monthDeliverables.length}`,
    `PUBLISHED THIS MONTH: ${monthDeliverables.filter((deliverable) => deliverable.published).length}`,
    `TOP POSTS: ${JSON.stringify(top)}`,
    `WEAKEST POSTS: ${JSON.stringify(weakest)}`,
    `SAVED INSPIRATIONS: ${JSON.stringify(inspirations)}`,
    `FOLLOWER HISTORY: ${JSON.stringify((detail.client.followerHistory || []).slice(-6))}`,
  ].join('\n');

  const result = await aiGenerateJson({
    task: 'ideas',
    contents: [{ role: 'user', parts: [{ text: content }] }],
    schema: RESPONSE_SCHEMA,
    parse: parseIdeasPayload,
    meta: { userId: user.id, clientId, feature: 'ideas' },
  });

  return { ideas: result.data, model: result.model, month };
}
