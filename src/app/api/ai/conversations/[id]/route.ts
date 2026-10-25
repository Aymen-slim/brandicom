import { NextRequest, NextResponse } from 'next/server';
import { enforceAuth } from '@/lib/permissions';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const supabase = createServerSupabaseClient();
  const { data: conversation } = await supabase
    .from('ai_conversations')
    .select('id, title, created_at')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

  const { data: messages, error: messagesError } = await supabase
    .from('ai_messages')
    .select('id, role, content, tool_calls, created_at')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (messagesError) {
    console.error('[ai] messages load failed', messagesError);
    return NextResponse.json({ error: 'Could not load messages' }, { status: 500 });
  }

  const orderedMessages = [...(messages || [])].reverse();
  const proposalIds = new Set<string>();
  for (const message of orderedMessages) {
    const proposalId = (message.tool_calls as any)?.proposal?.proposalId;
    if (typeof proposalId === 'string') proposalIds.add(proposalId);
  }

  let proposalMap = new Map<string, any>();
  if (proposalIds.size > 0) {
    const { data: proposals } = await supabase
      .from('ai_proposals')
      .select('id, status, actions, applied_at')
      .in('id', Array.from(proposalIds))
      .eq('user_id', user.id);
    proposalMap = new Map((proposals || []).map((proposal) => [proposal.id, proposal]));
  }

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      title: conversation.title || 'Untitled chat',
      createdAt: conversation.created_at,
    },
    messages: orderedMessages.map((message) => {
      const toolCalls = (message.tool_calls || {}) as any;
      const storedProposal = toolCalls.proposal || null;
      const liveProposal = storedProposal?.proposalId ? proposalMap.get(storedProposal.proposalId) : null;
      return {
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.created_at,
        tools: Array.isArray(toolCalls.tools) ? toolCalls.tools : [],
        proposal: storedProposal
          ? {
              ...storedProposal,
              actions: liveProposal?.actions || storedProposal.actions || [],
              status:
                liveProposal?.status ||
                storedProposal.status ||
                (storedProposal.autoApplied ? 'applied' : 'pending'),
              appliedAt: liveProposal?.applied_at || null,
            }
          : null,
      };
    }),
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { error: updateError } = await supabase
    .from('ai_conversations')
    .update({ title })
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (updateError) return NextResponse.json({ error: 'Could not rename conversation' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const supabase = createServerSupabaseClient();
  const { error: deleteError } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (deleteError) return NextResponse.json({ error: 'Could not delete conversation' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
