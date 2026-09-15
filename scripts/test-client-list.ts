import test from 'node:test';
import assert from 'node:assert/strict';
import { loadClientListStats, mapDeliverableRow } from '../src/lib/data';
import { computeClientGoalsProgress } from '../src/lib/clientGoals';
import { createMockSupabase, RecordedRequest } from './mock-supabase';
import { ClientData, ClientMonthlyGoals } from '../src/types';

const PACE_SELECT =
  'id, client_id, format, results, status, published, publish_date, scheduled_at, created_at';

function monthFilter(period: string, end: string): string {
  return `(and(publish_date.gte.${period}-01,publish_date.lt.${end}-01),and(publish_date.is.null,scheduled_at.gte.${period}-01T00:00:00Z,scheduled_at.lt.${end}-01T00:00:00Z),and(publish_date.is.null,scheduled_at.is.null,created_at.gte.${period}-01T00:00:00Z,created_at.lt.${end}-01T00:00:00Z))`;
}

function makeClient(id: string, monthlyGoals?: ClientMonthlyGoals): ClientData {
  return {
    id,
    name: `Client ${id}`,
    location: null,
    industry: null,
    website: null,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    startDate: null,
    endDate: null,
    leadSource: null,
    churnReason: null,
    tags: [],
    assetsUrl: null,
    logoUrl: null,
    status: 'active',
    services: [],
    notes: null,
    createdAt: '2025-01-01T00:00:00Z',
    monthlyGoals,
  };
}

function goals(partial: ClientMonthlyGoals): ClientMonthlyGoals {
  return {
    reels: 0,
    posts: 0,
    stories: 0,
    ads: 0,
    other: 0,
    otherLabel: 'Other',
    ...partial,
  };
}

let rowSeq = 0;
function dRow(
  clientId: string,
  fields: {
    format?: string | null;
    results?: string | null;
    status?: string | null;
    published?: boolean | null;
    publish_date?: string | null;
    scheduled_at?: string | null;
    created_at?: string;
  }
) {
  rowSeq += 1;
  return {
    id: `d-${String(rowSeq).padStart(5, '0')}`,
    client_id: clientId,
    format: 'format' in fields ? fields.format ?? null : 'photo',
    results: fields.results ?? null,
    status: fields.status ?? 'published',
    published: fields.published ?? true,
    publish_date: fields.publish_date ?? null,
    scheduled_at: fields.scheduled_at ?? null,
    created_at: fields.created_at ?? '2025-09-05T10:00:00Z',
  };
}

function setup(opts: {
  deliverables?: any[];
  clientCounts?: any[];
  deliverablesError?: any;
  pageCap?: number;
}) {
  const mock = createMockSupabase({
    clients: { rows: opts.clientCounts ?? [] },
    deliverables: {
      rows: opts.deliverables ?? [],
      error: opts.deliverablesError,
      pageCap: opts.pageCap,
    },
  });
  return mock;
}

function countRowsFor(clients: ClientData[], counts?: Record<string, { d: number; m: number }>) {
  return clients.map((c) => ({
    id: c.id,
    deliverables: [{ count: counts?.[c.id]?.d ?? 0 }],
    messages: [{ count: counts?.[c.id]?.m ?? 0 }],
  }));
}

function delivRequests(requests: RecordedRequest[]) {
  return requests.filter((r) => r.table === 'deliverables');
}

test('no goals => hasGoals false and percent 0', async () => {
  const client = makeClient('c1');
  const mock = setup({
    clientCounts: countRowsFor([client]),
    deliverables: [dRow('c1', { publish_date: '2025-09-10' })],
  });
  const [result] = await loadClientListStats(mock.supabase as any, [client], '2025-09');
  assert.equal(result.monthlyPace?.hasGoals, false);
  assert.equal(result.monthlyPace?.percent, 0);
  assert.equal(result.monthlyPace?.target, 0);
});

