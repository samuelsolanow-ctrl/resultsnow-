-- ResultsNOW — escolher o que aparece na súmula (rodar UMA vez)
alter table public.events drop constraint if exists events_flag_mode_check;
alter table public.events add constraint events_flag_mode_check check (flag_mode in ('country','state','both','none'));
alter table public.events add column if not exists show_club boolean not null default true;
alter table public.events add column if not exists show_cbvela boolean not null default true;
notify pgrst, 'reload schema';
