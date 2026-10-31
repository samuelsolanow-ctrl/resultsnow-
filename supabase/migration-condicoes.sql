-- ResultsNOW — condições de cada regata (rodar UMA vez)
alter table public.races add column if not exists conditions jsonb not null default '{}'::jsonb;
notify pgrst, 'reload schema';
