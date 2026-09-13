/**
 * Utility functions for storing, calculating, and retrieving
 * month-by-month follower history and month-over-month follower gains.
 *
 * Stored safely in clients.tags as:
 * f_month:YYYY-MM:<URI_ENCODED_JSON>
 */

export interface MonthFollowerSnapshot {
  month: string; // 'YYYY-MM'
  instagram: number | null;
  tiktok: number | null;
  total: number;
  gainFromPrevMonth: number | null;
  gainPct: number | null;
  igGain: number | null;
  ttGain: number | null;
  prevMonth: string | null;
  prevTotal: number | null;
  updatedAt: string;
  source?: 'sync' | 'manual' | 'baseline';
}

/**
 * Returns previous calendar month in YYYY-MM format.
 * E.g., '2026-09' -> '2026-08', '2026-01' -> '2025-12'
 */
export function getPreviousMonth(monthStr: string): string {
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    return now.toISOString().slice(0, 7);
  }
  const [year, month] = monthStr.split('-').map(Number);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  const prevMonth = month - 1;
  return `${year}-${prevMonth < 10 ? '0' : ''}${prevMonth}`;
}

/**
 * Parses a single f_month tag into a MonthFollowerSnapshot.
 */
export function parseFollowerMonthTag(tag: string): MonthFollowerSnapshot | null {
  if (typeof tag !== 'string' || !tag.startsWith('f_month:')) return null;
  const rest = tag.slice('f_month:'.length);
  const colonIdx = rest.indexOf(':');
  if (colonIdx === -1) return null;

  const month = rest.slice(0, colonIdx);
  const rawPayload = rest.slice(colonIdx + 1);

  try {
    const json = JSON.parse(decodeURIComponent(rawPayload));
    const ig = typeof json.ig === 'number' ? json.ig : null;
    const tt = typeof json.tt === 'number' ? json.tt : null;
    const total = typeof json.total === 'number' ? json.total : ((ig || 0) + (tt || 0));

    return {
      month,
      instagram: ig,
      tiktok: tt,
      total,
      gainFromPrevMonth: typeof json.gain === 'number' ? json.gain : null,
      gainPct: typeof json.gainPct === 'number' ? json.gainPct : null,
      igGain: typeof json.igGain === 'number' ? json.igGain : null,
      ttGain: typeof json.ttGain === 'number' ? json.ttGain : null,
      prevMonth: json.prevM || null,
      prevTotal: typeof json.prevTot === 'number' ? json.prevTot : null,
      updatedAt: json.date || new Date().toISOString(),
      source: json.src || 'sync',
    };
  } catch {
    return null;
  }
}

/**
 * Serializes a MonthFollowerSnapshot into a tag string.
 */
export function serializeFollowerMonthTag(snapshot: MonthFollowerSnapshot): string {
  const payload = {
    ig: snapshot.instagram,
    tt: snapshot.tiktok,
    total: snapshot.total,
    gain: snapshot.gainFromPrevMonth,
    gainPct: snapshot.gainPct,
    igGain: snapshot.igGain,
    ttGain: snapshot.ttGain,
    prevM: snapshot.prevMonth,
    prevTot: snapshot.prevTotal,
    date: snapshot.updatedAt,
    src: snapshot.source || 'sync',
  };
  return `f_month:${snapshot.month}:${encodeURIComponent(JSON.stringify(payload))}`;
}

/**
 * Adds or updates a follower snapshot for a month in the tags array.
 */
export function packClientFollowerMonthTag(
  existingTags: string[] = [],
  snapshot: MonthFollowerSnapshot
): string[] {
  const prefix = `f_month:${snapshot.month}:`;
  const filtered = existingTags.filter(
    (t) => typeof t === 'string' && !t.startsWith(prefix)
  );
  filtered.push(serializeFollowerMonthTag(snapshot));
  return filtered;
}

/**
 * Extracts and reconstructs the complete chronological monthly follower history
 * for a client, calculating month-over-month gains.
 */
export function extractClientFollowerHistory(
  tags: string[] = [],
  initialIg?: number | null,
  initialTt?: number | null,
  startDate?: string | null
): MonthFollowerSnapshot[] {
  const snapshots: MonthFollowerSnapshot[] = [];

  for (const tag of tags) {
    const parsed = parseFollowerMonthTag(tag);
    if (parsed) {
      snapshots.push(parsed);
    }
  }

  // Sort ascending by month
  snapshots.sort((a, b) => a.month.localeCompare(b.month));

  // Determine starting baseline info
  const hasBaseline = (initialIg != null && initialIg > 0) || (initialTt != null && initialTt > 0);
  const baselineTotal = (initialIg || 0) + (initialTt || 0);
  const baselineMonth = startDate ? startDate.slice(0, 7) : null;

  // Recalculate / reconcile month-over-month gains sequentially
  for (let i = 0; i < snapshots.length; i++) {
    const current = snapshots[i];
    let prevTotal: number | null = null;
    let prevMonth: string | null = null;
    let prevIg: number | null = null;
    let prevTt: number | null = null;

    if (i > 0) {
      const prev = snapshots[i - 1];
      prevTotal = prev.total;
      prevMonth = prev.month;
      prevIg = prev.instagram;
      prevTt = prev.tiktok;
    } else if (hasBaseline) {
      // First recorded month compares to contract starting baseline
      prevTotal = baselineTotal;
      prevMonth = baselineMonth || 'Baseline';
      prevIg = initialIg ?? null;
      prevTt = initialTt ?? null;
    }

    if (prevTotal != null) {
      current.prevTotal = prevTotal;
      current.prevMonth = prevMonth;
      current.gainFromPrevMonth = current.total - prevTotal;
      current.gainPct = prevTotal > 0 ? (current.gainFromPrevMonth / prevTotal) * 100 : 0;
      current.igGain = (current.instagram != null && prevIg != null) ? current.instagram - prevIg : null;
      current.ttGain = (current.tiktok != null && prevTt != null) ? current.tiktok - prevTt : null;
    }
  }

  return snapshots;
}
