import { NextRequest, NextResponse } from 'next/server';
import { enforceAuth, canAccessClient } from '@/lib/permissions';
import { generateIdeas } from '@/lib/ai/ideas';
import { aiEnabled } from '@/lib/ai/config';
import { AiQuotaError, consumeAiQuota } from '@/lib/ai/usage';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  if (!aiEnabled()) {
    return NextResponse.json({ error: 'The AI assistant is not configured.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    if (!body.clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

    const hasAccess = await canAccessClient(user.id, user.role, body.clientId);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    try {
      await consumeAiQuota(user.id);
    } catch (quotaError) {
      if (quotaError instanceof AiQuotaError) {
        return NextResponse.json(
          {
            error: quotaError.message,
            limit: quotaError.limit,
            used: quotaError.used,
            resetAt: quotaError.resetAt,
          },
          { status: 429 }
        );
      }
      throw quotaError;
    }

    const result = await generateIdeas(body.clientId, user, {
      month: body.month,
      language: body.language,
    });
    return NextResponse.json({
      ideas: result.ideas,
      month: result.month,
      meta: { model: result.model },
    });
  } catch (err: any) {
    console.error('Ideas failed:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate ideas' }, { status: 500 });
  }
}
