import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getGemini, geminiModel } from './gemini';

interface Factors {
  engagementDrop: number;
  unpublishedBacklog: number;
  daysSinceMessage: number;
  contractEndingSoon: boolean;
  overdueInvoices: number;
}

function scoreFrom(f: Factors, admin: boolean): { score: number; risk: 'low' | 'medium' | 'high' } {
  let score = 100;
  score -= Math.min(40, f.engagementDrop);
  score -= Math.min(20, f.unpublishedBacklog * 4);
  if (f.daysSinceMessage > 14) score -= 15;
  else if (f.daysSinceMessage > 7) score -= 8;
  if (f.contractEndingSoon) score -= 20;
  if (admin && f.overdueInvoices > 0) score -= Math.min(25, f.overdueInvoices * 10);
  score = Math.max(0, Math.min(100, Math.round(score)));
  const risk = score >= 70 ? 'low' : score >= 45 ? 'medium' : 'high';
  return { score, risk };
}

export async function recomputeHealth(opts?: { admin?: boolean; useServiceRole?: boolean }) {
  const supabase = opts?.useServiceRole ? createAdminSupabaseClient() : createServerSupabaseClient();
  const { data: clients, error } = await supabase.from('clients').select('id, name, status, end_date, notes');
  if (error) throw error;

  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const d60 = new Date(now.getTime() - 60 * 86400000).toISOString().slice(0, 10);
  const in45 = new Date(now.getTime() + 45 * 86400000).toISOString().slice(0, 10);

  const results = [];
  for (const client of clients || []) {
    const { data: dels } = await supabase
      .from('deliverables')
      .select('id, published, status, publish_date, post_metrics(views, captured_at)')
      .eq('client_id', client.id);

    const unpublished = (dels || []).filter((d) => !d.published && d.status !== 'published').length;
    const recent = (dels || []).filter((d) => d.publish_date && d.publish_date >= d30);
    const prior = (dels || []).filter((d) => d.publish_date && d.publish_date >= d60 && d.publish_date < d30);
    const sumViews = (rows: any[]) =>
      rows.reduce((s, d) => {
        const latest = (d.post_metrics || []).sort(
          (a: any, b: any) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
        )[0];
        return s + Number(latest?.views || 0);
      }, 0);
    const recentViews = sumViews(recent);
    const priorViews = sumViews(prior);
    const drop = priorViews > 0 ? Math.max(0, ((priorViews - recentViews) / priorViews) * 100) : 0;

    const { data: lastMsg } = await supabase
      .from('messages')
      .select('created_at')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const daysSinceMessage = lastMsg?.created_at
      ? Math.floor((now.getTime() - new Date(lastMsg.created_at).getTime()) / 86400000)
      : 30;

    const contractEndingSoon = Boolean(client.end_date && client.end_date <= in45 && client.end_date >= now.toISOString().slice(0, 10));

    let overdueInvoices = 0;
    if (opts?.admin) {
      const { count } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', client.id)
        .in('status', ['overdue']);
      overdueInvoices = count ?? 0;
    }

    const factors: Factors = {
      engagementDrop: Math.round(drop),
      unpublishedBacklog: unpublished,
      daysSinceMessage,
      contractEndingSoon,
      overdueInvoices,
    };
    const { score, risk } = scoreFrom(factors, Boolean(opts?.admin));

    let aiSummary: string | null = null;
    try {
      const ai = getGemini();
      const res = await ai.models.generateContent({
        model: geminiModel(),
        contents: `Write 1-2 sentences for agency staff about this client health. Client: ${client.name}, status ${client.status}. Factors: ${JSON.stringify(factors)}. Score ${score} (${risk}). Recommend one action. No money details unless overdueInvoices > 0.`,
      });
      aiSummary = (res.text || '').trim().slice(0, 500);
    } catch {
      aiSummary = `${client.name} health score ${score} (${risk}).`;
    }

    const { data: snap } = await supabase
      .from('client_health_snapshots')
      .insert({
        client_id: client.id,
        score,
        risk,
        factors,
        ai_summary: aiSummary,
      })
      .select('client_id, score, risk, factors, ai_summary, computed_at')
      .single();
    results.push(snap);
  }
  return results;
}
