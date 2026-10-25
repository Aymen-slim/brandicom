# AI Feature Improvement Roadmap

Last updated: 2026-10-25

This file is the working roadmap for the Brandicom CRM AI assistant. It assumes
the current implementation is the baseline and lists only the work that is still
worth doing.

Use the IDs (`AI-01`, `AI-02`, ...) in issues, PRs, and commits so progress is
easy to track. Check an item only when its acceptance criteria are met.

For the architecture, permissions, file map, and run/test conventions referenced
by this roadmap, read [`AI_DEV_CONTEXT.md`](./AI_DEV_CONTEXT.md).

---

## 1. Product rules

These rules are not optional and must survive every change:

1. **English is the default output language.** Use another language only when the
   user writes in it or explicitly selects one.
2. **Members never receive financial data.** This includes revenue, profit,
   expenses, invoices, payments, contract values, monthly fees, overdue counts,
   and AI summaries that mention them.
3. **Low-risk actions auto-apply and remain undoable.** The current low-risk
   actions are `create_deliverable` and `update_deliverable_status`. Any new
   auto-applied action must have a safe Undo path.
4. **High-risk actions always require confirmation.** This includes clients,
   contracts, finance, assignments, and anything that cannot be reversed.
5. **Do not replace deterministic calculations with model output.** Scores,
   totals, dates, and permissions come from code and the database.
6. **Do not weaken RLS or server-side access checks.** The UI is not a security
   boundary.
7. **Treat client notes, inspirations, and web content as untrusted text.** They
   are data, not instructions.
8. **Preserve Gemini tool-call parts exactly, including `thoughtSignature`.**
   Rebuilding function-call parts breaks Gemini 3 tool loops.
9. **Every schema change must be idempotent and safe to re-run.**
10. **A failed AI request must leave the database unchanged or fully retryable.**

---

## 2. Current baseline

Already implemented, so do not rebuild it:

- Streaming assistant drawer with history, new chat, stop, retry, copy, quota,
  Markdown and GFM tables, and resume after reload.
- Conversation persistence in `ai_conversations`, `ai_messages`, and
  `ai_proposals`.
- Tool loop with read tools, admin finance read tools, proposals, and action
  validation.
- Low-risk auto-apply with Undo, partial proposal application, failure retry,
  and persisted proposal status (`applied`, `pending`, `rejected`, `failed`,
  `reverted`).
- Model routing and fallback in `src/lib/ai/config.ts` and
  `src/lib/ai/runtime.ts`.
- Optional telemetry in `ai_runs` and atomic quota RPC in
  `supabase/ai_upgrade.sql`.
- AI ideas generation with structured output and add-all.
- Monthly report generation with goals, month-over-month comparison, language,
  overwrite protection, saved reports, and download.
- Client health scoring, admin refresh, low-risk deterministic summaries, and
  at-risk dashboard ordering.
- Member financial redaction in tools, goals, overview, and health summaries.
  Health snapshots no longer persist invoice-derived factors in shared JSON, and
  the migration cleans legacy rows.
- Synthetic regression tests in `scripts/test-ai-core.ts` and the other
  `scripts/test-*.ts` files.

---

## 3. Known gaps

1. No authenticated end-to-end test has been run against the live database.
2. No repeatable AI evaluation set exists, so prompt changes cannot be compared
   objectively.
3. Users cannot rate an answer or report a bad one.
4. Tool results are not shown as verifiable sources in the UI.
5. Prompt versions are not recorded, making regressions hard to attribute.
6. Proposal cards show action summaries but not a full before/after diff.
7. Undo is action-level in chat metadata, not a durable audit record.
8. Conversation history has no search, pinning, renaming, or pagination.
9. There is no memory of user preferences or durable client context.
10. The assistant cannot edit deliverable hooks, captions, scripts, or notes.
11. Ideas use current context but not a closed performance-learning loop.
12. Reports are on-demand only; there is no scheduled or batch generation.
13. No image, PDF, screenshot, or voice input.
14. No admin digest, lead scoring, or proactive recommendation inbox.
15. No dashboard for telemetry, token cost, tool failures, or feedback.
16. Quota days reset at UTC midnight instead of Africa/Tunis.
17. Rate limiting is per-user quota only; there is no abuse or IP protection.
18. Prompt-injection defenses are relying mostly on prompt wording.
19. The drawer has no dedicated mobile or assistive-technology test pass.
20. There is no Arabic/French interface mode and no RTL test coverage.

