"use client";

import { useCallback, useEffect, useState } from "react";

export type Organizer = { user: string };

export async function logout() {
  await fetch("/api/login", { method: "DELETE" });
  window.location.href = "/admin";
}

export default function AuthGate({ children }: { children: (org: Organizer) => React.ReactNode }) {
  const [user, setUser] = useState<string | null | undefined>(undefined);

  const check = useCallback(async () => {
    const res = await fetch("/api/login", { cache: "no-store" }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setUser(json.user ?? null);
  }, []);

  useEffect(() => {
    check();
    const out = () => setUser(null);
    window.addEventListener("rn-logout", out);
    return () => window.removeEventListener("rn-logout", out);
  }, [check]);

  if (user === undefined) return <p className="p-8 text-center text-sm text-ink-3">Carregando…</p>;
  if (!user) return <Login onDone={setUser} />;
  return <>{children({ user })}</>;
}

function Login({ onDone }: { onDone: (u: string) => void }) {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, password }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(json.error ?? "Não foi possível entrar.");
    onDone(json.user);
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-display text-3xl font-bold">Área do organizador</h1>
      <p className="mb-6 mt-1 text-sm text-ink-3">Crie eventos, cadastre barcos e lance os resultados.</p>
      <form onSubmit={submit} className="card space-y-4 p-5">
        <div>
          <label className="label">Usuário</label>
          <input className="input" autoCapitalize="none" autoComplete="username" required value={user} onChange={(e) => setUser(e.target.value)} />
        </div>
        <div>
          <label className="label">Senha</label>
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {msg ? <p className="text-sm text-flag">{msg}</p> : null}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
      </form>
    </div>
  );
}
