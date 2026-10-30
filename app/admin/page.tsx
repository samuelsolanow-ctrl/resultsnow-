"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AuthGate, { logout } from "@/components/AuthGate";
import BackLink from "@/components/BackLink";
import StatusBadge from "@/components/StatusBadge";
import { formatDates } from "@/lib/data";
import { slugify } from "@/lib/slug";
import { db } from "@/lib/adminDb";
import type { EventRow } from "@/lib/types";

export default function AdminPage() {
  return <AuthGate>{(org) => <Dashboard user={org.user} />}</AuthGate>;
}

function Dashboard({ user }: { user: string }) {
  const router = useRouter();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await db
      .from("events")
      .select("*")
      .order("start_date", { ascending: false, nullsFirst: false });
    setEvents((data as EventRow[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const base = slugify(`${name} ${start.slice(0, 4)}`) || "evento";
    const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await db
      .from("events")
      .insert({ name, venue: venue || null, start_date: start || null, end_date: end || start || null, slug, status: "draft" })
      .select()
      .single();
    setBusy(false);
    if (error) return setErr(error.message);
    router.push(`/admin/eventos/${data.id}`);
  }

  return (
    <div className="wrap max-w-4xl py-6 sm:py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <BackLink href="/">Site</BackLink>
          <h1 className="font-display text-3xl font-bold">Meus eventos</h1>
          <p className="text-sm text-ink-3">Olá, {user.charAt(0).toUpperCase() + user.slice(1)}</p>
        </div>
        <button className="btn-ghost" onClick={logout}>Sair</button>
      </div>

      <form onSubmit={create} className="card mb-8 grid gap-3 p-4 sm:grid-cols-2">
        <h2 className="font-display text-xl font-bold sm:col-span-2">Novo evento</h2>
        <div className="sm:col-span-2">
          <label className="label">Nome</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Campeonato Paulista de ILCA 2026" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Local</label>
          <input className="input" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Yacht Club Santo Amaro, São Paulo" />
        </div>
        <div>
          <label className="label">Início</label>
          <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className="label">Término</label>
          <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        {err ? <p className="text-sm text-flag sm:col-span-2">{err}</p> : null}
        <div className="sm:col-span-2">
          <button className="btn-primary" disabled={busy}>Criar evento</button>
        </div>
      </form>

      <div className="space-y-2">
        {events.map((ev) => (
          <Link key={ev.id} href={`/admin/eventos/${ev.id}`} className="card flex items-center gap-3 p-4 hover:border-ink-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{ev.name}</p>
              <p className="text-sm text-ink-3">{[ev.venue, formatDates(ev.start_date, ev.end_date)].filter(Boolean).join(" · ")}</p>
            </div>
            <StatusBadge status={ev.status} />
          </Link>
        ))}
        {!events.length ? <p className="text-sm text-ink-3">Você ainda não criou nenhum evento.</p> : null}
      </div>
    </div>
  );
}
