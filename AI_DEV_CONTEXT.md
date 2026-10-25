# AI Assistant - Developer Context

Last updated: 2026-10-25

This is the orientation document for anyone changing the AI assistant in the
Brandicom CRM. It explains how the feature is put together, which rules must not
be broken, and where the sharp edges are.

It is not the backlog. The prioritised improvement list lives in
[`AI_NEXT_STEPS.md`](./AI_NEXT_STEPS.md). Read `AGENTS.md` for the run/build/test
commands.

The AI implementation is maintained in git on `main`. Commit and push only when
the user explicitly asks.

---

## 1. What the assistant is

The assistant is a workspace copilot inside the authenticated CRM. It can:

- answer questions using live CRM data;
- create and change records through a proposal/confirmation flow;
- auto-apply a small set of reversible actions and offer Undo;
- generate eight content ideas for a client;
- generate a saved monthly client report;
- compute deterministic client health scores and an AI explanation;
- generate page-aware suggestions in the drawer.

It is not a general chatbot. Every client-specific fact must come from a tool or
from page context. The model must not invent IDs, dates, numbers, or statuses.

### Product language and business rules

- English is the default response language. Reply in another language only when
  the user writes in it or explicitly chooses it.
- Currency is Tunisian Dinar (TND) with three decimal places. VAT is 19%.
- The business timezone for dates is `Africa/Tunis`.
- Members must never receive financial data: revenue, profit, expenses,
  invoices, payments, fees, contract values, overdue counts, or financial
  summaries.
- Low-risk actions may auto-apply only when they are reversible and have a safe
  Undo path.
- High-risk actions require explicit confirmation in the UI.
- Never replace deterministic calculations (health scores, totals, dates,
  permissions) with model output.

---

## 2. Architecture at a glance

```text
Browser
  AiAssistantDrawer (global, mounted in AppShell via AppChrome)
        |
        | POST /api/ai/chat  (SSE)
        v
  chat route
    enforceAuth
    aiEnabled
    consumeAiQuota
    find/create ai_conversations row
    save user ai_messages row
    load last AI_HISTORY_LIMIT messages
        |
        v
  tool loop, max AI_MAX_TOOL_LOOPS (8)
    aiStream -> Gemini
    onText -> SSE "delta"
    functionCalls -> executeTool
        - read tools -> data layer + RLS
        - propose_changes -> validate actions
            - all low risk -> auto-apply + create ai_proposals row
            - otherwise -> create pending ai_proposals row
    append model parts + functionResponse parts
        |
        v
  save assistant ai_messages row (tool_calls JSON)
  add token usage
  SSE "done"
```

The assistant has one prompt for chat (`src/lib/ai/prompt.ts`) and separate
feature prompts for ideas, reports, and health. Keep those contracts separate.

The UI is a client component. All permission checks and writes happen on the
server. The browser never receives the Gemini key or the Supabase service-role
key.

---

## 3. File map

### API routes

| Path | Purpose |
| --- | --- |
| `src/app/api/ai/chat/route.ts` | SSE chat endpoint, quota, history, tool loop, proposal events, persistence. |
| `src/app/api/ai/conversations/route.ts` | List the current user's last 50 conversations. |
| `src/app/api/ai/conversations/[id]/route.ts` | Load/rename/delete one owned conversation; loads last 200 messages and live proposal status. |
| `src/app/api/ai/proposals/[id]/route.ts` | Apply selected actions or reject a pending proposal. |
| `src/app/api/ai/undo/route.ts` | Validate and execute Undo actions; marks a proposal `reverted` only when every undo succeeds. |
| `src/app/api/ai/usage/route.ts` | Current user's daily quota snapshot. |
| `src/app/api/ai/ideas/route.ts` | Generate eight ideas for a client; client access + quota. |
| `src/app/api/ai/report/route.ts` | Read a saved report (`GET`) or generate/overwrite one (`POST`); client access + quota on POST. |
| `src/app/api/ai/health/route.ts` | Admin-only global health refresh. Uses the service-role client. |

### AI library

