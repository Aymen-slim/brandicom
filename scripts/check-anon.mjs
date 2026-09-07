import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const content = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
for (const line of content.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sb = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });

const { error, count } = await sb.from('clients').select('id', { count: 'exact', head: true });
console.log('clients (anon):', error ? `ERR ${error.code || ''} ${error.message}` : `ok count=${count}`);

const { error: authError } = await sb.auth.signInWithPassword({ email: 'admin@agency.com', password: 'admin123' });
console.log('auth admin@agency.com:', authError ? `ERR ${authError.message}` : 'ok');
