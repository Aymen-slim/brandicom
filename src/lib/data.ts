import { createServerSupabaseClient } from './supabase/server';
import { CurrentUser } from './permissions';
import {
  AssignmentStatus,
  ClientAssignmentData,
  ClientContractData,
  ClientData,
  ClientHealthData,
  ClientStatus,
  CreatorData,
  CreatorRole,
  DeliverableData,
  DeliverableFormat,
  DeliverableStatus,
  MessageData,
  PartnerType,
  Platform,
  PostMetricsData,
  SocialAccountData,
  UserSummary,
} from '@/types';

export const CLIENT_STATUSES: ClientStatus[] = ['potential', 'starting', 'active', 'paused', 'churned'];
export const CREATOR_ROLES: CreatorRole[] = [
  'photographer',
  'ugc',
  'presenter',
  'videographer',
  'influencer',
  'agency',
  'editor',
  'designer',
  'model',
];
export const DELIVERABLE_FORMATS: DeliverableFormat[] = ['reel', 'photo', 'story', 'carousel'];
export const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'facebook', 'youtube'];
export const DELIVERABLE_STATUSES: DeliverableStatus[] = [
  'idea',
  'scripted',
  'filmed',
  'editing',
  'scheduled',
  'published',
];

export const isClientStatus = (v: unknown): v is ClientStatus => CLIENT_STATUSES.includes(v as ClientStatus);
export const isCreatorRole = (v: unknown): v is CreatorRole => CREATOR_ROLES.includes(v as CreatorRole);
export const isDeliverableFormat = (v: unknown): v is DeliverableFormat =>
  DELIVERABLE_FORMATS.includes(v as DeliverableFormat);
export const isPlatform = (v: unknown): v is Platform => PLATFORMS.includes(v as Platform);
export const isDeliverableStatus = (v: unknown): v is DeliverableStatus =>
  DELIVERABLE_STATUSES.includes(v as DeliverableStatus);

export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,().%_]/g, ' ').replace(/\s+/g, ' ').trim();
}

const USER_SUMMARY_SELECT = 'id, name, email, role';

const CLIENT_FIELDS =
  'id, name, location, status, services, notes, industry, website, contact_name, contact_email, contact_phone, start_date, end_date, lead_source, churn_reason, tags, assets_url, logo_url, created_at, created_by';

const CLIENT_SELECT = `${CLIENT_FIELDS}, client_assignments(client_id, user_id, users(${USER_SUMMARY_SELECT})), client_social_accounts(id, client_id, platform, handle, url, followers, followers_updated_at)`;

const DELIVERABLE_SELECT_BASE = `id, client_id, idea, title, caption, hook, filmed, published, status, link, format, platform, results, publish_date, scheduled_at, thumbnail_url, created_by, created_at, users!deliverables_created_by_fkey(id, name, email, role), creator_assignments(id, scheduled_date, status, creators(id, name, role, instagram_handle, available, style_tags, partner_type, company)), post_metrics(id, deliverable_id, captured_at, views, likes, comments, shares, saves, reach, impressions, link_clicks, followers_gained, source, note)`;
const DELIVERABLE_SELECT = `id, client_id, idea, title, caption, hook, filmed, published, status, link, format, platform, results, publish_date, publish_time, filming_date, scheduled_at, thumbnail_url, created_by, created_at, users!deliverables_created_by_fkey(id, name, email, role), creator_assignments(id, scheduled_date, status, creators(id, name, role, instagram_handle, available, style_tags, partner_type, company)), post_metrics(id, deliverable_id, captured_at, views, likes, comments, shares, saves, reach, impressions, link_clicks, followers_gained, source, note)`;
const CALENDAR_DELIVERABLE_SELECT_BASE = `${DELIVERABLE_SELECT_BASE}, clients(id, name)`;
const CALENDAR_DELIVERABLE_SELECT = `${DELIVERABLE_SELECT}, clients(id, name)`;
let _filmingDateSupported: boolean | null = null;
let _lastFilmingDateCheck = 0;

