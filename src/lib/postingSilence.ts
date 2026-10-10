export const POSTING_SILENCE_DAYS = 6;
export const SILENCE_DISMISS_COOKIE = 'posting_silence_dismissed';

const DISMISS_ENTRY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:(none|\d{4}-\d{2}-\d{2})$/i;

export interface SilenceClientInput {
  id: string;
  name: string;
  logoUrl: string | null;
  startDate: string | null;
  createdAt: string;
}

export interface SilencePostInput {
  clientId: string;
  published: boolean;
  status: string | null;
  publishDate: string | null;
  createdAt: string;
}

export interface SilentClientAlert {
  clientId: string;
  name: string;
  logoUrl: string | null;
  lastPostDate: string | null;
  daysSilent: number;
  gapKey: string;
  neverPosted: boolean;
}

export function isGapKey(value: string): boolean {
  if (value === 'none') return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysBetween(earlier: string, later: string): number {
  const [y1, m1, d1] = earlier.split('-').map(Number);
  const [y2, m2, d2] = later.split('-').map(Number);
  const start = Date.UTC(y1, m1 - 1, d1);
  const end = Date.UTC(y2, m2 - 1, d2);
  return Math.round((end - start) / 86400000);
}

function dayKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  return isGapKey(day) && day !== 'none' ? day : null;
}

function postedDay(post: SilencePostInput, today: string): string | null {
  const published = post.published || post.status === 'published';
  if (!published) return null;
  const scheduled = dayKey(post.publishDate);
  if (scheduled) return scheduled <= today ? scheduled : null;
  const created = dayKey(post.createdAt);
  return created && created <= today ? created : null;
}

function tenureStart(client: SilenceClientInput, today: string): string | null {
  const start = dayKey(client.startDate);
  if (start && start <= today) return start;
  return dayKey(client.createdAt);
}

export function selectSilentClients(
  clients: SilenceClientInput[],
  posts: SilencePostInput[],
  today: string,
  dismissed: Set<string>
): SilentClientAlert[] {
  const latest = new Map<string, string>();
  for (const post of posts) {
    const day = postedDay(post, today);
    if (!day) continue;
    const previous = latest.get(post.clientId);
    if (!previous || day > previous) latest.set(post.clientId, day);
  }

  const alerts: SilentClientAlert[] = [];
  for (const client of clients) {
    const started = tenureStart(client, today);
    if (!started || daysBetween(started, today) <= POSTING_SILENCE_DAYS) continue;

    const lastPostDate = latest.get(client.id) ?? null;
    if (lastPostDate && daysBetween(lastPostDate, today) <= POSTING_SILENCE_DAYS) continue;

    const gapKey = lastPostDate ?? 'none';
    if (dismissed.has(`${client.id}:${gapKey}`)) continue;

    alerts.push({
      clientId: client.id,
      name: client.name,
      logoUrl: client.logoUrl,
      lastPostDate,
      daysSilent: daysBetween(lastPostDate ?? started, today),
      gapKey,
      neverPosted: !lastPostDate,
    });
  }

  alerts.sort((a, b) => b.daysSilent - a.daysSilent || a.name.localeCompare(b.name));
  return alerts;
}

export function parseSilenceDismissals(raw: string | undefined | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && DISMISS_ENTRY.test(item)).slice(0, 40);
  } catch {
    return [];
  }
}

export function mergeSilenceDismissals(existing: string[], entry: string): string[] {
  return [entry, ...existing.filter((item) => item !== entry)].slice(0, 40);
}
