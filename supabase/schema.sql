-- ============================================================================
-- Brandicom Agency CRM — complete schema (v2)
-- Run in the Supabase SQL Editor. Idempotent: safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.client_status as enum ('potential', 'starting', 'active', 'paused', 'churned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.creator_role as enum ('photographer', 'ugc', 'presenter', 'videographer');
exception when duplicate_object then null; end $$;

alter type public.creator_role add value if not exists 'influencer';
alter type public.creator_role add value if not exists 'agency';
alter type public.creator_role add value if not exists 'editor';
alter type public.creator_role add value if not exists 'designer';
alter type public.creator_role add value if not exists 'model';

do $$ begin
  create type public.deliverable_format as enum ('reel', 'photo', 'story', 'carousel');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.platform as enum ('instagram', 'tiktok', 'facebook', 'youtube');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.deliverable_status as enum ('idea', 'scripted', 'filmed', 'editing', 'scheduled', 'published');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.partner_type as enum ('individual', 'agency');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.assignment_status as enum ('booked', 'done', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contract_type as enum ('retainer', 'project', 'one_off');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invoice_status as enum ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('bank_transfer', 'cash', 'cheque', 'card', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.expense_category as enum (
    'partner_fee', 'software', 'ads', 'equipment', 'salary', 'rent', 'travel', 'freelance', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.metrics_source as enum ('manual', 'api');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.health_risk as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null,
  email      text not null unique,
  role       public.user_role not null default 'member',
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  location       text,
  status         public.client_status not null default 'potential',
  services       text[] not null default '{}',
  notes          text,
  industry       text,
  website        text,
  contact_name   text,
  contact_email  text,
  contact_phone  text,
  start_date     date,
  end_date       date,
  lead_source    text,
  churn_reason   text,
  tags           text[] not null default '{}',
  assets_url     text,
  logo_url       text,
  created_by     uuid references public.users (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);

alter table public.clients add column if not exists industry text;
alter table public.clients add column if not exists website text;
alter table public.clients add column if not exists contact_name text;
alter table public.clients add column if not exists contact_email text;
alter table public.clients add column if not exists contact_phone text;
alter table public.clients add column if not exists start_date date;
alter table public.clients add column if not exists end_date date;
alter table public.clients add column if not exists lead_source text;
alter table public.clients add column if not exists churn_reason text;
alter table public.clients add column if not exists tags text[] not null default '{}';
alter table public.clients add column if not exists assets_url text;
alter table public.clients add column if not exists logo_url text;

create table if not exists public.client_assignments (
  client_id uuid not null references public.clients (id) on delete cascade,
  user_id   uuid not null references public.users (id) on delete cascade,
  primary key (client_id, user_id)
);

create table if not exists public.client_contracts (
  client_id     uuid primary key references public.clients (id) on delete cascade,
  contract_type public.contract_type not null default 'retainer',
  monthly_fee   numeric(12, 3),
  currency      text not null default 'TND',
  billing_day   integer,
  start_date    date,
  end_date      date,
  notes         text
);

create table if not exists public.client_social_accounts (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references public.clients (id) on delete cascade,
  platform             public.platform not null,
  handle               text,
  url                  text,
  followers            integer,
  followers_updated_at timestamptz,
  unique (client_id, platform, handle)
);

create table if not exists public.deliverables (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  idea          text not null,
  title         text,
  caption       text,
  hook          text,
  filmed        boolean not null default false,
  published     boolean not null default false,
  status        public.deliverable_status not null default 'idea',
  link          text,
  format        public.deliverable_format,
  platform      public.platform,
  results       text,
  publish_date  date,
  publish_time  text,
  filming_date  date,
  scheduled_at  timestamptz,
  thumbnail_url text,
  created_by    uuid references public.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

alter table public.deliverables add column if not exists title text;
alter table public.deliverables add column if not exists caption text;
alter table public.deliverables add column if not exists hook text;
alter table public.deliverables add column if not exists status public.deliverable_status not null default 'idea';
alter table public.deliverables add column if not exists filming_date date;
alter table public.deliverables add column if not exists publish_time text;
alter table public.deliverables add column if not exists scheduled_at timestamptz;
alter table public.deliverables add column if not exists thumbnail_url text;

create table if not exists public.post_metrics (
  id               uuid primary key default gen_random_uuid(),
  deliverable_id   uuid not null references public.deliverables (id) on delete cascade,
  captured_at      timestamptz not null default now(),
  views            integer not null default 0,
  likes            integer not null default 0,
  comments         integer not null default 0,
  shares           integer not null default 0,
  saves            integer not null default 0,
  reach            integer not null default 0,
  impressions      integer not null default 0,
  link_clicks      integer not null default 0,
  followers_gained integer not null default 0,
  source           public.metrics_source not null default 'manual',
  note             text
);

create table if not exists public.creators (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  role             public.creator_role not null,
  partner_type     public.partner_type not null default 'individual',
  company          text,
  location         text,
  style_tags       text[] not null default '{}',
  instagram_handle text,
  followers        integer,
  day_rate         numeric(12, 3),
  rate_unit        text default 'day',
  available        boolean not null default true,
  phone            text,
  email            text,
  notes            text,
  portfolio_url    text,
  rating           smallint,
  last_worked_at   date,
  created_at       timestamptz not null default now()
);

alter table public.creators add column if not exists partner_type public.partner_type not null default 'individual';
alter table public.creators add column if not exists company text;
alter table public.creators add column if not exists location text;
alter table public.creators add column if not exists portfolio_url text;
alter table public.creators add column if not exists rating smallint;
alter table public.creators add column if not exists last_worked_at date;

create table if not exists public.creator_assignments (
  id             uuid primary key default gen_random_uuid(),
  creator_id     uuid not null references public.creators (id) on delete cascade,
  client_id      uuid not null references public.clients (id) on delete cascade,
  deliverable_id uuid references public.deliverables (id) on delete set null,
  scheduled_date date,
  status         public.assignment_status not null default 'booked',
  role_on_project text,
  notes          text
);

alter table public.creator_assignments add column if not exists status public.assignment_status not null default 'booked';
alter table public.creator_assignments add column if not exists role_on_project text;
alter table public.creator_assignments add column if not exists notes text;

create table if not exists public.goals (
  id           uuid primary key default gen_random_uuid(),
  period_type  text not null,
  period_value text not null,
  metric       text not null,
  target       numeric(14, 3) not null,
  unique (period_type, period_value, metric)
);

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  sender_id  uuid references public.users (id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  number       text not null unique,
  issue_date   date not null default current_date,
  due_date     date,
  period_label text,
  subtotal     numeric(12, 3) not null default 0,
  vat_rate     numeric(5, 4) not null default 0.19,
  total        numeric(12, 3) not null default 0,
  status       public.invoice_status not null default 'draft',
  notes        text,
  created_by   uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists public.payments (
  id         uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount     numeric(12, 3) not null,
  paid_at    date not null default current_date,
  method     public.payment_method not null default 'bank_transfer',
  reference  text
);

create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  date          date not null default current_date,
  amount        numeric(12, 3) not null,
  category      public.expense_category not null default 'other',
  description   text,
  client_id     uuid references public.clients (id) on delete set null,
  partner_id    uuid references public.creators (id) on delete set null,
  assignment_id uuid references public.creator_assignments (id) on delete set null,
  recurring     boolean not null default false,
  recurrence    text,
  receipt_url   text,
  created_by    uuid references public.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists public.activity_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.users (id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  diff       jsonb,
  source     text not null default 'user',
  created_at timestamptz not null default now()
);

create table if not exists public.client_health_snapshots (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  score       integer not null,
  risk        public.health_risk not null,
  factors     jsonb not null default '{}',
  ai_summary  text,
  computed_at timestamptz not null default now()
);

create table if not exists public.client_reports (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  month        text not null,
  content_md   text not null,
  generated_by uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (client_id, month)
);

create table if not exists public.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  title      text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role            text not null,
  content         text not null default '',
  tool_calls      jsonb,
  created_at      timestamptz not null default now()
);

create table if not exists public.ai_proposals (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.ai_conversations (id) on delete set null,
  user_id         uuid not null references public.users (id) on delete cascade,
  actions         jsonb not null,
  status          text not null default 'pending',
  applied_at      timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.ai_usage (
  user_id  uuid not null references public.users (id) on delete cascade,
  day      date not null default current_date,
  requests integer not null default 0,
  tokens   integer not null default 0,
  primary key (user_id, day)
);

-- Migrate contract_value if the old column still exists.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'contract_value'
  ) then
    insert into public.client_contracts (client_id, contract_type, monthly_fee, currency)
    select id, 'retainer', contract_value, 'TND'
    from public.clients
    where contract_value is not null
    on conflict (client_id) do nothing;
    alter table public.clients drop column contract_value;
  end if;
end $$;

-- Keep filmed/published in sync with status.
create or replace function public.sync_deliverable_flags()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.published := new.status = 'published';
    new.filmed := new.status in ('filmed', 'editing', 'scheduled', 'published');
  elsif tg_op = 'UPDATE' and ((new.published is distinct from old.published) or (new.filmed is distinct from old.filmed)) then
    if new.published then
      new.status := 'published';
    elsif new.filmed then
      new.status := 'filmed';
    end if;
  elsif tg_op = 'INSERT' then
    if new.published then
      new.status := 'published';
    elsif new.filmed and new.status = 'idea' then
      new.status := 'filmed';
    end if;
    new.published := new.status = 'published';
    new.filmed := new.status in ('filmed', 'editing', 'scheduled', 'published');
  end if;
  return new;
end;
$$;

drop trigger if exists deliverable_sync_flags on public.deliverables;
create trigger deliverable_sync_flags
  before insert or update on public.deliverables
  for each row execute function public.sync_deliverable_flags();

-- Invoice status from payments.
create or replace function public.recompute_invoice_status()
returns trigger language plpgsql as $$
declare
  v_invoice_id uuid;
  v_total numeric;
  v_paid numeric;
  v_status public.invoice_status;
  v_due date;
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);
  select total, due_date, status into v_total, v_due, v_status
  from public.invoices where id = v_invoice_id;
  if not found then return coalesce(new, old); end if;
  if v_status = 'cancelled' then return coalesce(new, old); end if;

  select coalesce(sum(amount), 0) into v_paid from public.payments where invoice_id = v_invoice_id;

  if v_paid <= 0 then
    v_status := case when v_due is not null and v_due < current_date then 'overdue' else 'sent' end;
  elsif v_paid >= v_total then
    v_status := 'paid';
  else
    v_status := 'partially_paid';
  end if;

  update public.invoices set status = v_status where id = v_invoice_id and status <> 'draft' and status <> 'cancelled';
  return coalesce(new, old);
end;
$$;

drop trigger if exists payments_recompute_invoice on public.payments;
create trigger payments_recompute_invoice
  after insert or update or delete on public.payments
  for each row execute function public.recompute_invoice_status();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists clients_status_idx          on public.clients (status);
create index if not exists clients_created_at_idx      on public.clients (created_at desc);
create index if not exists assignments_user_idx        on public.client_assignments (user_id);
create index if not exists deliverables_client_idx     on public.deliverables (client_id);
create index if not exists deliverables_published_idx  on public.deliverables (published, publish_date);
create index if not exists deliverables_status_idx     on public.deliverables (status);
create index if not exists deliverables_filming_date_idx on public.deliverables (filming_date);
create index if not exists deliverables_created_by_idx on public.deliverables (created_by);
create index if not exists post_metrics_del_idx        on public.post_metrics (deliverable_id, captured_at desc);
create index if not exists creator_assign_creator_idx  on public.creator_assignments (creator_id);
create index if not exists creator_assign_client_idx   on public.creator_assignments (client_id);
create index if not exists messages_client_idx         on public.messages (client_id, created_at);
create index if not exists messages_sender_idx         on public.messages (sender_id);
create index if not exists goals_period_idx            on public.goals (period_value);
create index if not exists invoices_client_idx         on public.invoices (client_id, issue_date desc);
create index if not exists invoices_status_idx         on public.invoices (status);
create index if not exists payments_invoice_idx        on public.payments (invoice_id);
create index if not exists expenses_date_idx           on public.expenses (date desc);
create index if not exists expenses_client_idx         on public.expenses (client_id);
create index if not exists activity_log_created_idx    on public.activity_log (created_at desc);
create index if not exists health_client_idx           on public.client_health_snapshots (client_id, computed_at desc);
create index if not exists social_client_idx           on public.client_social_accounts (client_id);
create index if not exists ai_conv_user_idx            on public.ai_conversations (user_id, created_at desc);
create index if not exists ai_msg_conv_idx             on public.ai_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.has_client_access(p_client_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
  or exists (
    select 1 from public.client_assignments
    where client_id = p_client_id and user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.has_client_access(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_client_access(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.users                    enable row level security;
alter table public.clients                  enable row level security;
alter table public.client_assignments       enable row level security;
alter table public.client_contracts         enable row level security;
alter table public.client_social_accounts   enable row level security;
alter table public.deliverables             enable row level security;
alter table public.post_metrics             enable row level security;
alter table public.creators                 enable row level security;
alter table public.creator_assignments      enable row level security;
alter table public.goals                    enable row level security;
alter table public.messages                 enable row level security;
alter table public.invoices                 enable row level security;
alter table public.payments                 enable row level security;
alter table public.expenses                 enable row level security;
alter table public.activity_log             enable row level security;
alter table public.client_health_snapshots  enable row level security;
alter table public.client_reports           enable row level security;
alter table public.ai_conversations         enable row level security;
alter table public.ai_messages              enable row level security;
alter table public.ai_proposals             enable row level security;
alter table public.ai_usage                 enable row level security;

-- users
drop policy if exists users_select on public.users;
create policy users_select on public.users for select to authenticated using (true);
drop policy if exists users_insert on public.users;
create policy users_insert on public.users for insert to authenticated with check (public.is_admin());
drop policy if exists users_update on public.users;
create policy users_update on public.users for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists users_delete on public.users;
create policy users_delete on public.users for delete to authenticated using (public.is_admin());

-- clients
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.client_assignments ca
      where ca.client_id = clients.id and ca.user_id = auth.uid()
    )
  );
drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients for insert to authenticated with check (true);
drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update to authenticated
  using (public.has_client_access(clients.id)) with check (public.has_client_access(clients.id));
drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients for delete to authenticated using (public.is_admin());

-- client_assignments
drop policy if exists client_assignments_select on public.client_assignments;
create policy client_assignments_select on public.client_assignments
  for select to authenticated using (public.has_client_access(client_assignments.client_id));
drop policy if exists client_assignments_insert on public.client_assignments;
create policy client_assignments_insert on public.client_assignments
  for insert to authenticated with check (
    public.has_client_access(client_assignments.client_id)
    or (
      client_assignments.user_id = auth.uid()
      and exists (
        select 1 from public.clients c
        where c.id = client_assignments.client_id and c.created_by = auth.uid()
      )
    )
  );
drop policy if exists client_assignments_delete on public.client_assignments;
create policy client_assignments_delete on public.client_assignments
  for delete to authenticated using (public.has_client_access(client_assignments.client_id));

-- contracts: admin only
drop policy if exists client_contracts_all on public.client_contracts;
create policy client_contracts_select on public.client_contracts
  for select to authenticated using (public.is_admin());
drop policy if exists client_contracts_write on public.client_contracts;
create policy client_contracts_write on public.client_contracts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- socials
drop policy if exists social_select on public.client_social_accounts;
create policy social_select on public.client_social_accounts
  for select to authenticated using (public.has_client_access(client_id));
drop policy if exists social_write on public.client_social_accounts;
create policy social_write on public.client_social_accounts
  for all to authenticated using (public.has_client_access(client_id)) with check (public.has_client_access(client_id));

-- deliverables
drop policy if exists deliverables_select on public.deliverables;
create policy deliverables_select on public.deliverables
  for select to authenticated using (public.has_client_access(deliverables.client_id));
drop policy if exists deliverables_insert on public.deliverables;
create policy deliverables_insert on public.deliverables
  for insert to authenticated with check (public.has_client_access(deliverables.client_id));
drop policy if exists deliverables_update on public.deliverables;
create policy deliverables_update on public.deliverables
  for update to authenticated using (public.has_client_access(deliverables.client_id))
  with check (public.has_client_access(deliverables.client_id));
drop policy if exists deliverables_delete on public.deliverables;
create policy deliverables_delete on public.deliverables
  for delete to authenticated using (public.has_client_access(deliverables.client_id));

-- post_metrics (via parent deliverable)
drop policy if exists post_metrics_select on public.post_metrics;
create policy post_metrics_select on public.post_metrics
  for select to authenticated using (
    exists (select 1 from public.deliverables d where d.id = post_metrics.deliverable_id and public.has_client_access(d.client_id))
  );
drop policy if exists post_metrics_write on public.post_metrics;
create policy post_metrics_write on public.post_metrics
  for all to authenticated using (
    exists (select 1 from public.deliverables d where d.id = post_metrics.deliverable_id and public.has_client_access(d.client_id))
  ) with check (
    exists (select 1 from public.deliverables d where d.id = post_metrics.deliverable_id and public.has_client_access(d.client_id))
  );

-- creator assignments
drop policy if exists creator_assignments_select on public.creator_assignments;
create policy creator_assignments_select on public.creator_assignments
  for select to authenticated using (public.has_client_access(creator_assignments.client_id));
drop policy if exists creator_assignments_insert on public.creator_assignments;
create policy creator_assignments_insert on public.creator_assignments
  for insert to authenticated with check (public.has_client_access(creator_assignments.client_id));
drop policy if exists creator_assignments_update on public.creator_assignments;
create policy creator_assignments_update on public.creator_assignments
  for update to authenticated using (public.has_client_access(creator_assignments.client_id))
  with check (public.has_client_access(creator_assignments.client_id));
drop policy if exists creator_assignments_delete on public.creator_assignments;
create policy creator_assignments_delete on public.creator_assignments
  for delete to authenticated using (public.has_client_access(creator_assignments.client_id));

-- creators
drop policy if exists creators_select on public.creators;
create policy creators_select on public.creators for select to authenticated using (true);
drop policy if exists creators_insert on public.creators;
create policy creators_insert on public.creators for insert to authenticated with check (public.is_admin());
drop policy if exists creators_update on public.creators;
create policy creators_update on public.creators for update to authenticated using (true) with check (true);
drop policy if exists creators_delete on public.creators;
create policy creators_delete on public.creators for delete to authenticated using (public.is_admin());

-- goals: members cannot see financial metrics
drop policy if exists goals_select on public.goals;
create policy goals_select on public.goals for select to authenticated
  using (public.is_admin() or metric not in ('revenue', 'profit'));
drop policy if exists goals_insert on public.goals;
create policy goals_insert on public.goals for insert to authenticated with check (public.is_admin());
drop policy if exists goals_update on public.goals;
create policy goals_update on public.goals for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists goals_delete on public.goals;
create policy goals_delete on public.goals for delete to authenticated using (public.is_admin());

-- messages
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated using (public.has_client_access(messages.client_id));
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated with check (sender_id = auth.uid() and public.has_client_access(messages.client_id));

-- finance tables: admin only
drop policy if exists invoices_admin on public.invoices;
create policy invoices_admin on public.invoices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists payments_admin on public.payments;
create policy payments_admin on public.payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists expenses_admin on public.expenses;
create policy expenses_admin on public.expenses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- activity log
drop policy if exists activity_select on public.activity_log;
create policy activity_select on public.activity_log for select to authenticated using (public.is_admin());
drop policy if exists activity_insert on public.activity_log;
create policy activity_insert on public.activity_log for insert to authenticated with check (actor_id = auth.uid());

-- health / reports
drop policy if exists health_select on public.client_health_snapshots;
create policy health_select on public.client_health_snapshots
  for select to authenticated using (public.has_client_access(client_id));
drop policy if exists health_write on public.client_health_snapshots;
create policy health_write on public.client_health_snapshots
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists reports_select on public.client_reports;
create policy reports_select on public.client_reports
  for select to authenticated using (public.has_client_access(client_id));
drop policy if exists reports_write on public.client_reports;
create policy reports_write on public.client_reports
  for all to authenticated using (public.has_client_access(client_id)) with check (public.has_client_access(client_id));

-- AI
drop policy if exists ai_conv_owner on public.ai_conversations;
create policy ai_conv_owner on public.ai_conversations
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists ai_msg_owner on public.ai_messages;
create policy ai_msg_owner on public.ai_messages
  for all to authenticated using (
    exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );
drop policy if exists ai_prop_owner on public.ai_proposals;
create policy ai_prop_owner on public.ai_proposals
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists ai_usage_owner on public.ai_usage;
create policy ai_usage_owner on public.ai_usage
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Auth profile trigger
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    case new.raw_user_meta_data ->> 'role'
      when 'admin' then 'admin'::public.user_role
      else 'member'::public.user_role
    end
  )
  on conflict (id) do update
    set name = excluded.name, email = excluded.email, role = excluded.role;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Dashboard snapshot
-- ---------------------------------------------------------------------------
create or replace function public.get_dashboard_snapshot(p_period text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_start        timestamptz;
  v_end          timestamptz;
  v_is_year      boolean;
  v_admin        boolean;
  v_revenue      numeric := 0;
  v_expenses     numeric := 0;
  v_outstanding  numeric := 0;
  v_overdue      numeric := 0;
  v_mrr          numeric := 0;
  v_deliverables bigint;
  v_new_clients  bigint;
  v_views        bigint := 0;
  v_pipeline     jsonb;
  v_targets      jsonb;
  v_top          jsonb;
  v_active       bigint;
  v_churned      bigint;
  v_total        bigint;
begin
  v_admin := public.is_admin();

  if p_period ~ '^\d{4}$' then
    v_is_year := true;
    v_start := make_timestamptz(substr(p_period, 1, 4)::int, 1, 1, 0, 0, 0);
    v_end   := make_timestamptz(substr(p_period, 1, 4)::int, 12, 31, 23, 59, 59);
  elsif p_period ~ '^\d{4}-\d{2}$' then
    v_is_year := false;
    v_start := make_timestamptz(substr(p_period, 1, 4)::int, substr(p_period, 6, 2)::int, 1, 0, 0, 0);
    v_end   := v_start + interval '1 month' - interval '1 microsecond';
  else
    raise exception 'Invalid period format: expected YYYY or YYYY-MM, got "%"', p_period;
  end if;

  if v_admin then
    select coalesce(sum(p.amount), 0) into v_revenue
    from public.payments p
    where p.paid_at >= v_start::date and p.paid_at <= v_end::date;

    select coalesce(sum(e.amount), 0) into v_expenses
    from public.expenses e
    where e.date >= v_start::date and e.date <= v_end::date;

    select coalesce(sum(i.total - coalesce(p.paid, 0)), 0)
    into v_outstanding
    from public.invoices i
    left join (select invoice_id, sum(amount) paid from public.payments group by invoice_id) p on p.invoice_id = i.id
    where i.status in ('sent', 'partially_paid', 'overdue');

    select coalesce(sum(i.total - coalesce(p.paid, 0)), 0)
    into v_overdue
    from public.invoices i
    left join (select invoice_id, sum(amount) paid from public.payments group by invoice_id) p on p.invoice_id = i.id
    where i.status = 'overdue' or (i.status in ('sent', 'partially_paid') and i.due_date < current_date);

    select coalesce(sum(monthly_fee), 0) into v_mrr
    from public.client_contracts cc
    join public.clients c on c.id = cc.client_id
    where c.status = 'active' and cc.contract_type = 'retainer';
  end if;

  select count(*) into v_deliverables
  from public.deliverables
  where published = true
    and publish_date >= v_start::date
    and publish_date <= v_end::date;

  select count(*) into v_new_clients
  from public.clients
  where created_at >= v_start and created_at <= v_end;

  select coalesce(sum(pm.views), 0) into v_views
  from public.post_metrics pm
  join public.deliverables d on d.id = pm.deliverable_id
  where d.published = true
    and d.publish_date >= v_start::date
    and d.publish_date <= v_end::date
    and pm.captured_at = (
      select max(pm2.captured_at) from public.post_metrics pm2 where pm2.deliverable_id = pm.deliverable_id
    );

  select coalesce(jsonb_object_agg(status::text, cnt), '{}'::jsonb) into v_pipeline
  from (select status, count(*) as cnt from public.clients group by status) s;

  select count(*) into v_active  from public.clients where status = 'active';
  select count(*) into v_churned from public.clients where status = 'churned';
  select count(*) into v_total   from public.clients;

  if v_admin then
    select coalesce(jsonb_object_agg(metric, target), '{}'::jsonb) into v_targets
    from public.goals where period_value = p_period;
  else
    select coalesce(jsonb_object_agg(metric, target), '{}'::jsonb) into v_targets
    from public.goals where period_value = p_period and metric not in ('revenue', 'profit');
  end if;

  if v_admin then
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_top
    from (
      select c.id, c.name, c.status::text as status, cc.monthly_fee as contract_value
      from public.clients c
      left join public.client_contracts cc on cc.client_id = c.id
      order by cc.monthly_fee desc nulls last
      limit 8
    ) t;
  else
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_top
    from (
      select c.id, c.name, c.status::text as status, null::numeric as contract_value
      from public.clients c
      where public.has_client_access(c.id)
      order by c.created_at desc
      limit 8
    ) t;
  end if;

  return jsonb_build_object(
    'isYear', v_is_year,
    'isAdmin', v_admin,
    'revenueActual', case when v_admin then v_revenue else null end,
    'expensesActual', case when v_admin then v_expenses else null end,
    'profitActual', case when v_admin then v_revenue - v_expenses else null end,
    'outstanding', case when v_admin then v_outstanding else null end,
    'overdue', case when v_admin then v_overdue else null end,
    'mrr', case when v_admin then v_mrr else null end,
    'deliverablesActual', v_deliverables,
    'newClientsActual', v_new_clients,
    'viewsActual', v_views,
    'pipeline', v_pipeline,
    'activeCount', v_active,
    'churnedCount', v_churned,
    'totalClients', v_total,
    'targets', v_targets,
    'topClients', v_top
  );
end;
$$;

revoke all on function public.get_dashboard_snapshot(text) from public, anon;
grant execute on function public.get_dashboard_snapshot(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Finance summary (admin only)
-- ---------------------------------------------------------------------------
create or replace function public.get_finance_summary(p_period text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_start date;
  v_end   date;
  v_year  int;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  if p_period ~ '^\d{4}$' then
    v_year := substr(p_period, 1, 4)::int;
    v_start := make_date(v_year, 1, 1);
    v_end := make_date(v_year, 12, 31);
  elsif p_period ~ '^\d{4}-\d{2}$' then
    v_start := make_date(substr(p_period, 1, 4)::int, substr(p_period, 6, 2)::int, 1);
    v_end := (v_start + interval '1 month' - interval '1 day')::date;
    v_year := extract(year from v_start)::int;
  else
    raise exception 'Invalid period';
  end if;

  select jsonb_build_object(
    'period', p_period,
    'revenueReceived', (select coalesce(sum(amount), 0) from public.payments where paid_at between v_start and v_end),
    'invoiced', (select coalesce(sum(total), 0) from public.invoices where issue_date between v_start and v_end and status <> 'cancelled'),
    'outstanding', (
      select coalesce(sum(i.total - coalesce(p.paid, 0)), 0)
      from public.invoices i
      left join (select invoice_id, sum(amount) paid from public.payments group by invoice_id) p on p.invoice_id = i.id
      where i.status in ('sent', 'partially_paid', 'overdue')
    ),
    'overdue', (
      select coalesce(sum(i.total - coalesce(p.paid, 0)), 0)
      from public.invoices i
      left join (select invoice_id, sum(amount) paid from public.payments group by invoice_id) p on p.invoice_id = i.id
      where i.status = 'overdue' or (i.status in ('sent', 'partially_paid') and i.due_date < current_date)
    ),
    'expenses', (select coalesce(sum(amount), 0) from public.expenses where date between v_start and v_end),
    'mrr', (
      select coalesce(sum(cc.monthly_fee), 0)
      from public.client_contracts cc
      join public.clients c on c.id = cc.client_id
      where c.status = 'active' and cc.contract_type = 'retainer'
    ),
    'expensesByCategory', (
      select coalesce(jsonb_object_agg(category, total), '{}'::jsonb)
      from (
        select category::text as category, sum(amount) as total
        from public.expenses where date between v_start and v_end
        group by category
      ) s
    ),
    'monthlySeries', (
      select coalesce(jsonb_agg(row_to_json(s) order by s.month), '[]'::jsonb)
      from (
        select
          to_char(d, 'YYYY-MM') as month,
          coalesce((select sum(amount) from public.payments p where to_char(p.paid_at, 'YYYY-MM') = to_char(d, 'YYYY-MM')), 0) as revenue,
          coalesce((select sum(amount) from public.expenses e where to_char(e.date, 'YYYY-MM') = to_char(d, 'YYYY-MM')), 0) as expenses
        from generate_series(make_date(v_year, 1, 1), make_date(v_year, 12, 1), interval '1 month') d
      ) s
    ),
    'clientProfitability', (
      select coalesce(jsonb_agg(row_to_json(s)), '[]'::jsonb)
      from (
        select
          c.id as "clientId",
          c.name,
          coalesce((
            select sum(p.amount) from public.payments p
            join public.invoices i on i.id = p.invoice_id
            where i.client_id = c.id and p.paid_at between v_start and v_end
          ), 0) as revenue,
          coalesce((
            select sum(e.amount) from public.expenses e
            where e.client_id = c.id and e.date between v_start and v_end
          ), 0) as expenses
        from public.clients c
        order by c.name
      ) s
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_finance_summary(text) from public, anon;
grant execute on function public.get_finance_summary(text) to authenticated;
