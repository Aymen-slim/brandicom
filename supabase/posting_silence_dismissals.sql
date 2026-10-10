-- Closed "no post for 6+ days" alerts. Re-run safely in the Supabase SQL editor.
-- An alert can come back after the client is published again and then goes quiet.

create table if not exists public.posting_silence_dismissals (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  gap_key      text not null check (gap_key = 'none' or gap_key ~ '^\d{4}-\d{2}-\d{2}$'),
  dismissed_by uuid references public.users (id) on delete set null,
  dismissed_at timestamptz not null default now(),
  unique (client_id, gap_key)
);

alter table public.posting_silence_dismissals enable row level security;

drop policy if exists posting_silence_dismissals_select on public.posting_silence_dismissals;
create policy posting_silence_dismissals_select on public.posting_silence_dismissals
  for select to authenticated using (public.is_admin());

drop policy if exists posting_silence_dismissals_insert on public.posting_silence_dismissals;
create policy posting_silence_dismissals_insert on public.posting_silence_dismissals
  for insert to authenticated with check (public.is_admin() and dismissed_by = auth.uid());

drop policy if exists posting_silence_dismissals_delete on public.posting_silence_dismissals;
create policy posting_silence_dismissals_delete on public.posting_silence_dismissals
  for delete to authenticated using (public.is_admin());

grant select, insert, delete on public.posting_silence_dismissals to authenticated;
revoke all on public.posting_silence_dismissals from anon;