export async function isFilmingDateSupported(supabase: any): Promise<boolean> {
  const now = Date.now();
  if (_filmingDateSupported !== null && now - _lastFilmingDateCheck < 60_000) {
    return _filmingDateSupported;
  }
  try {
    const { error } = await supabase.from('deliverables').select('filming_date').limit(1);
    _filmingDateSupported = !error;
  } catch {
    _filmingDateSupported = false;
  }
  _lastFilmingDateCheck = now;
  return _filmingDateSupported;
}

export function getDeliverableSelect(supportsFilmingDate: boolean): string {
  return supportsFilmingDate ? DELIVERABLE_SELECT : DELIVERABLE_SELECT_BASE;
}

export function getCalendarDeliverableSelect(supportsFilmingDate: boolean): string {
  return supportsFilmingDate ? CALENDAR_DELIVERABLE_SELECT : CALENDAR_DELIVERABLE_SELECT_BASE;
}

export {
  DELIVERABLE_SELECT,
  DELIVERABLE_SELECT_BASE,
  CALENDAR_DELIVERABLE_SELECT,
  CALENDAR_DELIVERABLE_SELECT_BASE,
};


const MESSAGE_SELECT = `id, client_id, sender_id, body, created_at, users!messages_sender_id_fkey(${USER_SUMMARY_SELECT})`;

const CREATOR_PUBLIC_FIELDS =
  'id, name, role, partner_type, company, location, style_tags, instagram_handle, followers, available, phone, email, notes, portfolio_url, rating, last_worked_at, created_at';
const CREATOR_ADMIN_FIELDS = `${CREATOR_PUBLIC_FIELDS}, day_rate, rate_unit`;

