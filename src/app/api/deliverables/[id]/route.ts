import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { enforceAuth, canAccessClient } from '@/lib/permissions';
import {
  mapDeliverableRow,
  isDeliverableFormat,
  isDeliverableStatus,
  isPlatform,
  toDateOnly,
  DELIVERABLE_SELECT,
  DELIVERABLE_SELECT_BASE,
  logActivity,
} from '@/lib/data';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const deliverableId = params.id;

  try {
    const body = await request.json();
    const {
      idea,
      filmed,
      published,
      status,
      link,
      format,
      platform,
      results,
      publishDate,
      publishTime,
      filmingDate,
      title,
      caption,
      hook,
      scheduledAt,
    } = body;

    const dataToUpdate: Record<string, unknown> = {};
    if (idea !== undefined && typeof idea === 'string') dataToUpdate.idea = idea.trim();
    if (title !== undefined) dataToUpdate.title = typeof title === 'string' ? title.trim() : null;
    if (caption !== undefined) dataToUpdate.caption = typeof caption === 'string' ? caption.trim() : null;
    if (hook !== undefined) dataToUpdate.hook = typeof hook === 'string' ? hook.trim() : null;
    if (status !== undefined && isDeliverableStatus(status)) dataToUpdate.status = status;
    if (filmed !== undefined) dataToUpdate.filmed = Boolean(filmed);
    if (published !== undefined) dataToUpdate.published = Boolean(published);
    if (link !== undefined) {
      dataToUpdate.link = typeof link === 'string' && link.trim() !== '' ? link.trim() : null;
    }
    if (format !== undefined) {
      dataToUpdate.format = format && isDeliverableFormat(format) ? format : null;
    }
    if (platform !== undefined) {
      dataToUpdate.platform = platform && isPlatform(platform) ? platform : null;
    }
    if (results !== undefined) {
      dataToUpdate.results = typeof results === 'string' && results.trim() !== '' ? results.trim() : null;
    }
    if (publishDate !== undefined) dataToUpdate.publish_date = toDateOnly(publishDate);
    if (publishTime !== undefined) {
      dataToUpdate.publish_time =
        typeof publishTime === 'string' && publishTime.trim() !== '' ? publishTime.trim() : null;
    }
    if (filmingDate !== undefined) dataToUpdate.filming_date = toDateOnly(filmingDate);
    if (scheduledAt !== undefined) dataToUpdate.scheduled_at = scheduledAt || null;

    const supabase = createServerSupabaseClient();
    const { data: existing, error: existingError } = await supabase
      .from('deliverables')
      .select('id, client_id, publish_date, scheduled_at')
      .eq('id', deliverableId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) {
      return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });
    }

    const hasAccess = await canAccessClient(user.id, user.role, existing.client_id);
    if (!hasAccess) {
      console.warn(`[authz] Deliverable update denied for user ${user.email} on deliverable ${deliverableId}`);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Keep scheduled_at in sync with publish_date and publishTime
    const effectivePublishDate =
      dataToUpdate.publish_date !== undefined
        ? (dataToUpdate.publish_date as string | null)
        : existing.publish_date;
    if (effectivePublishDate && publishTime !== undefined && dataToUpdate.scheduled_at === undefined) {
      if (publishTime && typeof publishTime === 'string') {
        const timePart = /^\d{1,2}:\d{2}$/.test(publishTime.trim()) ? `${publishTime.trim()}:00Z` : '09:00:00Z';
        dataToUpdate.scheduled_at = `${effectivePublishDate}T${timePart.padStart(11, '0')}`;
      } else if (publishTime === null) {
        dataToUpdate.scheduled_at = `${effectivePublishDate}T09:00:00Z`;
      }
    }

    let updateRes = await supabase
      .from('deliverables')
      .update(dataToUpdate)
      .eq('id', deliverableId)
      .select(DELIVERABLE_SELECT)
      .maybeSingle();

    if (
      updateRes.error &&
      (updateRes.error.code === '42703' ||
        updateRes.error.message?.includes('filming_date') ||
        updateRes.error.message?.includes('publish_time'))
    ) {
      delete dataToUpdate.publish_time;
      delete dataToUpdate.filming_date;
      updateRes = await supabase
        .from('deliverables')
        .update(dataToUpdate)
        .eq('id', deliverableId)
        .select(DELIVERABLE_SELECT_BASE)
        .maybeSingle();
    }

    if (updateRes.error) throw updateRes.error;
    if (!updateRes.data) {
      return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });
    }

    await logActivity({ action: 'update', entity: 'deliverable', entityId: deliverableId, diff: dataToUpdate });
    return NextResponse.json(mapDeliverableRow(updateRes.data));
  } catch (err: any) {
    console.error('Error updating deliverable:', err);
    return NextResponse.json({ error: 'Failed to update deliverable' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const deliverableId = params.id;

  try {
    const supabase = createServerSupabaseClient();
    const { data: existing, error: existingError } = await supabase
      .from('deliverables')
      .select('id, client_id')
      .eq('id', deliverableId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) {
      return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });
    }

    const hasAccess = await canAccessClient(user.id, user.role, existing.client_id);
    if (!hasAccess) {
      console.warn(`[authz] Deliverable delete denied for user ${user.email} on deliverable ${deliverableId}`);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { error: deleteError } = await supabase.from('deliverables').delete().eq('id', deliverableId);
    if (deleteError) throw deleteError;
    await logActivity({ action: 'delete', entity: 'deliverable', entityId: deliverableId });
    return NextResponse.json({ success: true, message: 'Deliverable deleted' });
  } catch (err: any) {
    console.error('Error deleting deliverable:', err);
    return NextResponse.json({ error: 'Failed to delete deliverable' }, { status: 500 });
  }
}
