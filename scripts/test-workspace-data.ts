import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockSupabase } from './mock-supabase';
import { loadClientPage, loadCalendarDeliverables, loadClientDetail, loadMessages } from '../src/lib/data';
import { loadInvoicePage, loadExpensePage } from '../src/lib/finance';
import { getCalendarRange } from '../src/lib/calendarRange';
import { calendarRangeSchema } from '../src/lib/listValidation';
import { parsePagination } from '../src/lib/pagination';

const client = (id: string, status: string, created: string, name = id) => ({ id, name, status, created_at: created, services: ['Video production'], tags: [], client_assignments: [], client_social_accounts: [] });

test('client pages preserve global stage ordering before slicing', async () => {
  const rows = [client('paused', 'paused', '2026-10-03'), client('starting', 'starting', '2026-10-03'), client('active-a', 'active', '2026-09-01'), client('active-b', 'active', '2026-10-01')];
  const mock = createMockSupabase({ clients: { rows, pageCap: 2 } });
  const result = await loadClientPage(mock.supabase as any, { userRole: 'member', page: 2, pageSize: 2 });
  assert.equal(result.total, 4);
  assert.deepEqual(result.items.map((row) => row.id), ['starting', 'paused']);
  const detailRequests = mock.requests.filter((request) => request.params.get('select')?.includes('client_social_accounts'));
  assert.ok(detailRequests.every((request) => !request.params.get('select')?.includes('client_contracts')));
  assert.ok(detailRequests.every((request) => !request.params.get('id')?.includes('active-a')));
});

test('client service search and export operate over the full roster', async () => {
  const rows = Array.from({ length: 105 }, (_, i) => client(`c-${i}`, 'active', '2026-10-01'));
  const mock = createMockSupabase({ clients: { rows, pageCap: 20 } });
  const result = await loadClientPage(mock.supabase as any, { userRole: 'member', search: 'production', pageSize: 10, fullExport: true });
  assert.equal(result.total, 105);
  assert.equal(result.items.length, 105);
});

test('calendar range includes month overflow days and rejects invalid dates', () => {
  assert.deepEqual(getCalendarRange(new Date(2026, 9, 3)), { from: '2026-09-28', to: '2026-11-02' });
  assert.equal(calendarRangeSchema.safeParse({ from: '2026-02-30', to: '2026-03-01' }).success, false);
  assert.equal(calendarRangeSchema.safeParse({ from: '2026-10-01', to: '2026-09-01' }).success, false);
  assert.throws(() => parsePagination({ page: 0 }));
  assert.throws(() => parsePagination({ pageSize: 10000 }));
});

test('calendar ranges retain either event and creator-scheduling fallback', async () => {
  const rows = [
    { id: 'publish', client_id: 'c1', idea: 'Post', publish_date: '2026-10-01', filming_date: '2026-08-01', creator_assignments: [] },
    { id: 'shoot', client_id: 'c1', idea: 'Shoot', publish_date: '2026-12-01', filming_date: '2026-10-15', creator_assignments: [] },
    { id: 'fallback', client_id: 'c1', idea: 'Legacy', publish_date: null, filming_date: null, creator_assignments: [{ id: 'ca1', scheduled_date: '2026-10-10', creators: { id: 'cr1', name: 'Pat' } }] },
    { id: 'outside', client_id: 'c1', idea: 'Old', publish_date: '2026-09-01', creator_assignments: [] },
    { id: 'end', client_id: 'c1', idea: 'Boundary', publish_date: '2026-11-01', creator_assignments: [] },
  ];
  const mock = createMockSupabase({ deliverables: { rows }, creator_assignments: { rows: [{ id: 'ca1', deliverable_id: 'fallback', scheduled_date: '2026-10-10' }] } });
  const result = await loadCalendarDeliverables(mock.supabase as any, { lightweight: true, from: '2026-10-01', to: '2026-11-01' }, true);
  assert.deepEqual(result.map((row) => row.id).sort(), ['fallback', 'publish', 'shoot']);
});

