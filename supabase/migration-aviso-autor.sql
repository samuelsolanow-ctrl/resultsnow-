-- ResultsNOW — assinatura dos avisos (quem publicou) — rodar UMA vez
alter table public.notices add column if not exists author text;
notify pgrst, 'reload schema';
