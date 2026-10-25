import { NextRequest, NextResponse } from 'next/server';
import { enforceAuth } from '@/lib/permissions';
import { applyProposal, rejectProposal } from '@/lib/ai/apply';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const action = request.nextUrl.searchParams.get('action') || 'apply';
  try {
    if (action === 'reject') {
      await rejectProposal(params.id, user);
      return NextResponse.json({ status: 'rejected' });
    }

    const body = await request.json().catch(() => ({}));
    const selectedIndices = Array.isArray(body.indices)
      ? body.indices.filter((index: unknown) => typeof index === 'number')
      : undefined;
    const result = await applyProposal(params.id, user, selectedIndices);
    return NextResponse.json({
      status: result.remaining > 0 ? 'pending' : 'applied',
      results: result.results,
      remaining: result.remaining,
      remainingActions: result.remainingActions,
      undo: result.undo,
    });
  } catch (err: any) {
    console.error('[ai] proposal action failed', err);
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 400 });
  }
}
