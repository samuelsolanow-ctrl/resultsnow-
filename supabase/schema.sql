-- ResultsNOW — rodar inteiro no SQL Editor do Supabase (uma vez)

create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slug text not null unique,
  name text not null,
  venue text,
  start_date date,
  end_date date,
  cover_url text,
  flag_mode text not null default 'country' check (flag_mode in ('country','state','both')),
  status text not null default 'live' check (status in ('draft','live','finished')),
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  crew_size int not null default 1 check (crew_size in (1,2)),
  discard_rules jsonb not null default '[{"races":4,"discards":1}]',
  sort_order int not null default 0
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  sail_number text not null,
  country text,
  state text,
  club text,
  helm_name text not null,
  helm_cbvela text,
  crew_name text,
  crew_cbvela text,
  created_at timestamptz not null default now()
);

create table if not exists public.races (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  number int not null,
  sailed_on date,
  unique (class_id, number)
);

create table if not exists public.results (
  race_id uuid not null references public.races(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  position int,
  code text,
  points numeric,
  primary key (race_id, entry_id)
);

create index if not exists classes_event_idx on public.classes(event_id);
create index if not exists entries_class_idx on public.entries(class_id);
create index if not exists races_class_idx on public.races(class_id);

-- Funções de dono (evitam recursão nas políticas)
create or replace function public.owns_event(eid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from events where id = eid and owner_id = auth.uid());
$$;

create or replace function public.owns_class(cid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from classes c join events e on e.id = c.event_id
                 where c.id = cid and e.owner_id = auth.uid());
$$;

create or replace function public.owns_race(rid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from races r join classes c on c.id = r.class_id join events e on e.id = c.event_id
                 where r.id = rid and e.owner_id = auth.uid());
$$;

alter table public.events  enable row level security;
alter table public.classes enable row level security;
alter table public.entries enable row level security;
alter table public.races   enable row level security;
alter table public.results enable row level security;

-- Leitura pública (rascunhos só para o dono)
drop policy if exists events_read on public.events;
create policy events_read on public.events for select using (status <> 'draft' or owner_id = auth.uid());
drop policy if exists classes_read on public.classes;
create policy classes_read on public.classes for select using (true);
drop policy if exists entries_read on public.entries;
create policy entries_read on public.entries for select using (true);
drop policy if exists races_read on public.races;
create policy races_read on public.races for select using (true);
drop policy if exists results_read on public.results;
create policy results_read on public.results for select using (true);

-- Escrita só pelo organizador dono do evento
drop policy if exists events_write on public.events;
create policy events_write on public.events for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists classes_write on public.classes;
create policy classes_write on public.classes for all to authenticated
  using (owns_event(event_id)) with check (owns_event(event_id));
drop policy if exists entries_write on public.entries;
create policy entries_write on public.entries for all to authenticated
  using (owns_class(class_id)) with check (owns_class(class_id));
drop policy if exists races_write on public.races;
create policy races_write on public.races for all to authenticated
  using (owns_class(class_id)) with check (owns_class(class_id));
drop policy if exists results_write on public.results;
create policy results_write on public.results for all to authenticated
  using (owns_race(race_id)) with check (owns_race(race_id));

-- Capas de evento (Storage)
insert into storage.buckets (id, name, public) values ('covers', 'covers', true)
on conflict (id) do nothing;

drop policy if exists covers_read on storage.objects;
create policy covers_read on storage.objects for select using (bucket_id = 'covers');
drop policy if exists covers_insert on storage.objects;
create policy covers_insert on storage.objects for insert to authenticated with check (bucket_id = 'covers');
drop policy if exists covers_update on storage.objects;
create policy covers_update on storage.objects for update to authenticated using (bucket_id = 'covers' and owner = auth.uid());
drop policy if exists covers_delete on storage.objects;
create policy covers_delete on storage.objects for delete to authenticated using (bucket_id = 'covers' and owner = auth.uid());
