import { NextRequest, NextResponse } from 'next/server';
import { enforceAuth } from '@/lib/permissions';
import { applyProposal, rejectProposal } from '@/lib/ai/apply';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;
  const action = request.nextUrl.searchParams.get('action') || 'apply';
  try {
    if (action === 'reject') {
      await rejectProposal(params.id, user);
      return NextResponse.json({ status: 'rejected' });
    }
    const results = await applyProposal(params.id, user);
    return NextResponse.json({ status: 'applied', results });
  } catch (err: any) {
    console.error('Proposal action failed:', err);
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 400 });
  }
}
