import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getGemini, geminiModel } from './gemini';
import { fetchClientDetail } from '@/lib/data';
import { clientEngagementSummary } from '@/lib/engagement';
import { CurrentUser } from '@/lib/permissions';
import { periodRange } from '@/lib/period';

export async function generateClientReport(clientId: string, month: string, user: CurrentUser) {
  const detail = await fetchClientDetail(clientId, user);
  if (!detail) throw new Error('Client not found');
  const { start, end } = periodRange(month);
  const engagement = await clientEngagementSummary(clientId, month);
  const posts = detail.deliverables.filter(
    (d) => d.published && d.publishDate && d.publishDate >= start && d.publishDate <= end
  );

  const ai = getGemini();
  const res = await ai.models.generateContent({
    model: geminiModel(),
    contents: `Write a client-facing monthly performance report in Markdown. Language: match the agency (French or English; default English). Sections: 1) Executive summary 2) What we published 3) Results (views, engagement) 4) Highlights 5) Plan for next month. Do NOT mention invoices, fees, profit, or internal notes. Client: ${detail.client.name}. Month: ${month}. Engagement: ${JSON.stringify(engagement)}. Posts: ${JSON.stringify(posts.map((p) => ({ idea: p.idea, platform: p.platform, format: p.format, views: p.latestMetrics?.views, likes: p.latestMetrics?.likes })))}.`,
  });
  const content = (res.text || '').trim();

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
  return data;
}
