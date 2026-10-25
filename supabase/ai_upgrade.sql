-- Brandicom AI upgrade
-- Run this once in the Supabase SQL editor if your database predates the
-- assistant telemetry + atomic usage counter. It is safe to run more than once.
--
-- The application degrades gracefully if this file has not been run: telemetry
-- inserts fail silently and the quota falls back to an upsert.

create table if not exists public.ai_runs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.users (id) on delete set null,
  client_id      uuid references public.clients (id) on delete set null,
  task           text not null,
  feature        text,
  model          text not null,
  status         text not null,
  latency_ms     integer,
  prompt_tokens  integer,
  output_tokens  integer,
  total_tokens   integer,
  tool_count     integer not null default 0,
  error          text,
  metadata       jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists ai_runs_created_idx on public.ai_runs (created_at desc);
create index if not exists ai_runs_user_idx on public.ai_runs (user_id, created_at desc);

alter table public.ai_runs enable row level security;

drop policy if exists ai_runs_insert on public.ai_runs;
create policy ai_runs_insert on public.ai_runs
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists ai_runs_select on public.ai_runs;
create policy ai_runs_select on public.ai_runs
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

create or replace function public.increment_ai_usage(p_tokens integer default 0)
returns public.ai_usage
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.ai_usage;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.ai_usage (user_id, day, requests, tokens)
  values (auth.uid(), current_date, 1, greatest(coalesce(p_tokens, 0), 0))
  on conflict (user_id, day) do update
    set requests = public.ai_usage.requests + 1,
        tokens = public.ai_usage.tokens + greatest(coalesce(p_tokens, 0), 0)
  returning * into result;

  return result;
end;
$$;

revoke all on function public.increment_ai_usage(integer) from public, anon;
grant execute on function public.increment_ai_usage(integer) to authenticated;

-- Health snapshots are readable by assigned members. Invoice-derived factors
-- must not be persisted in the shared factors JSON. This also cleans rows
-- written before the redaction fix and is safe to run more than once.
do $$
begin
  if to_regclass('public.client_health_snapshots') is not null then
    update public.client_health_snapshots
       set factors = factors - 'overdueInvoices'
     where factors ? 'overdueInvoices';
  end if;
end $$;