| Path | Responsibility |
| --- | --- |
| `src/lib/ai/config.ts` | Task types, model routing, fallback models, timeouts, history/tool limits, daily quota. |
| `src/lib/ai/gemini.ts` | Constructs the `@google/genai` client. Server only. |
| `src/lib/ai/runtime.ts` | `aiGenerate`, `aiStream`, `aiGenerateJson`; retries, fallbacks, timeouts, JSON repair, telemetry. |
| `src/lib/ai/prompt.ts` | The chat system prompt and page/client/selection context. |
| `src/lib/ai/toolDeclarations.ts` | Pure Gemini function declarations, gated by `isAdminUser`. |
| `src/lib/ai/tools.ts` | Tool argument validation, execution, permissions, financial redaction, proposal creation. |
| `src/lib/ai/actions.ts` | Zod action schema, admin action set, low-risk set, Undo schema, status flags. |
| `src/lib/ai/apply.ts` | Applies actions, auto-apply, proposal claiming, partial apply, persistence. |
| `src/lib/ai/undo.ts` | Restores deliverable status or deletes a deliverable created by AI. |
| `src/lib/ai/usage.ts` | Daily request quota and best-effort token accounting. |
| `src/lib/ai/telemetry.ts` | Optional `ai_runs` logging plus a console line. Best effort only. |
| `src/lib/ai/health.ts` | Deterministic health score, AI summary, snapshot write. |
| `src/lib/ai/ideas.ts` | Structured idea generation and parsing. |
| `src/lib/ai/report.ts` | Monthly client report generation and upsert. |
| `src/lib/ai/actionDisplay.ts` | Human labels/details for proposals. |
| `src/lib/ai/chatTypes.ts` | Shared UI types for messages, proposals, tools, usage. |

### UI

| Path | Responsibility |
| --- | --- |
| `src/components/AiAssistantDrawer.tsx` | Global drawer: streaming, selection popover, history, quota, suggestions, proposal actions, Undo. |
| `src/components/ai/ProposalCard.tsx` | Proposal rendering, selection, apply/reject/undo controls. |
| `src/components/AppChrome.tsx` | Dynamically mounts the drawer; must stay mounted globally. |
| `src/components/AppShell.tsx` | Workspace shell; renders `AppChrome`. |
| `src/components/ClientWorkspace.tsx` | Client page ideas and report UI, health card, add-all ideas. |
| `src/components/HealthRefreshButton.tsx` | Admin-only dashboard button for the global health refresh. |

### Data and database

| Path | Responsibility |
| --- | --- |
| `supabase/schema.sql` | Full idempotent fresh-install schema, including AI tables, RLS, and the quota RPC. |
| `supabase/ai_upgrade.sql` | Additive upgrade for older databases: `ai_runs`, `increment_ai_usage`, and health-factor cleanup. Safe to re-run. |
| `src/lib/data.ts` | Client/deliverable reads, role-aware contract loading, health mapping, activity logging. |
| `src/lib/permissions.ts` | `CurrentUser`, `getSessionUser`, `enforceAuth`, `enforceAdmin`, `canAccessClient`, `isAdmin`. |
| `src/lib/finance.ts` | Admin-only finance reads/writes used by admin tools and actions. |
| `src/lib/goals.ts` | Dashboard metrics; returns `null` financial fields to members. |
| `src/lib/clientGoals.ts` | Content goals stored in client tags; not financial goals. |
| `src/lib/healthPrivacy.ts` | Member-safe health factors and summary helpers shared by the data and tool layers. |
| `src/lib/deliverables.ts` | Link parsing/serialization and the empty-`both` link rule. |

### Tests and docs

- `scripts/test-ai-core.ts` - synthetic AI tests.
- `scripts/test-*.ts` - other synthetic regression tests.
- `AI_NEXT_STEPS.md` - prioritised roadmap with acceptance criteria.
- `AGENTS.md` - run/build/test commands and the lint warning.

---

## 4. Chat request lifecycle

1. `POST /api/ai/chat` calls `enforceAuth()`. Unauthenticated requests get `401`.
2. If `GEMINI_API_KEY` is missing, return `503`.
3. Parse JSON and require a non-empty `message` of at most 8,000 characters.
4. Consume one daily quota unit. This happens before the conversation is created,
   so failed or stopped requests still count.
5. If `conversationId` is supplied, it must belong to the current user. Otherwise
   a new conversation is created with the first 80 characters as the title.
6. Save the user message to `ai_messages`.
7. Load the newest `AI_HISTORY_LIMIT` (24) messages, reverse them, and rebuild
   Gemini contents as text-only parts. Tool calls are not replayed from history.
8. Start an SSE response and immediately send `meta`.
9. Run up to `AI_MAX_TOOL_LOOPS` (8) model/tool turns.
10. For each turn, `aiStream` emits text deltas. If the model returns function
    calls, execute every tool, send `tool` events, and append:
    - the complete model parts, unchanged;
    - one `functionResponse` part per call.
