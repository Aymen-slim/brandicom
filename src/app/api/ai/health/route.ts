import { NextResponse } from 'next/server';
import { enforceAuth, isAdmin } from '@/lib/permissions';
import { recomputeHealth } from '@/lib/ai/health';
import { aiEnabled } from '@/lib/ai/config';

export const runtime = 'nodejs';
export const maxDuration = 60;

let running = false;

export async function POST() {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;
  if (!isAdmin(user)) return NextResponse.json({ error: 'Admin permission required' }, { status: 403 });
  if (!aiEnabled()) return NextResponse.json({ error: 'AI is not configured' }, { status: 503 });
  if (running) {
    return NextResponse.json({ error: 'A health refresh is already running. Try again in a moment.' }, { status: 409 });
  }

  running = true;
  const started = Date.now();
  try {
    const results = await recomputeHealth({ admin: true, useServiceRole: true });
    return NextResponse.json({
      ok: true,
      clients: results.length,
      durationMs: Date.now() - started,
      snapshots: results,
    });
  } catch (healthError: any) {
    console.error('[ai] health refresh failed', healthError);
    return NextResponse.json({ error: healthError?.message || 'Health refresh failed' }, { status: 500 });
  } finally {
    running = false;
  }
}
