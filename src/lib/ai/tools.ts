import { z } from 'zod';
import { canAccessClient, type CurrentUser } from '@/lib/permissions';
import {
  fetchClientDetail,
  fetchClients,
  fetchCreators,
  fetchGoals,
  isFilmingDateSupported,
  sanitizeSearchTerm,
} from '@/lib/data';
import { computeGoalsAndMetrics } from '@/lib/goals';
import { fetchFinanceSummary, fetchInvoices, fetchExpenses } from '@/lib/finance';
import { clientEngagementSummary } from '@/lib/engagement';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { currentMonth, normalizePeriod } from '@/lib/period';
import { fetchContactSubmissions } from '@/lib/submissions';
import { memberHealthSummary, memberSafeHealthFactors } from '@/lib/healthPrivacy';
import {
  ActionSchema,
  ADMIN_ACTIONS,
  isLowRiskAction,
  type AiAction,
} from './actions';
import { autoApplyActions } from './apply';
import { toolDeclarations } from './toolDeclarations';

export { ActionSchema, ADMIN_ACTIONS, isLowRiskAction };
export { toolDeclarations };

const CHAT_LIMIT = 60;

function clip(value: unknown, max = 8000): unknown {
  const serialized = JSON.stringify(value);
  if (serialized.length <= max) return value;
  return { truncated: true, preview: serialized.slice(0, max) };
}

function limitNumber(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function moneyFields(metrics: any, admin: boolean) {
  if (admin) return metrics;
  const { revenue, profit, expenses, outstanding, overdue, mrr, ...safe } = metrics;
  return safe;
}

function healthView(health: any, admin: boolean, clientName?: string) {
  if (!health) return null;
  return {
    score: health.score,
    risk: health.risk,
    summary: admin ? health.aiSummary : memberHealthSummary(health, clientName),
    factors: admin ? health.factors : memberSafeHealthFactors(health.factors),
    computedAt: health.computedAt,
  };
}

function latestHealthRows<T extends { client_id: string; computed_at?: string }>(rows: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (!map.has(row.client_id)) map.set(row.client_id, row);
  }
  return map;
}

function compactDeliverable(deliverable: any) {
  return {
    id: deliverable.id,
    title: deliverable.idea,
    format: deliverable.format,
    platform: deliverable.platform,
    status: deliverable.status,
    publishDate: deliverable.publishDate,
    filmingDate: deliverable.filmingDate,
    views: deliverable.latestMetrics?.views ?? null,
    likes: deliverable.latestMetrics?.likes ?? null,
    comments: deliverable.latestMetrics?.comments ?? null,
    saves: deliverable.latestMetrics?.saves ?? null,
    link: deliverable.link || null,
  };
}

const ToolArgSchemas: Record<string, z.ZodTypeAny> = {
  get_agency_overview: z.object({ period: z.string().max(20).optional() }),
  list_clients: z.object({
    status: z.string().max(30).optional(),
    search: z.string().max(120).optional(),
    limit: z.number().optional(),
  }),
  get_client: z.object({ clientId: z.string().min(1) }),
  get_client_health: z.object({ clientId: z.string().min(1) }),
  get_client_engagement: z.object({ clientId: z.string().min(1), period: z.string().max(20).optional() }),
  get_follower_growth: z.object({ clientId: z.string().min(1) }),
  get_top_posts: z.object({ clientId: z.string().min(1), limit: z.number().optional() }),
  list_deliverables: z.object({
    clientId: z.string().min(1),
    status: z.string().max(30).optional(),
    limit: z.number().optional(),
  }),
  get_upcoming: z.object({ clientId: z.string().min(1).optional(), days: z.number().optional() }),
  list_partners: z.object({ role: z.string().max(40).optional(), search: z.string().max(120).optional() }),
  get_goals: z.object({ period: z.string().max(20).optional() }),
  search: z.object({ query: z.string().min(1).max(120) }),
  get_report: z.object({ clientId: z.string().min(1), month: z.string().min(4).max(20) }),
  propose_changes: z.object({
    actions: z.array(z.unknown()).min(1).max(10),
    summary: z.string().max(300).optional(),
  }),
  get_finance_summary: z.object({ period: z.string().max(20).optional() }),
  list_invoices: z.object({ status: z.string().max(30).optional(), clientId: z.string().min(1).optional() }),
  list_expenses: z.object({ category: z.string().max(40).optional(), clientId: z.string().min(1).optional() }),
  get_contact_submissions: z.object({ limit: z.number().optional() }),
};

