import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { enforceAuth, canAccessClient } from '@/lib/permissions';
import { fetchMessages, mapMessageRow } from '@/lib/data';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const clientId = params.id;
  const hasAccess = await canAccessClient(user.id, user.role, clientId);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const since = new URL(request.url).searchParams.get('since');

  try {
    const messages = await fetchMessages(clientId, since);
    return NextResponse.json(messages);
  } catch (err: any) {
    console.error('Error fetching messages:', err);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const clientId = params.id;
  const hasAccess = await canAccessClient(user.id, user.role, clientId);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { body: messageText } = body;

    if (!messageText || typeof messageText !== 'string' || messageText.trim() === '') {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data: messageRow, error: insertError } = await supabase
      .from('messages')
      .insert({
        client_id: clientId,
        sender_id: user.id,
        body: messageText.trim(),
      })
      .select(`id, client_id, sender_id, body, created_at, users!messages_sender_id_fkey(id, name, email, role)`)
      .single();

    if (insertError) throw insertError;
    return NextResponse.json(mapMessageRow(messageRow), { status: 201 });
  } catch (err: any) {
    console.error('Error sending message:', err);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
