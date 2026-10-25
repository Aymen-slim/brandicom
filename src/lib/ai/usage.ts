import { createServerSupabaseClient } from '@/lib/supabase/server';
import { dailyAiLimit } from './config';

export class AiQuotaError extends Error {
  status = 429;
  limit: number;
  used: number;
  resetAt: string;

  constructor(limit: number, used: number) {
    super('Daily AI limit reached');
    this.name = 'AiQuotaError';
    this.limit = limit;
    this.used = used;
    const next = new Date();
    next.setUTCHours(24, 0, 0, 0);
    this.resetAt = next.toISOString();
  }
}

export interface AiUsageSnapshot {
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function resetAt(): string {
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  return next.toISOString();
}

export function snapshotUsage(used: number, limit = dailyAiLimit()): AiUsageSnapshot {
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetAt: resetAt(),
  };
}

export async function getAiUsage(userId: string): Promise<AiUsageSnapshot> {
  const limit = dailyAiLimit();
  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase
      .from('ai_usage')
      .select('requests')
      .eq('user_id', userId)
      .eq('day', todayKey())
      .maybeSingle();
    return snapshotUsage(data?.requests || 0, limit);
  } catch {
    return snapshotUsage(0, limit);
  }
}

/**
 * Counts one request for this user. Uses the atomic RPC when available and
 * falls back to the previous upsert behaviour on older databases.
 */
export async function consumeAiQuota(userId: string): Promise<AiUsageSnapshot> {
  const limit = dailyAiLimit();
  const supabase = createServerSupabaseClient();

  const { data: existing } = await supabase
    .from('ai_usage')
    .select('requests')
    .eq('user_id', userId)
    .eq('day', todayKey())
    .maybeSingle();

  const used = existing?.requests || 0;
  if (used >= limit) throw new AiQuotaError(limit, used);

  const { data: rpcData, error: rpcError } = await supabase.rpc('increment_ai_usage', { p_tokens: 0 });
  if (!rpcError) {
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const nextUsed = Number(row?.requests ?? used + 1);
    return snapshotUsage(nextUsed, limit);
  }

  const { error: upsertError } = await supabase.from('ai_usage').upsert(
    {
      user_id: userId,
      day: todayKey(),
      requests: used + 1,
    },
    { onConflict: 'user_id,day' }
  );
  if (upsertError) throw upsertError;

  return snapshotUsage(used + 1, limit);
}

export async function addAiTokens(userId: string, tokens: number): Promise<void> {
  if (!tokens || tokens < 0) return;
  try {
    const supabase = createServerSupabaseClient();
    const { data: existing } = await supabase
      .from('ai_usage')
      .select('tokens')
      .eq('user_id', userId)
      .eq('day', todayKey())
      .maybeSingle();
    await supabase
      .from('ai_usage')
      .update({ tokens: (existing?.tokens || 0) + Math.round(tokens) })
      .eq('user_id', userId)
      .eq('day', todayKey());
  } catch {
    // Token accounting is best-effort.
  }
}
