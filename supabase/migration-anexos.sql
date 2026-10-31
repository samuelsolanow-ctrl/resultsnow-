-- ResultsNOW — anexos no quadro de avisos (rodar UMA vez)
alter table public.notices add column if not exists file_url text;
alter table public.notices add column if not exists file_name text;
notify pgrst, 'reload schema';
