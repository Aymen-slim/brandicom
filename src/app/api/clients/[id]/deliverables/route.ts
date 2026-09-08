import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { enforceAuth, canAccessClient } from '@/lib/permissions';
import {
  fetchDeliverables,
  mapDeliverableRow,
  isDeliverableFormat,
  isDeliverableStatus,
  isPlatform,
  toDateOnly,
  DELIVERABLE_SELECT,
  DELIVERABLE_SELECT_BASE,
  isFilmingDateSupported,
  getDeliverableSelect,
  logActivity,
} from '@/lib/data';

export async function GET(
  _request: NextRequest,
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
    const deliverables = await fetchDeliverables(clientId);
    return NextResponse.json(deliverables);
  } catch (err: any) {
    console.error('Error fetching deliverables:', err);
    return NextResponse.json({ error: 'Failed to fetch deliverables' }, { status: 500 });
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
    const {
      idea,
      title,
      caption,
      hook,
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
      scheduledAt,
      creatorId,
    } = body;

    if (!idea || typeof idea !== 'string' || idea.trim() === '') {
      return NextResponse.json({ error: 'Deliverable idea/title is required' }, { status: 400 });
    }

    const publishDateOnly = toDateOnly(publishDate);
    let filmingDateOnly = toDateOnly(filmingDate);
    const isFilmed = Boolean(filmed) || status === 'filmed';
    const isPublished = Boolean(published) || status === 'published';

    let resolvedStatus = isDeliverableStatus(status) ? status : undefined;
    if (!resolvedStatus) {
      if (isPublished) resolvedStatus = 'published';
      else if (isFilmed) resolvedStatus = 'filmed';
      else resolvedStatus = 'idea';
    } else {
      if (isPublished) resolvedStatus = 'published';
      else if (isFilmed && (resolvedStatus === 'idea' || resolvedStatus === 'scripted')) {
        resolvedStatus = 'filmed';
      }
    }

    if (isFilmed && !filmingDateOnly) {
      filmingDateOnly = new Date().toISOString().slice(0, 10);
    }

    let calculatedScheduledAt = scheduledAt || null;
    if (!calculatedScheduledAt && publishDateOnly && publishTime && typeof publishTime === 'string') {
      try {
        calculatedScheduledAt = `${publishDateOnly}T${publishTime}:00Z`;
      } catch {
        // fallback
      }
    }

    const supabase = createServerSupabaseClient();
    const supportsFilmingDate = await isFilmingDateSupported(supabase);

    const insertPayload: Record<string, unknown> = {
      client_id: clientId,
      idea: idea.trim(),
      title: typeof title === 'string' ? title.trim() : null,
      caption: typeof caption === 'string' ? caption.trim() : null,
      hook: typeof hook === 'string' ? hook.trim() : null,
      status: resolvedStatus,
      filmed: isFilmed,
      published: isPublished,
      link: typeof link === 'string' && link.trim() !== '' ? link.trim() : null,
      format: format && isDeliverableFormat(format) ? format : null,
      platform: platform && isPlatform(platform) ? platform : null,
      results: typeof results === 'string' && results.trim() !== '' ? results.trim() : null,
      publish_date: publishDateOnly,
      scheduled_at: calculatedScheduledAt,
      created_by: user.id,
    };
    if (publishTime && typeof publishTime === 'string') {
      insertPayload.publish_time = publishTime.trim();
    }
    if (supportsFilmingDate && filmingDateOnly) {
      insertPayload.filming_date = filmingDateOnly;
    }

    let deliverableRow: { id: string } | null = null;
    let insertRes = await supabase
      .from('deliverables')
      .insert(insertPayload)
      .select('id')
      .single();

    if (
      insertRes.error &&
      (insertRes.error.code === '42703' ||
        insertRes.error.message?.includes('filming_date') ||
        insertRes.error.message?.includes('publish_time'))
    ) {
      delete insertPayload.publish_time;
      delete insertPayload.filming_date;
      insertRes = await supabase
        .from('deliverables')
        .insert(insertPayload)
        .select('id')
        .single();
    }

    if (insertRes.error) throw insertRes.error;
    deliverableRow = insertRes.data;

    if (creatorId && typeof creatorId === 'string' && deliverableRow) {
      const { error: assignError } = await supabase.from('creator_assignments').insert({
        creator_id: creatorId,
        client_id: clientId,
        deliverable_id: deliverableRow.id,
        scheduled_date: filmingDateOnly || publishDateOnly,
        status: 'booked',
      });
      if (assignError) console.warn('Could not record creator assignment:', assignError);
    }

    const delivSelect = getDeliverableSelect(supportsFilmingDate);
    let fetchRes = await supabase
      .from('deliverables')
      .select(delivSelect)
      .eq('id', deliverableRow!.id)
      .maybeSingle();

    if (fetchRes.error) {
      fetchRes = await supabase
        .from('deliverables')
        .select(DELIVERABLE_SELECT_BASE)
        .eq('id', deliverableRow!.id)
        .maybeSingle();
    }

    if (fetchRes.error) throw fetchRes.error;
    await logActivity({ action: 'create', entity: 'deliverable', entityId: deliverableRow!.id, actorId: user.id });
    return NextResponse.json(mapDeliverableRow(fetchRes.data), { status: 201 });
  } catch (err: any) {
    console.error('Error creating deliverable:', err);
    return NextResponse.json({ error: 'Failed to create deliverable' }, { status: 500 });
  }
}