test('target 2 with 0/1/2/3 published => 0/50/100/100', async () => {
  for (const [n, pct, delivered] of [
    [0, 0, 0],
    [1, 50, 1],
    [2, 100, 2],
    [3, 100, 3],
  ] as const) {
    const client = makeClient('c1', goals({ posts: 2, selectedFormats: ['posts'] }));
    const rows = [0, 1, 2].map((i) =>
      dRow('c1', {
        publish_date: `2025-09-1${i}`,
        published: i < n,
        status: i < n ? 'published' : 'idea',
      })
    );
    const mock = setup({ clientCounts: countRowsFor([client]), deliverables: rows });
    const [result] = await loadClientListStats(mock.supabase as any, [client], '2025-09');
    assert.equal(result.monthlyPace?.delivered, delivered, `published=${n}`);
    assert.equal(result.monthlyPace?.target, 2);
    assert.equal(result.monthlyPace?.percent, pct, `published=${n}`);
    assert.equal(result.monthlyPace?.hasGoals, true);
  }
});

test('monthly query sends null-aware OR filter and light select', async () => {
  const client = makeClient('c1', goals({ posts: 2, selectedFormats: ['posts'] }));
  const mock = setup({ clientCounts: countRowsFor([client]), deliverables: [] });
  await loadClientListStats(mock.supabase as any, [client], '2025-09');
  const reqs = delivRequests(mock.requests);
  assert.equal(reqs.length, 1);
  assert.match(reqs[0].headers.get('prefer') || '', /count=exact/);
  assert.equal(
    reqs[0].params.get('select')!.replace(/\s+/g, ''),
    PACE_SELECT.replace(/\s+/g, '')
  );
  assert.equal(reqs[0].params.get('or'), monthFilter('2025-09', '2025-10'));
  assert.equal(reqs[0].params.get('client_id'), 'in.(c1)');
});

test('unselected format targets excluded; selected-only counts published', async () => {
  const client = makeClient('c1', goals({ posts: 2, reels: 5, selectedFormats: ['posts'] }));
  const rows = [
    dRow('c1', { format: 'reel', publish_date: '2025-09-10' }),
    dRow('c1', { format: 'reel', publish_date: '2025-09-11' }),
    dRow('c1', { format: 'photo', publish_date: '2025-09-12' }),
  ];
  const mock = setup({ clientCounts: countRowsFor([client]), deliverables: rows });
  const [result] = await loadClientListStats(mock.supabase as any, [client], '2025-09');
  assert.equal(result.monthlyPace?.target, 2);
  assert.equal(result.monthlyPace?.delivered, 1);
  assert.equal(result.monthlyPace?.percent, 50);
});

test('photo and carousel both count toward posts target', async () => {
  const client = makeClient('c1', goals({ posts: 2, selectedFormats: ['posts'] }));
  const rows = [
    dRow('c1', { format: 'photo', publish_date: '2025-09-10' }),
    dRow('c1', { format: 'carousel', publish_date: '2025-09-11' }),
  ];
  const mock = setup({ clientCounts: countRowsFor([client]), deliverables: rows });
  const [result] = await loadClientListStats(mock.supabase as any, [client], '2025-09');
  assert.equal(result.monthlyPace?.delivered, 2);
  assert.equal(result.monthlyPace?.percent, 100);
});

test('legacy ad formats normalize: format "ads" and results "[format:ad]" count as ads', async () => {
  for (const variant of [
    { format: 'ads', results: null },
    { format: null, results: '[format:ad] spring campaign' },
  ]) {
    const client = makeClient('c1', goals({ ads: 1, selectedFormats: ['ads'] }));
    const rows = [dRow('c1', { ...variant, publish_date: '2025-09-10' })];
    const mock = setup({ clientCounts: countRowsFor([client]), deliverables: rows });
    const [result] = await loadClientListStats(mock.supabase as any, [client], '2025-09');
    assert.equal(result.monthlyPace?.delivered, 1, JSON.stringify(variant));
    assert.equal(result.monthlyPace?.percent, 100);
  }
});

