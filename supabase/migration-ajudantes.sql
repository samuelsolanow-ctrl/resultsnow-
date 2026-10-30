-- ResultsNOW — organizadores ajudantes por evento (rodar UMA vez)
alter table public.events add column if not exists helpers text[] not null default '{}';
notify pgrst, 'reload schema';
