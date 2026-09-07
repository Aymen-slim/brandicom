import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { enforceAuth, enforceAdmin, isAdmin } from '@/lib/permissions';
import { fetchCreators, mapCreatorRow, isCreatorRole } from '@/lib/data';

export async function GET(request: NextRequest) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const { searchParams } = new URL(request.url);
  try {
    const creators = await fetchCreators({
      role: searchParams.get('role'),
      available: searchParams.get('available'),
      search: searchParams.get('search'),
      isAdmin: isAdmin(user),
    });
    return NextResponse.json(creators);
  } catch (err: any) {
    console.error('Error fetching creators:', err);
    return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await enforceAdmin();
  if (error || !user) return error;

  try {
    const body = await request.json();
    const {
      name,
      role,
      styleTags,
      instagramHandle,
      followers,
      dayRate,
      rateUnit,
      available,
      phone,
      email,
      notes,
      partnerType,
      company,
      location,
      portfolioUrl,
      rating,
    } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Partner name is required' }, { status: 400 });
    }
    if (!role || !isCreatorRole(role)) {
      return NextResponse.json({ error: 'Valid partner role is required' }, { status: 400 });
    }

    const tags = Array.isArray(styleTags)
      ? styleTags.filter((t: unknown) => typeof t === 'string')
      : typeof styleTags === 'string'
        ? styleTags.split(',').map((t: string) => t.trim()).filter(Boolean)
        : [];

    const supabase = createServerSupabaseClient();
    const insert: Record<string, unknown> = {
      name: name.trim(),
      role,
      style_tags: tags,
      instagram_handle:
        typeof instagramHandle === 'string' && instagramHandle.trim() !== '' ? instagramHandle.trim() : null,
      followers:
        followers !== undefined && followers !== null && followers !== '' && !isNaN(Number(followers))
          ? parseInt(followers, 10)
          : null,
      available: available !== undefined ? Boolean(available) : true,
      phone: typeof phone === 'string' && phone.trim() !== '' ? phone.trim() : null,
      email: typeof email === 'string' && email.trim() !== '' ? email.trim() : null,
      notes: typeof notes === 'string' && notes.trim() !== '' ? notes.trim() : null,
      partner_type: partnerType === 'agency' ? 'agency' : 'individual',
      company: typeof company === 'string' ? company.trim() || null : null,
      location: typeof location === 'string' ? location.trim() || null : null,
      portfolio_url: typeof portfolioUrl === 'string' ? portfolioUrl.trim() || null : null,
      rating: rating != null && !isNaN(Number(rating)) ? Number(rating) : null,
    };

    if (isAdmin(user)) {
      insert.day_rate =
        dayRate !== undefined && dayRate !== null && dayRate !== '' && !isNaN(Number(dayRate))
          ? parseFloat(dayRate)
          : null;
      insert.rate_unit = typeof rateUnit === 'string' && rateUnit.trim() !== '' ? rateUnit : 'day';
    }

    const { data: creatorRow, error: insertError } = await supabase
      .from('creators')
      .insert(insert)
      .select('id, name, role, partner_type, company, location, style_tags, instagram_handle, followers, available, phone, email, notes, portfolio_url, rating, last_worked_at, created_at')
      .single();

    if (insertError) throw insertError;
    return NextResponse.json({ ...mapCreatorRow(creatorRow, isAdmin(user)), assignments: [] }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating creator:', err);
    return NextResponse.json({ error: 'Failed to create partner' }, { status: 500 });
  }
}
