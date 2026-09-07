import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Minimal .env loader (keeps the seed dependency-free).
function loadEnvFile() {
  try {
    const content = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // No .env file — rely on real environment variables.
  }
}

loadEnvFile();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Copy them from your Supabase project (Settings > API) into .env first.'
  );
  process.exit(1);
}

// Service-role client: bypasses RLS for seeding. Never expose this key client-side.
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface AuthedUser {
  authId: string;
  profileId: string;
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = (data?.users || []) as Array<{ id: string; email?: string }>;
    const found = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    const totalPages = (data as any)?.totalPages ?? 1;
    if (users.length < perPage || page >= totalPages) return null;
    page += 1;
  }
}

async function upsertAuthUser(
  name: string,
  email: string,
  password: string,
  role: 'admin' | 'member'
): Promise<AuthedUser> {
  // Remove any existing auth user with this email so seeding is idempotent.
  const existingId = await findAuthUserIdByEmail(email);
  if (existingId) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(existingId);
    if (deleteError) throw deleteError;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  });
  if (error || !data?.user) throw error ?? new Error(`Failed to create ${email}`);

  // The on_auth_user_created trigger inserts the profile row; upsert keeps it exact.
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .upsert({ id: data.user.id, name, email, role }, { onConflict: 'id' })
    .select('id')
    .single();
  if (profileError) throw profileError;

  return { authId: data.user.id, profileId: profile.id };
}

async function insertReturningId(table: string, payload: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.from(table).insert(payload).select('id').single();
  if (error) throw error;
  return data.id as string;
}

