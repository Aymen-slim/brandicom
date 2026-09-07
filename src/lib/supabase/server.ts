import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Configure it in .env (see .env.example for the Supabase setup).`
    );
  }
  return value;
}

/**
 * Cookie-scoped Supabase client for Server Components and Route Handlers.
 * Uses the caller's session (anon key + user JWT) so Row Level Security applies.
 * Create a new client per request — never share across requests.
 */
export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient(
    getEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet, headers) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component where cookies are read-only.
            // Session refresh is handled by middleware.
          }
        },
      },
    }
  );
}