11. If `propose_changes` returns actions, the route captures a proposal and sends
    a `proposal` event.
12. After the loop, if no assistant text was produced, use a deterministic
    fallback message (applied, failed, pending, or no answer).
13. Save the assistant message with `tool_calls = { tools, proposal, model,
    tokens }`.
14. Add tokens to `ai_usage` (best effort), then send `done`.
15. On error, send `error` unless the request was aborted. On abort, do not save
    an assistant message.

### SSE contract

| Event | Payload | Meaning |
| --- | --- | --- |
| `meta` | `{ conversationId, usage }` | Stream opened; persist this conversation ID in the browser. |
| `delta` | `{ text }` | Incremental assistant text. |
| `text` | `{ text }` | Legacy compatibility; the client accepts it like `delta`. |
| `tool` | `{ name, status, summary, result? }` | Tool running/done. `result` is included only for `propose_changes`. |
| `proposal` | proposal view | Actions ready to apply or already applied. |
| `done` | `{ conversationId, messageId, usage }` | Stream finished and the assistant message was saved. |
| `error` | `{ message }` | User-facing failure. The stream still closes. |

A `: keep-alive` comment is sent every 15 seconds. The route sets
`maxDuration = 60`.

**Do not pretty-print SSE JSON.** The browser parser reads one `data:` line per
event. Multi-line JSON will be dropped. The client also ignores malformed chunks
so a later valid event can still work.

### What is stored

- `ai_conversations` - owner, title, created time.
- `ai_messages` - role, content, `tool_calls` JSON.
- `ai_proposals` - actions, status, applied time. It does not store Undo/results.
- `ai_usage` - `(user_id, day)` request count and tokens.
- `ai_runs` - optional telemetry per model attempt.

`tool_calls` currently has this shape:

```json
{
  "tools": [{ "name": "get_client", "status": "done", "summary": "Loaded Acme" }],
  "proposal": { "proposalId": "...", "actions": [], "status": "pending" },
  "model": "gemini-3.5-flash",
  "tokens": 1234
}
```

The conversation loader merges the stored proposal with the live
`ai_proposals` row so status and remaining actions survive a reload. Undo
metadata is only as durable as the stored message metadata; see the known
limitations below.

---

## 5. Permissions and financial redaction

### Server-side layers

1. **Route authentication**: `enforceAuth()` / `enforceAdmin()`.
2. **Tool declarations**: admin tools and admin action types are omitted for
   members.
3. **Tool execution**: every handler re-checks the role. Hidden declarations are
   not a security boundary.
4. **Client access**: `canAccessClient(userId, role, clientId)` or RLS via
   `has_client_access(client_id)`.
5. **Data layer**: contract queries run only for admins; goals RLS hides
   `revenue` and `profit`; finance tables are admin-only.
6. **Tool output redaction**:
   - `moneyFields()` removes `revenue`, `profit`, `expenses`, `outstanding`,
     `overdue`, and `mrr` for members.
   - `healthView()` and `loadClientDetail()` use `memberSafeHealthFactors()`
     and `memberHealthSummary()` to remove invoice-derived factors and replace
     the admin summary with a generic member-safe sentence.
   - `get_client()` omits `monthlyFee` for members.
   - `list_clients()` omits `monthlyFee` for members.
   - `list_partners()` omits `dayRate` for members.
   - `search()` queries invoices only for admins.
7. **UI**: finance navigation/pages are admin-only and AI props are rendered
   conditionally.
8. **Prompt**: members are explicitly told to refuse money topics.

### Rules for new tools and fields

- Do not rely on the prompt for redaction.
- Do not rely on the declaration list for authorization.
- If you add a financial field, decide where it is removed:
  declarations, handler output, data-layer query, or all three.
- Add a member test for every new financial field.
- `get_agency_overview` and `get_goals` use `computeGoalsAndMetrics`, which
  already depends on the session role. `moneyFields` is a second line of
  defence.

### Health data boundary

`overdueInvoices` is still used to compute the score, but it is no longer written
into `client_health_snapshots.factors`. `memberSafeHealthFactors()` strips it from
legacy/read payloads, `loadClientDetail()` substitutes a member-safe summary, and
`ai_upgrade.sql` / `schema.sql` clean existing rows. `healthView()` uses the same
helpers.