test('published flag OR published status counts; filmed unpublished does not', async () => {
  const client = makeClient('c1', goals({ posts: 3, selectedFormats: ['posts'] }));
  const rows = [
    dRow('c1', { published: true, status: null, publish_date: '2025-09-10' }),
    dRow('c1', { published: false, status: 'published', publish_date: '2025-09-11' }),
    dRow('c1', { published: false, status: 'filmed', publish_date: '2025-09-12' }),
  ];
  const mock = setup({ clientCounts: countRowsFor([client]), deliverables: rows });
  const [result] = await loadClientListStats(mock.supabase as any, [client], '2025-09');
  assert.equal(result.monthlyPace?.delivered, 2);
});

test('Sep/Oct boundaries are inclusive start, exclusive end', async () => {
  const client = makeClient('c1', goals({ posts: 5, selectedFormats: ['posts'] }));
  const rows = [
    dRow('c1', { publish_date: '2025-09-01' }),
    dRow('c1', { publish_date: '2025-09-30' }),
    dRow('c1', { publish_date: '2025-10-01' }),
    dRow('c1', { publish_date: '2025-08-31' }),
  ];
  const mock = setup({ clientCounts: countRowsFor([client]), deliverables: rows });
  const [result] = await loadClientListStats(mock.supabase as any, [client], '2025-09');
  assert.equal(result.monthlyPace?.delivered, 2);
});

test('Dec/Jan boundary rolls into next year exclusively', async () => {
  const client = makeClient('c1', goals({ posts: 5, selectedFormats: ['posts'] }));
  const rows = [
    dRow('c1', { publish_date: '2025-12-31' }),
    dRow('c1', { publish_date: '2025-12-01' }),
    dRow('c1', { publish_date: '2026-01-01' }),
  ];
  const mock = setup({ clientCounts: countRowsFor([client]), deliverables: rows });
  const [result] = await loadClientListStats(mock.supabase as any, [client], '2025-12');
  assert.equal(result.monthlyPace?.delivered, 2);
  const req = delivRequests(mock.requests)[0];
  assert.equal(req.params.get('or'), monthFilter('2025-12', '2026-01'));
});

test('date precedence: publish > scheduled > created', async () => {
  const client = makeClient('c1', goals({ posts: 10, selectedFormats: ['posts'] }));
  const rows = [
    dRow('c1', { publish_date: '2025-08-05', scheduled_at: '2025-09-10T10:00:00Z' }),
    dRow('c1', { publish_date: null, scheduled_at: '2025-09-10T10:00:00Z' }),
    dRow('c1', { publish_date: null, scheduled_at: '2025-08-10T10:00:00Z', created_at: '2025-09-05T10:00:00Z' }),
    dRow('c1', { publish_date: null, scheduled_at: null, created_at: '2025-09-05T10:00:00Z' }),
    dRow('c1', { publish_date: null, scheduled_at: null, created_at: '2025-08-05T10:00:00Z' }),
  ];
  const mock = setup({ clientCounts: countRowsFor([client]), deliverables: rows });
  const [result] = await loadClientListStats(mock.supabase as any, [client], '2025-09');
  assert.equal(result.monthlyPace?.delivered, 2);
});

test('two clients stay isolated', async () => {
  const c1 = makeClient('c1', goals({ posts: 2, selectedFormats: ['posts'] }));
  const c2 = makeClient('c2', goals({ posts: 2, selectedFormats: ['posts'] }));
  const rows = [
    dRow('c1', { publish_date: '2025-09-10' }),
    dRow('c1', { publish_date: '2025-09-11' }),
    dRow('c2', { publish_date: '2025-09-12' }),
  ];
  const mock = setup({ clientCounts: countRowsFor([c1, c2]), deliverables: rows });
  const results = await loadClientListStats(mock.supabase as any, [c1, c2], '2025-09');
  assert.equal(results[0].monthlyPace?.delivered, 2);
  assert.equal(results[1].monthlyPace?.delivered, 1);
  const req = delivRequests(mock.requests)[0];
  assert.equal(req.params.get('client_id'), 'in.(c1,c2)');
});

