import { createServerSupabaseClient } from '@/lib/supabase/server';
import { canAccessClient, CurrentUser, isAdmin } from '@/lib/permissions';
import {
  ActionSchema,
  ADMIN_ACTIONS,
  deliverableStatusFlags,
  isLowRiskAction,
  type AiAction,
  type ApplyResult,
  type UndoAction,
} from './actions';
import {
  logActivity,
  updateClient,
  upsertContract,
  isDeliverableStatus,
  isDeliverableFormat,
  isPlatform,
  createClient,
  isClientStatus,
  toDateOnly,
} from '@/lib/data';
import { createExpense, createInvoice, recordPayment, EXPENSE_CATEGORIES } from '@/lib/finance';
import { ExpenseCategory } from '@/types';

export interface AutoApplyResult {
  proposalId: string | null;
  autoApplied: true;
  results: ApplyResult[];
  undo: UndoAction[];
}

async function insertDeliverable(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  payload: Record<string, unknown>
) {
  let res = await supabase.from('deliverables').insert(payload).select('id').single();
  if (res.error) {
    const message = res.error.message || '';
    if (message.includes('filming_date') || message.includes('publish_date')) {
      const retryPayload = { ...payload };
      delete retryPayload.filming_date;
      delete retryPayload.publish_date;
      res = await supabase.from('deliverables').insert(retryPayload).select('id').single();
    }
  }
  return res;
}