The raw `ai_summary` column remains readable by assigned members under the
`health_select` policy. It is generated with a no-finance prompt, but it is not
column-filtered. Do not store new financial fields in shared health JSON; use a
separate admin-only table or view if detailed admin health factors are needed.

---

## 6. Actions, proposals, and Undo

### Action types

Defined in `src/lib/ai/actions.ts`:

- `create_client`
- `create_deliverable`
- `update_deliverable_status`
- `update_client`
- `add_client_note`
- `book_partner`
- `upsert_goal`
- `create_expense` (admin)
- `create_invoice` (admin)
- `record_payment` (admin)
- `update_contract` (admin)

`ADMIN_ACTIONS` currently contains `create_expense`, `create_invoice`,
`record_payment`, `update_contract`, and `upsert_goal`.

`LOW_RISK_ACTIONS` currently contains only:

- `create_deliverable`
- `update_deliverable_status`

A proposal auto-applies only if **every** action in it is low risk. One
high-risk action makes the whole proposal require confirmation.

### Proposal state machine

```text
pending --apply--> applying --all ok--> applied
                           --partial--> pending (remaining actions)
                           --none ok--> failed

pending --reject--> rejected
applied --all undo ok--> reverted
applied/pending --partial undo--> unchanged with remaining Undo actions
```

Auto-applied actions bypass `pending` and create a proposal row directly with
`applied` or `failed`.

`applyProposal()` claims a row by updating it to `applying` only when it is
`pending` and owned by the caller. This prevents double-apply. If the process
dies after claiming, the row can stay `applying`; there is no recovery job yet.

### Undo scope

Only two Undo operations exist:

- `restore_deliverable_status` - set a deliverable back to its previous status
  and align `filmed`/`published` flags.
- `delete_deliverable` - delete a deliverable created by the assistant.

The Undo route checks client access, executes each action, and marks the
proposal `reverted` only if all actions succeed. Partial Undo leaves the
proposal applied/pending so the remaining Undo actions can be retried.

### The multi-file rule for changes

An action is not complete until all relevant layers agree:

1. `src/lib/ai/actions.ts` - Zod schema and type.
2. `ADMIN_ACTIONS` / `LOW_RISK_ACTIONS` if the policy changes.
3. `src/lib/ai/toolDeclarations.ts` - the Gemini action type and field list.
4. `src/lib/ai/apply.ts` - execution, permission checks, side effects, result.
5. `src/lib/ai/undo.ts` + Undo schema - only if it is reversible.
6. `src/lib/ai/actionDisplay.ts` - proposal title/details.
7. UI behavior in `ProposalCard` or the drawer if the shape changes.
8. `scripts/test-ai-core.ts` - schema, policy, and declaration tests.

Missing one of these layers is the most common way to produce a tool that looks
valid to Gemini but fails or bypasses policy in execution.

### Deliverable status flags

`deliverableStatusFlags()` keeps `filmed` and `published` aligned with `status`.
Update it when adding a status. Both apply and undo rely on it, so analytics and
Undo stay consistent.

### Compatibility shim

`insertDeliverable()` retries without `filming_date` and `publish_date` if the
database predates those columns. Do not remove this until the deployed schema is
known to support both columns.

---

## 7. Tools

`toolDeclarations(isAdminUser)` is a pure function. It returns Gemini function
declarations and is deliberately easy to test without a database.

### Read tools (all users)

- `get_agency_overview`
- `list_clients`
- `get_client`
- `get_client_health`
- `get_client_engagement`
- `get_follower_growth`
- `get_top_posts`
- `list_deliverables`
- `get_upcoming`
- `list_partners`
- `get_goals`
- `search`
- `get_report`
- `propose_changes`

### Admin-only read tools

- `get_finance_summary`
- `list_invoices`
- `list_expenses`
- `get_contact_submissions`

### Execution contract

`executeTool(name, args, user, ctx)`:

1. Looks up a Zod argument schema. Unknown tools return an error.
2. Parses and validates arguments.
3. Runs the handler with explicit role/client checks.
4. Returns a compact object. Throwing is allowed; the chat route catches tool
   errors and gives the model an error response.
5. Clips large output to roughly 8,000 characters of JSON via `clip()`.

Tools should return compact, source-like facts with IDs, not raw database rows.
The model has a limited context and will make better use of small payloads.

### Propose changes

`propose_changes` accepts up to 10 actions. It:

- parses each with `ActionSchema`;
- rejects admin actions for members;
- rejects `assignedUserIds` on `update_client` for members;
- auto-applies if all parsed actions are low risk;
- inserts a pending `ai_proposals` row otherwise;
- returns an error with `invalid_actions` details and tells the model to retry
  without claiming success.