---

## 4. Priority overview

| Phase | Focus | Outcome | Estimated effort |
| --- | --- | --- | --- |
| P0 | Verify and stabilize | Trustworthy baseline, no unknown failures | 2-4 days |
| P1 | Assistant quality | Better answers, feedback, citations, safer proposals | 1-2 weeks |
| P2 | Content workflow | AI can edit, plan, and reuse content end to end | 2-4 weeks |
| P3 | Proactive intelligence | Digests, leads, health actions, performance learning | 4-8 weeks |
| P4 | Platform and scale | Security, observability, cost, accessibility, docs | Ongoing |

Do P0 before adding features. Do P1 before expanding the number of tools.

---

## 5. P0 - Verify and stabilize

### AI-01 Authenticated end-to-end test

**Why:** The build, typecheck, and synthetic tests cannot prove that auth, RLS,
Gemini, streaming, database writes, proposals, and Undo work together.

**Work:**

- Create a dedicated admin test account and a test client. Do not use a real
  client.
- Run this matrix:
  1. Log in and open the assistant.
  2. Ask a read-only question such as "Summarize this client's health and recent
     posts."
  3. Confirm tool chips appear and the answer cites real data.
  4. Ask for a low-risk write: "Create an idea called E2E test reel, reel for
     Instagram, status idea."
  5. Confirm the deliverable exists in the client page and calendar.
  6. Click Undo, confirm it is removed, reload, and confirm "Undone" persists.
  7. Ask for a high-risk write and confirm nothing applies before confirmation.
  8. Confirm a member sees no financial fields, finance tools, or admin actions.
  9. Confirm quota is consumed once per request and the UI shows the remainder.
 10. Stop a response mid-stream, reload, and confirm history is consistent.
- Delete the test client and test deliverables at the end.

**Acceptance criteria:**

- No unhandled 4xx/5xx responses in the network panel.
- No duplicate deliverables or proposals after retrying.
- Undo works before and after reload.
- Member test shows no financial values or admin-only tool names.
- Results are recorded in `AI_NEXT_STEPS.md` or the issue tracker.

### AI-02 Apply the optional database migration

**Work:**

- Run `supabase/ai_upgrade.sql` in the Supabase SQL editor.
- Confirm `ai_runs` and `increment_ai_usage` exist.
- Send one chat request and confirm an `ai_runs` row is created.
- Confirm quota uses the RPC path instead of the upsert fallback.

**Acceptance criteria:**

- Migration is safe to run twice.
- No API errors when telemetry is available.
- The app still works if telemetry is disabled or unavailable.

### AI-03 Add an AI evaluation harness

**Why:** Prompt and tool changes currently have no regression measure beyond a
few unit tests.

**Work:**

- Add `scripts/eval-ai.ts`.
- Use a frozen set of 40-60 cases covering:
  - client summaries, health, engagement, followers, top posts;
  - search and disambiguation;
  - missing data and invalid IDs;
  - proposal validation and permission boundaries;
  - member financial redaction;
  - language behavior;
  - destructive requests that must require confirmation.
- For each case, record expected tools, forbidden tools, required facts, and
  forbidden facts.
- Run with mocked tools by default. Add an optional live mode behind an explicit
  flag.
- Output pass/fail, latency, token usage, and a diff from the previous run.

**Acceptance criteria:**

- `node --import tsx scripts/eval-ai.ts` runs without a live server.
- The suite fails when a required fact is missing or a forbidden tool is called.
- Results are saved as JSON for comparison.

### AI-04 Harden user-facing failure states

**Work:**

