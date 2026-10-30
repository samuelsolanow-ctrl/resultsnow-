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
  return <AuthGate>{(org) => <Dashboard user={org.user} master={org.master} />}</AuthGate>;
}

function Dashboard({ user, master }: { user: string; master: boolean }) {
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

  async function remove(ev: EventRow) {
    if (!confirm(`Apagar "${ev.name}"?\n\nSai do site com classes, inscritos e todos os resultados. Não dá para desfazer.`)) return;
    const { error } = await db.from("events").delete().eq("id", ev.id);
    if (error) return alert(error.message);
    setEvents((list) => list.filter((x) => x.id !== ev.id));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const base = slugify(`${name} ${start.slice(0, 4)}`) || "evento";
    const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await db
      .from("events")
      .insert({ name, venue: venue || null, start_date: start || null, end_date: end || start || null, slug, status: "draft", registration_open: true })
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
          <h1 className="font-display text-3xl font-bold">{master ? "Todos os eventos" : "Meus eventos"}</h1>
          <p className="text-sm text-ink-3">
            Olá, {user.charAt(0).toUpperCase() + user.slice(1)}
            {master ? <span className="ml-2 rounded bg-night px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky">Master</span> : null}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/rankings" className="btn-ghost">Rankings</Link>
          <button className="btn-ghost" onClick={logout}>Sair</button>
        </div>
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
          <div key={ev.id} className="card flex items-center gap-2 pr-2 hover:border-ink-3">
            <Link href={`/admin/eventos/${ev.id}`} className="flex min-w-0 flex-1 items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{ev.name}</p>
                <p className="truncate text-sm text-ink-3">
                  {[ev.venue, formatDates(ev.start_date, ev.end_date), master && ev.organizer ? `por ${ev.organizer}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <StatusBadge status={ev.status} />
            </Link>
            <button
              onClick={() => remove(ev)}
              aria-label={`Apagar ${ev.name}`}
              title="Apagar evento"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-red-50 hover:text-red-700"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
              </svg>
            </button>
          </div>
        ))}
        {!events.length ? <p className="text-sm text-ink-3">Você ainda não criou nenhum evento.</p> : null}
      </div>
    </div>
  );
}