Only one proposal is captured per assistant message by the chat route. If the
model calls `propose_changes` more than once in a turn, the last proposal wins in
the UI while the tool log records both. Prefer one proposal per answer.

---

## 8. AI runtime and model routing

`src/lib/ai/config.ts`:

- Task types: `chat`, `ideas`, `report`, `health`, `digest`, `lead`, `caption`.
  Only `chat`, `ideas`, `report`, and `health` currently call Gemini. The others
  are reserved for future work.
- `AI_HISTORY_LIMIT = 24`
- `AI_MAX_TOOL_LOOPS = 8`
- Default daily quota: 80 requests per user.
- Chat/ideas/report/lead/caption use the chat model.
- Health/digest use the fast model.
- `GEMINI_MODEL_<TASK>` overrides a specific task.
- `GEMINI_MODEL_FALLBACKS` is a comma-separated fallback list.
- Timeouts: chat/ideas/lead 45s, report 60s, fast tasks 20s.

Defaults are declared in `.env.example` and `config.ts`. Do not hard-code a model
ID elsewhere.

### Runtime behaviour

`aiGenerate` (non-streaming):

- retries retryable errors: 404, 429, 5xx, timeouts, network failures;
- tries the primary model and then fallbacks;
- logs each attempt to telemetry;
- respects an external abort signal and a task timeout.

`aiStream`:

- streams text deltas through `onText`;
- ignores thought text for display;
- returns the complete accumulated `parts` and `functionCalls`;
- stops and does not continue fallback after text has already been emitted;
- throws `AiRuntimeError` on failure or cancellation.

`aiGenerateJson`:

- requests structured JSON with a response schema;
- parses with `extractJson`;
- makes one repair call if parsing/schema validation fails;
- throws `invalid_json` if the repair also fails.

### Critical Gemini rule

**Preserve complete Gemini function-call parts, including `thoughtSignature`.**
The chat route appends `result.parts` as the model turn and only adds
`functionResponse` parts for the tools. Never reconstruct a model turn from
`functionCall` alone. Gemini 3 rejects or degrades the next tool turn when the
signature is lost.

Across HTTP requests, history is rebuilt from text only. That is intentional:
do not try to resume a half-finished tool loop from `ai_messages`.

### Health exception

`src/lib/ai/health.ts` calls the Gemini SDK directly instead of using
`aiGenerate`. That means the health summary currently has:

- no runtime fallback list;
- no runtime timeout wrapper;
- no `ai_runs` telemetry entry.

It catches failures and writes a deterministic fallback summary. If you change
health generation, consider routing it through the runtime or adding equivalent
telemetry and timeout handling.

---

## 9. Prompt and context

`systemPrompt(user, ctx)` includes:

- today's date in `Africa/Tunis`;
- TND and 19% VAT;
- the user's name and role;
- admin/member financial rules;
- grounding and Markdown style rules;
- English default and reply-in-user-language rule;
- write/permission rules;
- untrusted-data instruction;
- current page, client ID, active month, and a highlighted selection;
- page-specific first moves.

The drawer sends `page`, `clientId`, `selection`, and `month` with each chat
request. The client ID is parsed from `/clients/<uuid>`. Highlighted text is
captured from a mouse selection of at least 9 and fewer than 2,000 characters and
also included in the prompt as untrusted content.

Keep the prompt concise. Do not put large data payloads or tool schemas in it;
tools should retrieve data.

---

## 10. UI behaviour

`AiAssistantDrawer` is mounted globally in `AppShell` through `AppChrome`. It is
hidden on `/login`.

- Shortcut: `Ctrl/⌘ + J`.
- Launcher: fixed button bottom-right.
- Escape closes history first, then the drawer.
- Focus is placed in the textarea on open and trapped inside the dialog.
- Conversation ID is stored in `localStorage` under
  `brandicom:ai:conversation`.
- History lists the last 50 conversations; loading a conversation fetches up to
  200 messages.
- SSE events are parsed incrementally; malformed chunks are ignored.
- Quota and reset time are shown in the header.
- Page-aware starter prompts exist for client, calendar, finance, leads,
  dashboard, and general workspace pages.
- The report and ideas UI lives in `ClientWorkspace`, not the drawer.

The drawer supports a legacy `text` event in addition to `delta`. Keep that
compatibility if you change older clients.

### Proposal card