- Verify quota (`429`), disabled AI (`503`), Gemini timeout, invalid tool output,
  network loss, and empty model response.
- Every failure must show a clear message, a retry path where safe, and no
  duplicated user message.
- Never show raw Gemini errors or stack traces to users.
- Keep the user's typed message in the input after a failed send if it was not
  persisted.

**Acceptance criteria:**

- Test each failure by forcing the error locally.
- A retry does not create duplicate conversations, messages, or proposals.
- Server logs contain the technical detail; the UI contains actionable text.

### AI-05 Check proposal and stream races

**Work:**

- Simulate double-click Apply, Apply then Reject, Reject then Undo, refresh while
  streaming, and two tabs on the same conversation.
- Confirm no proposal remains stuck in `applying`.
- Confirm partial success is never discarded.
- Confirm a stopped stream cannot append late text to a newer conversation.

**Acceptance criteria:**

- Proposal status transitions are deterministic.
- A stale response cannot overwrite the active conversation.
- The UI remains usable after every race.

### AI-06 Add a single quality gate

**Work:**

- Add a documented command that runs typecheck, synthetic tests, AI tests, and
  production build in the correct order.
- Stop the dev server before building because dev and build share `.next`.
- Do not use `npm run lint`; this repository does not have ESLint installed.

**Acceptance criteria:**

- One command gives a clear pass/fail result.
- The command is referenced from `AGENTS.md`.

---

## 6. P1 - Assistant quality

### AI-07 Capture answer feedback

**Work:**

- Add helpful / not helpful buttons on each assistant answer.
- When "not helpful" is selected, ask for one reason: wrong data, missed tool,
  bad action, too long, wrong language, or other.
- Store feedback in `ai_messages.tool_calls` first; add a dedicated table only if
  reporting requires it.
- Send feedback to telemetry without storing private message text in logs.

**Acceptance criteria:**

- Feedback survives reload.
- Feedback can be aggregated by model, prompt version, and feature.
- No financial or client-private text is copied into structured logs.

### AI-08 Show verifiable sources

**Work:**

- Attach source metadata to read-tool results: clients, deliverables, reports,
  invoices, or health snapshots.
- Render compact source chips below the answer, for example "Client: Acme" and
  "Post: Reel #123".
- Link each source to the relevant CRM page when an ID is available.
- Make it clear when an answer is based on no tool data.

**Acceptance criteria:**

- Every factual client answer can be traced to at least one source or explicitly
  states that no data was found.
- Members cannot use a source chip to open a page they cannot access.

### AI-09 Version prompts and record them

**Work:**

- Add `PROMPT_VERSION` in `src/lib/ai/prompt.ts`.
- Include it in telemetry metadata and stored assistant messages.
- Keep prompt changes reviewable and small.
- Record model, prompt version, tool count, latency, and token usage for every
  request.

**Acceptance criteria:**

- A regression can identify the prompt version that introduced it.
- Old conversations still render after a prompt change.

### AI-10 Improve proposal review

**Work:**

- Show a before/after diff for updates, not only a label.
- For creates, show the key fields that will be written.
- For status changes, show the previous status, new status, and date effects.
- Highlight validation warnings before Apply.
- Let users edit individual actions before applying.
- Keep the current partial-apply and retry behavior.

**Acceptance criteria:**

- A user can understand every database change without opening developer tools.
- Invalid actions are rejected before any write occurs.
- Successful actions are never re-applied when a failed action is retried.

### AI-11 Add a clarification policy

**Work:**

- Require a clarifying question when a write is ambiguous, for example:
  - two clients have similar names;
  - a deliverable ID is missing;
  - a date has no year;
  - a currency amount has no client or invoice.
- For read requests, prefer the most likely match only when the tool result makes
  it unambiguous, and state the assumption.
- Never guess a client or invoice ID.

**Acceptance criteria:**

- Ambiguous test cases produce a question, not a write.
- The question includes enough options for a one-tap reply.

### AI-12 Improve follow-up suggestions

**Work:**