export function toDateOnly(v: unknown): string | null {
  if (!v || typeof v !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function mapUserSummary(row: any): UserSummary {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

function mapAssignmentRow(row: any): ClientAssignmentData {
  return {
    clientId: row.client_id,
    userId: row.user_id,
    user: mapUserSummary(row.users || row.user || { id: row.user_id, name: 'Unknown', email: '', role: 'member' }),
  };
}

function mapSocial(row: any): SocialAccountData {
  return {
    id: row.id,
    clientId: row.client_id,
    platform: row.platform,
    handle: row.handle,
    url: row.url,
    followers: row.followers,
    followersUpdatedAt: row.followers_updated_at,
  };
}

function mapMetrics(row: any): PostMetricsData {
  return {
    id: row.id,
    deliverableId: row.deliverable_id,
    capturedAt: row.captured_at,
    views: Number(row.views || 0),
    likes: Number(row.likes || 0),
    comments: Number(row.comments || 0),
    shares: Number(row.shares || 0),
    saves: Number(row.saves || 0),
    reach: Number(row.reach || 0),
    impressions: Number(row.impressions || 0),
    linkClicks: Number(row.link_clicks || 0),
    followersGained: Number(row.followers_gained || 0),
    source: row.source || 'manual',
    note: row.note,
  };
}

export function mapClientRow(row: any, opts?: { contract?: ClientContractData | null; health?: ClientHealthData | null }): ClientData {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    industry: row.industry,
    website: row.website,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    startDate: row.start_date,
    endDate: row.end_date,
    leadSource: row.lead_source,
    churnReason: row.churn_reason,
    tags: row.tags || [],
    assetsUrl: row.assets_url,
    logoUrl: row.logo_url,
    status: row.status as ClientStatus,
    services: row.services || [],
    notes: row.notes,
    createdAt: row.created_at,
    socialAccounts: (row.client_social_accounts || []).map(mapSocial),
    assignments: (row.client_assignments || []).map(mapAssignmentRow),
    contract: opts?.contract ?? null,
    health: opts?.health ?? null,
  };
}

export function mapCreatorRow(row: any, isAdmin = false): CreatorData {
  return {
    id: row.id,
    name: row.name,
    role: row.role as CreatorRole,
    partnerType: (row.partner_type || 'individual') as PartnerType,
    company: row.company ?? null,
    location: row.location ?? null,
    styleTags: row.style_tags || [],
    instagramHandle: row.instagram_handle,
    followers: row.followers,
    dayRate: isAdmin && row.day_rate != null ? Number(row.day_rate) : null,
    rateUnit: isAdmin ? row.rate_unit : null,
    available: row.available,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    portfolioUrl: row.portfolio_url ?? null,
    rating: row.rating ?? null,
    lastWorkedAt: row.last_worked_at ?? null,
    createdAt: row.created_at,
    assignments: (row.creator_assignments || []).map((a: any) => ({
      id: a.id,
      client: a.clients || { id: '', name: '' },
      scheduledDate: a.scheduled_date,
      deliverableId: a.deliverable_id,
      status: a.status as AssignmentStatus | undefined,
      deliverable: a.deliverables
        ? {
            id: a.deliverables.id,
            idea: a.deliverables.idea,
            format: a.deliverables.format,
            platform: a.deliverables.platform,
          }
        : null,
    })),
  };
}

function latestMetrics(rows: any[] | undefined): PostMetricsData | null {
  if (!rows || rows.length === 0) return null;
  const sorted = [...rows].sort(
    (a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
  );
  return mapMetrics(sorted[0]);
}

export function mapDeliverableRow(row: any): DeliverableData {
  const status: DeliverableStatus =
    row.status || (row.published ? 'published' : row.filmed ? 'filmed' : 'idea');
  const creatorAssignments = (row.creator_assignments || []).map((ca: any) => ({
    id: ca.id,
    creator: mapCreatorRow(ca.creators || {}),
    scheduledDate: ca.scheduled_date,
    status: ca.status,
  }));
  const filmingDate = row.filming_date ?? creatorAssignments[0]?.scheduledDate ?? null;

  let publishTime: string | null = row.publish_time ?? null;
  if (!publishTime && row.scheduled_at) {
    try {
      const dt = new Date(row.scheduled_at);
      if (!isNaN(dt.getTime())) {
        const hh = String(dt.getUTCHours()).padStart(2, '0');
        const mm = String(dt.getUTCMinutes()).padStart(2, '0');
        publishTime = `${hh}:${mm}`;
      }
    } catch {
      // ignore
    }
  }

  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.clients?.name ?? null,
    idea: row.idea,
    title: row.title ?? null,
    caption: row.caption ?? null,
    hook: row.hook ?? null,
    filmed: Boolean(row.filmed),
    published: Boolean(row.published),
    status,
    link: row.link,
    format: row.format,
    platform: row.platform,
    results: row.results,
    publishDate: row.publish_date,
    publishTime,
    filmingDate,
    scheduledAt: row.scheduled_at ?? null,
    thumbnailUrl: row.thumbnail_url ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    author: row.users ? mapUserSummary(row.users) : null,
    latestMetrics: latestMetrics(row.post_metrics),
    creatorAssignments,
  };
}

export function mapMessageRow(row: any): MessageData {
  return {
    id: row.id,
    clientId: row.client_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    sender: row.users ? mapUserSummary(row.users) : null,
  };
}

function mapContract(row: any): ClientContractData {
  return {
    clientId: row.client_id,
    contractType: row.contract_type,
    monthlyFee: row.monthly_fee != null ? Number(row.monthly_fee) : null,
    currency: row.currency || 'TND',
    billingDay: row.billing_day,
    startDate: row.start_date,
    endDate: row.end_date,
    notes: row.notes,
  };
}

export async function logActivity(entry: {
  action: string;
  entity: string;
  entityId?: string | null;
  diff?: Record<string, unknown> | null;
  source?: 'user' | 'ai';
  actorId?: string | null;
}) {
  const supabase = createServerSupabaseClient();
  let actorId = entry.actorId;
  if (actorId === undefined) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    actorId = user?.id ?? null;
  }
  await supabase.from('activity_log').insert({
    actor_id: actorId ?? null,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId ?? null,
    diff: entry.diff ?? null,
    source: entry.source ?? 'user',
  });
}

export async function fetchUsersWithCounts(): Promise<
  Array<UserSummary & { createdAt: string; _count: { assignments: number; deliverables: number } }>
> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select(`${USER_SUMMARY_SELECT}, created_at`)
    .order('name', { ascending: true });

  if (error) throw error;
  const users = data || [];
  if (users.length === 0) return [];

  const userIds = users.map((u: any) => u.id);

  const [assignmentsRes, deliverablesRes] = await Promise.all([
    supabase
      .from('client_assignments')
      .select('user_id')
      .in('user_id', userIds),
    supabase
      .from('deliverables')
      .select('created_by')
      .in('created_by', userIds),
  ]);

  const assignmentCountMap = new Map<string, number>();
  for (const a of assignmentsRes.data || []) {
    if (a.user_id) {
      assignmentCountMap.set(a.user_id, (assignmentCountMap.get(a.user_id) || 0) + 1);
    }
  }

  const deliverableCountMap = new Map<string, number>();
  for (const d of deliverablesRes.data || []) {
    if (d.created_by) {
      deliverableCountMap.set(d.created_by, (deliverableCountMap.get(d.created_by) || 0) + 1);
    }
  }

  return users.map((u: any) => ({
    ...mapUserSummary(u),
    createdAt: u.created_at,
    _count: {
      assignments: assignmentCountMap.get(u.id) ?? 0,
      deliverables: deliverableCountMap.get(u.id) ?? 0,
    },
  }));
}

