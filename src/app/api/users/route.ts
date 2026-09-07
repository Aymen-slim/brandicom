import { NextRequest, NextResponse } from 'next/server';
import { enforceAuth, enforceAdmin } from '@/lib/permissions';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { fetchUsersWithCounts } from '@/lib/data';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  try {
    const users = await fetchUsersWithCounts();
    return NextResponse.json(users);
  } catch (err: any) {
    console.error('Error fetching users:', err);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await enforceAdmin();
  if (error || !user) return error;

  try {
    const body = await request.json();
    const { name, email, password, role } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!email || typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password is required and must be at least 8 characters' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedRole = role === 'admin' ? 'admin' : 'member';

    const admin = createAdminSupabaseClient();

    const { data: authUser, error: createError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { name: name.trim(), role: normalizedRole },
    });

    if (createError || !authUser?.user) {
      const message =
        createError?.message === 'User already registered'
          ? 'User with this email already exists'
          : createError?.message || 'Failed to create auth user';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { data: profile, error: profileError } = await admin
      .from('users')
      .upsert(
        {
          id: authUser.user.id,
          name: name.trim(),
          email: normalizedEmail,
          role: normalizedRole,
        },
        { onConflict: 'id' }
      )
      .select('id, name, email, role, created_at')
      .single();

    if (profileError) throw profileError;

    return NextResponse.json(
      {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        createdAt: profile.created_at,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Error creating user:', err);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