- Generate two or three contextual follow-ups after each answer.
- Make them specific to the page, client, and last tool result.
- Add page-aware starter prompts for client, calendar, finance, leads, and
  dashboard pages.
- Do not suggest actions the user cannot perform.

**Acceptance criteria:**

- Suggestions never expose admin-only actions to members.
- Clicking a suggestion sends the exact visible prompt.

### AI-13 Improve conversation management

**Work:**

- Add search, pin, rename, and pagination for conversations.
- Add message-level pagination instead of a hard 200-message viewer limit.
- Keep the assistant history window at 24 messages for cost, but make older
  messages available on demand.
- Add an export chat action in Markdown.

**Acceptance criteria:**

- A user with 200+ chats can find an old conversation.
- Renaming and pinning persist across reloads.
- Export contains no data the user cannot already see.

### AI-14 Persist an action and undo audit

**Work:**

- Add a durable record for applied actions and their undo status.
- Store the proposal ID, action type, entity ID, before/after values, actor, and
  timestamp.
- Make Undo verify the current state before restoring it, so a later manual edit
  is not silently overwritten.
- Show a clear message when Undo is no longer safe.

**Acceptance criteria:**

- Every auto-applied change has an audit row.
- Undo refuses to overwrite a conflicting manual change unless the user
  explicitly confirms.
- The record is admin-readable for support.

### AI-15 Add a telemetry dashboard

**Work:**

- Build an admin page for `ai_runs`: volume, latency, token usage, model mix,
  tool failures, quota hits, and feedback.
- Add a date range and per-feature filter.
- Add a cost estimate using configurable per-million-token prices.
- Degrade gracefully when `ai_upgrade.sql` has not been applied.

**Acceptance criteria:**

- p50/p95 latency and error rate are visible.
- A failed tool call can be traced to a chat request without exposing message
  text.
- The page is admin-only.

### AI-16 Align quota reset with Africa/Tunis

**Work:**

- Replace the UTC day key and reset time with Africa/Tunis local midnight.
- Migrate the `ai_usage.day` key if necessary, or add a timezone column.
- Keep the logic deterministic and testable.

**Acceptance criteria:**

- Quota resets at local midnight in Tunisia.
- Tests cover a DST-free date and a month boundary.
- Existing usage rows do not double-count.

### AI-17 Make cost visible before it becomes a problem

**Work:**

- Show token usage per answer in an admin-only tooltip.
- Add per-feature budgets: chat, ideas, reports, health, summaries.
- Add warnings at 70%, 90%, and 100% of a monthly internal budget.
- Cache safe read-only context such as client profiles for a short TTL.
- Keep member quota messaging separate from internal cost budgets.

**Acceptance criteria:**

- Cost is attributable by feature and model.
- A budget warning does not block normal user work.
- Cache entries are keyed by user access scope and cannot leak across clients.

---

## 7. P2 - Content workflow

### AI-18 Add deliverable content actions

**Work:**

- Add an `update_deliverable_content` action for `idea`, `hook`, `caption`, and
  `script`.
- Decide whether it is low-risk. Recommended: low-risk only when the user
  explicitly asks to change content, with Undo restoring the previous fields.
- Add validation for maximum lengths and plain-text normalization.
- Add these fields to the proposal diff.

**Acceptance criteria:**

- The assistant can draft and apply a caption without leaving the chat.
- Undo restores every changed field.
- Member access is checked on the deliverable's client.

### AI-19 Upgrade ideas generation

**Work:**

- Add controls for:
  - number of ideas;
  - platform mix;
  - format mix;
  - language;
  - campaign objective;
  - awareness, consideration, or conversion stage.
- Use top-performing posts and weak posts as context.
- Generate a hook, script outline, shot list, caption direction, and reference
  angle for each idea.
- Avoid repeating recent titles.
- Save ideas directly as deliverables with a clear preview before creation.

**Acceptance criteria:**

- Ideas are distinct and match the selected objective.
- Duplicate titles are rejected or regenerated.
- Saving ideas creates valid deliverables with the correct client and platform.

### AI-20 Upgrade reports