test('embedded all-time counts are used, not monthly row length', async () => {
  const client = makeClient('c1', goals({ posts: 2, selectedFormats: ['posts'] }));
  const mock = setup({
    clientCounts: [{ id: 'c1', deliverables: [{ count: 1200 }], messages: [{ count: 1300 }] }],
    deliverables: [
      dRow('c1', { publish_date: '2025-09-10' }),
      dRow('c1', { publish_date: '2025-09-11' }),
    ],
  });
  const [result] = await loadClientListStats(mock.supabase as any, [client], '2025-09');
  assert.equal(result._count?.deliverables, 1200);
  assert.equal(result._count?.messages, 1300);
  assert.equal(result.monthlyPace?.delivered, 2);
});

test('paginates beyond server page cap with deterministic ids', async () => {
  const client = makeClient('c1', goals({ posts: 1001, selectedFormats: ['posts'] }));
  const rows = Array.from({ length: 1001 }, (_, i) =>
    dRow('c1', { publish_date: '2025-09-10' })
  );
  const mock = setup({
    clientCounts: countRowsFor([client], { c1: { d: 1001, m: 0 } }),
    deliverables: rows,
    pageCap: 200,
  });
  const [result] = await loadClientListStats(mock.supabase as any, [client], '2025-09');
  assert.equal(result.monthlyPace?.delivered, 1001);
  assert.equal(result.monthlyPace?.percent, 100);
  const reqs = delivRequests(mock.requests);
  assert.equal(reqs.length, 6, `expected exactly 6 paged requests, got ${reqs.length}`);
  const offsets = reqs.map((r) => r.params.get('offset'));
  assert.deepEqual(offsets, ['0', '200', '400', '600', '800', '1000']);
  assert.match(reqs[0].headers.get('prefer') || '', /count=exact/);
  for (const r of reqs.slice(1)) {
    assert.ok(!/count=/.test(r.headers.get('prefer') || ''), 'later pages must not re-count');
  }
});

test('query errors propagate instead of becoming zeros', async () => {
  const client = makeClient('c1', goals({ posts: 2, selectedFormats: ['posts'] }));
  const mock = setup({
    clientCounts: countRowsFor([client]),
    deliverablesError: { message: 'db exploded', code: 'XX000' },
  });
  await assert.rejects(
    loadClientListStats(mock.supabase as any, [client], '2025-09'),
    (err: any) => err.message === 'db exploded' || err.code === 'XX000'
  );
});

test('empty clients short-circuits with no fetches', async () => {
  const mock = setup({});
  const result = await loadClientListStats(mock.supabase as any, [], '2025-09');
  assert.deepEqual(result, []);
  assert.equal(mock.requests.length, 0);
});

test('invalid period throws before any fetch', async () => {
  const client = makeClient('c1');
  for (const bad of ['abc', '2025-13', '2025', '2025-9']) {
    const mock = setup({ clientCounts: countRowsFor([client]) });
    await assert.rejects(loadClientListStats(mock.supabase as any, [client], bad), /Invalid monthly period/);
    assert.equal(mock.requests.length, 0, bad);
  }
});

test('timestamptz boundaries: Sep1 midnight included, Oct1 midnight excluded (canonical +00:00)', async () => {
  const client = makeClient('c1', goals({ posts: 10, selectedFormats: ['posts'] }));
  const rows = [
    dRow('c1', { publish_date: null, scheduled_at: '2025-09-01T00:00:00.000+00:00' }),
    dRow('c1', { publish_date: null, scheduled_at: '2025-10-01T00:00:00.000+00:00' }),
    dRow('c1', { publish_date: null, scheduled_at: null, created_at: '2025-09-01T00:00:00.000+00:00' }),
    dRow('c1', { publish_date: null, scheduled_at: null, created_at: '2025-10-01T00:00:00.000+00:00' }),
  ];
  const mock = setup({ clientCounts: countRowsFor([client]), deliverables: rows });
  const [result] = await loadClientListStats(mock.supabase as any, [client], '2025-09');
  assert.equal(result.monthlyPace?.delivered, 2);
});

