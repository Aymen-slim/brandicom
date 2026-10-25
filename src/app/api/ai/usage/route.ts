import { NextResponse } from 'next/server';
import { enforceAuth } from '@/lib/permissions';
import { getAiUsage } from '@/lib/ai/usage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  return NextResponse.json({ usage: await getAiUsage(user.id) });
}