test('invoice totals cover all rows while payment reads stay on the selected page', async () => {
  const rows = Array.from({ length: 105 }, (_, i) => ({ id: `i-${String(i).padStart(3, '0')}`, number: `INV-${i}`, total: 100, issue_date: '2026-10-01', clients: { name: 'Acme' } }));
  const mock = createMockSupabase({ invoices: { rows, pageCap: 20 }, payments: { rows: [{ invoice_id: 'i-000', amount: 25 }] } });
  const result = await loadInvoicePage(mock.supabase as any, { page: 1, pageSize: 10 });
  assert.equal(result.total, 105);
  assert.equal(result.summary.totalBilled, 10500);
  assert.equal(result.items.length, 10);
  assert.equal(result.items[0].paidAmount, 25);
  assert.ok(mock.requests.filter((request) => request.table === 'payments').every((request) => !request.params.get('invoice_id')?.includes('i-104')));
});

test('expense summary stays global when the visible list is filtered/paginated', async () => {
  const rows = [
    { id: 'e1', date: '2026-10-03', amount: 100, recurring: false, category: 'software' },
    { id: 'e2', date: '2026-10-02', amount: 1200, recurring: true, recurrence: 'yearly', category: 'software' },
    { id: 'e3', date: '2026-10-01', amount: 50, recurring: true, recurrence: 'monthly', category: 'rent' },
  ];
  const mock = createMockSupabase({ expenses: { rows, pageCap: 1 } });
  const result = await loadExpensePage(mock.supabase as any, { page: 1, pageSize: 1, category: 'software' });
  assert.equal(result.total, 2);
  assert.equal(result.items.length, 1);
  assert.equal(result.summary.totalAmount, 1350);
  assert.equal(result.summary.totalCount, 3);
  assert.equal(result.summary.regularMonthlyRunrate, 150);
});

test('client overview avoids chat and full content fields while retaining latest metrics', async () => {
  const mock = createMockSupabase({
    clients: { rows: [client('c1', 'active', '2026-10-01')] },
    deliverables: { rows: [{ id: 'd1', client_id: 'c1', idea: 'Post', publish_date: '2026-10-01', created_at: '2026-10-01', post_metrics: [{ captured_at: '2026-10-01', views: 10 }, { captured_at: '2026-10-02', views: 20 }] }] },
    creator_assignments: { rows: [] }, messages: { rows: [] }, client_health_snapshots: { rows: [] },
  });
  const detail = await loadClientDetail(mock.supabase as any, 'c1', { id: 'u1', name: 'Test', email: '', role: 'member' }, { overview: true });
  assert.equal(detail?.messages.length, 0);
  assert.equal(detail?.deliverables[0].latestMetrics?.views, 20);
  assert.equal(detail?.client.contract, null);
  assert.ok(!mock.requests.some((request) => request.table === 'messages'));
  const request = mock.requests.find((request) => request.table === 'deliverables' && request.params.get('select')?.includes('post_metrics'))!;
  assert.doesNotMatch(request.params.get('select')!, /caption|hook|users!/);
  assert.equal(request.params.get('post_metrics.limit'), '1');
});

test('chat can load recent and older messages without dropping equal-timestamp rows', async () => {
  const rows = Array.from({ length: 150 }, (_, i) => ({ id: String(i).padStart(3, '0'), client_id: 'c1', body: `Message ${i}`, created_at: '2026-10-01T00:00:00.000Z' }));
  const mock = createMockSupabase({ messages: { rows } });
  const recent = await loadMessages(mock.supabase as any, 'c1', null, null, true);
  assert.equal(recent.length, 100);
  assert.equal(recent[0].id, '050');
  const older = await loadMessages(mock.supabase as any, 'c1', null, recent[0].createdAt, false, recent[0].id);
  assert.equal(older.length, 50);
  assert.equal(older[0].id, '000');
  const updates = await loadMessages(mock.supabase as any, 'c1', recent[95].createdAt, null, false, recent[95].id);
  assert.deepEqual(updates.map((message) => message.id), ['146', '147', '148', '149']);
});
