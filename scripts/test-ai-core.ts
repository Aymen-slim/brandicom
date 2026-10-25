import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ActionSchema,
  ADMIN_ACTIONS,
  UndoActionSchema,
  deliverableStatusFlags,
  isLowRiskAction,
} from '../src/lib/ai/actions';
import { extractJson } from '../src/lib/ai/runtime';
import { parseIdeasPayload } from '../src/lib/ai/ideas';
import { actionTitle, proposalStatusLabel } from '../src/lib/ai/actionDisplay';
import { toolDeclarations } from '../src/lib/ai/toolDeclarations';
import { systemPrompt } from '../src/lib/ai/prompt';
import { snapshotUsage } from '../src/lib/ai/usage';
import { memberHealthSummary, memberSafeHealthFactors } from '../src/lib/healthPrivacy';

test('action schema accepts a valid create_client and strips unknown fields', () => {
  const parsed = ActionSchema.parse({
    type: 'create_client',
    name: 'Acme Studio',
    industry: 'Fashion',
    services: ['Content', 'Ads'],
    monthlyFee: 2200,
    unknownField: 'must not survive',
  });

  assert.equal(parsed.type, 'create_client');
  assert.equal(parsed.name, 'Acme Studio');
  assert.equal('unknownField' in (parsed as any), false);
});

test('action schema rejects invalid statuses and missing client ids', () => {
  assert.equal(
    ActionSchema.safeParse({ type: 'update_deliverable_status', deliverableId: 'not-a-uuid', status: 'published' }).success,
    false
  );
  assert.equal(
    ActionSchema.safeParse({
      type: 'create_deliverable',
      clientId: '11111111-1111-4111-8111-111111111111',
      idea: 'Launch reel',
      status: 'made-up',
    }).success,
    false
  );
});

test('low-risk action policy only covers reversible deliverable changes', () => {
  assert.equal(isLowRiskAction('create_deliverable'), true);
  assert.equal(isLowRiskAction('update_deliverable_status'), true);
  assert.equal(isLowRiskAction('create_client'), false);
  assert.equal(isLowRiskAction('create_invoice'), false);
  assert.equal(ADMIN_ACTIONS.has('create_invoice'), true);
});

test('deliverable status flags stay aligned so analytics and undo agree', () => {
  assert.deepEqual(deliverableStatusFlags('idea'), { filmed: false, published: false });
  assert.deepEqual(deliverableStatusFlags('filmed'), { filmed: true, published: false });
  assert.deepEqual(deliverableStatusFlags('editing'), { filmed: true, published: false });
  assert.deepEqual(deliverableStatusFlags('published'), { filmed: true, published: true });
});

test('undo schema accepts only known reversible operations', () => {
  const parsed = UndoActionSchema.parse({
    type: 'restore_deliverable_status',
    deliverableId: '11111111-1111-4111-8111-111111111111',
    previousStatus: 'idea',
  });
  assert.equal(parsed.type, 'restore_deliverable_status');
  if (parsed.type === 'restore_deliverable_status') {
    assert.equal(parsed.previousStatus, 'idea');
  }
  assert.equal(
    UndoActionSchema.safeParse({
      type: 'delete_client',
      deliverableId: '11111111-1111-4111-8111-111111111111',
    }).success,
    false
  );
});

test('extractJson handles fenced JSON amid prose', () => {
  const parsed = extractJson('Here you go:\n```json\n{"ok": true, "items": [1,2]}\n```\nDone.');
  assert.deepEqual(parsed, { ok: true, items: [1, 2] });
});

