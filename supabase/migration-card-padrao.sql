-- ResultsNOW — card padronizado, documentos, rascunho da chegada (rodar UMA vez)
alter table public.events add column if not exists subtitle text;        -- troféu / etapa
alter table public.events add column if not exists host_club text;       -- clube organizador
alter table public.events add column if not exists club_logo_url text;   -- logo do clube
alter table public.events add column if not exists city text;            -- cidade
alter table public.events add column if not exists uf text;              -- estado (SP, RJ…)
alter table public.events add column if not exists area text;            -- raia / local
alter table public.events add column if not exists level text;           -- nível (Brasileiro, Regional…)
alter table public.classes add column if not exists planned_races int;   -- regatas programadas
alter table public.notices add column if not exists kind text not null default 'aviso'; -- 'aviso' ou 'doc' (AR, IR, emendas)
alter table public.races add column if not exists draft jsonb;           -- chegada em andamento (não publicada)
notify pgrst, 'reload schema';