- Pending actions are individually selectable.
- Apply sends selected indices.
- Partial applies update the card with remaining actions and accumulated Undo.
- Reject only works on a pending proposal.
- Undo is available only when the proposal has Undo actions and is not already
  `reverted`.
- Failure messages appear in the card and in the drawer's error banner.

### Report and ideas UI

- Ideas: generate eight, show each, add one, or add all sequentially. A failed
  add stops the add-all loop.
- Report: select month and language, load the saved report, generate or confirm
  overwrite, download as Markdown.
- Health: members see the score, risk, and a generic sentence; admins see the
  saved AI summary. The refresh button is admin-only on the dashboard.

---

## 11. Health, ideas, and reports

### Health

- Score is deterministic, starting at 100.
- Penalties: engagement drop (max 40), unpublished backlog (max 20), days since
  client message (up to 15), contract ending within 45 days (20), and overdue
  invoices (admin only, max 25).
- Risk thresholds: low >= 70, medium >= 45, otherwise high.
- Low-risk clients get a deterministic summary without a model call.
- Medium/high-risk clients get a short Gemini summary; failure falls back to a
  deterministic sentence.
- `recomputeHealth()` processes clients with four concurrent workers and writes
  a new snapshot for each. The admin route uses the service-role client and a
  process-local `running` lock.
- Health refresh does not consume the chat quota.

### Ideas

- Fetch the client detail through the access-controlled data layer.
- Use recent top posts, weakest posts, planned formats, goals, inspirations, and
  follower history.
- Generate exactly eight structured ideas with title, hook, format, platform,
  fit rationale, and a shootable outline.
- `parseIdeasPayload` normalizes field names, limits to eight, and falls back to
  `reel`/`instagram` for unknown enums.
- Adding an idea uses the normal client deliverables endpoint, not the AI action
  layer.

### Reports

- Fetch the client detail, current and previous engagement, published posts,
  next month's plan, goals, and follower history.
- The prompt explicitly excludes invoices, fees, retainers, profit, expenses,
  contracts, internal notes, and team performance.
- The report is upserted into `client_reports` on `(client_id, month)`.
- Regeneration overwrites the saved month after UI confirmation.
- Members with client access can generate/read a report; the prompt and data
  payload contain no financial figures.

---

## 12. Quota, telemetry, and configuration

### Quota

- One unit per chat request, ideas request, and report generation.
- Default limit: `AI_DAILY_LIMIT` or 80.
- `consumeAiQuota()` pre-checks, then calls `increment_ai_usage` if available.
  If the RPC is missing, it falls back to an upsert.
- The quota day key and reset currently use UTC midnight, not Africa/Tunis.
- Failed/stopped chat requests still consume a unit.
- Token counts are added after the response; this is best effort.
- Health refresh is not quota-metered.

### Telemetry

- `logAiRun` writes to the console and attempts an `ai_runs` insert.
- It records task, feature, user, client, model, status, latency, tokens, tool
  count, and error text. It does not store the prompt or message body.
- Telemetry is optional. The app must work if `ai_runs` does not exist.
- Table RLS: users can insert/read their own rows; admins can read all rows.

### Configuration

Server environment:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
```

`GEMINI_API_KEY` is only needed for AI features. Without it the rest of the app
still runs and AI routes return `503`.

Optional AI configuration:

```text
GEMINI_MODEL
GEMINI_MODEL_CHAT
GEMINI_MODEL_FAST
GEMINI_MODEL_FALLBACKS
# Per-task override, e.g. GEMINI_MODEL_IDEAS, GEMINI_MODEL_REPORT, GEMINI_MODEL_HEALTH
AI_DAILY_LIMIT
AI_TIMEOUT_MS
AI_FAST_TIMEOUT_MS
AI_REPORT_TIMEOUT_MS
```

`GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only. Never prefix
them with `NEXT_PUBLIC_`.

---

## 13. Testing and verification

### Synthetic tests

The AI suite is `scripts/test-ai-core.ts`. It currently covers:

- action schema acceptance/rejection and unknown-field stripping;
- low-risk/admin policy sets;
- deliverable status flags;
- Undo schema;
- JSON extraction;
- idea payload normalization;
- proposal display labels;
- member/admin tool declaration gating;
- system prompt defaults and safety wording;
- quota snapshot non-negativity.

It does **not** cover live Supabase, Gemini, auth, streaming, tool execution, or
the proposal apply/undo state machine end to end. Those are manual or future
work.

Run the synthetic suite:

