"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
import BackLink from "@/components/BackLink";
import { db } from "@/lib/adminDb";
import { slugify } from "@/lib/slug";
import type { CircuitRow } from "@/lib/types";

type Stage = { circuit_id: string; event_id: string; class_name: string };
type Ev = { id: string; name: string; start_date: string | null; classes: { name: string }[] };

export default function RankingsAdmin() {
  return <AuthGate>{() => <Rankings />}</AuthGate>;
}

function Rankings() {
  const [circuits, setCircuits] = useState<(CircuitRow & { circuit_events: Stage[] })[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [c, e] = await Promise.all([
      db.from("circuits").select("*, circuit_events(*)").order("created_at", { ascending: false }),
      db.from("events").select("id, name, start_date, classes(name)").order("start_date", { ascending: false }),
    ]);
    if (c.error) setMsg("Rode o SQL das novas funções no Supabase para usar rankings.");
    setCircuits(c.data ?? []);
    setEvents(e.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(ev: React.FormEvent) {
    ev.preventDefault();
    const slug = `${slugify(name) || "ranking"}-${Math.random().toString(36).slice(2, 5)}`;
    const { error } = await db.from("circuits").insert({ name: name.trim(), slug });
    if (error) return setMsg(error.message);
    setName("");
    load();
  }

  async function remove(c: CircuitRow) {
    if (!confirm(`Apagar o ranking "${c.name}"? Os eventos continuam existindo.`)) return;
    await db.from("circuits").delete().eq("id", c.id);
    load();
  }

  return (
    <div className="wrap max-w-4xl py-5 sm:py-8">
      <BackLink href="/admin">Eventos</BackLink>
      <h1 className="mt-2 font-display text-3xl font-bold">Rankings de circuito</h1>
      <p className="mb-5 text-sm text-ink-3">Some várias etapas (eventos) numa classificação só. Cada etapa vale a colocação final do velejador.</p>
      {msg ? <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{msg}</p> : null}

      <form onSubmit={create} className="card mb-6 flex flex-wrap gap-2 p-4">
        <input className="input min-w-0 flex-1" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Copa Paulista de ILCA 2026" />
        <button className="btn-primary">Criar ranking</button>
      </form>

      <div className="space-y-4">
        {circuits.map((c) => (
          <CircuitCard key={c.id} c={c} events={events} onChange={load} onRemove={() => remove(c)} />
        ))}
        {!circuits.length && !msg ? <p className="text-sm text-ink-3">Nenhum ranking criado.</p> : null}
      </div>
    </div>
  );
}

function CircuitCard({
  c,
  events,
  onChange,
  onRemove,
}: {
  c: CircuitRow & { circuit_events: Stage[] };
  events: Ev[];
  onChange: () => void;
  onRemove: () => void;
}) {
  const [eventId, setEventId] = useState("");
  const [cls, setCls] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const classes = events.find((e) => e.id === eventId)?.classes ?? [];

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await db.from("circuit_events").insert({ circuit_id: c.id, event_id: eventId, class_name: cls });
    if (error) return setErr(error.message.includes("duplicate") ? "Essa etapa já está no ranking." : error.message);
    setErr(null);
    setEventId("");
    setCls("");
    onChange();
  }

  async function removeStage(s: Stage) {
    await db.from("circuit_events").delete().eq("circuit_id", c.id).eq("event_id", s.event_id).eq("class_name", s.class_name);
    onChange();
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
        <h2 className="flex-1 font-display text-xl font-bold">{c.name}</h2>
        <Link href={`/rankings/${c.slug}`} target="_blank" className="text-sm font-semibold text-sea">Ver ranking ↗</Link>
        <button onClick={onRemove} className="ml-2 text-sm text-red-700">Apagar</button>
      </div>
      <div className="divide-y divide-line">
        {c.circuit_events.map((s, i) => (
          <div key={`${s.event_id}-${s.class_name}`} className="flex items-center gap-3 px-4 py-2 text-sm">
            <span className="w-8 font-display font-bold text-sea">E{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">
              {events.find((e) => e.id === s.event_id)?.name ?? "Evento"} · <b>{s.class_name}</b>
            </span>
            <button className="text-red-700" onClick={() => removeStage(s)} aria-label="Tirar etapa">×</button>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="flex flex-wrap gap-2 border-t border-line bg-paper p-3">
        <select className="input min-w-0 flex-[2]" required value={eventId} onChange={(e) => { setEventId(e.target.value); setCls(""); }}>
          <option value="">Escolha o evento…</option>
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select className="input min-w-0 flex-1" required value={cls} onChange={(e) => setCls(e.target.value)} disabled={!eventId}>
          <option value="">Classe…</option>
          {classes.map((k) => <option key={k.name}>{k.name}</option>)}
        </select>
        <button className="btn-primary">+ Etapa</button>
        {err ? <p className="w-full text-sm text-flag">{err}</p> : null}
      </form>
    </div>
  );
}
