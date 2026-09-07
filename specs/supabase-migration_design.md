# Supabase Migration Design — Remove Prisma & NextAuth

## Overview

Replace the local-stack data and auth layers with Supabase (hosted PostgreSQL +
Supabase Auth), removing Docker, Prisma, NextAuth, bcryptjs, and the mockDb
offline fallback. Product behavior and all API JSON contracts stay identical.

## Decisions

| Area | Decision |
|------|----------|
| ORM | `@supabase/supabase-js` (PostgREST) — Prisma fully removed |
| Auth | Supabase Auth (email/password) via `@supabase/ssr` cookie sessions |
| Profiles | `public.users` keyed to `auth.users(id)` — no password hash (Supabase owns credentials) |
| Enforcement | RLS policies **and** API-layer checks (defense in depth) |
| Privileged ops | Service-role client only in seed script + `POST /api/users` (auth admin API) |
| Dashboard | `SECURITY DEFINER` RPC `get_dashboard_snapshot(period)` — agency-wide metrics for all staff (matches current product spec) |
| Demo data | Identical seed dataset + demo accounts (admin@agency.com / admin123, etc.) |

## Three Perspectives

### Backend
- **Schema** (`supabase/schema.sql`): same enums/tables/FKs as the Prisma schema
  (`users`, `clients`, `client_assignments`, `deliverables`, `creators`,
  `creator_assignments`, `goals`, `messages`). `users.id` → `auth.users(id)` ON
  DELETE CASCADE; a trigger `on_auth_user_created` inserts the profile row from
  signup metadata.
- **Data access**: every route/page uses a cookie-scoped server client (anon
  key + user JWT) so RLS applies. `src/lib/data.ts` maps snake_case rows → the
  existing camelCase `src/types` so API responses are byte-compatible.
- **Aggregates**: goals engine moves to one SQL function (sum/count/group-by in
  the database instead of `groupBy`/`count` Prisma calls).

### Frontend
- `login/page.tsx` → `supabase.auth.signInWithPassword` (browser client).
- Session-consuming components (Sidebar, ClientTable, ClientDetailHeader,
  ChatThread, SettingsManager) receive `user` as a prop from server pages
  instead of `useSession()`. `SessionProvider`/`Providers` removed.
- Polling chat, optimistic sends, CSV export, and all fetch URLs unchanged.

### Security
- **Auth**: httpOnly-ish cookie sessions managed by `@supabase/ssr`; middleware
  refreshes tokens; unauthenticated page hits redirect to `/login`; API routes
  return `401 JSON` (no redirects).
- **Authz matrix (RLS + route checks)**:
  - `clients`: read/update — admin or assigned member; insert — any
    authenticated (auto-assign self); delete — admin.
  - `deliverables`, `messages`, `creator_assignments`: read/write —
    `has_client_access(client_id)`; messages `sender_id` must equal `auth.uid()`.
  - `creators`: read/insert/update — any authenticated; delete — admin.
  - `goals`: read — authenticated; write — admin.
  - `users` (profiles): read — authenticated; write — admin.
- **SQL injection**: PostgREST parameterizes all filters. Free-text search terms
  are sanitized (strip `, ( ) . % _`) before entering `or`/`ilike` filter
  expressions to prevent filter-syntax injection.
- **Data exposure**: password hashes no longer exist in app tables; responses
  select explicit columns only; service-role key is server-only (no
  `NEXT_PUBLIC_` prefix) and used only after `enforceAdmin()`.
- **Brute force**: Supabase Auth built-in rate limiting covers login attempts.
- **Logging**: console.error/warn retained; 403 authz denials logged.

## Verification Plan

1. `npm run build` (type + compile).
2. Apply `supabase/schema.sql` in Supabase SQL Editor; run `npm run db:seed`.
3. `npm run dev` + browser test: admin login, member login (scoping), dashboard
   metrics, roster, client detail (deliverables toggle, chat), settings goals
   save, creators directory.
4. RLS sanity: member API responses exclude unassigned clients.

## Out of Scope / Future Work

- Supabase Realtime to replace 4.5s polling chat.
- Rate limiting middleware beyond Supabase Auth limits.
- Password reset / email flows (internal tool; admin provisions accounts).