```powershell
node --import tsx --test scripts/test-client-list.ts scripts/test-calendar-data.ts scripts/test-font-loading.ts scripts/test-devtools-probe.ts scripts/test-workspace-navigation.ts scripts/test-workspace-data.ts scripts/test-posting-silence.ts scripts/test-ai-core.ts
```

Typecheck:

```powershell
npx --no-install tsc --noEmit --incremental false --noUncheckedSideEffectImports
```

Build (stop the dev server first; both share `.next`):

```powershell
npm run build
npx --no-install next start -p 3001
```

Smoke checks:

```powershell
Invoke-WebRequest http://localhost:3001/login -UseBasicParsing
Invoke-WebRequest http://localhost:3001/api/ai/usage -UseBasicParsing
Invoke-WebRequest http://localhost:3001/dashboard -UseBasicParsing -MaximumRedirection 0
```

Expected: login `200`, usage without a session `401`, dashboard without a
session `307` to login.

Do not use `npm run lint`; ESLint is not installed and the script triggers
interactive setup.

### Manual authenticated E2E checklist

1. Admin and member login.
2. Read-only client question; confirm tool chips and real data.
3. Low-risk write; confirm the deliverable appears in the client page and
   calendar.
4. Undo; reload; confirm the Undo state persists.
5. High-risk write; confirm nothing applies before confirmation.
6. Member page: no finance values, finance tools, or admin actions.
7. Quota: one unit per request; header updates.
8. Stop mid-stream; reload; understand current persistence behavior.
9. Ideas and report generation for a test client.
10. Admin health refresh.
11. Delete test data.

---

## 14. Common tasks

### Add a read-only tool

1. Add the declaration to `toolDeclarations.ts`.
2. Add an argument schema to `ToolArgSchemas` in `tools.ts`.
3. Add a handler case with access checks and compact output.
4. Add redaction if the output can contain financial or admin-only fields.
5. Add a tool summary in `chat/route.ts` if the UI should show a useful count.
6. Add tests for admin/member declarations and, where possible, pure shape tests.
7. Add an eval case before changing the prompt.

### Add a write action

1. Add the action to `ActionSchema`.
2. Add it to `ADMIN_ACTIONS` and/or `LOW_RISK_ACTIONS` as appropriate.
3. Add its fields and type to `actionDeclaration()` in `toolDeclarations.ts`.
4. Implement the case in `apply.ts` with `canAccessClient` and explicit role
   checks.
5. If low risk, add an Undo schema and implement it in `undo.ts`.
6. Add display labels/details in `actionDisplay.ts`.
7. Verify the proposal card can render it.
8. Add schema, permission, and Undo tests.
9. Add an activity log entry with `source: 'ai'` where appropriate.
10. Update the prompt only if the model needs new field instructions.

### Add a migration

1. Add the table/column/policy/function to `supabase/schema.sql` so fresh
   installs get it.
2. Add an idempotent version to `supabase/ai_upgrade.sql` if existing databases
   need it.
3. Make optional features degrade gracefully when the migration is absent.
4. Test the upgrade twice.
5. Update this document and, if the work is planned, `AI_NEXT_STEPS.md`.

### Change model routing

1. Change `config.ts` and `.env.example`.
2. Keep a safe fallback chain.
3. Use an explicit task override rather than a new hard-coded model ID.
4. Confirm telemetry records the actual model used.
5. Re-run the chat/report/ideas smoke tests.

### Debug a failed request

- `401` - auth/session or middleware.
- `403` - admin/client access check.
- `429` - daily quota; inspect `ai_usage` and `resetAt`.
- `503` - missing `GEMINI_API_KEY` or the assistant is disabled.
- `502` - Gemini/runtime failure after retries.
- `invalid_actions` - the model produced actions that failed Zod, role, or field
  checks; the tool returns details but the UI generally shows a readable error.
- Empty answer - check `assistantText`, model response parts, and whether the
  model called a tool and stopped.
- Proposal missing - check `propose_changes` result, `ai_proposals` insert, and
  whether the last proposal overwrote an earlier one.
- Undo missing after reload - check whether the proposal was auto-applied
  (Undo is stored in message metadata) or applied later (Undo metadata is not
  persisted on the proposal row).

---

## 15. Gotchas and hard rules

1. **Never rebuild function-call parts from `functionCall`.** Preserve the full
   parts, including `thoughtSignature`.
2. **The declaration list is not authorization.** Check the role again in
   `executeTool` and `applyAction`.