function validateArgs(name: string, args: Record<string, any>) {
  const schema = ToolArgSchemas[name];
  if (!schema) return { ok: false as const, error: `unknown tool ${name}` };
  const parsed = schema.safeParse(args || {});
  if (!parsed.success) {
    return { ok: false as const, error: 'invalid_arguments', details: parsed.error.flatten() };
  }
  return { ok: true as const, data: parsed.data as Record<string, any> };
}

export async function executeTool(
  name: string,
  args: Record<string, any>,
  user: CurrentUser,
  ctx?: { conversationId?: string | null }
): Promise<unknown> {
  const validated = validateArgs(name, args);
  if (!validated.ok) return { error: validated.error, details: (validated as any).details };
  const input = validated.data;
  const admin = user.role === 'admin';

  switch (name) {
    case 'get_agency_overview':
      return clip(moneyFields(await computeGoalsAndMetrics(normalizePeriod(input.period)), admin));

    case 'list_clients': {
      const clients = await fetchClients({
        status: input.status,
        search: input.search,
        userRole: user.role,
        userId: user.id,
      });
      const page = clients.slice(0, limitNumber(input.limit, 30, 60));
      const supabase = createServerSupabaseClient();
      const { data: healthRows } = page.length
        ? await supabase
            .from('client_health_snapshots')
            .select('client_id, score, risk, computed_at')
            .in('client_id', page.map((client) => client.id))
            .order('computed_at', { ascending: false })
            .limit(Math.max(60, page.length * 4))
        : { data: [] as any[] };
      const latest = latestHealthRows((healthRows || []) as any[]);
      return clip(
        page.map((client) => {
          const health = latest.get(client.id);
          return {
            id: client.id,
            name: client.name,
            status: client.status,
            location: client.location,
            industry: client.industry,
            startDate: client.startDate,
            monthlyFee: admin ? client.contract?.monthlyFee ?? null : undefined,
            health: health ? { score: health.score, risk: health.risk, computedAt: health.computed_at } : null,
          };
        })
      );
    }

    case 'get_client': {
      const detail = await fetchClientDetail(input.clientId, user);
      if (!detail) return { error: 'not found' };
      const { client, deliverables } = detail;
      const topPosts = deliverables
        .filter((deliverable) => deliverable.latestMetrics)
        .sort((a, b) => (b.latestMetrics?.views || 0) - (a.latestMetrics?.views || 0))
        .slice(0, 3)
        .map(compactDeliverable);
      return clip({
        id: client.id,
        name: client.name,
        status: client.status,
        industry: client.industry,
        location: client.location,
        website: client.website,
        services: client.services,
        notes: (client.notes || '').slice(0, 1500),
        contact: {
          name: client.contactName,
          email: client.contactEmail,
          phone: client.contactPhone,
        },
        startDate: client.startDate,
        endDate: client.endDate,
        tags: client.tags,
        monthlyGoals: client.monthlyGoals,
        followerHistory: (client.followerHistory || []).slice(-6),
        socials: (client.socialAccounts || []).map((social) => ({
          platform: social.platform,
          handle: social.handle,
          followers: social.followers,
        })),
        inspirations: (client.inspirations || []).slice(0, 5).map((inspiration) => ({
          title: inspiration.title,
          platform: inspiration.platform,
          format: inspiration.format,
        })),
        health: healthView(client.health, admin, client.name),
        counts: {
          deliverables: deliverables.length,
          published: deliverables.filter((deliverable) => deliverable.published).length,
          ideas: deliverables.filter((deliverable) => deliverable.status === 'idea').length,
        },
        topPosts,
        monthlyFee: admin ? client.contract?.monthlyFee ?? null : undefined,
      });
    }

    case 'get_client_health': {
      const detail = await fetchClientDetail(input.clientId, user);
      if (!detail) return { error: 'not found' };
      if (!detail.client.health) return { client: detail.client.name, health: null, hint: 'No health snapshot yet.' };
      return clip({
        client: detail.client.name,
        ...(healthView(detail.client.health, admin, detail.client.name) || {}),
      });
    }

    case 'get_client_engagement': {
      if (!(await canAccessClient(user.id, user.role, input.clientId))) {
        return { error: 'not found' };
      }
      const requested = String(input.period || '').trim().toLowerCase();
      const period = requested === 'all' ? 'all' : normalizePeriod(input.period);
      return clip({
        period,
        ...(await clientEngagementSummary(input.clientId, period)),
      });
    }

    case 'get_follower_growth': {
      const detail = await fetchClientDetail(input.clientId, user);
      if (!detail) return { error: 'not found' };
      const current = (detail.client.socialAccounts || []).reduce((sum, social) => sum + Number(social.followers || 0), 0);
      return clip({
        client: detail.client.name,
        currentFollowers: current,
        history: (detail.client.followerHistory || []).slice(-12),
      });
    }

    case 'get_top_posts': {
      const detail = await fetchClientDetail(input.clientId, user);
      if (!detail) return { error: 'not found' };
      const limit = limitNumber(input.limit, 5, 15);
      return clip(
        detail.deliverables
          .filter((deliverable) => deliverable.latestMetrics)
          .sort((a, b) => (b.latestMetrics?.views || 0) - (a.latestMetrics?.views || 0))
          .slice(0, limit)
          .map(compactDeliverable)
      );
    }

    case 'list_deliverables': {
      const detail = await fetchClientDetail(input.clientId, user);
      if (!detail) return { error: 'not found' };
      const status = String(input.status || '').trim();
      const limit = limitNumber(input.limit, 40, 80);
      return clip(
        detail.deliverables
          .filter((deliverable) => !status || deliverable.status === status)
          .slice(0, limit)
          .map(compactDeliverable)
      );
    }

    case 'get_upcoming': {
      if (input.clientId && !(await canAccessClient(user.id, user.role, input.clientId))) {
        return { error: 'not found' };
      }
      const supabase = createServerSupabaseClient();
      const today = new Date().toISOString().slice(0, 10);
      const days = limitNumber(input.days, 14, 60);
      const until = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
      const supportsFilming = await isFilmingDateSupported(supabase);

      const baseSelect = 'id, client_id, idea, status, publish_date, clients(name)';
      const filmingSelect = supportsFilming ? 'id, client_id, idea, status, publish_date, filming_date, clients(name)' : baseSelect;

      let publishQuery = supabase
        .from('deliverables')
        .select(filmingSelect)
        .gte('publish_date', today)
        .lte('publish_date', until)
        .order('publish_date', { ascending: true })
        .limit(40);
      let filmingQuery = supportsFilming
        ? supabase
            .from('deliverables')
            .select(filmingSelect)
            .gte('filming_date', today)
            .lte('filming_date', until)
            .order('filming_date', { ascending: true })
            .limit(40)
        : Promise.resolve({ data: [], error: null } as any);

      if (input.clientId) {
        publishQuery = publishQuery.eq('client_id', input.clientId);
        if (supportsFilming) {
          filmingQuery = (filmingQuery as any).eq('client_id', input.clientId);
        }
      }

      const [publishing, filming] = await Promise.all([publishQuery, filmingQuery]);
      const rows = new Map<string, any>();
      for (const row of (publishing as any).data || []) {
        rows.set(row.id, {
          id: row.id,
          client: row.clients?.name || null,
          title: row.idea,
          status: row.status,
          publishDate: row.publish_date,
          filmingDate: null,
        });
      }
      for (const row of (filming as any).data || []) {
        const existing = rows.get(row.id);
        if (existing) existing.filmingDate = row.filming_date;
        else
          rows.set(row.id, {
            id: row.id,
            client: row.clients?.name || null,
            title: row.idea,
            status: row.status,
            publishDate: row.publish_date,
            filmingDate: row.filming_date,
          });
      }
      return clip(Array.from(rows.values()));
    }

    case 'list_partners': {
      const partners = await fetchCreators({ role: input.role, search: input.search, isAdmin: admin });
      return clip(
        partners.slice(0, 30).map((partner) => ({
          id: partner.id,
          name: partner.name,
          role: partner.role,
          company: partner.company,
          location: partner.location,
          available: partner.available,
          instagramHandle: partner.instagramHandle,
          styleTags: partner.styleTags,
          rating: partner.rating,
          dayRate: admin ? partner.dayRate : undefined,
        }))
      );
    }

    case 'get_goals': {
      const targets = (await fetchGoals()).filter(
        (goal) => admin || !['revenue', 'profit'].includes(goal.metric)
      );
      return clip({
        metrics: moneyFields(await computeGoalsAndMetrics(normalizePeriod(input.period)), admin),
        targets,
      });
    }

    case 'search': {
      const term = sanitizeSearchTerm(String(input.query || '')).slice(0, 80);
      const supabase = createServerSupabaseClient();
      const like = `%${term}%`;
      const [clients, partners, deliverables, invoices] = await Promise.all([
        fetchClients({ search: term, userRole: user.role, userId: user.id }),
        fetchCreators({ search: term, isAdmin: false }),
        supabase
          .from('deliverables')
          .select('id, idea, client_id, status, clients(name)')
          .ilike('idea', like)
          .limit(10),
        admin
          ? supabase.from('invoices').select('id, number, total, status, clients(name)').ilike('number', like).limit(10)
          : Promise.resolve({ data: [] } as any),
      ]);
      return clip({
        clients: clients.slice(0, 8).map((client) => ({ id: client.id, name: client.name, status: client.status })),
        partners: partners.slice(0, 8).map((partner) => ({ id: partner.id, name: partner.name, role: partner.role })),
        deliverables: (deliverables as any).data || [],
        invoices: (invoices as any).data || [],
      });
    }

    case 'get_report': {
      if (!(await canAccessClient(user.id, user.role, input.clientId))) {
        return { error: 'not found' };
      }
      const month = normalizePeriod(input.month);
      const supabase = createServerSupabaseClient();
      const { data } = await supabase
        .from('client_reports')
        .select('client_id, month, content_md, generated_by, created_at')
        .eq('client_id', input.clientId)
        .eq('month', month)
        .maybeSingle();
      if (!data) return { report: null, month };
      return clip({
        month,
        savedAt: data.created_at,
        content: (data.content_md || '').slice(0, 6000),
      });
    }

    case 'get_finance_summary':
      if (!admin) return { error: 'forbidden' };
      return clip(await fetchFinanceSummary(normalizePeriod(input.period || currentMonth())));

    case 'list_invoices':
      if (!admin) return { error: 'forbidden' };
      return clip(
        (await fetchInvoices({ status: input.status, clientId: input.clientId })).slice(0, CHAT_LIMIT)
      );

    case 'list_expenses':
      if (!admin) return { error: 'forbidden' };
      return clip(
        (await fetchExpenses({ category: input.category, clientId: input.clientId })).slice(0, CHAT_LIMIT)
      );

    case 'get_contact_submissions': {
      if (!admin) return { error: 'forbidden' };
      const submissions = await fetchContactSubmissions();
      return clip(
        submissions.slice(0, limitNumber(input.limit, 10, 30)).map((submission) => ({
          id: submission.id,
          name: submission.name,
          email: submission.email,
          phone: submission.phone,
          budget: submission.budget,
          services: submission.services,
          message: submission.message.slice(0, 1200),
          createdAt: submission.createdAt,
        }))
      );
    }

    case 'propose_changes': {
      const raw = Array.isArray(input.actions) ? input.actions : [];
      const actions: AiAction[] = [];
      const errors: Array<Record<string, unknown>> = [];

      raw.slice(0, 10).forEach((item: unknown, index: number) => {
        const parsed = ActionSchema.safeParse(item);
        if (!parsed.success) {
          errors.push({ index, error: 'invalid_action', details: parsed.error.flatten(), raw: item });
          return;
        }
        if (ADMIN_ACTIONS.has(parsed.data.type) && !admin) {
          errors.push({ index, error: 'forbidden', type: parsed.data.type });
          return;
        }
        if (
          parsed.data.type === 'update_client' &&
          !admin &&
          parsed.data.assignedUserIds &&
          parsed.data.assignedUserIds.length > 0
        ) {
          errors.push({ index, error: 'forbidden', type: parsed.data.type, field: 'assignedUserIds' });
          return;
        }
        actions.push(parsed.data);
      });

      if (errors.length > 0) {
        return {
          error: 'invalid_actions',
          errors,
          hint: 'Fix the invalid actions and call propose_changes again. Do not claim anything was applied.',
        };
      }
      if (actions.length === 0) {
        return { error: 'no_actions', hint: 'Provide at least one action.' };
      }

      if (actions.every((action) => isLowRiskAction(action.type))) {
        const applied = await autoApplyActions(actions, user, ctx?.conversationId);
        const appliedCount = applied.results.filter((result) => result.ok).length;
        const failedCount = applied.results.length - appliedCount;
        if (appliedCount === 0) {
          return {
            error: 'auto_apply_failed',
            status: 'failed',
            summary: 'The changes could not be applied.',
            proposalId: applied.proposalId,
            actions,
            autoApplied: false,
            needsConfirmation: false,
            results: applied.results,
            undo: [],
            hint: 'Nothing was applied. Explain the failure and do not claim success.',
          };
        }
        return {
          proposalId: applied.proposalId,
          status: 'applied',
          summary: input.summary || 'Changes applied automatically.',
          actions,
          autoApplied: true,
          appliedCount,
          failedCount,
          results: applied.results,
          undo: applied.undo,
          needsConfirmation: false,
        };
      }

      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase
        .from('ai_proposals')
        .insert({
          conversation_id: ctx?.conversationId || null,
          user_id: user.id,
          actions,
          status: 'pending',
        })
        .select('id, actions, status')
        .single();
      if (error) throw error;
      return {
        proposalId: data.id,
        status: 'pending',
        summary: input.summary || 'Proposed changes ready for confirmation.',
        actions: data.actions,
        needsConfirmation: true,
        autoApplied: false,
      };
    }

    default:
      return { error: `unknown tool ${name}` };
  }
}