async function applyAction(action: AiAction, user: CurrentUser): Promise<ApplyResult> {
  const supabase = createServerSupabaseClient();
  try {
    switch (action.type) {
      case 'create_client': {
        const userIds = isAdmin(user)
          ? action.assignedUserIds && action.assignedUserIds.length > 0
            ? action.assignedUserIds.filter((id): id is string => typeof id === 'string')
            : [user.id]
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
            status: action.status && isClientStatus(action.status) ? action.status : 'starting',
            services,
            notes: action.notes?.trim() || null,
            industry: action.industry?.trim() || null,
            website: action.website?.trim() || null,
            contactName: action.contactName?.trim() || null,
            contactEmail: action.contactEmail?.trim() || null,
            contactPhone: action.contactPhone?.trim() || null,
            startDate: toDateOnly(action.startDate),
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

        return { ok: true, type: action.type, id: newClient.id, name: newClient.name };
      }

      case 'create_deliverable': {
        if (!(await canAccessClient(user.id, user.role, action.clientId))) {
          return { ok: false, type: action.type, error: 'Access denied' };
        }
        const status = action.status && isDeliverableStatus(action.status) ? action.status : 'idea';
        const flags = deliverableStatusFlags(status);
        const insertPayload: Record<string, unknown> = {
          client_id: action.clientId,
          idea: action.idea,
          format: action.format && isDeliverableFormat(action.format) ? action.format : null,
          platform: action.platform && isPlatform(action.platform) ? action.platform : null,
          status,
          filmed: flags.filmed,
          published: flags.published,
          created_by: user.id,
        };
        if (action.filmingDate) {
          const normalized = toDateOnly(action.filmingDate);
          if (!normalized) return { ok: false, type: action.type, error: 'Filming date must be YYYY-MM-DD' };
          insertPayload.filming_date = normalized;
        }
        if (action.publishDate) {
          const normalized = toDateOnly(action.publishDate);
          if (!normalized) return { ok: false, type: action.type, error: 'Publish date must be YYYY-MM-DD' };
          insertPayload.publish_date = normalized;
        }

        const { data, error } = await insertDeliverable(supabase, insertPayload);
        if (error) throw error;
        await logActivity({ action: 'create', entity: 'deliverable', entityId: data.id, source: 'ai' });
        return {
          ok: true,
          type: action.type,
          id: data.id,
          name: action.idea,
          undo: {
            type: 'delete_deliverable',
            deliverableId: data.id,
            label: `Delete "${action.idea.slice(0, 80)}"`,
          },
        };
      }

      case 'update_deliverable_status': {
        if (!isDeliverableStatus(action.status)) {
          return { ok: false, type: action.type, error: 'Invalid deliverable status' };
        }
        const { data: current, error: readError } = await supabase
          .from('deliverables')
          .select('id, status, idea, client_id')
          .eq('id', action.deliverableId)
          .maybeSingle();
        if (readError) throw readError;
        if (!current) return { ok: false, type: action.type, error: 'Deliverable not found' };
        if (!(await canAccessClient(user.id, user.role, current.client_id))) {
          return { ok: false, type: action.type, error: 'Access denied' };
        }

        const update: Record<string, unknown> = {
          status: action.status,
          ...deliverableStatusFlags(action.status),
        };

        const { error } = await supabase
          .from('deliverables')
          .update(update)
          .eq('id', action.deliverableId);
        if (error) throw error;
        await logActivity({
          action: 'update',
          entity: 'deliverable',
          entityId: action.deliverableId,
          diff: { status: action.status, previousStatus: current.status },
          source: 'ai',
        });
        return {
          ok: true,
          type: action.type,
          id: action.deliverableId,
          name: current.idea,
          undo: {
            type: 'restore_deliverable_status',
            deliverableId: action.deliverableId,
            previousStatus: current.status,
            label: `Restore "${current.idea?.slice(0, 60) || 'post'}" to ${current.status}`,
          },
        };
      }

      case 'update_client': {
        if (!(await canAccessClient(user.id, user.role, action.clientId))) {
          return { ok: false, type: action.type, error: 'Access denied' };
        }
        if (!isAdmin(user) && action.assignedUserIds && action.assignedUserIds.length > 0) {
          return { ok: false, type: action.type, error: 'Admin permission required to change assignments' };
        }
        await updateClient(
          action.clientId,
          action.fields as any,
          action.assignedUserIds || undefined
        );
        return { ok: true, type: action.type, id: action.clientId };
      }

      case 'add_client_note': {
        if (!(await canAccessClient(user.id, user.role, action.clientId))) {
          return { ok: false, type: action.type, error: 'Access denied' };
        }
        const { data: existing } = await supabase
          .from('clients')
          .select('notes')
          .eq('id', action.clientId)
          .maybeSingle();
        const next = [existing?.notes, action.note].filter(Boolean).join('\n\n');
        await updateClient(action.clientId, { notes: next });
        return { ok: true, type: action.type, id: action.clientId };
      }

      case 'book_partner': {
        if (!(await canAccessClient(user.id, user.role, action.clientId))) {
          return { ok: false, type: action.type, error: 'Access denied' };
        }
        if (action.deliverableId) {
          const { data: deliverable } = await supabase
            .from('deliverables')
            .select('client_id')
            .eq('id', action.deliverableId)
            .maybeSingle();
          if (!deliverable || deliverable.client_id !== action.clientId) {
            return { ok: false, type: action.type, error: 'Deliverable does not belong to this client' };
          }
        }
        const { data, error } = await supabase
          .from('creator_assignments')
          .insert({
            creator_id: action.partnerId,
            client_id: action.clientId,
            deliverable_id: action.deliverableId || null,
            scheduled_date: toDateOnly(action.scheduledDate),
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
          date: toDateOnly(action.date) || action.date,
          amount: action.amount,
          category,
          description: action.description || undefined,
          clientId: action.clientId || undefined,
          createdBy: user.id,
        });
        return { ok: true, type: action.type, id: row.id };
      }

      case 'create_invoice': {
        const row = await createInvoice({
          clientId: action.clientId,
          subtotal: action.subtotal,
          periodLabel: action.periodLabel || undefined,
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
          monthlyFee: action.monthlyFee ?? undefined,
          contractType: action.contractType ?? undefined,
        });
        return { ok: true, type: action.type, id: action.clientId };
      }
    }
  } catch (error: any) {
    console.error(`[ai] action ${action.type} failed`, error);
    return {
      ok: false,
      type: action.type,
      error: error?.message || 'Action failed',
      id: typeof (action as any).clientId === 'string' ? (action as any).clientId : undefined,
    };
  }
}

