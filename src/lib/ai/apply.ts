import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CurrentUser, isAdmin } from '@/lib/permissions';
import { ActionSchema, ADMIN_ACTIONS } from './tools';
import { logActivity, updateClient, upsertContract, isDeliverableStatus, isDeliverableFormat, isPlatform, createClient, isClientStatus } from '@/lib/data';
import { createExpense, createInvoice, recordPayment, EXPENSE_CATEGORIES } from '@/lib/finance';
import { ExpenseCategory } from '@/types';

export async function applyProposal(proposalId: string, user: CurrentUser) {
  const supabase = createServerSupabaseClient();
  const { data: proposal, error } = await supabase
    .from('ai_proposals')
    .select('*')
    .eq('id', proposalId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!proposal) throw new Error('Proposal not found');
  if (proposal.status !== 'pending') throw new Error('Proposal is not pending');

  const results: unknown[] = [];
  for (const raw of proposal.actions as unknown[]) {
    const parsed = ActionSchema.safeParse(raw);
    if (!parsed.success) {
      results.push({ ok: false, error: 'invalid' });
      continue;
    }
    if (ADMIN_ACTIONS.has(parsed.data.type) && !isAdmin(user)) {
      results.push({ ok: false, error: 'forbidden', type: parsed.data.type });
      continue;
    }
    results.push(await applyAction(parsed.data, user));
  }

  await supabase
    .from('ai_proposals')
    .update({ status: 'applied', applied_at: new Date().toISOString() })
    .eq('id', proposalId);

  return results;
}

export async function rejectProposal(proposalId: string, user: CurrentUser) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from('ai_proposals')
    .update({ status: 'rejected' })
    .eq('id', proposalId)
    .eq('user_id', user.id)
    .eq('status', 'pending');
  if (error) throw error;
}

async function applyAction(action: z.infer<typeof ActionSchema>, user: CurrentUser) {
  const supabase = createServerSupabaseClient();
  switch (action.type) {
    case 'create_client': {
      const userIds = isAdmin(user)
        ? (action.assignedUserIds && action.assignedUserIds.length > 0
            ? action.assignedUserIds.filter((id): id is string => typeof id === 'string')
            : [user.id])
        : [user.id];

      const rawServices = action.services;
      const services = Array.isArray(rawServices)
        ? rawServices.filter((s): s is string => typeof s === 'string')
        : typeof rawServices === 'string'
        ? rawServices.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      const rawTags = action.tags;
      const tags = Array.isArray(rawTags)
        ? rawTags.filter((t): t is string => typeof t === 'string')
        : typeof rawTags === 'string'
        ? rawTags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];

      const newClient = await createClient(
        {
          name: action.name.trim(),
          location: action.location?.trim() || null,
          status: action.status && isClientStatus(action.status) ? action.status : 'potential',
          services,
          notes: action.notes?.trim() || null,
          industry: action.industry?.trim() || null,
          website: action.website?.trim() || null,
          contactName: action.contactName?.trim() || null,
          contactEmail: action.contactEmail?.trim() || null,
          contactPhone: action.contactPhone?.trim() || null,
          startDate: action.startDate || null,
          leadSource: action.leadSource?.trim() || 'AI Chat',
          tags,
        },
        userIds,
        isAdmin(user) && action.monthlyFee != null
          ? {
              monthlyFee: Number(action.monthlyFee),
              contractType: action.contractType || 'retainer',
            }
          : null,
        isAdmin(user)
      );

      return {
        ok: true,
        type: action.type,
        id: newClient.id,
        name: newClient.name,
      };
    }
    case 'create_deliverable': {
      const { data, error } = await supabase
        .from('deliverables')
        .insert({
          client_id: action.clientId,
          idea: action.idea,
          format: action.format && isDeliverableFormat(action.format) ? action.format : null,
          platform: action.platform && isPlatform(action.platform) ? action.platform : null,
          status: action.status && isDeliverableStatus(action.status) ? action.status : 'idea',
          created_by: user.id,
        })
        .select('id')
        .single();
      if (error) throw error;
      await logActivity({ action: 'create', entity: 'deliverable', entityId: data.id, source: 'ai' });
      return { ok: true, type: action.type, id: data.id };
    }
    case 'update_deliverable_status': {
      if (!isDeliverableStatus(action.status)) return { ok: false, error: 'bad status' };
      const { error } = await supabase.from('deliverables').update({ status: action.status }).eq('id', action.deliverableId);
      if (error) throw error;
      await logActivity({ action: 'update', entity: 'deliverable', entityId: action.deliverableId, source: 'ai' });
      return { ok: true, type: action.type };
    }
    case 'update_client': {
      await updateClient(action.clientId, action.fields as any);
      return { ok: true, type: action.type };
    }
    case 'add_client_note': {
      const { data: existing } = await supabase.from('clients').select('notes').eq('id', action.clientId).maybeSingle();
      const next = [existing?.notes, action.note].filter(Boolean).join('\n\n');
      await updateClient(action.clientId, { notes: next });
      return { ok: true, type: action.type };
    }
    case 'book_partner': {
      const { data, error } = await supabase
        .from('creator_assignments')
        .insert({
          creator_id: action.partnerId,
          client_id: action.clientId,
          deliverable_id: action.deliverableId || null,
          scheduled_date: action.scheduledDate || null,
          status: 'booked',
        })
        .select('id')
        .single();
      if (error) throw error;
      await logActivity({ action: 'create', entity: 'assignment', entityId: data.id, source: 'ai' });
      return { ok: true, type: action.type, id: data.id };
    }
    case 'upsert_goal': {
      const { error } = await supabase.from('goals').upsert(
        {
          period_type: action.periodType,
          period_value: action.periodValue,
          metric: action.metric,
          target: action.target,
        },
        { onConflict: 'period_type,period_value,metric' }
      );
      if (error) throw error;
      return { ok: true, type: action.type };
    }
    case 'create_expense': {
      const category = EXPENSE_CATEGORIES.includes(action.category as ExpenseCategory)
        ? (action.category as ExpenseCategory)
        : 'other';
      const row = await createExpense({
        date: action.date,
        amount: action.amount,
        category,
        description: action.description,
        clientId: action.clientId,
        createdBy: user.id,
      });
      return { ok: true, type: action.type, id: row.id };
    }
    case 'create_invoice': {
      const row = await createInvoice({
        clientId: action.clientId,
        subtotal: action.subtotal,
        periodLabel: action.periodLabel,
        createdBy: user.id,
        status: 'draft',
      });
      return { ok: true, type: action.type, id: row.id };
    }
    case 'record_payment': {
      const row = await recordPayment({ invoiceId: action.invoiceId, amount: action.amount });
      return { ok: true, type: action.type, id: row.id };
    }
    case 'update_contract': {
      await upsertContract(action.clientId, {
        monthlyFee: action.monthlyFee,
        contractType: action.contractType,
      });
      return { ok: true, type: action.type };
    }
  }
}
