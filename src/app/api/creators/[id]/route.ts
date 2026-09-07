import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { enforceAuth, enforceAdmin, isAdmin } from '@/lib/permissions';
import { fetchCreatorDetail, isCreatorRole, mapCreatorRow } from '@/lib/data';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  try {
    const creator = await fetchCreatorDetail(params.id, isAdmin(user));
    if (!creator) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }
    return NextResponse.json(creator);
  } catch (err: any) {
    console.error('Error fetching creator:', err);
    return NextResponse.json({ error: 'Failed to fetch partner' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  try {
    const body = await request.json();
    const dataToUpdate: Record<string, unknown> = {};
    if (body.name !== undefined && typeof body.name === 'string') dataToUpdate.name = body.name.trim();
    if (body.role !== undefined && isCreatorRole(body.role)) dataToUpdate.role = body.role;
    if (body.styleTags !== undefined) {
      dataToUpdate.style_tags = Array.isArray(body.styleTags)
        ? body.styleTags.filter((t: unknown) => typeof t === 'string')
        : typeof body.styleTags === 'string'
          ? body.styleTags.split(',').map((t: string) => t.trim()).filter(Boolean)
          : [];
    }
    if (body.instagramHandle !== undefined) {
      dataToUpdate.instagram_handle =
        typeof body.instagramHandle === 'string' && body.instagramHandle.trim() !== ''
          ? body.instagramHandle.trim()
          : null;
    }
    if (body.followers !== undefined) {
      dataToUpdate.followers =
        body.followers !== null && body.followers !== '' && !isNaN(Number(body.followers))
          ? parseInt(body.followers, 10)
          : null;
    }
    if (isAdmin(user) && body.dayRate !== undefined) {
      dataToUpdate.day_rate =
        body.dayRate !== null && body.dayRate !== '' && !isNaN(Number(body.dayRate))
          ? parseFloat(body.dayRate)
          : null;
    }
    if (isAdmin(user) && body.rateUnit !== undefined) {
      dataToUpdate.rate_unit =
        typeof body.rateUnit === 'string' && body.rateUnit.trim() !== '' ? body.rateUnit : 'day';
    }
    if (body.available !== undefined) dataToUpdate.available = Boolean(body.available);
    if (body.phone !== undefined) {
      dataToUpdate.phone = typeof body.phone === 'string' && body.phone.trim() !== '' ? body.phone.trim() : null;
    }
    if (body.email !== undefined) {
      dataToUpdate.email = typeof body.email === 'string' && body.email.trim() !== '' ? body.email.trim() : null;
    }
    if (body.notes !== undefined) {
      dataToUpdate.notes = typeof body.notes === 'string' && body.notes.trim() !== '' ? body.notes.trim() : null;
    }
    if (body.partnerType !== undefined) {
      dataToUpdate.partner_type = body.partnerType === 'agency' ? 'agency' : 'individual';
    }
    if (body.company !== undefined) dataToUpdate.company = body.company?.trim() || null;
    if (body.location !== undefined) dataToUpdate.location = body.location?.trim() || null;
    if (body.portfolioUrl !== undefined) dataToUpdate.portfolio_url = body.portfolioUrl?.trim() || null;
    if (body.rating !== undefined) {
      dataToUpdate.rating = body.rating != null && !isNaN(Number(body.rating)) ? Number(body.rating) : null;
    }

    const supabase = createServerSupabaseClient();
    const selectCols = isAdmin(user)
      ? 'id, name, role, partner_type, company, location, style_tags, instagram_handle, followers, available, phone, email, notes, portfolio_url, rating, last_worked_at, created_at, day_rate, rate_unit'
      : 'id, name, role, partner_type, company, location, style_tags, instagram_handle, followers, available, phone, email, notes, portfolio_url, rating, last_worked_at, created_at';
    const { data: updated, error: updateError } = await supabase
      .from('creators')
      .update(dataToUpdate)
      .eq('id', params.id)
      .select(selectCols)
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updated) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }
    return NextResponse.json(mapCreatorRow(updated, isAdmin(user)));
  } catch (err: any) {
    console.error('Error updating creator:', err);
    return NextResponse.json({ error: 'Failed to update partner' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAdmin();
  if (error || !user) return error;

  try {
    const supabase = createServerSupabaseClient();
    const { error: deleteError } = await supabase.from('creators').delete().eq('id', params.id);
    if (deleteError) throw deleteError;
    return NextResponse.json({ success: true, message: 'Partner deleted' });
  } catch (err: any) {
    console.error('Error deleting creator:', err);
    return NextResponse.json({ error: 'Failed to delete partner' }, { status: 500 });
  }
}
