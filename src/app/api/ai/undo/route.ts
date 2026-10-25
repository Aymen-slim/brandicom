import { NextRequest, NextResponse } from 'next/server';
import { enforceAuth } from '@/lib/permissions';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UndoActionSchema } from '@/lib/ai/actions';
import { undoActions } from '@/lib/ai/undo';

export async function POST(request: NextRequest) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  try {
    const body = await request.json();
    const parsed = UndoActionSchema.array().min(1).max(10).safeParse(body.actions);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid undo request', details: parsed.error.flatten() }, { status: 400 });
    }

    const results = await undoActions(parsed.data, user);
    const allUndone = results.every((result) => result.ok);

    // Keep the proposal honest after a reload. Partial or failed undos leave it
    // applied/pending so the remaining undo actions stay available.
    if (allUndone && typeof body.proposalId === 'string' && body.proposalId.length <= 64) {
      const { error: proposalError } = await createServerSupabaseClient()
        .from('ai_proposals')
        .update({ status: 'reverted' })
        .eq('id', body.proposalId)
        .eq('user_id', user.id)
        .eq('status', 'applied');
      if (proposalError) console.warn('[ai] could not mark proposal reverted', proposalError);
    }

    return NextResponse.json({ results, ok: allUndone });
  } catch (undoError: any) {
    console.error('[ai] undo failed', undoError);
    return NextResponse.json({ error: undoError?.message || 'Undo failed' }, { status: 500 });
  }
}
