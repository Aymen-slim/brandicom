-- Client stages: active, starting, one_time, paused (legacy potential/churned migrated)
alter type public.client_status add value if not exists 'one_time';

update public.clients set status = 'starting' where status = 'potential';
update public.clients set status = 'paused' where status = 'churned';

alter table public.clients alter column status set default 'starting';