test('parseIdeasPayload normalizes model field names and limits to eight', () => {
  const ideas = parseIdeasPayload({
    ideas: Array.from({ length: 10 }, (_, index) => ({
      title: `Idea ${index + 1}`,
      hook: 'Hook',
      format: index % 2 === 0 ? 'reel' : 'unknown',
      platform: index % 3 === 0 ? 'tiktok' : 'unknown',
      why_it_fits: 'Because the audience engages with this format.',
      script_outline: 'Shot 1\nShot 2',
    })),
  });

  assert.equal(ideas.length, 8);
  assert.equal(ideas[0].format, 'reel');
  assert.equal(ideas[1].format, 'reel');
  assert.equal(ideas[0].platform, 'tiktok');
  assert.equal(ideas[1].platform, 'instagram');
  assert.equal(ideas[0].whyItFits.includes('audience'), true);
  assert.equal(ideas[0].scriptOutline, 'Shot 1\nShot 2');
});

test('proposal display labels are human readable', () => {
  assert.match(actionTitle({ type: 'create_client', name: 'Acme' }), /Acme/);
  assert.match(actionTitle({ type: 'update_deliverable_status', status: 'published' }), /published/);
  assert.equal(proposalStatusLabel({ autoApplied: true }), 'Applied automatically');
  assert.equal(proposalStatusLabel({ status: 'pending', needsConfirmation: true }), 'Needs your confirmation');
  assert.equal(proposalStatusLabel({ status: 'reverted' }), 'Undone');
});

test('tool declarations gate finance tools and admin actions', () => {
  const memberTools = toolDeclarations(false);
  const adminTools = toolDeclarations(true);
  const memberNames = memberTools.map((entry) => entry.name);
  const adminNames = adminTools.map((entry) => entry.name);

  assert.equal(memberNames.includes('propose_changes'), true);
  assert.equal(memberNames.includes('get_finance_summary'), false);
  assert.equal(adminNames.includes('get_finance_summary'), true);
  assert.equal(adminNames.includes('get_contact_submissions'), true);

  const memberProposal = memberTools.find((entry) => entry.name === 'propose_changes') as any;
  const adminProposal = adminTools.find((entry) => entry.name === 'propose_changes') as any;
  const memberTypes = memberProposal.parameters.properties.actions.items.properties.type.enum;
  const adminTypes = adminProposal.parameters.properties.actions.items.properties.type.enum;

  assert.equal(memberTypes.includes('create_deliverable'), true);
  assert.equal(memberTypes.includes('create_invoice'), false);
  assert.equal(memberTypes.includes('upsert_goal'), false);
  assert.equal(adminTypes.includes('create_invoice'), true);
  assert.equal(adminTypes.includes('upsert_goal'), true);
});

test('member health redaction removes invoice factors from read payloads', () => {
  const source = {
    engagementDrop: 12,
    unpublishedBacklog: 2,
    overdueInvoices: 3,
    contractEndingSoon: true,
  };
  const safe = memberSafeHealthFactors(source);

  assert.equal('overdueInvoices' in safe, false);
  assert.equal(safe.engagementDrop, 12);
  assert.equal(safe.contractEndingSoon, true);
  assert.equal(source.overdueInvoices, 3);
  assert.deepEqual(memberSafeHealthFactors(null), {});

  const summary = memberHealthSummary({ score: 55, risk: 'high' }, 'Acme');
  assert.match(summary, /Acme/);
  assert.match(summary, /55\/100/);
  assert.doesNotMatch(summary, /invoice|overdue|fee|revenue|profit/i);
});

test('system prompt defaults to English and explains auto-apply with undo', () => {
  const prompt = systemPrompt(
    { id: '11111111-1111-4111-8111-111111111111', name: 'Aymen', email: 'a@example.com', role: 'admin' },
    { page: '/clients/11111111-1111-4111-8111-111111111111' }
  );

  assert.match(prompt, /English by default/);
  assert.match(prompt, /autoApplied=true/);
  assert.match(prompt, /Undo is available/);
  assert.match(prompt, /Never invent/);
});

test('usage snapshots never go negative', () => {
  const snapshot = snapshotUsage(12, 10);
  assert.equal(snapshot.used, 12);
  assert.equal(snapshot.remaining, 0);
  assert.equal(snapshot.limit, 10);
});