**Work:**

- Add reusable report templates: monthly recap, campaign recap, and QBR.
- Add a scheduled monthly draft generation in the first working day of the month.
- Add batch generation for all active clients, with progress and failure retry.
- Add PDF export using the existing report page styling.
- Add an option to include or exclude financial sections, still gated to admins.
- Store report version history instead of overwriting the only copy.

**Acceptance criteria:**

- A bad generation can be retried without overwriting a good report.
- Scheduled drafts are clearly marked as drafts until approved.
- Members can never select or receive financial sections.

### AI-21 Accept images and documents

**Work:**

- Allow screenshot and image upload for ad references, moodboards, and visual
  ideas.
- Allow brief PDFs or text files as context.
- Use Gemini vision for analysis, then discard the file unless the user chooses
  to attach it to a client.
- Show file size, type, and retention rules before upload.
- Add a clear path for deleting uploaded context.

**Acceptance criteria:**

- Unsupported files are rejected client-side and server-side.
- Uploaded files are access-checked and never exposed through a public URL.
- Conversation export notes whether attachments were used.

### AI-22 Add voice input

**Work:**

- Add browser speech-to-text for chat input.
- Show a recording state and a clear cancel action.
- Do not auto-send after transcription; let the user review the text first.
- Provide a typed fallback for browsers without speech support.

**Acceptance criteria:**

- Typing still works while voice input is unsupported.
- No audio is stored by default.
- The feature is keyboard accessible.

### AI-23 Add safe memory

**Work:**

- Add user preferences: language, response length, favorite formats, and tone.
- Add optional client memory: brand rules, recurring instructions, and banned
  phrases.
- Make memory visible and editable.
- Scope memory to the user or client and enforce RLS.
- Never use one member's private memory in another member's conversation.

**Acceptance criteria:**

- The assistant can explain which memory it used.
- Clearing memory takes effect immediately.
- A member cannot read another user's memory rows.

### AI-24 Add a client timeline tool

**Work:**

- Add a read-only `get_client_timeline` tool that combines notes, messages,
  deliverables, reports, health changes, and activities for a date range.
- Use it for "what happened with this client" questions.
- Return compact facts and source IDs, not raw database rows.

**Acceptance criteria:**

- Answers can cite the underlying events.
- Results respect client access and member financial redaction.
- The tool has a strict limit to prevent huge prompts.

### AI-25 Add bulk content planning

**Work:**

- Turn a monthly plan into multiple deliverables in one proposal.
- Show the full batch in a table before applying.
- Let users deselect rows.
- Cap batches at a safe number and apply sequentially.
- Roll back completed rows if a batch partially fails and the user requests a
  full undo.

**Acceptance criteria:**

- A 10-post plan can be reviewed and applied without editing the calendar
  manually.
- Failures identify the exact row.
- Undo removes only rows created by that batch.

### AI-26 Add language and RTL polish

**Work:**

- Add an explicit output-language control: English, French, Arabic, or auto.
- Keep English as the default.
- Test Arabic content in the drawer, proposals, tables, and reports.
- Add RTL support where Arabic is selected.
- Keep dates, currency, and month labels locale-aware.

**Acceptance criteria:**

- Arabic answers render without broken tables or controls.
- The selected language persists per user.
- Drafts in French or Arabic still use the correct CRM field values.

### AI-27 Add reusable prompt templates

**Work:**

- Add saved prompts for common tasks: weekly client update, report summary,
  content critique, lead follow-up, and finance review.
- Make templates permission-aware.
- Prefill page and client context when opened.

**Acceptance criteria:**

- Templates cannot contain admin-only instructions for members.
- A template can be edited and deleted by its owner.
- Built-in templates are read-only.

---

## 8. P3 - Proactive intelligence

### AI-28 Add a daily and weekly digest

**Work:**

- Compute deterministic facts first: at-risk clients, overdue invoices, posting
  gaps, upcoming shoots, unread leads, and goals behind pace.
