import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { shouldSyncListFilters } from '../src/lib/workspaceEvents';

const source = (path: string) => readFileSync(resolve(path), 'utf8');
const workspace = 'src/app/(workspace)';
const pages = ['dashboard', 'clients', 'clients/[id]', 'calendar', 'partners', 'settings', 'leads', 'blog', 'finance', 'finance/invoices', 'finance/invoices/[id]', 'finance/expenses'];

test('authenticated routes share one persistent shell', () => {
  assert.ok(existsSync(resolve(`${workspace}/layout.tsx`)), 'Missing shared workspace layout');
  const layout = source(`${workspace}/layout.tsx`);
  assert.match(layout, /getSessionUser/);
  assert.match(layout, /<AppShell/);
  for (const page of pages) {
    const content = source(`${workspace}/${page}/page.tsx`);
    assert.doesNotMatch(content, /<AppShell\b/, page);
    assert.match(content, /<PageChrome\b/, page);
  }
});

test('pending pages never replace the sidebar or header', () => {
  const loading = source('src/components/RouteLoading.tsx');
  assert.doesNotMatch(loading, /<aside|<header|app-container|main-content|<main/);
  assert.match(loading, /aria-busy/);
});

test('standalone documents and login stay outside the workspace', () => {
  for (const path of ['login', 'clients/[id]/reports/[month]', 'finance/invoices/[id]/print']) {
    assert.ok(existsSync(resolve(`src/app/${path}/page.tsx`)), path);
    assert.ok(!existsSync(resolve(`${workspace}/${path}/page.tsx`)), path);
  }
});

test('authenticated shortcuts belong to the workspace, not the public root', () => {
  const root = source('src/app/layout.tsx');
  assert.doesNotMatch(root, /<CommandSearch|<AppChrome/);
  const shell = source('src/components/AppShell.tsx');
  assert.match(shell, /<CommandSearch/);
  assert.match(shell, /<AppChrome/);
  assert.doesNotMatch(shell, /key=\{pathname\}/);
});

test('private data is not stored in a global notification cache', () => {
  const notifier = source('src/components/AdminPostingNotifier.tsx');
  assert.doesNotMatch(notifier, /alertCache|ALERT_TTL/);
  assert.match(notifier, /AbortController/);
  assert.match(notifier, /user\?\.id/);
  assert.match(source('src/lib/supabase/server.ts'), /cache: 'no-store'/);
});

test('delayed filter responses preserve newer drafts while history navigation can reset them', () => {
  assert.equal(shouldSyncListFilters('old', 'new draft', 'completed request'), false);
  assert.equal(shouldSyncListFilters('old', 'old', 'server change'), true);
  assert.equal(shouldSyncListFilters('same', 'same', 'same'), false);
  assert.equal(shouldSyncListFilters('old', 'new draft', 'history value', true), true);
});
