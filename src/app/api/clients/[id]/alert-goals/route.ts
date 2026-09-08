import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { enforceAuth, canAccessClient } from '@/lib/permissions';
import { fetchClientDetail, logActivity, mapMessageRow } from '@/lib/data';
import { computeClientGoalsProgress } from '@/lib/clientGoals';

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
    const detail = await fetchClientDetail(clientId, user);
    if (!detail) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const progress = computeClientGoalsProgress(detail.client, detail.deliverables);
    const body = await request.json().catch(() => ({}));
    const customNote = body?.note ? `\n\nNote: ${body.note}` : '';

    const deliverableLines = progress.visibleGoals.map((item) => {
      const icon = item.key === 'reels' ? '🎬' : item.key === 'posts' ? '📸' : item.key === 'stories' ? '📱' : '⚡';
      return `• ${icon} ${item.label}: ${item.published} / ${item.target} ${item.hit ? '✓' : `(missing ${item.remaining})`}`;
    }).join('\n');

    const alertMessage = `🚨 [END-OF-MONTH ALERT - CONTENT DELIVERABLES]
Attention team assigned to ${detail.client.name}!
Only ${progress.daysRemaining} day${progress.daysRemaining > 1 ? 's' : ''} remaining before the end of ${progress.period}.

Deliverables Status:
${deliverableLines || '• No deliverables configured'}

👉 Overall: ${progress.totalPublished} / ${progress.totalTarget} completed (${progress.totalPercent}%)${customNote}
Immediate action required to fulfill the client's contractual deliverables quota!`;

    const supabase = createServerSupabaseClient();
    const { data: messageRow, error: msgError } = await supabase
      .from('messages')
      .insert({
        client_id: clientId,
        sender_id: user.id,
        body: alertMessage,
      })
      .select(`id, client_id, sender_id, body, created_at, users!messages_sender_id_fkey(id, name, email, role)`)
      .single();

    if (msgError) throw msgError;

    await logActivity({
      action: 'send_alert',
      entity: 'client_goals',
      entityId: clientId,
      diff: {
        missingSummary: progress.missingSummary,
        daysRemaining: progress.daysRemaining,
        period: progress.period,
      },
      actorId: user.id,
    });

    return NextResponse.json({
      success: true,
      progress,
      message: mapMessageRow(messageRow),
    }, { status: 201 });
  } catch (err: any) {
    console.error('Error sending goal alert:', err);
    return NextResponse.json({ error: 'Failed to send goal alert' }, { status: 500 });
  }
}