- Use the model only to summarize and prioritize those facts.
- Produce an admin digest and a member-safe digest.
- Link every item to the underlying record.
- Add opt-in email or in-app delivery.

**Acceptance criteria:**

- A digest never claims something absent from the source data.
- Member digests contain no financial facts.
- A failed generation falls back to the deterministic list.

### AI-29 Add lead follow-up assistance

**Work:**

- Score and classify new contact submissions using explicit signals.
- Draft a follow-up message and suggested next action.
- Create a task or note only after confirmation.
- Convert a lead to a client through the existing admin-only flow.
- Never send a message automatically.

**Acceptance criteria:**

- Every score shows its reasons.
- Conversion reuses existing validation and permissions.
- No duplicate client is created from the same lead.

### AI-30 Turn health recommendations into actions

**Work:**

- Show a recommended action on the client health card.
- Offer one-click proposals such as creating a shoot, scheduling a post, or
  adding a follow-up note.
- Keep low-risk actions auto-applicable with Undo.
- Show why the recommendation exists.

**Acceptance criteria:**

- The recommendation references the actual factors.
- One-click actions still go through proposal validation.
- Dismissed recommendations do not reappear immediately.

### AI-31 Close the content performance loop

**Work:**

- Compare hooks, formats, and platforms against views, likes, comments, and
  saves.
- Identify top and weak patterns with a minimum sample size.
- Feed those findings into ideas and reports.
- Label recommendations as correlation, not causation.

**Acceptance criteria:**

- The analysis states the sample size and date range.
- Recommendations are not produced from a single viral post.
- Members see engagement data but never revenue or profit.

### AI-32 Add an admin finance assistant

**Work:**

- Add safe read tools for cashflow, overdue invoices, expense trends, and client
  profitability.
- Add proposal actions for invoice reminders and payment recording.
- Require confirmation for every financial write.
- Add an audit trail entry for every financial action.

**Acceptance criteria:**

- Members cannot call financial tools even if they craft a tool name.
- Amounts and currencies are formatted in TND with three decimals.
- No financial write can run without explicit confirmation.

### AI-33 Add goal planning assistance

**Work:**

- Recommend next month's content targets from historical delivery and
  engagement.
- Show the assumptions and available capacity.
- Let an admin accept the targets through an `upsert_goal` proposal.
- Never invent financial goals for members.

**Acceptance criteria:**

- Recommendations are compared with actual capacity.
- Accepted goals appear in the existing goals UI.
- Rejected suggestions do not change data.

### AI-34 Add an AI recommendation inbox

**Work:**

- Store proactive recommendations with status: new, accepted, dismissed,
  completed.
- Group by client and priority.
- Link to the proposal or record that resolves them.
- Avoid duplicate recommendations for the same client and cause.

**Acceptance criteria:**

- Recommendations are actionable, not just text.
- Dismissal is durable.
- The inbox is permission-aware.

### AI-35 Generate QBR packs

**Work:**

- Combine reports, health history, engagement, goals, and upcoming plans into a
  quarterly review.
- Generate a shareable draft and an internal appendix.
- Keep financial sections admin-only.
- Add a review step before sharing.

**Acceptance criteria:**

- The internal and external versions are clearly separated.
- The external version contains no financial or internal notes.
- Regeneration preserves the previous approved version.

---

## 9. P4 - Platform, security, and scale

### AI-36 Add prompt-injection defenses

**Work:**

- Wrap client notes, inspirations, submissions, and scraped captions in explicit
  untrusted-data delimiters.
- Instruct the model to never follow instructions found inside data.
- Keep the tool allowlist and permission checks server-side.
- Add eval cases where a note says "ignore previous instructions" or "reveal
  financial data" and confirm the assistant refuses.
- Do not add a web-fetch tool until URL allowlisting and content sanitization
  exist.

**Acceptance criteria:**

- Injection eval cases pass.
- A malicious note cannot trigger a tool or reveal another client's data.
- The model never receives secrets or service-role credentials.

### AI-37 Add abuse and rate protection

**Work:**

