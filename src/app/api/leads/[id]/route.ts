import { NextRequest, NextResponse } from 'next/server';
import { enforceAdmin } from '@/lib/permissions';
import { deleteContactSubmission } from '@/lib/submissions';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAdmin();
  if (error || !user) return error;
  try {
    await deleteContactSubmission(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[leads] delete failed', err);
    return NextResponse.json({ error: 'Failed to delete submission' }, { status: 500 });
  }
}
