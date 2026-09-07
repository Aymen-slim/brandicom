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
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function clearDemoData() {
  console.log('--- CLEARING ALL DEMO DATA ---');

  // 1. Clear data tables in reverse dependency order
  const tables = [
    'ai_messages',
    'ai_proposals',
    'ai_conversations',
    'ai_usage',
    'client_reports',
    'client_health_snapshots',
    'activity_log',
    'post_metrics',
    'messages',
    'payments',
    'invoices',
    'expenses',
    'creator_assignments',
    'deliverables',
    'client_social_accounts',
    'client_contracts',
    'client_assignments',
    'clients',
    'creators',
    'goals',
  ];

  const deleteFilter = {
    ai_usage: 'user_id',
    client_assignments: 'client_id',
    client_contracts: 'client_id',
  };

  for (const table of tables) {
    const filterCol = deleteFilter[table] ?? 'id';
    const { error, count } = await sb
      .from(table)
      .delete({ count: 'exact' })
      .neq(filterCol, '00000000-0000-0000-0000-000000000000');

    if (error && !error.message.includes('no rows')) {
      console.error(`Error deleting from ${table}:`, error.message);
    } else {
      console.log(`✓ Cleared table '${table}' (${count ?? 0} rows deleted)`);
    }
  }

  // 2. Remove demo members (Sarah, Marcus, Elena), keeping only Admin
  const demoMemberEmails = ['sarah@agency.com', 'marcus@agency.com', 'elena@agency.com'];
  const { data: authData } = await sb.auth.admin.listUsers({ perPage: 100 });
  const authUsers = authData?.users ?? [];

  for (const email of demoMemberEmails) {
    const found = authUsers.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) {
      const { error: delAuthErr } = await sb.auth.admin.deleteUser(found.id);
      if (delAuthErr) {
        console.warn(`Could not delete auth user ${email}:`, delAuthErr.message);
      } else {
        console.log(`✓ Deleted auth user: ${email} (${found.id})`);
      }
      const { error: delProfileErr } = await sb.from('users').delete().eq('id', found.id);
      if (delProfileErr) {
        console.warn(`Could not delete profile for ${email}:`, delProfileErr.message);
      } else {
        console.log(`✓ Deleted profile: ${email}`);
      }
    }
  }

  // Ensure Admin user profile exists
  const adminUser = authUsers.find((u) => u.email?.toLowerCase() === 'admin@agency.com');
  if (adminUser) {
    await sb
      .from('users')
      .upsert({ id: adminUser.id, name: 'Admin', email: 'admin@agency.com', role: 'admin' }, { onConflict: 'id' });
    console.log(`✓ Preserved Admin account: admin@agency.com (${adminUser.id})`);
  }

  console.log('\n--- VERIFYING FINAL COUNTS ---');
  for (const table of [...tables, 'users']) {
    const { count } = await sb.from(table).select('*', { count: 'exact', head: true });
    console.log(` - ${table}: ${count}`);
  }

  console.log('\nAll demo data has been successfully removed.');
}

clearDemoData().catch((err) => {
  console.error('Fatal error clearing demo data:', err);
  process.exit(1);
});
