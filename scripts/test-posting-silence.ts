import test from 'node:test';
import assert from 'node:assert/strict';
import {
  daysBetween,
  mergeSilenceDismissals,
  parseSilenceDismissals,
  selectSilentClients,
  shiftDateKey,
  SilenceClientInput,
  SilencePostInput,
} from '../src/lib/postingSilence';

const TODAY = '2026-10-10';
const CLIENT = '11111111-1111-4111-8111-111111111111';

const client = (overrides: Partial<SilenceClientInput> = {}): SilenceClientInput => ({
  id: CLIENT,
  name: 'Acme',
  logoUrl: null,
  startDate: '2026-01-01',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const post = (overrides: Partial<SilencePostInput> = {}): SilencePostInput => ({
  clientId: CLIENT,
  published: true,
  status: 'published',
  publishDate: '2026-10-01',
  createdAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

test('silence cutoff is more than six days and ignores unpublished work', () => {
  assert.equal(shiftDateKey('2026-10-01', -6), '2026-09-25');
  assert.equal(daysBetween('2026-10-03', TODAY), 7);
  const quiet = selectSilentClients([client()], [post({ publishDate: '2026-10-03' })], TODAY, new Set());
  assert.equal(quiet.length, 1);
  assert.equal(quiet[0].daysSilent, 7);
  assert.equal(quiet[0].gapKey, '2026-10-03');

  const recent = selectSilentClients([client()], [post({ publishDate: '2026-10-04' })], TODAY, new Set());
  assert.equal(recent.length, 0);

  const draft = selectSilentClients(
    [client()],
    [post({ published: false, status: 'scheduled', publishDate: '2026-10-09' })],
    TODAY,
    new Set()
  );
  assert.equal(draft[0].neverPosted, true);
});

test('a brand-new client is not alerted, and a closed gap stays closed until the last post changes', () => {
  const fresh = selectSilentClients(
    [client({ startDate: null, createdAt: '2026-10-06T00:00:00.000Z' })],
    [],
    TODAY,
    new Set()
  );
  assert.equal(fresh.length, 0);

  const never = selectSilentClients(
    [client({ id: CLIENT, startDate: null, createdAt: '2026-09-01T00:00:00.000Z' })],
    [],
    TODAY,
    new Set()
  );
  assert.equal(never[0].gapKey, 'none');
  assert.equal(never[0].neverPosted, true);

  const hidden = selectSilentClients([client()], [post({ publishDate: '2026-10-01' })], TODAY, new Set([`${CLIENT}:2026-10-01`]));
  assert.equal(hidden.length, 0);

  const nextGap = selectSilentClients([client()], [post({ publishDate: '2026-09-20' })], TODAY, new Set([`${CLIENT}:none`]));
  assert.equal(nextGap.length, 1);
  assert.equal(nextGap[0].gapKey, '2026-09-20');
});

test('future publish dates and status-only publishes are handled, and dismissal cookies stay strict', () => {
  const future = selectSilentClients([client()], [post({ publishDate: '2026-10-20' })], TODAY, new Set());
  assert.equal(future[0].neverPosted, true);

  const statusOnly = selectSilentClients(
    [client()],
    [post({ published: false, status: 'published', publishDate: '2026-10-09' })],
    TODAY,
    new Set()
  );
  assert.equal(statusOnly.length, 0);

  const laterStart = selectSilentClients([client({ startDate: '2026-10-08', createdAt: '2026-01-01T00:00:00.000Z' })], [], TODAY, new Set());
  assert.equal(laterStart.length, 0);

  const raw = JSON.stringify([`${CLIENT}:none`, 'not-an-entry', 12]);
  assert.deepEqual(parseSilenceDismissals(raw), [`${CLIENT}:none`]);
  assert.deepEqual(parseSilenceDismissals('{'), []);
  assert.deepEqual(mergeSilenceDismissals([`${CLIENT}:none`], `${CLIENT}:2026-10-01`)[0], `${CLIENT}:2026-10-01`);
});
