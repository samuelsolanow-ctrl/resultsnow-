import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isConfigured = () => Boolean(url() && key());

/** Cliente do navegador (painel do organizador), mantém a sessão */
export function supabaseBrowser(): SupabaseClient {
  if (!browserClient) browserClient = createClient(url(), key());
  return browserClient;
}

/** Cliente de leitura para páginas públicas (servidor) */
export function supabaseServer(): SupabaseClient {
  return createClient(url(), key(), { auth: { persistSession: false } });
}
