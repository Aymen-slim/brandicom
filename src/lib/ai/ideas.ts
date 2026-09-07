import { getGemini, geminiModel } from './gemini';
import { fetchClientDetail } from '@/lib/data';
import { CurrentUser } from '@/lib/permissions';
import { ContentIdea, DeliverableFormat, Platform } from '@/types';

export async function generateIdeas(clientId: string, user: CurrentUser): Promise<ContentIdea[]> {
  const detail = await fetchClientDetail(clientId, user);
  if (!detail) throw new Error('Client not found');

  const top = detail.deliverables
    .filter((d) => d.latestMetrics)
    .sort((a, b) => (b.latestMetrics?.views || 0) - (a.latestMetrics?.views || 0))
    .slice(0, 10)
    .map((d) => ({
      idea: d.idea,
      format: d.format,
      platform: d.platform,
      views: d.latestMetrics?.views,
      likes: d.latestMetrics?.likes,
    }));

  const ai = getGemini();
  const res = await ai.models.generateContent({
    model: geminiModel(),
    contents: `You are a content strategist. Propose 8 content ideas as JSON array of objects with keys title, hook, format (reel|photo|story|carousel), platform (instagram|tiktok|facebook|youtube), why_it_fits, script_outline. Client: ${detail.client.name}. Industry: ${detail.client.industry}. Services: ${detail.client.services.join(', ')}. Notes: ${(detail.client.notes || '').slice(0, 800)}. Socials: ${(detail.client.socialAccounts || []).map((s) => s.platform + ' ' + s.handle).join(', ')}. Top posts: ${JSON.stringify(top)}. Return JSON only.`,
  });

  const text = (res.text || '').trim();
  const json = text.replace(/^```json\s*|```$/g, '');
  const parsed = JSON.parse(json.slice(json.indexOf('['), json.lastIndexOf(']') + 1));
  return (parsed as any[]).slice(0, 8).map((row) => ({
    title: String(row.title || 'Untitled'),
    hook: String(row.hook || ''),
    format: (['reel', 'photo', 'story', 'carousel'].includes(row.format) ? row.format : 'reel') as DeliverableFormat,
    platform: (['instagram', 'tiktok', 'facebook', 'youtube'].includes(row.platform)
      ? row.platform
      : 'instagram') as Platform,
    whyItFits: String(row.why_it_fits || row.whyItFits || ''),
    scriptOutline: String(row.script_outline || row.scriptOutline || ''),
  }));
}
