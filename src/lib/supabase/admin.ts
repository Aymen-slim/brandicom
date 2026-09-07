import { createClient } from '@supabase/supabase-js';

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
 * Service-role Supabase client. Bypasses Row Level Security — use ONLY in
 * admin-guarded server code that needs the Auth admin API (user provisioning).
 * The key must never be exposed to the browser (no NEXT_PUBLIC_ prefix).
 */
export function createAdminSupabaseClient() {
  return createClient(
    getEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
