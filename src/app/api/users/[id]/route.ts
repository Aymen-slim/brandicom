import { NextRequest, NextResponse } from 'next/server';
import { enforceAdmin } from '@/lib/permissions';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user: currentAdmin, error } = await enforceAdmin();
  if (error || !currentAdmin) return error;

  const targetUserId = params.id;
  if (!targetUserId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { name, email, password, role } = body;

    const authUpdates: {
      email?: string;
      password?: string;
      user_metadata?: Record<string, any>;
    } = {};

    const profileUpdates: {
      name?: string;
      email?: string;
      role?: 'admin' | 'member';
    } = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      }
      profileUpdates.name = name.trim();
    }

    if (email !== undefined) {
      if (typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) {
        return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
      }
      const normalizedEmail = email.toLowerCase().trim();
      authUpdates.email = normalizedEmail;
      profileUpdates.email = normalizedEmail;
    }

    if (password !== undefined && password !== '') {
      if (typeof password !== 'string' || password.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters long' },
          { status: 400 }
        );
      }
      authUpdates.password = password;
    }

    if (role !== undefined) {
      if (role !== 'admin' && role !== 'member') {
        return NextResponse.json({ error: 'Role must be admin or member' }, { status: 400 });
      }
      profileUpdates.role = role;
    }

    // Prepare metadata if name or role is updated
    if (profileUpdates.name || profileUpdates.role) {
      authUpdates.user_metadata = {
        ...(profileUpdates.name ? { name: profileUpdates.name } : {}),
        ...(profileUpdates.role ? { role: profileUpdates.role } : {}),
      };
    }

    const admin = createAdminSupabaseClient();

    // 1. Update Auth user if auth fields are provided
    if (authUpdates.email || authUpdates.password || authUpdates.user_metadata) {
      const { data: updatedAuthUser, error: authError } =
        await admin.auth.admin.updateUserById(targetUserId, authUpdates);

      if (authError) {
        const msg =
          authError.message === 'User already registered'
            ? 'A user with this email address already exists'
            : authError.message || 'Failed to update authentication details';
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    // 2. Update public profile in `users` table
    if (Object.keys(profileUpdates).length > 0) {
      const { data: updatedProfile, error: profileError } = await admin
        .from('users')
        .update(profileUpdates)
        .eq('id', targetUserId)
        .select('id, name, email, role, created_at')
        .single();

      if (profileError) {
        throw profileError;
      }

      return NextResponse.json({
        id: updatedProfile.id,
        name: updatedProfile.name,
        email: updatedProfile.email,
        role: updatedProfile.role,
        createdAt: updatedProfile.created_at,
      });
    }

    // If only password was updated
    const { data: currentProfile, error: fetchError } = await admin
      .from('users')
      .select('id, name, email, role, created_at')
      .eq('id', targetUserId)
      .single();

    if (fetchError) throw fetchError;

    return NextResponse.json({
      id: currentProfile.id,
      name: currentProfile.name,
      email: currentProfile.email,
      role: currentProfile.role,
      createdAt: currentProfile.created_at,
    });
  } catch (err: any) {
    console.error('Error updating user:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user: currentAdmin, error } = await enforceAdmin();
  if (error || !currentAdmin) return error;

  const targetUserId = params.id;
  if (!targetUserId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  // Prevent self-deletion
  if (targetUserId === currentAdmin.id) {
    return NextResponse.json(
      { error: 'You cannot delete your own administrator account.' },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminSupabaseClient();

    // 1. Delete from Supabase Auth
    const { error: authDelError } = await admin.auth.admin.deleteUser(targetUserId);
    if (authDelError) {
      console.warn('Error deleting auth user (may already be gone):', authDelError.message);
    }

    // 2. Delete from public.users table (and cascades/sets null referencing rows)
    const { error: profileDelError } = await admin
      .from('users')
      .delete()
      .eq('id', targetUserId);

    if (profileDelError) {
      throw profileDelError;
    }

    return NextResponse.json({ success: true, id: targetUserId });
  } catch (err: any) {
    console.error('Error deleting user:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to delete user' },
      { status: 500 }
    );
  }
}
