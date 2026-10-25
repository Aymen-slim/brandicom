import { NextRequest, NextResponse } from 'next/server';
import { enforceAuth } from '@/lib/permissions';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const supabase = createServerSupabaseClient();
  const { data, error: listError } = await supabase
    .from('ai_conversations')
    .select('id, title, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (listError) {
    console.error('[ai] conversation list failed', listError);
    return NextResponse.json({ error: 'Could not load conversations' }, { status: 500 });
  }

  return NextResponse.json({
    conversations: (data || []).map((row) => ({
      id: row.id,
      title: row.title || 'Untitled chat',
      createdAt: row.created_at,
    })),
  });
}
