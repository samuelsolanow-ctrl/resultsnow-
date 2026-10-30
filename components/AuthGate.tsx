"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { slugify } from "@/lib/slug";
import { isConfigured, supabaseBrowser } from "@/lib/supabase";

/** "Samuel" → samuel@resultsnow.app; e-mail digitado passa direto */
export const loginEmail = (u: string) => (u.includes("@") ? u.trim().toLowerCase() : `${slugify(u)}@resultsnow.app`);

export default function AuthGate({ children }: { children: (session: Session) => React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!isConfigured()) {
      setSession(null);
      return;
    }
    const sb = supabaseBrowser();
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <p className="p-8 text-center text-sm text-ink-3">Carregando…</p>;
  if (!session) return <Login />;
  return <>{children(session)}</>;
}

function Login() {
  const mode = "in" as "in" | "up";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isConfigured()) return setMsg("Supabase não configurado nas variáveis de ambiente.");
    setBusy(true);
    setMsg(null);
    const sb = supabaseBrowser();
    const { error, data } =
      mode === "in"
        ? await sb.auth.signInWithPassword({ email: loginEmail(email), password })
        : await sb.auth.signUp({ email: loginEmail(email), password, options: { data: { username: email.trim() } } });
    setBusy(false);
    if (error) return setMsg(error.message === "Invalid login credentials" ? "Usuário ou senha incorretos." : error.message);
    if (mode === "up" && !data.session)
      setMsg("Conta criada, mas o Supabase pediu confirmação de e-mail. Desligue \"Confirm email\" em Authentication → Sign In / Providers → Email.");
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-display text-3xl font-bold">Área do organizador</h1>
      <p className="mb-6 mt-1 text-sm text-ink-3">Crie eventos, cadastre barcos e lance os resultados.</p>
      <form onSubmit={submit} className="card space-y-4 p-5">
        <div>
          <label className="label">Usuário</label>
          <input className="input" type="text" autoCapitalize="none" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Senha</label>
          <input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {msg ? <p className="text-sm text-flag">{msg}</p> : null}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Aguarde…" : mode === "in" ? "Entrar" : "Criar conta"}
        </button>
        <p className="text-center text-xs text-ink-3">Acesso só para organizadores autorizados.</p>
      </form>
    </div>
  );
}
