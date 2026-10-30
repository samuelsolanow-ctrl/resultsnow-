"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isConfigured, supabaseBrowser } from "@/lib/supabase";

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
  const [mode, setMode] = useState<"in" | "up">("in");
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
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password });
    setBusy(false);
    if (error) return setMsg(error.message);
    if (mode === "up" && !data.session) setMsg("Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre.");
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-display text-3xl font-bold">Área do organizador</h1>
      <p className="mb-6 mt-1 text-sm text-ink-3">Crie eventos, cadastre barcos e lance os resultados.</p>
      <form onSubmit={submit} className="card space-y-4 p-5">
        <div>
          <label className="label">E-mail</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Senha</label>
          <input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {msg ? <p className="text-sm text-flag">{msg}</p> : null}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Aguarde…" : mode === "in" ? "Entrar" : "Criar conta"}
        </button>
        <button type="button" className="w-full text-sm text-sea" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Não tenho conta — criar" : "Já tenho conta — entrar"}
        </button>
      </form>
    </div>
  );
}