test('list pace matches detail computation on mixed fixtures', async () => {
  const client = makeClient('c1', goals({ posts: 4, reels: 2, selectedFormats: ['posts', 'reels'] }));
  const rows = [
    dRow('c1', { format: 'photo', publish_date: '2025-09-03' }),
    dRow('c1', { format: 'carousel', publish_date: '2025-09-05' }),
    dRow('c1', { format: 'photo', publish_date: null, scheduled_at: '2025-09-20T12:00:00Z' }),
    dRow('c1', { format: 'reel', publish_date: '2025-09-08' }),
    dRow('c1', { format: 'reel', publish_date: '2025-08-28', scheduled_at: '2025-09-02T12:00:00Z' }),
    dRow('c1', { format: 'photo', publish_date: null, scheduled_at: null, created_at: '2025-09-30T23:00:00Z' }),
    dRow('c1', { format: 'reel', published: false, status: 'filmed', publish_date: '2025-09-15' }),
    dRow('c1', { format: 'photo', publish_date: '2025-10-02' }),
  ];
  const mock = setup({ clientCounts: countRowsFor([client]), deliverables: rows });
  const [result] = await loadClientListStats(mock.supabase as any, [client], '2025-09');
  const detail = computeClientGoalsProgress(client, rows.map(mapDeliverableRow), '2025-09');
  assert.equal(result.monthlyPace?.delivered, detail.totalPublished);
  assert.equal(result.monthlyPace?.target, detail.totalTarget);
  assert.equal(result.monthlyPace?.percent, detail.totalPercent);
  assert.equal(result.monthlyPace?.hasGoals, detail.hasGoals);
  assert.equal(result.monthlyPace?.delivered, 5);
  assert.equal(result.monthlyPace?.target, 6);
});

test('counts-query errors propagate', async () => {
  const client = makeClient('c1', goals({ posts: 2, selectedFormats: ['posts'] }));
  const mock = createMockSupabase({
    clients: { rows: [], error: { message: 'counts exploded', code: 'XX000' } },
    deliverables: { rows: [] },
  });
  await assert.rejects(
    loadClientListStats(mock.supabase as any, [client], '2025-09'),
    (err: any) => err.message === 'counts exploded' || err.code === 'XX000'
  );
});

test('101 clients batch in groups of 100 with isolated counts and pace', async () => {
  const clients = Array.from({ length: 101 }, (_, i) =>
    makeClient(`c-${String(i).padStart(3, '0')}`, goals({ posts: 2, selectedFormats: ['posts'] }))
  );
  const counts = clients.map((c, i) => ({
    id: c.id,
    deliverables: [{ count: i }],
    messages: [{ count: i * 2 }],
  }));
  const rows = [
    dRow('c-000', { publish_date: '2025-09-10' }),
    dRow('c-000', { publish_date: '2025-09-11' }),
    dRow('c-100', { publish_date: '2025-09-12' }),
  ];
  const mock = setup({ clientCounts: counts, deliverables: rows });
  const results = await loadClientListStats(mock.supabase as any, clients, '2025-09');
  assert.equal(results.length, 101);
  for (let i = 0; i < 101; i++) {
    assert.equal(results[i]._count?.deliverables, i, `counts c-${i}`);
    assert.equal(results[i]._count?.messages, i * 2);
  }
  assert.equal(results[0].monthlyPace?.delivered, 2);
  assert.equal(results[100].monthlyPace?.delivered, 1);
  assert.equal(results[50].monthlyPace?.delivered, 0);
  const delivReqs = delivRequests(mock.requests);
  const clientReqs = mock.requests.filter((r) => r.table === 'clients');
  assert.deepEqual(
    delivReqs.map((r) => r.params.get('client_id')?.startsWith('in.(c-0')),
    [true, false]
  );
  assert.equal(clientReqs.length, 2);
});