async function main() {
  console.log('Seeding Marketing Agency CRM (Supabase)...');

  // 1. Clear existing records in reverse dependency order
  const tables = [
    'ai_messages',
    'ai_proposals',
    'ai_conversations',
    'ai_usage',
    'client_reports',
    'client_health_snapshots',
    'activity_log',
    'payments',
    'invoices',
    'expenses',
    'post_metrics',
    'messages',
    'creator_assignments',
    'deliverables',
    'client_social_accounts',
    'client_contracts',
    'client_assignments',
    'clients',
    'creators',
    'goals',
    'users',
  ];
  // Tables without an `id` column use a different filter column for "delete all".
  const deleteFilter: Record<string, string> = {
    ai_usage: 'user_id',
    client_assignments: 'client_id',
    client_contracts: 'client_id',
  };
  for (const table of tables) {
    const filterCol = deleteFilter[table] ?? 'id';
    const { error } = await supabase
      .from(table)
      .delete()
      .neq(filterCol, '00000000-0000-0000-0000-000000000000');
    if (error && !error.message.includes('no rows')) throw new Error(`Failed to clear ${table}: ${error.message}`);
  }

  // 2. Users (Supabase Auth + profiles)
  const admin = await upsertAuthUser('Alex Vance', 'admin@agency.com', 'admin123', 'admin');
  const sarah = await upsertAuthUser('Sarah Connor', 'sarah@agency.com', 'member123', 'member');
  const marcus = await upsertAuthUser('Marcus Reed', 'marcus@agency.com', 'member123', 'member');
  const elena = await upsertAuthUser('Elena Rostova', 'elena@agency.com', 'member123', 'member');

  console.log('Users created: Admin (admin@agency.com), Members (sarah, marcus, elena)');

  const insertClient = async (
    payload: Record<string, unknown>,
    assigneeIds: string[],
    monthlyFee?: number
  ): Promise<string> => {
    const clientId = await insertReturningId('clients', payload);
    if (assigneeIds.length > 0) {
      const { error } = await supabase
        .from('client_assignments')
        .insert(assigneeIds.map((uid) => ({ client_id: clientId, user_id: uid })));
      if (error) throw error;
    }
    if (monthlyFee != null) {
      const { error } = await supabase.from('client_contracts').insert({
        client_id: clientId,
        contract_type: 'retainer',
        monthly_fee: monthlyFee,
        currency: 'TND',
        billing_day: 1,
      });
      if (error) throw error;
    }
    return clientId;
  };

  // 3. Clients
  const lumiere = await insertClient(
    {
      name: 'Lumiere Skincare',
      location: 'Paris / New York',
      status: 'active',
      services: ['TikTok UGC', 'Brand Anthem', 'Monthly Retainer', 'Product Photography'],
      industry: 'Beauty',
      start_date: '2026-01-15',
      contact_name: 'Camille Dubois',
      contact_email: 'camille@lumiere.demo',
      notes: 'High-end clean beauty brand. Primary KPI is ROAS on TikTok Shop and UGC conversion.',
    },
    [sarah.profileId, marcus.profileId],
    14500
  );

  const apex = await insertClient(
    {
      name: 'Apex Athletics',
      location: 'Austin, TX',
      status: 'active',
      services: ['Instagram Reels', 'Athlete Showcase', 'Content Engine'],
      industry: 'Fitness',
      start_date: '2026-02-01',
      notes: 'Performance apparel and hybrid fitness training brand. Rapid growth in Hyrox/Crossfit community.',
    },
    [sarah.profileId, elena.profileId],
    18000
  );

  const volt = await insertClient(
    {
      name: 'Volt Energy Drinks',
      location: 'Miami, FL',
      status: 'active',
      services: ['Extreme Sports UGC', 'Festival Coverage', 'TikTok Trends'],
      industry: 'F&B',
      start_date: '2026-03-01',
      notes: 'Clean caffeine energy drink. Targeting action sports, collegiate clubs, and music festivals.',
    },
    [marcus.profileId],
    12500
  );

  const echo = await insertClient(
    {
      name: 'Echo Soundwear',
      location: 'Berlin, DE',
      status: 'active',
      services: ['Hardware 3D & UGC', 'Audio Reviews', 'Creator Seeding'],
      industry: 'Consumer electronics',
      start_date: '2025-11-01',
      notes: 'Audiophile grade wireless headphones. Launching ANC flagship Q4.',
    },
    [marcus.profileId, elena.profileId],
    21000
  );

  const saffron = await insertClient(
    {
      name: 'Saffron Table',
      location: 'London, UK',
      status: 'starting',
      services: ['Restaurant Ambience', 'Chef Features', 'Reels Series'],
      industry: 'Hospitality',
      start_date: '2026-08-20',
      notes: 'Michelin-starred modern Persian dining expanding into upscale casual locations.',
    },
    [sarah.profileId],
    7500
  );

  const kinetix = await insertClient(
    {
      name: 'Kinetix Apparel',
      location: 'Los Angeles, CA',
      status: 'potential',
      services: ['Seasonal Lookbook', 'Influencer Collabs'],
      industry: 'Apparel',
      start_date: '2026-09-01',
      notes: 'Pitch delivered last Thursday. Waiting on Q4 marketing budget sign-off.',
    },
    [sarah.profileId],
    9000
  );

  const oasis = await insertClient(
    {
      name: 'Oasis Botanicals',
      location: 'Vancouver, BC',
      status: 'paused',
      services: ['Eco Storytelling', 'Photo Stills'],
      industry: 'CPG',
      start_date: '2026-04-01',
      notes: 'Contract paused pending inventory restock for fall harvesting.',
    },
    [elena.profileId],
    5500
  );

  await insertClient(
    {
      name: 'Velox EV Motors',
      location: 'Stockholm, SE',
      status: 'churned',
      services: ['Launch Campaign', 'Press Reel'],
      industry: 'Automotive',
      start_date: '2025-06-01',
      end_date: '2025-12-15',
      churn_reason: 'In-house studio',
      notes: 'Transitioned internal in-house studio after successful vehicle unveil.',
    },
    [],
    16000
  );

  console.log('Clients created (8 clients across all status categories)');

  // 4. Creators
  const kai = await insertReturningId('creators', {
    name: 'Kai Thorne',
    role: 'videographer',
    style_tags: ['Cinematic 4K', 'FPV Drone', 'Color Grade Master'],
    instagram_handle: '@kaithorne_cine',
    followers: 145000,
    day_rate: 1200,
    rate_unit: 'day',
    available: true,
    email: 'kai@creators.agency',
    phone: '+1 (555) 234-5678',
    notes: 'Top choice for high-speed dynamic shots and outdoor automotive/fitness.',
  });

  const maya = await insertReturningId('creators', {
    name: 'Maya Lin',
    role: 'ugc',
    style_tags: ['Skincare Minimalist', 'Clean Girl Aesthetic', 'Macro Focus'],
    instagram_handle: '@mayalinstudio',
    followers: 88000,
    day_rate: 650,
    rate_unit: 'day',
    available: true,
    email: 'maya@creators.agency',
    phone: '+1 (555) 345-6789',
    notes: 'Exceptional lighting at home studio. 48hr delivery turnaround on UGC.',
  });

  const jordan = await insertReturningId('creators', {
    name: "Jordan 'Apex' Cole",
    role: 'presenter',
    style_tags: ['High Energy', 'Fitness Coach', 'On-Camera Host'],
    instagram_handle: '@jordancolefit',
    followers: 230000,
    day_rate: 950,
    rate_unit: 'day',
    available: true,
    email: 'jordan@creators.agency',
    phone: '+1 (555) 456-7890',
    notes: 'Former collegiate athlete, dynamic vocal presence for workout content.',
  });

  const sora = await insertReturningId('creators', {
    name: 'Sora Tanaka',
    role: 'photographer',
    style_tags: ['Editorial Fashion', '35mm Film Look', 'Studio Lighting'],
    instagram_handle: '@soratanaka_raw',
    followers: 64000,
    day_rate: 800,
    rate_unit: 'day',
    available: false,
    email: 'sora@creators.agency',
    phone: '+1 (555) 567-8901',
    notes: 'On location shoot in Tokyo through end of month. Available October.',
  });

  const chloe = await insertReturningId('creators', {
    name: 'Chloe Bennett',
    role: 'ugc',
    style_tags: ['Tech Unboxing', 'Relatable Humor', 'Fast Paced'],
    instagram_handle: '@chloeb_tech',
    followers: 195000,
    day_rate: 750,
    rate_unit: 'day',
    available: true,
    email: 'chloe@creators.agency',
    phone: '+1 (555) 678-9012',
    notes: 'Strong conversion driver for hardware and consumer electronic accessories.',
  });

  const devon = await insertReturningId('creators', {
    name: 'Devon Miller',
    role: 'videographer',
    style_tags: ['Action Sports', 'Anamorphic', 'Music Videos'],
    instagram_handle: '@devonmiller_mov',
    followers: 110000,
    day_rate: 1100,
    rate_unit: 'day',
    available: true,
    email: 'devon@creators.agency',
    phone: '+1 (555) 789-0123',
    notes: 'Red V-Raptor package, specialty gimbal and extreme sports rigger.',
  });

  console.log('Creators created (6 creators across all roles)');

  // 5. Deliverables (current month reference: 2026-09)
  const insertDeliverable = async (payload: Record<string, unknown>): Promise<string> =>
    insertReturningId('deliverables', payload);

  const d1 = await insertDeliverable({
    client_id: lumiere,
    idea: 'Glow Drops Before/After Macro Video',
    filmed: true,
    published: true,
    link: 'https://instagram.com/reel/C7-demo1',
    format: 'reel',
    platform: 'instagram',
    results: '284k views, 14.2k saves, 4.8% CTR to shop',
    filming_date: '2026-08-28',
    publish_date: '2026-09-02',
    status: 'published',
    created_by: sarah.profileId,
  });

  const d2 = await insertDeliverable({
    client_id: lumiere,
    idea: 'Night Routine 3-Step UGC Story Series',
    filmed: true,
    published: true,
    link: 'https://instagram.com/stories/demo2',
    format: 'story',
    platform: 'instagram',
    results: '42k impressions, 620 link sticker clicks',
    filming_date: '2026-08-30',
    publish_date: '2026-09-04',
    created_by: sarah.profileId,
  });

  await insertDeliverable({
    client_id: lumiere,
    idea: 'Dermatologist Ingredient Breakdown Duet',
    filmed: true,
    published: false,
    format: 'reel',
    platform: 'tiktok',
    filming_date: '2026-09-06',
    publish_date: '2026-09-12',
    created_by: admin.profileId,
  });

  await insertDeliverable({
    client_id: lumiere,
    idea: 'Fall Serum Texture Macro Carousel',
    filmed: false,
    published: false,
    format: 'carousel',
    platform: 'instagram',
    filming_date: '2026-09-14',
    publish_date: '2026-09-18',
    created_by: sarah.profileId,
  });

  const d5 = await insertDeliverable({
    client_id: apex,
    idea: 'Hyrox Training: Day in the Life with Pro Athlete',
    filmed: true,
    published: true,
    link: 'https://instagram.com/reel/C8-demo3',
    format: 'reel',
    platform: 'instagram',
    results: '510k views, 28.5k likes, trending audio hit',
    filming_date: '2026-08-29',
    publish_date: '2026-09-03',
    created_by: elena.profileId,
  });

  const d6 = await insertDeliverable({
    client_id: apex,
    idea: 'Sprint Acceleration Biomechanics Breakdown',
    filmed: true,
    published: true,
    link: 'https://youtube.com/shorts/demo4',
    format: 'reel',
    platform: 'youtube',
    results: '95k views, 1,240 subscribers gained',
    filming_date: '2026-09-01',
    publish_date: '2026-09-05',
    created_by: elena.profileId,
  });

  await insertDeliverable({
    client_id: apex,
    idea: 'Winter Seamless Thermal Compression Editorial',
    filmed: false,
    published: false,
    format: 'photo',
    platform: 'instagram',
    filming_date: '2026-09-19',
    publish_date: '2026-09-24',
    created_by: sarah.profileId,
  });

  const d8 = await insertDeliverable({
    client_id: volt,
    idea: 'Downtown Skate Plaza Trick or Sip Challenge',
    filmed: true,
    published: true,
    link: 'https://tiktok.com/@voltenergy/demo5',
    format: 'reel',
    platform: 'tiktok',
    results: '1.2M views, 185k likes, 2,100 shares',
    filming_date: '2026-08-27',
    publish_date: '2026-09-01',
    created_by: marcus.profileId,
  });

  await insertDeliverable({
    client_id: volt,
    idea: 'Midnight Drift Car Pitstop Cinematic',
    filmed: true,
    published: false,
    format: 'reel',
    platform: 'instagram',
    filming_date: '2026-09-08',
    publish_date: '2026-09-14',
    created_by: marcus.profileId,
  });

  const d10 = await insertDeliverable({
    client_id: echo,
    idea: 'Active Noise Cancelling Berlin U-Bahn Test',
    filmed: true,
    published: true,
    link: 'https://tiktok.com/@echosound/demo6',
    format: 'reel',
    platform: 'tiktok',
    results: '680k views, $34,200 direct tracked attribution',
    filming_date: '2026-08-31',
    publish_date: '2026-09-04',
    created_by: marcus.profileId,
  });

  console.log('Deliverables created (10 deliverables across formats & platforms)');

  // 6. Creator Assignments
  const creatorAssignments: Array<Record<string, unknown>> = [
    { creator_id: maya, client_id: lumiere, deliverable_id: d1, scheduled_date: '2026-09-01' },
    { creator_id: jordan, client_id: apex, deliverable_id: d5, scheduled_date: '2026-09-02' },
    { creator_id: kai, client_id: apex, deliverable_id: d6, scheduled_date: '2026-09-03' },
    { creator_id: devon, client_id: volt, deliverable_id: d8, scheduled_date: '2026-08-30' },
    { creator_id: chloe, client_id: echo, deliverable_id: d10, scheduled_date: '2026-09-02' },
  ];
  const { error: caError } = await supabase.from('creator_assignments').insert(creatorAssignments);
  if (caError) throw caError;

  console.log('Creator assignments linked to deliverables & shoots');

  // 7. Goals for 2026-09 and Year 2026
  const { error: goalsError } = await supabase.from('goals').insert([
    { period_type: 'month', period_value: '2026-09', metric: 'revenue', target: 75000 },
    { period_type: 'month', period_value: '2026-09', metric: 'deliverables', target: 12 },
    { period_type: 'month', period_value: '2026-09', metric: 'new_clients', target: 3 },
    { period_type: 'month', period_value: '2026-09', metric: 'retention', target: 90 },
    { period_type: 'year', period_value: '2026', metric: 'revenue', target: 850000 },
    { period_type: 'year', period_value: '2026', metric: 'deliverables', target: 150 },
    { period_type: 'year', period_value: '2026', metric: 'new_clients', target: 25 },
    { period_type: 'year', period_value: '2026', metric: 'retention', target: 88 },
    { period_type: 'month', period_value: '2026-09', metric: 'profit', target: 25000 },
    { period_type: 'month', period_value: '2026-09', metric: 'views', target: 400000 },
  ]);
  if (goalsError) throw goalsError;

  console.log('Goals targets created for 2026-09 and 2026');

  // 8. Messages
  const { error: messagesError } = await supabase.from('messages').insert([
    {
      client_id: lumiere,
      sender_id: sarah.profileId,
      body: 'Welcome to the September content sprint! We completed the Glow Drops macro edits yesterday.',
      created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    },
    {
      client_id: lumiere,
      sender_id: admin.profileId,
      body: 'Great work team. The client loved the first hook variation. Let’s make sure publish time aligns with their email blast on Tuesday.',
      created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
    {
      client_id: lumiere,
      sender_id: marcus.profileId,
      body: 'Confirmed with their marketing manager. Scheduled for 10am EST.',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      client_id: apex,
      sender_id: elena.profileId,
      body: "Jordan's shoot wrapped in Austin! Raw footage has been uploaded to our production server.",
      created_at: new Date(Date.now() - 3600000 * 20).toISOString(),
    },
    {
      client_id: apex,
      sender_id: admin.profileId,
      body: 'Awesome turnaround. Please ensure the colorist retains that high-contrast athletic grade for YouTube Shorts.',
      created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    },
  ]);
  if (messagesError) throw messagesError;

  console.log('Messages seeded for client chat threads.');

  const { error: metricsError } = await supabase.from('post_metrics').insert([
    { deliverable_id: d1, views: 284000, likes: 18200, comments: 640, shares: 1100, saves: 14200, reach: 210000, impressions: 320000, followers_gained: 420 },
    { deliverable_id: d5, views: 510000, likes: 28500, comments: 890, shares: 2400, saves: 6100, reach: 380000, impressions: 540000, followers_gained: 980 },
    { deliverable_id: d8, views: 1200000, likes: 185000, comments: 4200, shares: 2100, saves: 8900, reach: 900000, impressions: 1400000, followers_gained: 2100 },
    { deliverable_id: d10, views: 680000, likes: 41200, comments: 1500, shares: 980, saves: 3200, reach: 500000, impressions: 720000, followers_gained: 640 },
  ]);
  if (metricsError) throw metricsError;

  const invLumiere = await insertReturningId('invoices', {
    client_id: lumiere,
    number: 'INV-2026-0001',
    issue_date: '2026-09-01',
    due_date: '2026-09-15',
    period_label: '2026-09',
    subtotal: 14500,
    vat_rate: 0.19,
    total: 17255,
    status: 'sent',
    created_by: admin.profileId,
  });
  await supabase.from('payments').insert({
    invoice_id: invLumiere,
    amount: 17255,
    paid_at: '2026-09-05',
    method: 'bank_transfer',
  });
  const invApex = await insertReturningId('invoices', {
    client_id: apex,
    number: 'INV-2026-0002',
    issue_date: '2026-09-01',
    due_date: '2026-09-20',
    period_label: '2026-09',
    subtotal: 18000,
    vat_rate: 0.19,
    total: 21420,
    status: 'sent',
    created_by: admin.profileId,
  });
  await supabase.from('payments').insert({
    invoice_id: invApex,
    amount: 10000,
    paid_at: '2026-09-08',
    method: 'bank_transfer',
  });

  const { error: expError } = await supabase.from('expenses').insert([
    { date: '2026-09-03', amount: 1950, category: 'partner_fee', description: 'Maya Lin UGC day', client_id: lumiere, partner_id: maya, created_by: admin.profileId },
    { date: '2026-09-04', amount: 320, category: 'software', description: 'Adobe + CapCut seats', created_by: admin.profileId },
    { date: '2026-09-06', amount: 850, category: 'ads', description: 'Boost Glow Drops reel', client_id: lumiere, created_by: admin.profileId },
    { date: '2026-09-01', amount: 2800, category: 'salary', description: 'Producer stipend', created_by: admin.profileId },
  ]);
  if (expError) throw expError;

  await insertReturningId('creators', {
    name: 'Noor Studio',
    role: 'agency',
    partner_type: 'agency',
    company: 'Noor Studio',
    style_tags: ['Full production', 'Arabic + FR'],
    available: true,
    location: 'Tunis',
    notes: 'Sister production house for larger retainers.',
  });
  await insertReturningId('creators', {
    name: 'Lina K.',
    role: 'influencer',
    partner_type: 'individual',
    style_tags: ['Lifestyle', 'Tunis', 'Arabic'],
    instagram_handle: '@linak_tn',
    followers: 310000,
    available: true,
    day_rate: 2200,
  });

  console.log('Finance, metrics, and extra partners seeded.');
  console.log('Seeding completed successfully!');
}

main().catch((e) => {
  console.error('Seeding error:', e);
  process.exit(1);
});