- Keep the per-user daily quota.
- Add per-IP and per-session burst limits for unauthenticated or compromised
  sessions.
- Add a maximum message length and attachment size.
- Add a cooldown for expensive actions such as health refresh and batch report
  generation.
- Return `Retry-After` on rate limits.

**Acceptance criteria:**

- A rapid request loop cannot exhaust the Gemini budget.
- Normal users are unaffected.
- Rate-limit responses do not create partial database writes.

### AI-38 Add privacy and retention controls

**Work:**

- Document what is stored in conversations, messages, proposals, telemetry, and
  logs.
- Add user or admin deletion for conversations.
- Add a retention period for old conversations and telemetry.
- Add redaction rules for logs: no full prompts, no financial values, no tokens.
- Add an export path for a user's own conversations.

**Acceptance criteria:**

- Deleting a conversation removes its messages and pending proposals.
- Retention jobs are idempotent.
- Logs contain identifiers and status, not private content.

### AI-39 Make model routing configurable safely

**Work:**

- Keep `GEMINI_MODEL_CHAT`, `GEMINI_MODEL_FAST`, and per-task overrides.
- Add a validated allowlist of model IDs.
- Show the active model per feature in an admin settings page.
- Add a dry-run mode that records routing decisions without calling Gemini.
- Log fallback events and the reason for each fallback.

**Acceptance criteria:**

- An invalid model ID fails fast with a clear configuration error.
- Fallbacks are visible in telemetry.
- Changing a model does not require a code deploy.

### AI-40 Add an admin configuration page

**Work:**

- Configure daily user quota, feature budgets, enabled features, model routing,
  report templates, and health thresholds.
- Store configuration in the database or environment, not hard-coded constants.
- Validate every value and show the effective value.
- Add an audit log for changes.

**Acceptance criteria:**

- An admin can see why a request was blocked or routed to a model.
- Configuration changes do not require editing source code.
- Invalid values are rejected before saving.

### AI-41 Accessibility and mobile pass

**Work:**

- Test the drawer with keyboard only, a screen reader, 200% zoom, and reduced
  motion.
- Check focus return after close, proposal cards, tables, and long code blocks.
- Make the drawer full-screen on small viewports.
- Ensure touch targets are at least 44px.
- Add accessible labels to icon-only buttons.

**Acceptance criteria:**

- No keyboard trap.
- Focus returns to the launcher.
- Tables scroll horizontally without breaking the page.
- Reduced motion disables non-essential animation.

### AI-42 Add operational documentation

**Work:**

- Document environment variables, model routing, quota behavior, migrations,
  telemetry, and runbooks for failed AI requests.
- Add a troubleshooting section for 401, 429, 503, empty responses, and tool
  validation errors.
- Keep `AGENTS.md` commands current.
- Add a short "how to add a tool" guide covering declaration, handler,
  permissions, tests, and UI display.

**Acceptance criteria:**

- A new developer can add a read-only tool without reading the whole AI module.
- Every environment variable is documented in `.env.example`.
- The production start command is accurate.

### AI-43 Add schema migrations as a first-class practice

**Work:**

- Keep `schema.sql` as the full fresh-install schema.
- Keep `supabase/ai_upgrade.sql` as the idempotent upgrade path.
- Add future AI tables and columns to both.
- Test migrations against a copy of the database before production.
- Avoid mandatory migrations for optional features; degrade gracefully where
  possible.

**Acceptance criteria:**

- A fresh database and an upgraded database have the same AI schema.
- Re-running migrations is safe.
- The app starts even if optional telemetry is missing.

### AI-44 Keep the test suite representative

**Work:**

- Add one regression test for every fixed production bug.
- Add action-schema tests for every new action.
- Add permission tests for every new tool.
- Add an eval case for every prompt change that affects behavior.
- Keep synthetic tests free of live database dependencies.

**Acceptance criteria:**

- A new action cannot merge without a schema and permission test.
- The synthetic suite runs in CI without secrets.
- Evaluations are separated from deterministic tests.

---

## 10. Metrics