export async function applyActions(actions: AiAction[], user: CurrentUser): Promise<ApplyResult[]> {
  const results: ApplyResult[] = [];
  for (const action of actions) {
    if (ADMIN_ACTIONS.has(action.type) && !isAdmin(user)) {
      results.push({ ok: false, type: action.type, error: 'Admin permission required' });
      continue;
    }
    results.push(await applyAction(action, user));
  }
  return results;
}

function undoFrom(results: ApplyResult[]): UndoAction[] {
  return results.map((result) => result.undo).filter((undo): undo is UndoAction => Boolean(undo));
}

export async function autoApplyActions(
  actions: AiAction[],
  user: CurrentUser,
  conversationId?: string | null
): Promise<AutoApplyResult> {
  const applied = await applyActions(actions, user);
  const results = applied.map((result, index) => ({ ...result, index }));
  const undo = undoFrom(results);
  const supabase = createServerSupabaseClient();

  const anyApplied = results.some((result) => result.ok);
  let proposalId: string | null = null;
  try {
    const { data } = await supabase
      .from('ai_proposals')
      .insert({
        conversation_id: conversationId || null,
        user_id: user.id,
        actions,
        status: anyApplied ? 'applied' : 'failed',
        applied_at: anyApplied ? new Date().toISOString() : null,
      })
      .select('id')
      .maybeSingle();
    proposalId = data?.id || null;
  } catch (error) {
    console.warn('[ai] could not record auto-applied proposal', error);
  }

  return { proposalId, autoApplied: true, results, undo };
}

export async function applyProposal(
  proposalId: string,
  user: CurrentUser,
  selectedIndices?: number[]
) {
  const supabase = createServerSupabaseClient();

  const { data: claimed, error: claimError } = await supabase
    .from('ai_proposals')
    .update({ status: 'applying' })
    .eq('id', proposalId)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();
  if (claimError) throw claimError;

  if (!claimed) {
    const { data: existing } = await supabase
      .from('ai_proposals')
      .select('status')
      .eq('id', proposalId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!existing) throw new Error('Proposal not found');
    throw new Error(
      existing.status === 'applied'
        ? 'This proposal was already applied'
        : existing.status === 'rejected'
        ? 'This proposal was rejected'
        : 'This proposal is already being applied'
    );
  }

  const allActions = (claimed.actions || []) as AiAction[];
  const parsed = allActions.map((action) => ActionSchema.safeParse(action));
  if (parsed.some((item) => !item.success)) {
    await supabase.from('ai_proposals').update({ status: 'failed' }).eq('id', proposalId);
    throw new Error('This proposal contains invalid actions and cannot be applied');
  }

  const validActions = parsed.map((item) => (item as any).data as AiAction);
  const indices = Array.isArray(selectedIndices)
    ? Array.from(
        new Set(
          selectedIndices.filter(
            (index) => Number.isInteger(index) && index >= 0 && index < validActions.length
          )
        )
      )
    : validActions.map((_, index) => index);
  const selected = indices.map((index) => validActions[index]);
  if (selected.length === 0) {
    await supabase.from('ai_proposals').update({ status: 'pending' }).eq('id', proposalId);
    throw new Error('Select at least one action to apply');
  }

  const applied = await applyActions(selected, user);
  const results = applied.map((result, index) => ({ ...result, index: indices[index] }));
  const failedIndices = new Set(results.filter((result) => !result.ok).map((result) => result.index));
  const remaining = validActions.filter(
    (_, index) => !indices.includes(index) || failedIndices.has(index)
  );

  if (remaining.length > 0) {
    await supabase
      .from('ai_proposals')
      .update({ status: 'pending', actions: remaining })
      .eq('id', proposalId);
  } else if (results.some((result) => result.ok)) {
    await supabase
      .from('ai_proposals')
      .update({ status: 'applied', applied_at: new Date().toISOString() })
      .eq('id', proposalId);
  } else {
    await supabase.from('ai_proposals').update({ status: 'failed' }).eq('id', proposalId);
  }

  return { results, remaining: remaining.length, remainingActions: remaining, undo: undoFrom(results) };
}

export async function rejectProposal(proposalId: string, user: CurrentUser) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ai_proposals')
    .update({ status: 'rejected' })
    .eq('id', proposalId)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This proposal is no longer pending');
}

export { isLowRiskAction };
