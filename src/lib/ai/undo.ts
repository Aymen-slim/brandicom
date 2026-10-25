import { createServerSupabaseClient } from '@/lib/supabase/server';
import { canAccessClient, type CurrentUser } from '@/lib/permissions';
import { isDeliverableStatus } from '@/lib/data';
import { deliverableStatusFlags, type UndoAction } from './actions';

export interface UndoResult {
  ok: boolean;
  type: string;
  id?: string;
  error?: string;
}

export async function undoActions(actions: UndoAction[], user: CurrentUser): Promise<UndoResult[]> {
  const supabase = createServerSupabaseClient();
  const results: UndoResult[] = [];

  for (const action of actions) {
    try {
      const { data: deliverable, error: readError } = await supabase
        .from('deliverables')
        .select('id, client_id')
        .eq('id', action.deliverableId)
        .maybeSingle();
      if (readError) throw readError;
      if (!deliverable) {
        results.push({ ok: false, type: action.type, id: action.deliverableId, error: 'Item not found' });
        continue;
      }

      const allowed = await canAccessClient(user.id, user.role, deliverable.client_id);
      if (!allowed) {
        results.push({ ok: false, type: action.type, id: action.deliverableId, error: 'Access denied' });
        continue;
      }

      if (action.type === 'delete_deliverable') {
        const { error } = await supabase.from('deliverables').delete().eq('id', action.deliverableId);
        if (error) throw error;
        await supabase.from('activity_log').insert({
          action: 'delete',
          entity: 'deliverable',
          entity_id: action.deliverableId,
          source: 'ai',
          actor_id: user.id,
          diff: { reason: 'ai_undo' },
        });
        results.push({ ok: true, type: action.type, id: action.deliverableId });
        continue;
      }

      if (!isDeliverableStatus(action.previousStatus)) {
        results.push({ ok: false, type: action.type, id: action.deliverableId, error: 'Invalid previous status' });
        continue;
      }

      const { error } = await supabase
        .from('deliverables')
        .update({ status: action.previousStatus, ...deliverableStatusFlags(action.previousStatus) })
        .eq('id', action.deliverableId);
      if (error) throw error;
      await supabase.from('activity_log').insert({
        action: 'update',
        entity: 'deliverable',
        entity_id: action.deliverableId,
        source: 'ai',
        actor_id: user.id,
        diff: { reason: 'ai_undo', status: action.previousStatus },
      });
      results.push({ ok: true, type: action.type, id: action.deliverableId });
    } catch (error: any) {
      results.push({
        ok: false,
        type: action.type,
        id: action.deliverableId,
        error: error?.message || 'Undo failed',
      });
    }
  }

  return results;
}
