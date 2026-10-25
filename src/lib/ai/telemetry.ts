import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { AiTask } from './config';

export interface AiRunEntry {
  task: AiTask;
  feature?: string;
  userId?: string | null;
  clientId?: string | null;
  model: string;
  status: 'ok' | 'error';
  latencyMs: number;
  promptTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  toolCount?: number;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
}

function safeError(error: unknown): string {
  if (!error) return '';
  if (error instanceof Error) return error.message.slice(0, 800);
  return String(error).slice(0, 800);
}

/**
 * Telemetry must never break a user-facing AI request. The table is optional
 * until `supabase/ai_upgrade.sql` has been applied.
 */
export async function logAiRun(entry: AiRunEntry): Promise<void> {
  const payload = {
    task: entry.task,
    feature: entry.feature || entry.task,
    user_id: entry.userId || null,
    client_id: entry.clientId || null,
    model: entry.model,
    status: entry.status,
    latency_ms: Math.round(entry.latencyMs),
    prompt_tokens: entry.promptTokens ?? null,
    output_tokens: entry.outputTokens ?? null,
    total_tokens: entry.totalTokens ?? null,
    tool_count: entry.toolCount ?? 0,
    error: entry.error ? safeError(entry.error) : null,
    metadata: entry.metadata || null,
  };

  console.info('[ai-run]', JSON.stringify(payload));

  try {
    const supabase = createServerSupabaseClient();
    await supabase.from('ai_runs').insert(payload);
  } catch {
    // Telemetry is best-effort. Older deployments may not have the table.
  }
}
