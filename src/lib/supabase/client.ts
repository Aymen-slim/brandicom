'use client';

import { createBrowserClient } from '@supabase/ssr';

// Next.js only inlines NEXT_PUBLIC_ env vars when accessed directly
// (e.g. process.env.NEXT_PUBLIC_FOO). Dynamic access like process.env[name]
// is NOT replaced at build time and becomes undefined in the browser.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Browser Supabase client — manages the auth session in cookies shared with
 * the server client (login, sign out).
 */
export function createBrowserSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Configure them in .env (see .env.example for the Supabase setup).'
    );
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
