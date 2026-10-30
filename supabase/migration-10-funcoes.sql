-- ResultsNOW — novas funções (rodar UMA vez no SQL Editor do Supabase)

-- Divisões (Feminino, Master, Sub-19...) e inscrição pelo link
alter table public.entries add column if not exists division text;
alter table public.entries add column if not exists status text not null default 'confirmed';
alter table public.entries add column if not exists contact text;
alter table public.events  add column if not exists registration_open boolean not null default false;

-- Quadro de avisos
create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  body text,
  created_at timestamptz not null default now()
);

-- Protestos e audiências
create table if not exists public.protests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  number int,
  race text,
  protestor text not null,
  protestee text,
  hearing_at text,
  room text,
  status text not null default 'Agendado',
  decision text,
  created_at timestamptz not null default now()
);

-- Circuitos / rankings (soma de etapas)
create table if not exists public.circuits (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  organizer text,
  created_at timestamptz not null default now()
);

create table if not exists public.circuit_events (
  circuit_id uuid not null references public.circuits(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  class_name text not null,
  primary key (circuit_id, event_id, class_name)
);

create index if not exists notices_event_idx on public.notices(event_id);
create index if not exists protests_event_idx on public.protests(event_id);
create index if not exists entries_cbvela_idx on public.entries(helm_cbvela);

-- Leitura pública; gravação só pelo site (chave secreta)
alter table public.notices        enable row level security;
alter table public.protests       enable row level security;
alter table public.circuits       enable row level security;
alter table public.circuit_events enable row level security;

drop policy if exists notices_read on public.notices;
create policy notices_read on public.notices for select using (true);
drop policy if exists protests_read on public.protests;
create policy protests_read on public.protests for select using (true);
drop policy if exists circuits_read on public.circuits;
create policy circuits_read on public.circuits for select using (true);
drop policy if exists circuit_events_read on public.circuit_events;
create policy circuit_events_read on public.circuit_events for select using (true);

notify pgrst, 'reload schema';
