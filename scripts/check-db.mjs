import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const content = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
for (const line of content.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (!(key in process.env)) process.env[key] = value;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const tables = ['clients', 'client_contracts', 'invoices', 'post_metrics', 'ai_conversations', 'expenses'];
for (const t of tables) {
  const { error, count } = await sb.from(t).select('id', { count: 'exact', head: true });
  console.log(t, error ? `ERR ${error.code || ''} ${error.message}` : `ok count=${count}`);
}

const { data, error } = await sb.rpc('get_finance_summary', { p_period: '2026-09' });
console.log('rpc get_finance_summary', error ? `ERR ${error.message}` : 'ok');
