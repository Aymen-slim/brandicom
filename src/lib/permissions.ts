import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from './supabase/server';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
}

export function isAdmin(user: { role?: string } | null | undefined): boolean {
  return user?.role === 'admin';
}

export async function getSessionUser(): Promise<CurrentUser | null> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('id, name, email, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    const meta = (user.user_metadata || {}) as Record<string, string>;
    return {
      id: user.id,
      name: meta.name || user.email?.split('@')[0] || 'User',
      email: user.email || '',
      role: (meta.role as 'admin' | 'member') || 'member',
    };
  }

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
  };
}

export async function canAccessClient(
  userId: string,
  userRole: string,
  clientId: string
): Promise<boolean> {
  if (userRole === 'admin') return true;

  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from('client_assignments')
    .select('client_id, user_id')
    .eq('client_id', clientId)
    .eq('user_id', userId)
    .maybeSingle();

  return !!data;
}

export async function enforceAuth() {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { user, error: null };
}

export async function enforceAdmin() {
  const { user, error } = await enforceAuth();
  if (error) return { user: null, error };
  if (user?.role !== 'admin') {
    console.warn(`[authz] Admin-only route denied for user ${user?.email}`);
    return {
      user: null,
      error: NextResponse.json({ error: 'Forbidden. Admin role required.' }, { status: 403 }),
    };
  }
  return { user, error: null };
}