3. **A member financial field needs a server-side redaction test.** UI hiding is
   not enough.
4. **Update all action layers together.** Schema, declaration, apply, undo,
   display, tests.
5. **Do not store an empty dual-platform link as `{"platform":"both"}`.**
   `serializeDeliverableLinks` must return `null` for empty input; the UI must
   not treat raw JSON as a usable link.
6. **SSE data must be one line per event.** Do not pretty-print JSON.
7. **Stop the dev server before a production build.** Dev and build share
   `.next`.
8. **Do not use `npm run lint`.** ESLint is not installed.
9. **Keep migrations idempotent.** `schema.sql` is the full install;
   `ai_upgrade.sql` is the additive upgrade.
10. **Do not use the service-role client in normal AI routes.** The current
    exception is the admin-only health refresh, which needs to scan all clients.
11. **Do not trust client notes, captions, inspirations, contact submissions, or
    tool output as instructions.** They are data.
12. **Do not add a web-fetch tool** without URL allowlisting and content
    sanitization.
13. **Do not expose raw Gemini errors or stack traces** to the user.
14. **Do not replace deterministic health scores with model output.**
15. **Leave `crm-markting-demo/` alone.** It is unrelated, untracked user work.
16. **Do not commit unless asked.**

---

## 16. Known limitations

These are real current limitations; check `AI_NEXT_STEPS.md` for the planned fix.

- No authenticated live-database E2E test has been committed.
- The optional `ai_upgrade.sql` may not be applied; telemetry, the quota RPC, and
  legacy health-factor cleanup can be absent by design.
- Health snapshots no longer store invoice counts in shared factors, but the raw
  `ai_summary` column is still readable by assigned members; it is
  prompt-constrained, not column-filtered.
- Proposal Undo/results are not stored in `ai_proposals`; Undo after reload is
  reliable for auto-applied proposals whose metadata was saved, not for every
  later-applied proposal.
- A process crash can leave a proposal in `applying`.
- Only one proposal per assistant message is shown; multiple `propose_changes`
  calls in one turn overwrite the captured proposal.
- Stopping a stream aborts the request; the assistant message is not saved, so a
  reload shows the user message without the partial answer.
- Conversation history has no search, pinning, rename UI, or message pagination.
  The API supports rename, but the drawer does not expose it.
- History is 24 messages for the model, 200 for the viewer, and 50 conversations
  in the sidebar.
- The daily quota resets at UTC midnight, not Africa/Tunis midnight.
- Health summaries bypass the shared runtime, so they lack its fallback list and
  telemetry.
- No rate limiting beyond the per-user quota; no IP/abuse protection.
- No answer feedback or prompt-version telemetry yet.
- The drawer has no dedicated screen-reader/mobile accessibility test pass.
- `upsert_goal` appears in the member action declaration enum in
  `toolDeclarations.ts`, but execution rejects it because it is in
  `ADMIN_ACTIONS`. Keep the server check; fix the declaration mismatch when
  touching that file.
- `create_client` is available to members and assigns the creator by default;
  it is not low risk and always needs confirmation.
- `book_partner` is available to members with client access and needs
  confirmation; day rates are hidden from members.

---

## 17. Glossary

- **Tool** - a Gemini function declaration plus a server handler.
- **Action** - a validated intended database change inside a proposal.
- **Proposal** - one or more actions, persisted in `ai_proposals`.
- **Low risk** - reversible action eligible for auto-apply and Undo.
- **Auto-apply** - applying low-risk actions immediately without a confirmation
  click.
- **Undo** - reversing a low-risk action through a typed Undo action.
- **SSE** - Server-Sent Events used by the chat stream.
- **Health snapshot** - a row in `client_health_snapshots` with a deterministic
  score, risk, factors, and optional AI summary.
- **Telemetry run** - one optional `ai_runs` row for a model attempt.

---

## 18. References

- Architecture and rules: this file.
- Prioritised work and acceptance criteria: [`AI_NEXT_STEPS.md`](./AI_NEXT_STEPS.md).
- Commands and environment: [`AGENTS.md`](./AGENTS.md), [`.env.example`](./.env.example).
- Product overview: [`README.md`](./README.md).
- Full schema: `supabase/schema.sql`.
- Additive AI migration: `supabase/ai_upgrade.sql`.
- Main implementation: `src/lib/ai/`, `src/app/api/ai/`,
  `src/components/AiAssistantDrawer.tsx`, `src/components/ai/ProposalCard.tsx`.
