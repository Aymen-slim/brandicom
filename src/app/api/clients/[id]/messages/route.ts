import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { enforceAuth, canAccessClient } from '@/lib/permissions';
import { fetchMessages, mapMessageRow } from '@/lib/data';
import { z } from 'zod';
import { privateReadHeaders } from '@/lib/listValidation';

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

  const searchParams = request.nextUrl.searchParams;
  try {
    const cursor = z.string().datetime({ offset: true }).or(z.string().date()).nullable();
    const since = cursor.parse(searchParams.get('since'));
    const before = cursor.parse(searchParams.get('before'));
    if (since && before) return NextResponse.json({ error: 'Use one message cursor at a time' }, { status: 400, headers: privateReadHeaders });
    const cursorId = z.string().uuid().nullable().parse(searchParams.get('cursorId'));
    const messages = await fetchMessages(clientId, since, before, searchParams.get('recent') === '1', cursorId);
    return NextResponse.json(messages, { headers: privateReadHeaders });
  } catch (err: any) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid message cursor' }, { status: 400, headers: privateReadHeaders });
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
