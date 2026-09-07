import { Type } from '@google/genai';
import { z } from 'zod';
import { CurrentUser } from '@/lib/permissions';
import { fetchClientDetail, fetchClients, fetchCreators, fetchGoals, updateClient } from '@/lib/data';
import { computeGoalsAndMetrics } from '@/lib/goals';
import { fetchFinanceSummary, fetchInvoices, fetchExpenses } from '@/lib/finance';
import { clientEngagementSummary } from '@/lib/engagement';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { currentMonth, normalizePeriod } from '@/lib/period';

const ActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create_client'),
    name: z.string().min(1).max(200),
    location: z.string().optional().nullable(),
    status: z.string().optional().nullable(),
    services: z.union([z.array(z.string()), z.string()]).optional().nullable(),
    notes: z.string().optional().nullable(),
    industry: z.string().optional().nullable(),
    website: z.string().optional().nullable(),
    contactName: z.string().optional().nullable(),
    contactEmail: z.string().optional().nullable(),
    contactPhone: z.string().optional().nullable(),
    startDate: z.string().optional().nullable(),
    leadSource: z.string().optional().nullable(),
    tags: z.union([z.array(z.string()), z.string()]).optional().nullable(),
    monthlyFee: z.number().optional().nullable(),
    contractType: z.string().optional().nullable(),
    assignedUserIds: z.array(z.string()).optional().nullable(),
  }),
  z.object({
    type: z.literal('create_deliverable'),
    clientId: z.string().uuid(),
    idea: z.string().min(1).max(400),
    format: z.string().optional(),
    platform: z.string().optional(),
    status: z.string().optional(),
    filmingDate: z.string().optional(),
    publishDate: z.string().optional(),
  }),
  z.object({
    type: z.literal('update_deliverable_status'),
    deliverableId: z.string().uuid(),
    status: z.string(),
  }),
  z.object({
    type: z.literal('update_client'),
    clientId: z.string().uuid(),
    fields: z.record(z.unknown()),
  }),
  z.object({
    type: z.literal('add_client_note'),
    clientId: z.string().uuid(),
    note: z.string().min(1).max(2000),
  }),
  z.object({
    type: z.literal('book_partner'),
    clientId: z.string().uuid(),
    partnerId: z.string().uuid(),
    scheduledDate: z.string().optional(),
    deliverableId: z.string().uuid().optional(),
  }),
  z.object({
    type: z.literal('upsert_goal'),
    periodType: z.enum(['month', 'year']),
    periodValue: z.string(),
    metric: z.string(),
    target: z.number(),
  }),
  z.object({
    type: z.literal('create_expense'),
    date: z.string(),
    amount: z.number().positive(),
    category: z.string(),
    description: z.string().optional(),
    clientId: z.string().uuid().optional(),
  }),
  z.object({
    type: z.literal('create_invoice'),
    clientId: z.string().uuid(),
    subtotal: z.number().nonnegative(),
    periodLabel: z.string().optional(),
  }),
  z.object({
    type: z.literal('record_payment'),
    invoiceId: z.string().uuid(),
    amount: z.number().positive(),
  }),
  z.object({
    type: z.literal('update_contract'),
    clientId: z.string().uuid(),
    monthlyFee: z.number().optional(),
    contractType: z.string().optional(),
  }),
]);

const ADMIN_ACTIONS = new Set(['create_expense', 'create_invoice', 'record_payment', 'update_contract', 'upsert_goal']);

function tool(name: string, description: string, properties: Record<string, unknown>, required: string[] = []) {
  return {
    name,
    description,
    parameters: {
      type: Type.OBJECT,
      properties,
      required,
    },
  };
}

export function toolDeclarations(isAdmin: boolean) {
  const read = [
    tool('get_agency_overview', 'KPI snapshot for a month (YYYY-MM) or year (YYYY).', {
      period: { type: Type.STRING },
    }),
    tool('list_clients', 'List clients, optionally filtered by status.', {
      status: { type: Type.STRING },
      search: { type: Type.STRING },
    }),
    tool('get_client', 'Full profile for one client (content, partners, engagement; money only if admin).', {
      clientId: { type: Type.STRING },
    }, ['clientId']),
    tool('get_client_engagement', 'Engagement totals for a client in a period.', {
      clientId: { type: Type.STRING },
      period: { type: Type.STRING },
    }, ['clientId']),
    tool('list_deliverables', 'Deliverables for a client.', {
      clientId: { type: Type.STRING },
    }, ['clientId']),
    tool('list_partners', 'Partner/talent directory.', {
      role: { type: Type.STRING },
      search: { type: Type.STRING },
    }),
    tool('get_goals', 'Goal targets vs actuals for a period.', {
      period: { type: Type.STRING },
    }),
    tool('search', 'Search clients, partners, and posts by text.', {
      query: { type: Type.STRING },
    }, ['query']),
    tool(
      'propose_changes',
      'Propose data changes. Does NOT apply them. actions is an array of {type, ...fields}. Allowed types: create_client, create_deliverable, update_deliverable_status, update_client, add_client_note, book_partner, upsert_goal' +
        (isAdmin ? ', create_expense, create_invoice, record_payment, update_contract' : '') +
        '.',
      {
        actions: { type: Type.ARRAY, items: { type: Type.OBJECT } },
        summary: { type: Type.STRING },
      },
      ['actions']
    ),
  ];

  if (!isAdmin) return read;

  return [
    ...read,
    tool('get_finance_summary', 'P&L for a period (admin).', { period: { type: Type.STRING } }),
    tool('list_invoices', 'List invoices (admin).', {
      status: { type: Type.STRING },
      clientId: { type: Type.STRING },
    }),
    tool('list_expenses', 'List expenses (admin).', {
      category: { type: Type.STRING },
      clientId: { type: Type.STRING },
    }),
  ];
}

