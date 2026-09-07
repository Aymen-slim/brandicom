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

const tables = [
  'clients', 'client_contacts', 'client_contracts', 'client_tags', 'client_assets',
  'client_social_accounts', 'deliverables', 'post_metrics', 'partners', 'partner_assignments',
  'invoices', 'payments', 'expenses', 'expense_categories', 'recurring_expenses',
  'goals', 'goal_progress', 'audit_log', 'ai_conversations', 'ai_proposals',
  'client_health', 'content_ideas', 'client_reports', 'users', 'messages'
];
let missing = 0;
for (const t of tables) {
  const { error, count } = await sb.from(t).select('id', { count: 'exact', head: true });
  if (error) {
    console.log(t, 'MISSING/ERR', error.code || '', JSON.stringify(error.message));
    missing++;
  } else {
    console.log(t, 'ok count=' + count);
  }
}
console.log('\nMissing/errored tables:', missing);
