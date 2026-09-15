import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface RecordedRequest {
  table: string;
  params: URLSearchParams;
  headers: Headers;
  method: string;
}

interface TableHandler {
  rows: any[];
  pageCap?: number;
  status?: number;
  error?: any;
  failIf?: (params: URLSearchParams) => string | null;
}

function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '{') depth++;
    if (ch === ')' || ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim() !== '') parts.push(cur);
  return parts;
}

const TIMESTAMPTZ_COLS = new Set(['scheduled_at', 'created_at']);

function matchCondition(row: any, cond: string): boolean {
  const dot1 = cond.indexOf('.');
  if (dot1 < 0) throw new Error(`unsupported condition ${cond}`);
  const col = cond.slice(0, dot1);
  const rest = cond.slice(dot1 + 1);
  const dot2 = rest.indexOf('.');
  const op = dot2 < 0 ? rest : rest.slice(0, dot2);
  const rawVal = dot2 < 0 ? '' : rest.slice(dot2 + 1);
  const cell = row[col];
  const compare = (): number => {
    if (TIMESTAMPTZ_COLS.has(col)) {
      return Date.parse(String(cell)) - Date.parse(rawVal);
    }
    const a = String(cell);
    return a < rawVal ? -1 : a > rawVal ? 1 : 0;
  };
  switch (op) {
    case 'is':
      if (rawVal === 'null') return cell === null || cell === undefined;
      if (rawVal === 'true') return cell === true;
      if (rawVal === 'false') return cell === false;
      return cell === rawVal;
    case 'eq':
      if (rawVal === 'null') return cell === null || cell === undefined;
      if (rawVal === 'true') return cell === true;
      if (rawVal === 'false') return cell === false;
      return cell != null && String(cell) === rawVal;
    case 'gte':
      return cell != null && compare() >= 0;
    case 'gt':
      return cell != null && compare() > 0;
    case 'lt':
      return cell != null && compare() < 0;
    case 'lte':
      return cell != null && compare() <= 0;
    case 'in': {
      const inner = rawVal.replace(/^\(/, '').replace(/\)$/, '');
      const list = inner.split(',').map((v) => v.replace(/^"|"$/g, ''));
      return list.includes(String(cell));
    }
    default:
      throw new Error(`unsupported operator ${op} in ${cond}`);
  }
}

function matchOr(row: any, orParam: string): boolean {
  let s = orParam.trim();
  if (s.startsWith('(') && s.endsWith(')')) s = s.slice(1, -1);
  return splitTopLevel(s).some((term) => {
    const t = term.trim();
    if (t.startsWith('and(') && t.endsWith(')')) {
      return splitTopLevel(t.slice(4, -1)).every((c) => matchCondition(row, c.trim()));
    }
    return matchCondition(row, t);
  });
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset']);

function applyFilters(rows: any[], params: URLSearchParams): any[] {
  let out = rows;
  const keys = Array.from(new Set(Array.from(params.keys())));
  for (const key of keys) {
    const value = params.get(key)!;
    if (RESERVED.has(key)) continue;
    if (key === 'or' || key.endsWith('.or')) {
      out = out.filter((row) => matchOr(row, value));
      continue;
    }
    out = out.filter((row) => matchCondition(row, `${key}.${value}`));
  }
  return out;
}

function applyOrder(rows: any[], orderParam: string | null): any[] {
  if (!orderParam) return rows;
  const keys = splitTopLevel(orderParam).map((k) => {
    const parts = k.trim().split('.');
    return { col: parts[0], asc: parts[1] !== 'desc' };
  });
  return [...rows].sort((a, b) => {
    for (const { col, asc } of keys) {
      const av = a[col] == null ? '' : String(a[col]);
      const bv = b[col] == null ? '' : String(b[col]);
      if (av !== bv) return asc ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    }
    return 0;
  });
}

export function createMockSupabase(tables: Record<string, TableHandler>) {
  const requests: RecordedRequest[] = [];

  const fetchImpl = async (input: any, init?: any): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const table = decodeURIComponent(url.pathname.replace(/^\/rest\/v1\//, '').replace(/\/$/, ''));
    const params = new URLSearchParams(url.search);
    const headers = new Headers(init?.headers);
    requests.push({ table, params, headers, method: init?.method || 'GET' });

    const handler = tables[table];
    if (!handler) {
      return new Response(JSON.stringify({ message: `unknown table ${table}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (handler.error) {
      return new Response(JSON.stringify(handler.error), {
        status: handler.status || 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (handler.failIf) {
      const reason = handler.failIf(params);
      if (reason) {
        return new Response(JSON.stringify({ message: reason, code: '42703' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const filtered = applyFilters(handler.rows, params);
    const ordered = applyOrder(filtered, params.get('order'));

    const offset = params.has('offset') ? parseInt(params.get('offset')!, 10) : 0;
    let limit = params.has('limit') ? parseInt(params.get('limit')!, 10) : ordered.length - offset;
    if (handler.pageCap !== undefined) limit = Math.min(limit, handler.pageCap);
    const page = ordered.slice(offset, offset + limit);

    const wantsCount = /count=(exact|planned|estimated)/.test(headers.get('prefer') || '');
    const rangePrefix = page.length === 0 ? '*' : `${offset}-${offset + page.length - 1}`;
    const contentRange = `${rangePrefix}/${wantsCount ? filtered.length : '*'}`;

    return new Response(JSON.stringify(page), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Content-Range': contentRange },
    });
  };

  const supabase = createClient('http://mock-supabase.local', 'test-anon-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchImpl },
  });

  return { supabase: supabase as unknown as SupabaseClient, requests };
}
