-- Run once in the Supabase SQL editor (shared with the Brandicom site /api/contact).
-- CRM reads and deletes via the service role key.

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null default '',
  budget text not null,
  services text[] not null default '{}',
  message text not null default '',
  created_at timestamptz not null default now()
);

alter table public.contact_submissions enable row level security;

revoke all on table public.contact_submissions from anon, authenticated;
grant insert, select, delete on table public.contact_submissions to service_role;

alter table public.contact_submissions add column if not exists phone text not null default '';
