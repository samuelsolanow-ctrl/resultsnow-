-- ResultsNOW — login simples pela Vercel (rodar UMA vez no SQL Editor)
-- Depois disto só o site (com a chave secreta) grava no banco.

alter table public.events alter column owner_id drop not null;
alter table public.events alter column owner_id drop default;
alter table public.events add column if not exists organizer text;

drop policy if exists events_write  on public.events;
drop policy if exists classes_write on public.classes;
drop policy if exists entries_write on public.entries;
drop policy if exists races_write   on public.races;
drop policy if exists results_write on public.results;

drop policy if exists events_read on public.events;
create policy events_read on public.events for select using (status <> 'draft');

drop policy if exists covers_insert on storage.objects;
drop policy if exists covers_update on storage.objects;
drop policy if exists covers_delete on storage.objects;