export async function fetchUsers(): Promise<UserSummary[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select(USER_SUMMARY_SELECT)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapUserSummary);
}

export async function fetchClients(opts: {
  status?: string | null;
  assignedTo?: string | null;
  search?: string | null;
  userRole?: string;
  userId?: string;
}): Promise<ClientData[]> {
  const supabase = createServerSupabaseClient();
  let query = supabase.from('clients').select(CLIENT_SELECT);

  if (opts.status && isClientStatus(opts.status)) {
    query = query.eq('status', opts.status);
  }

  const term = opts.search ? sanitizeSearchTerm(opts.search) : '';
  if (term) {
    query = query.or(
      `name.ilike.%${term}%,location.ilike.%${term}%,notes.ilike.%${term}%,industry.ilike.%${term}%`
    );
  }

  if (opts.userRole === 'admin' && opts.assignedTo) {
    query = query.eq('client_assignments.user_id', opts.assignedTo);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;

  const clients = (data || []).map((row) => mapClientRow(row));

  if (opts.userRole === 'admin' && clients.length > 0) {
    const { data: contracts } = await supabase
      .from('client_contracts')
      .select('client_id, contract_type, monthly_fee, currency, billing_day, start_date, end_date, notes')
      .in(
        'client_id',
        clients.map((c) => c.id)
      );
    const byId = new Map((contracts || []).map((c: any) => [c.client_id, mapContract(c)]));
    return clients.map((c) => ({ ...c, contract: byId.get(c.id) ?? null }));
  }

  return clients;
}

export async function attachClientCounts(clients: ClientData[]): Promise<ClientData[]> {
  if (!clients || clients.length === 0) return [];
  const supabase = createServerSupabaseClient();
  const clientIds = clients.map((c) => c.id);

  const [delivRes, msgRes] = await Promise.all([
    supabase
      .from('deliverables')
      .select('client_id')
      .in('client_id', clientIds),
    supabase
      .from('messages')
      .select('client_id')
      .in('client_id', clientIds),
  ]);

  const delivCountMap = new Map<string, number>();
  for (const d of delivRes.data || []) {
    if (d.client_id) {
      delivCountMap.set(d.client_id, (delivCountMap.get(d.client_id) || 0) + 1);
    }
  }

  const msgCountMap = new Map<string, number>();
  for (const m of msgRes.data || []) {
    if (m.client_id) {
      msgCountMap.set(m.client_id, (msgCountMap.get(m.client_id) || 0) + 1);
    }
  }

  return clients.map((client) => ({
    ...client,
    _count: {
      deliverables: delivCountMap.get(client.id) ?? 0,
      messages: msgCountMap.get(client.id) ?? 0,
    },
  }));
}

export async function fetchClientDetail(clientId: string, user?: CurrentUser | null) {
  const supabase = createServerSupabaseClient();

  const { data: clientRow, error: clientError } = await supabase
    .from('clients')
    .select(CLIENT_SELECT)
    .eq('id', clientId)
    .maybeSingle();

  if (clientError) throw clientError;
  if (!clientRow) return null;

  const supportsFilmingDate = await isFilmingDateSupported(supabase);
  const delivSelect = getDeliverableSelect(supportsFilmingDate);

  const [deliverablesRes, creatorAssignmentsRes, messagesRes, healthRes, contractRes] = await Promise.all([
    supabase
      .from('deliverables')
      .select(delivSelect)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
    supabase
      .from('creator_assignments')
      .select('*, creators(id, name, role, instagram_handle, available, style_tags, partner_type, company), deliverables(id, idea, format, platform)')
      .eq('client_id', clientId)
      .order('scheduled_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('messages')
      .select(MESSAGE_SELECT)
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })
      .limit(50),
    supabase
      .from('client_health_snapshots')
      .select('client_id, score, risk, factors, ai_summary, computed_at')
      .eq('client_id', clientId)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    user?.role === 'admin'
      ? supabase
          .from('client_contracts')
          .select('client_id, contract_type, monthly_fee, currency, billing_day, start_date, end_date, notes')
          .eq('client_id', clientId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  let deliverablesRows: any[] = deliverablesRes.data as any[];
  if (deliverablesRes.error) {
    const fallbackRes: any = await supabase
      .from('deliverables')
      .select(DELIVERABLE_SELECT_BASE)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (fallbackRes.error) throw fallbackRes.error;
    deliverablesRows = fallbackRes.data || [];
  }

  if (creatorAssignmentsRes.error) throw creatorAssignmentsRes.error;
  if (messagesRes.error) throw messagesRes.error;

  const health: ClientHealthData | null = healthRes.data
    ? {
        clientId: healthRes.data.client_id,
        score: healthRes.data.score,
        risk: healthRes.data.risk,
        factors: healthRes.data.factors || {},
        aiSummary: healthRes.data.ai_summary,
        computedAt: healthRes.data.computed_at,
      }
    : null;

  const contract = contractRes.data ? mapContract(contractRes.data) : null;
  const client = mapClientRow(clientRow, { contract, health });
  const deliverables = (deliverablesRows || []).map(mapDeliverableRow);

  const creatorAssignments = (creatorAssignmentsRes.data || []).map((ca: any) => ({
    id: ca.id,
    creator: mapCreatorRow(ca.creators),
    scheduledDate: ca.scheduled_date,
    deliverableId: ca.deliverable_id,
    status: ca.status as AssignmentStatus | undefined,
    deliverable: ca.deliverables
      ? {
          id: ca.deliverables.id,
          idea: ca.deliverables.idea,
          format: ca.deliverables.format,
          platform: ca.deliverables.platform,
        }
      : null,
  }));

  const messages = (messagesRes.data || []).map(mapMessageRow);

  return { client, deliverables, creatorAssignments, messages };
}

export async function fetchDeliverables(clientId: string): Promise<DeliverableData[]> {
  const supabase = createServerSupabaseClient();
  const supportsFilmingDate = await isFilmingDateSupported(supabase);
  const delivSelect = getDeliverableSelect(supportsFilmingDate);
  let res: any = await supabase
    .from('deliverables')
    .select(delivSelect)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (res.error) {
    res = await supabase
      .from('deliverables')
      .select(DELIVERABLE_SELECT_BASE)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
  }

  if (res.error) throw res.error;
  return (res.data || []).map(mapDeliverableRow);
}

export async function fetchCalendarDeliverables(opts?: {
  clientId?: string | null;
}): Promise<DeliverableData[]> {
  const supabase = createServerSupabaseClient();
  const supportsFilmingDate = await isFilmingDateSupported(supabase);
  const delivSelect = getCalendarDeliverableSelect(supportsFilmingDate);
  let query = supabase.from('deliverables').select(delivSelect);

  if (opts?.clientId) {
    query = query.eq('client_id', opts.clientId);
  }

  let res: any = await query.order('created_at', { ascending: false });

  if (res.error) {
    let fallbackQuery = supabase.from('deliverables').select(CALENDAR_DELIVERABLE_SELECT_BASE);
    if (opts?.clientId) {
      fallbackQuery = fallbackQuery.eq('client_id', opts.clientId);
    }
    res = await fallbackQuery.order('created_at', { ascending: false });
  }

  if (res.error) throw res.error;
  return (res.data || []).map(mapDeliverableRow);
}

export async function fetchAdminPostingAlerts(): Promise<{
  todayPosts: DeliverableData[];
  overduePosts: DeliverableData[];
  todayShoots: DeliverableData[];
  upcomingPosts: DeliverableData[];
}> {
  const supabase = createServerSupabaseClient();
  const today = new Date().toISOString().split('T')[0];
  const supportsFilmingDate = await isFilmingDateSupported(supabase);
  const delivSelect = getCalendarDeliverableSelect(supportsFilmingDate);

  let res: any = await supabase
    .from('deliverables')
    .select(delivSelect)
    .or('published.eq.false,filmed.eq.false')
    .order('created_at', { ascending: false });

  if (res.error) {
    res = await supabase
      .from('deliverables')
      .select(CALENDAR_DELIVERABLE_SELECT_BASE)
      .or('published.eq.false,filmed.eq.false')
      .order('created_at', { ascending: false });
  }

  if (res.error) throw res.error;
  const all: DeliverableData[] = (res.data || []).map(mapDeliverableRow);

  const todayPosts = all
    .filter((d) => d.publishDate === today && !d.published)
    .sort((a, b) => (a.publishTime || '99:99').localeCompare(b.publishTime || '99:99'));

  const overduePosts = all
    .filter((d) => Boolean(d.publishDate && d.publishDate < today && !d.published))
    .sort((a, b) => (b.publishDate || '').localeCompare(a.publishDate || ''));

  const todayShoots = all.filter((d) => d.filmingDate === today && !d.filmed);

  const upcomingPosts = all
    .filter((d) => Boolean(d.publishDate && d.publishDate > today && !d.published))
    .sort((a, b) => (a.publishDate || '').localeCompare(b.publishDate || ''))
    .slice(0, 5);

  return { todayPosts, overduePosts, todayShoots, upcomingPosts };
}

export async function fetchMessages(clientId: string, since?: string | null): Promise<MessageData[]> {
  const supabase = createServerSupabaseClient();
  let query = supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })
    .limit(100);

  if (since) {
    const sinceDate = new Date(since);
    if (!isNaN(sinceDate.getTime())) {
      query = query.gt('created_at', sinceDate.toISOString());
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapMessageRow);
}

export async function fetchCreators(opts: {
  role?: string | null;
  available?: string | null;
  search?: string | null;
  isAdmin?: boolean;
}): Promise<CreatorData[]> {
  const supabase = createServerSupabaseClient();
  const fields = opts.isAdmin ? CREATOR_ADMIN_FIELDS : CREATOR_PUBLIC_FIELDS;
  let query = supabase
    .from('creators')
    .select(`${fields}, creator_assignments(id, scheduled_date, deliverable_id, status, clients(id, name))`);

  if (opts.role && isCreatorRole(opts.role)) {
    query = query.eq('role', opts.role);
  }
  if (opts.available !== null && opts.available !== undefined && opts.available !== '') {
    query = query.eq('available', opts.available === 'true');
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;

  let creators = (data || []).map((row) => mapCreatorRow(row, Boolean(opts.isAdmin)));

  const term = opts.search ? opts.search.trim() : '';
  if (term) {
    const lower = term.toLowerCase();
    creators = creators.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        (c.instagramHandle || '').toLowerCase().includes(lower) ||
        (c.notes || '').toLowerCase().includes(lower) ||
        (c.company || '').toLowerCase().includes(lower) ||
        c.styleTags.some((tag) => tag.toLowerCase().includes(lower))
    );
  }

  return creators;
}

export async function fetchCreatorDetail(creatorId: string, isAdmin = false): Promise<CreatorData | null> {
  const supabase = createServerSupabaseClient();
  const fields = isAdmin ? CREATOR_ADMIN_FIELDS : CREATOR_PUBLIC_FIELDS;
  const { data, error } = await supabase
    .from('creators')
    .select(
      `${fields}, creator_assignments(id, scheduled_date, deliverable_id, status, clients(id, name, status), deliverables(id, idea, format, platform))`
    )
    .eq('id', creatorId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapCreatorRow(data, isAdmin);
}

export async function fetchGoals(): Promise<
  Array<{ periodType: string; periodValue: string; metric: string; target: number }>
> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('goals')
    .select('period_type, period_value, metric, target')
    .order('period_value', { ascending: true });

  if (error) throw error;
  return (data || []).map((g: any) => ({
    periodType: g.period_type,
    periodValue: g.period_value,
    metric: g.metric,
    target: Number(g.target),
  }));
}

export async function fetchAvailableCreators(): Promise<
  Array<{ id: string; name: string; role: CreatorRole }>
> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('creators')
    .select('id, name, role')
    .eq('available', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createClient(
  payload: {
    name: string;
    location?: string | null;
    status?: string | null;
    services: string[];
    notes?: string | null;
    industry?: string | null;
    website?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    startDate?: string | null;
    leadSource?: string | null;
    tags?: string[];
  },
  assignedUserIds: string[],
  contract?: { monthlyFee?: number | null; contractType?: string; billingDay?: number | null } | null,
  isAdmin = false
): Promise<ClientData> {
  const supabase = createServerSupabaseClient();

  const { data: row, error } = await supabase
    .from('clients')
    .insert({
      name: payload.name,
      location: payload.location?.trim() || null,
      status: payload.status && isClientStatus(payload.status) ? payload.status : 'potential',
      services: payload.services,
      notes: payload.notes?.trim() || null,
      industry: payload.industry?.trim() || null,
      website: payload.website?.trim() || null,
      contact_name: payload.contactName?.trim() || null,
      contact_email: payload.contactEmail?.trim() || null,
      contact_phone: payload.contactPhone?.trim() || null,
      start_date: toDateOnly(payload.startDate || '') || null,
      lead_source: payload.leadSource?.trim() || null,
      tags: payload.tags || [],
    })
    .select('id')
    .single();

  if (error) throw error;

  if (assignedUserIds.length > 0) {
    const { error: assignError } = await supabase
      .from('client_assignments')
      .insert(assignedUserIds.map((uid) => ({ client_id: row.id, user_id: uid })));
    if (assignError) throw assignError;
  }

  if (isAdmin && contract && contract.monthlyFee != null) {
    await supabase.from('client_contracts').upsert({
      client_id: row.id,
      contract_type: contract.contractType || 'retainer',
      monthly_fee: contract.monthlyFee,
      billing_day: contract.billingDay ?? 1,
      currency: 'TND',
    });
  }

  const { data: full, error: fetchError } = await supabase
    .from('clients')
    .select(CLIENT_SELECT)
    .eq('id', row.id)
    .maybeSingle();

  if (fetchError) throw fetchError;
  await logActivity({ action: 'create', entity: 'client', entityId: row.id, diff: { name: payload.name } });
  return mapClientRow(full);
}

export async function updateClient(
  clientId: string,
  fields: {
    name?: string;
    location?: string | null;
    status?: string;
    services?: string[];
    notes?: string | null;
    industry?: string | null;
    website?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    leadSource?: string | null;
    churnReason?: string | null;
    tags?: string[];
    assetsUrl?: string | null;
  },
  assignedUserIds?: string[]
): Promise<ClientData | null> {
  const supabase = createServerSupabaseClient();

  const dataToUpdate: Record<string, unknown> = {};
  if (fields.name !== undefined) dataToUpdate.name = fields.name.trim();
  if (fields.location !== undefined) dataToUpdate.location = fields.location?.trim() || null;
  if (fields.status !== undefined && isClientStatus(fields.status)) dataToUpdate.status = fields.status;
  if (fields.services !== undefined) dataToUpdate.services = fields.services;
  if (fields.notes !== undefined) dataToUpdate.notes = fields.notes?.trim() || null;
  if (fields.industry !== undefined) dataToUpdate.industry = fields.industry?.trim() || null;
  if (fields.website !== undefined) dataToUpdate.website = fields.website?.trim() || null;
  if (fields.contactName !== undefined) dataToUpdate.contact_name = fields.contactName?.trim() || null;
  if (fields.contactEmail !== undefined) dataToUpdate.contact_email = fields.contactEmail?.trim() || null;
  if (fields.contactPhone !== undefined) dataToUpdate.contact_phone = fields.contactPhone?.trim() || null;
  if (fields.startDate !== undefined) dataToUpdate.start_date = toDateOnly(fields.startDate || '') || null;
  if (fields.endDate !== undefined) dataToUpdate.end_date = toDateOnly(fields.endDate || '') || null;
  if (fields.leadSource !== undefined) dataToUpdate.lead_source = fields.leadSource?.trim() || null;
  if (fields.churnReason !== undefined) dataToUpdate.churn_reason = fields.churnReason?.trim() || null;
  if (fields.tags !== undefined) dataToUpdate.tags = fields.tags;
  if (fields.assetsUrl !== undefined) dataToUpdate.assets_url = fields.assetsUrl?.trim() || null;

  if (Object.keys(dataToUpdate).length > 0) {
    const { error } = await supabase.from('clients').update(dataToUpdate).eq('id', clientId);
    if (error) throw error;
  }

  if (Array.isArray(assignedUserIds)) {
    const { data: current, error: currentError } = await supabase
      .from('client_assignments')
      .select('user_id')
      .eq('client_id', clientId);

    if (currentError) throw currentError;

    const currentIds = new Set((current || []).map((r: any) => r.user_id as string));
    const wanted = Array.from(new Set(assignedUserIds.filter((u) => typeof u === 'string')));
    const toInsert = wanted.filter((u) => !currentIds.has(u));
    const toDelete = Array.from(currentIds).filter((u) => !wanted.includes(u));

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('client_assignments')
        .insert(toInsert.map((uid) => ({ client_id: clientId, user_id: uid })));
      if (insertError) throw insertError;
    }

    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('client_assignments')
        .delete()
        .eq('client_id', clientId)
        .in('user_id', toDelete);
      if (deleteError) throw deleteError;
    }
  }

  const { data: full, error } = await supabase
    .from('clients')
    .select(CLIENT_SELECT)
    .eq('id', clientId)
    .maybeSingle();

  if (error) throw error;
  await logActivity({ action: 'update', entity: 'client', entityId: clientId, diff: dataToUpdate });
  return full ? mapClientRow(full) : null;
}

export async function upsertClientSocials(
  clientId: string,
  accounts: Array<{ platform: Platform; handle?: string | null; url?: string | null; followers?: number | null }>
) {
  const supabase = createServerSupabaseClient();
  await supabase.from('client_social_accounts').delete().eq('client_id', clientId);
  if (accounts.length === 0) return;
  const { error } = await supabase.from('client_social_accounts').insert(
    accounts.map((a) => ({
      client_id: clientId,
      platform: a.platform,
      handle: a.handle?.trim() || null,
      url: a.url?.trim() || null,
      followers: a.followers ?? null,
      followers_updated_at: a.followers != null ? new Date().toISOString() : null,
    }))
  );
  if (error) throw error;
}

export async function upsertContract(
  clientId: string,
  fields: {
    contractType?: string;
    monthlyFee?: number | null;
    billingDay?: number | null;
    startDate?: string | null;
    endDate?: string | null;
    notes?: string | null;
  }
) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('client_contracts')
    .upsert({
      client_id: clientId,
      contract_type: fields.contractType || 'retainer',
      monthly_fee: fields.monthlyFee ?? null,
      billing_day: fields.billingDay ?? 1,
      start_date: toDateOnly(fields.startDate || '') || null,
      end_date: toDateOnly(fields.endDate || '') || null,
      notes: fields.notes?.trim() || null,
      currency: 'TND',
    })
    .select()
    .single();
  if (error) throw error;
  await logActivity({ action: 'upsert', entity: 'contract', entityId: clientId, diff: fields as Record<string, unknown> });
  return mapContract(data);
}
