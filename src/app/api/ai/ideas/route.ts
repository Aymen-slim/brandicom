import { NextRequest, NextResponse } from 'next/server';
import { enforceAuth, canAccessClient } from '@/lib/permissions';
import { generateIdeas } from '@/lib/ai/ideas';

export async function POST(request: NextRequest) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;
  try {
    const body = await request.json();
    if (!body.clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });
    const hasAccess = await canAccessClient(user.id, user.role, body.clientId);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    const ideas = await generateIdeas(body.clientId, user);
    return NextResponse.json({ ideas });
  } catch (err: any) {
    console.error('Ideas failed:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate ideas' }, { status: 500 });
  }
}
