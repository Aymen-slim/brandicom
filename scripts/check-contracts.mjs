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

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Try a real select with a limit
const { data, error } = await sb.from('client_contracts').select('*').limit(1);
console.log('select * result:');
console.log('  data:', JSON.stringify(data));
console.log('  error:', error ? JSON.stringify({ code: error.code, message: error.message, details: error.details, hint: error.hint }) : 'null');

// Also try inserting a test row to see if it's truly writable
const { data: clients } = await sb.from('clients').select('id').limit(1);
console.log('clients sample:', clients && clients[0] ? clients[0].id : 'none');
