import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getGemini } from './gemini';
import { modelFor } from './config';
import { memberSafeHealthFactors } from '@/lib/healthPrivacy';

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
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, status, end_date, created_at');
  if (error) throw error;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const d60 = new Date(now.getTime() - 60 * 86400000).toISOString().slice(0, 10);
  const in45 = new Date(now.getTime() + 45 * 86400000).toISOString().slice(0, 10);

  async function computeClient(client: any) {
    try {
      const { data: dels } = await supabase
        .from('deliverables')
        .select('id, published, status, publish_date, post_metrics(views, captured_at)')
        .eq('client_id', client.id);

      const unpublished = (dels || []).filter((d) => !d.published && d.status !== 'published').length;
      const recent = (dels || []).filter((d) => d.publish_date && d.publish_date >= d30);
      const prior = (dels || []).filter(
        (d) => d.publish_date && d.publish_date >= d60 && d.publish_date < d30
      );
      const sumViews = (rows: any[]) =>
        rows.reduce((sum, d) => {
          const latest = (d.post_metrics || []).sort(
            (a: any, b: any) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
          )[0];
          return sum + Number(latest?.views || 0);
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
      const lastContact = lastMsg?.created_at || client.created_at || null;
      const daysSinceMessage = lastContact
        ? Math.max(0, Math.floor((now.getTime() - new Date(lastContact).getTime()) / 86400000))
        : 30;

      const contractEndingSoon = Boolean(
        client.end_date && client.end_date <= in45 && client.end_date >= today
      );

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

      // Snapshots are readable by assigned members. Keep invoice-derived
      // factors out of the shared JSON; the score already reflects them.
      const storedFactors = memberSafeHealthFactors(factors);

      let aiSummary: string | null = null;
      if (risk === 'low') {
        aiSummary = `${client.name} is healthy (score ${score}/100). Keep the current posting cadence and check in with the client this week.`;
      } else {
        try {
          const ai = getGemini();
          const summaryFactors = {
            engagementDrop: factors.engagementDrop,
            unpublishedBacklog: factors.unpublishedBacklog,
            daysSinceMessage: factors.daysSinceMessage,
            contractEndingSoon: factors.contractEndingSoon,
          };
          const res = await ai.models.generateContent({
            model: modelFor('health'),
            contents: [
              'You write one or two concise sentences for agency staff about a client account health score.',
              'Write in English. Name the main risk, give one concrete next action, and do not invent data.',
              'Never mention money, invoices, fees, profit, expenses, or contract values.',
              `Client: ${client.name}. Status: ${client.status}. Score: ${score}/100 (${risk} risk).`,
              `Factors: ${JSON.stringify(summaryFactors)}.`,
            ].join('\n'),
            config: { temperature: 0.3, maxOutputTokens: 200 },
          });
          aiSummary = (res.text || '').trim().slice(0, 500) || null;
        } catch {
          aiSummary = `${client.name} is at ${risk} risk (score ${score}/100). Review outstanding work and contact the client.`;
        }
      }

      const { data: snapshot, error: snapshotError } = await supabase
        .from('client_health_snapshots')
        .insert({
          client_id: client.id,
          score,
          risk,
          factors: storedFactors,
          ai_summary: aiSummary,
        })
        .select('client_id, score, risk, factors, ai_summary, computed_at')
        .single();
      if (snapshotError) throw snapshotError;
      return snapshot;
    } catch (clientError: any) {
      console.error(`[ai] health failed for ${client.name}`, clientError);
      return { client_id: client.id, error: clientError?.message || 'Health check failed' };
    }
  }

  const list = clients || [];
  const results = new Array<any>(list.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(4, list.length) }, async () => {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await computeClient(list[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
