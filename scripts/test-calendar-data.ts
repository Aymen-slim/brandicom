import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadCalendarDeliverables,
  getCalendarDeliverableSelect,
  CALENDAR_DELIVERABLE_SELECT,
} from '../src/lib/data';
import { createMockSupabase, RecordedRequest } from './mock-supabase';

let seq = 0;
function calRow(fields: Record<string, any> = {}) {
  seq += 1;
  return {
    id: `e-${String(seq).padStart(5, '0')}`,
    client_id: 'c1',
    idea: `Idea ${seq}`,
    title: null,
    filmed: false,
    published: false,
    status: 'idea',
    link: null,
    format: 'reel',
    platform: 'instagram',
    results: null,
    publish_date: null,
    scheduled_at: null,
    publish_time: null,
    filming_date: null,
    created_by: null,
    created_at: `2025-09-${String((seq % 28) + 1).padStart(2, '0')}T10:00:00Z`,
    creator_assignments: [],
    clients: { id: 'c1', name: 'Acme' },
    ...fields,
  };
}

function setup(opts: {
  rows?: any[];
  pageCap?: number;
  failIf?: (params: URLSearchParams) => string | null;
}) {
  return createMockSupabase({
    deliverables: { rows: opts.rows ?? [], pageCap: opts.pageCap, failIf: opts.failIf },
  });
}

test('lightweight select omits metrics/author/caption/hook/thumbnail', async () => {
  const mock = setup({ rows: [calRow()] });
  await loadCalendarDeliverables(mock.supabase as any, { lightweight: true }, true);
  const select = mock.requests[0].params.get('select')!.replace(/\s+/g, '');
  assert.ok(!select.includes('post_metrics'), select);
  assert.ok(!select.includes('users!'), select);
  assert.ok(!select.includes('caption'), select);
  assert.ok(!select.includes('hook'), select);
  assert.ok(!select.includes('thumbnail_url'), select);
  assert.ok(select.includes('creator_assignments'), select);
  assert.ok(select.includes('clients(id,name)'), select);
  assert.ok(select.includes('filming_date'), select);
  assert.ok(select.includes('publish_time'), select);
  const mapped = await loadCalendarDeliverables(mock.supabase as any, { lightweight: true }, true);
  assert.equal(mapped[0].author, null);
  assert.equal(mapped[0].latestMetrics, null);
  assert.equal(mapped[0].clientName, 'Acme');
});

test('full path keeps the existing select contract', async () => {
  const mock = setup({ rows: [calRow()] });
  await loadCalendarDeliverables(mock.supabase as any, {}, true);
  const req = mock.requests[0];
  assert.equal(
    req.params.get('select')!.replace(/\s+/g, ''),
    CALENDAR_DELIVERABLE_SELECT.replace(/\s+/g, '')
  );
  assert.ok(req.params.get('select')!.includes('post_metrics'));
  assert.ok(req.params.get('select')!.includes('users!'));
  assert.equal(req.params.get('limit'), null);
  assert.equal(req.params.get('offset'), null);
});

test('legacy format/links normalization still applies on lightweight rows', async () => {
  const rows = [
    calRow({ format: 'ads' }),
    calRow({ format: null, results: '[format:ad] spring push' }),
    calRow({
      link: '{"platform":"both","instagram":"https://instagram.com/p/abc","tiktok":"https://tiktok.com/@x/video/1"}',
      platform: null,
    }),
  ];
  const mock = setup({ rows });
  const result = await loadCalendarDeliverables(mock.supabase as any, { lightweight: true }, true);
  const byId = new Map(result.map((r) => [r.id, r]));
  const legacyAds = byId.get(rows[0].id)!;
  const taggedAd = byId.get(rows[1].id)!;
  const bothLinks = byId.get(rows[2].id)!;
  assert.equal(legacyAds.format, 'ad');
  assert.equal(taggedAd.format, 'ad');
  assert.equal(taggedAd.results, 'spring push');
  assert.equal(bothLinks.platform, 'both');
  assert.equal(bothLinks.instagramLink, 'https://instagram.com/p/abc');
  assert.equal(bothLinks.tiktokLink, 'https://tiktok.com/@x/video/1');
});

test('filming date falls back to creator assignment scheduled_date', async () => {
  const rows = [
    calRow({
      creator_assignments: [
        { id: 'ca1', scheduled_date: '2025-09-05', status: 'booked', creators: { id: 'cr1', name: 'Nina', role: 'ugc' } },
      ],
    }),
  ];
  const mock = setup({ rows });
  const result = await loadCalendarDeliverables(mock.supabase as any, { lightweight: true }, false);
  const select = mock.requests[0].params.get('select')!;
  assert.ok(!select.includes('filming_date'), select);
  assert.equal(result[0].filmingDate, '2025-09-05');
  assert.equal(result[0].creatorAssignments?.[0].creator.name, 'Nina');
});

test('client filter is applied via client_id eq', async () => {
  const rows = [calRow({ client_id: 'c1' }), calRow({ client_id: 'c2' })];
  const mock = setup({ rows });
  const result = await loadCalendarDeliverables(mock.supabase as any, { clientId: 'c1', lightweight: true }, true);
  assert.equal(mock.requests[0].params.get('client_id'), 'eq.c1');
  assert.equal(result.length, 1);
  assert.equal(result[0].clientId, 'c1');
});

test('lightweight pagination beyond 1000 rows under a 200-row cap', async () => {
  const rows = Array.from({ length: 1001 }, () => calRow());
  const mock = setup({ rows, pageCap: 200 });
  const result = await loadCalendarDeliverables(mock.supabase as any, { lightweight: true }, true);
  assert.equal(result.length, 1001);
  const reqs = mock.requests.filter((r) => r.table === 'deliverables');
  assert.equal(reqs.length, 6, `expected exactly 6 paged requests, got ${reqs.length}`);
  assert.deepEqual(
    reqs.map((r) => r.params.get('offset')),
    ['0', '200', '400', '600', '800', '1000']
  );
  assert.equal(reqs[0].params.get('order'), 'created_at.desc,id.asc');
  assert.match(reqs[0].headers.get('prefer') || '', /count=exact/);
  for (const r of reqs.slice(1)) {
    assert.ok(!/count=/.test(r.headers.get('prefer') || ''), 'later pages must not re-count');
  }
});

test('error on filming-date select retries with base select', async () => {
  const mock = setup({
    rows: [calRow()],
    failIf: (params) =>
      params.get('select')?.includes('filming_date') ? 'column deliverables.filming_date does not exist' : null,
  });
  const result = await loadCalendarDeliverables(mock.supabase as any, { lightweight: true }, true);
  assert.equal(result.length, 1);
  assert.ok(mock.requests[0].params.get('select')!.includes('filming_date'));
  const retry = mock.requests[1].params.get('select')!.replace(/\s+/g, '');
  assert.ok(!retry.includes('filming_date'));
  assert.ok(!retry.includes('publish_time'));
  assert.equal(retry, getCalendarDeliverableSelect(false, true).replace(/\s+/g, ''));
});

test('errors propagate when the retry also fails', async () => {
  const mock = setup({
    failIf: () => 'always broken',
  });
  await assert.rejects(
    loadCalendarDeliverables(mock.supabase as any, { lightweight: true }, true),
    (err: any) => err.message === 'always broken'
  );
});