Set a baseline after AI-01 through AI-03, then track trends. Do not optimize for
message count.

### Product usefulness

- Task completion rate: user gets a usable answer or applies a valid proposal.
- Helpful feedback rate.
- Proposal accept rate.
- Undo rate. A rising undo rate is a quality signal, not automatically a failure.
- Time from question to useful result.
- Weekly active users of the assistant and per-feature usage.

### Quality

- Evaluation pass rate on the golden set.
- Required-fact recall and forbidden-fact rate.
- Wrong-tool rate.
- Invalid-action rate.
- Clarification rate for ambiguous requests.
- Member financial-leak count. Target: zero.

### Reliability

- Stream completion rate.
- Tool error rate.
- p50 and p95 first-token latency.
- p50 and p95 full-response latency.
- 4xx and 5xx rate by endpoint.
- Stuck or orphaned proposal count.

### Cost

- Tokens per request by feature.
- Cost per active user.
- Cache hit rate.
- Fallback rate by model.
- Quota hits per day.

---

## 11. Recommended next sprint

Do these in order:

1. Run AI-01 with an admin and a member test account.
2. Apply `supabase/ai_upgrade.sql` and verify telemetry and the quota RPC.
3. Add `scripts/eval-ai.ts` with 20 high-value cases.
4. Add AI-07 answer feedback.
5. Add AI-08 source chips for client and deliverable answers.
6. Add AI-09 prompt version telemetry.
7. Add AI-10 before/after proposal diffs.
8. Add AI-14 durable action and undo audit.
9. Add AI-04 failure-state tests.
10. Add AI-05 proposal race tests.

Ship P0 completely before starting P2.

---

## 12. Definition of done for the AI feature

The assistant is in good shape when:

- An admin and a member can complete the E2E matrix without manual database
  repair.
- Every factual answer can be traced to source data.
- Every write is either confirmed or auto-applied with a safe, durable Undo.
- A member cannot obtain financial data through prompts, tools, reports, source
  chips, or health summaries.
- Prompt, model, tool, and feedback changes are measured by the eval suite.
- Failures are understandable to users and diagnosable by admins.
- Cost, latency, and quota are visible before they become incidents.
- The drawer works with keyboard, screen reader, mobile, and reduced motion.
- The fresh-install schema and upgrade migration produce the same AI schema.

---

## 13. Open decisions

Resolve these before the related phase starts:

1. Should client memory be per user, per client, or both?
2. Which content fields are safe for low-risk auto-apply with Undo?
3. How long should conversations, telemetry, and uploaded files be retained?
4. What is the monthly AI budget, and how should it be split by feature?
5. Should model fallback stay within Gemini, or should a second provider be
   added?
6. Should scheduled reports deliver in-app only, by email, or both?
7. Should members see AI-generated client health summaries at all, or only the
   deterministic score and risk?
8. Which proactive recommendations are useful enough to justify their cost?
9. Should AI actions be visible in the existing activity log or a separate audit
   view?
10. What is the acceptable p95 latency for first token and full response?

---

## 14. Verification commands

Run these after every meaningful AI change:

```powershell
npx --no-install tsc --noEmit --incremental false --noUncheckedSideEffectImports

node --import tsx --test scripts/test-client-list.ts scripts/test-calendar-data.ts scripts/test-font-loading.ts scripts/test-devtools-probe.ts scripts/test-workspace-navigation.ts scripts/test-workspace-data.ts scripts/test-posting-silence.ts scripts/test-ai-core.ts
```

For a production build, stop the dev server first because both use `.next`:

```powershell
npm run build
npx --no-install next start -p 3001
```

Then smoke-check:

```powershell
# Expect 200
Invoke-WebRequest http://localhost:3001/login -UseBasicParsing

# Expect 401
Invoke-WebRequest http://localhost:3001/api/ai/usage -UseBasicParsing

# Expect 307
Invoke-WebRequest http://localhost:3001/dashboard -UseBasicParsing -MaximumRedirection 0
```

Authenticated E2E is still manual until AI-01 and AI-06 are complete.