function clip(value: unknown, max = 8000): unknown {
  const s = JSON.stringify(value);
  if (s.length <= max) return value;
  return { truncated: true, preview: s.slice(0, max) };
}

export async function executeTool(
  name: string,
  args: Record<string, any>,
  user: CurrentUser
): Promise<unknown> {
  const admin = user.role === 'admin';
  switch (name) {
    case 'get_agency_overview':
      return clip(await computeGoalsAndMetrics(normalizePeriod(args.period)));
    case 'list_clients': {
      const clients = await fetchClients({
        status: args.status,
        search: args.search,
        userRole: user.role,
        userId: user.id,
      });
      return clip(
        clients.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          location: c.location,
          industry: c.industry,
          startDate: c.startDate,
          monthlyFee: admin ? c.contract?.monthlyFee ?? null : undefined,
        }))
      );
    }
    case 'get_client': {
      const detail = await fetchClientDetail(args.clientId, user);
      if (!detail) return { error: 'not found' };
      return clip({
        ...detail.client,
        deliverables: detail.deliverables.slice(0, 20),
        partners: detail.creatorAssignments,
      });
    }
    case 'get_client_engagement':
      return clip(await clientEngagementSummary(args.clientId, normalizePeriod(args.period)));
    case 'list_deliverables': {
      const detail = await fetchClientDetail(args.clientId, user);
      return clip(detail?.deliverables || []);
    }
    case 'list_partners':
      return clip(await fetchCreators({ role: args.role, search: args.search, isAdmin: admin }));
    case 'get_goals':
      return clip({
        metrics: await computeGoalsAndMetrics(normalizePeriod(args.period)),
        targets: await fetchGoals(),
      });
    case 'search': {
      const term = String(args.query || '').slice(0, 80);
      const clients = await fetchClients({ search: term, userRole: user.role, userId: user.id });
      const partners = await fetchCreators({ search: term, isAdmin: false });
      return clip({
        clients: clients.slice(0, 8).map((c) => ({ id: c.id, name: c.name, status: c.status })),
        partners: partners.slice(0, 8).map((p) => ({ id: p.id, name: p.name, role: p.role })),
      });
    }
    case 'get_finance_summary':
      if (!admin) return { error: 'forbidden' };
      return clip(await fetchFinanceSummary(normalizePeriod(args.period || currentMonth())));
    case 'list_invoices':
      if (!admin) return { error: 'forbidden' };
      return clip(await fetchInvoices({ status: args.status, clientId: args.clientId }));
    case 'list_expenses':
      if (!admin) return { error: 'forbidden' };
      return clip(await fetchExpenses({ category: args.category, clientId: args.clientId }));
    case 'propose_changes': {
      const raw = Array.isArray(args.actions) ? args.actions : [];
      const actions: unknown[] = [];
      for (const item of raw.slice(0, 10)) {
        const parsed = ActionSchema.safeParse(item);
        if (!parsed.success) {
          actions.push({ error: 'invalid_action', details: parsed.error.flatten(), raw: item });
          continue;
        }
        if (ADMIN_ACTIONS.has(parsed.data.type) && !admin) {
          actions.push({ error: 'forbidden', type: parsed.data.type });
          continue;
        }
        actions.push(parsed.data);
      }
      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase
        .from('ai_proposals')
        .insert({
          user_id: user.id,
          actions,
          status: 'pending',
        })
        .select('id, actions, status')
        .single();
      if (error) throw error;
      return {
        proposalId: data.id,
        summary: args.summary || 'Proposed changes ready for confirmation.',
        actions: data.actions,
        needsConfirmation: true,
      };
    }
    default:
      return { error: `unknown tool ${name}` };
  }
}

export { ActionSchema, ADMIN_ACTIONS };
