import { cache } from "react";
import { computeStandings, type Standing } from "./scoring";
import { isConfigured, supabaseServer } from "./supabase";
import type { ClassFull, EntryRow, EventFull, NoticeRow, ProtestRow } from "./types";

/** inscrição feita pelo link e ainda não aprovada não entra na súmula */
export const isConfirmed = (e: EntryRow) => e.status !== "pending";

const FULL_SELECT = "*, classes(*, entries(*), races(*, results(*)))";

function normalize(ev: EventFull): EventFull {
  ev.classes = (ev.classes ?? []).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  for (const c of ev.classes) {
    c.entries = (c.entries ?? []).filter(isConfirmed);
    c.races = (c.races ?? []).sort((a, b) => a.number - b.number);
  }
  return ev;
}

export async function listPublicEvents(): Promise<EventFull[]> {
  if (!isConfigured()) return [];
  const list = (sel: string) =>
    supabaseServer().from("events").select(sel).neq("status", "draft").order("start_date", { ascending: false, nullsFirst: false }).limit(60);
  // com os avisos (para mostrar "AR · IR" no card); se der erro, segue sem
  let { data, error } = await list(`${FULL_SELECT}, notices(*)`);
  if (error) ({ data, error } = await list(FULL_SELECT));
  if (error) {
    console.error(error);
    return [];
  }
  return (data as unknown as EventFull[]).map(normalize);
}

export const getEventBySlug = cache(async function getEventBySlug(slug: string): Promise<EventFull | null> {
  if (!isConfigured()) return null;
  const sb = supabaseServer();
  const { data, error } = await sb.from("events").select(FULL_SELECT).eq("slug", slug).maybeSingle();
  if (error || !data) return null;
  const ev = normalize(data as EventFull);
  // avisos e protestos (se as tabelas ainda não existirem, segue sem eles)
  const [n, p] = await Promise.all([
    sb.from("notices").select("*").eq("event_id", ev.id).order("created_at", { ascending: false }),
    sb.from("protests").select("*").eq("event_id", ev.id).order("number", { ascending: true, nullsFirst: false }),
  ]);
  ev.notices = n.error ? [] : ((n.data ?? []) as NoticeRow[]);
  ev.protests = p.error ? [] : ((p.data ?? []) as ProtestRow[]);
  return ev;
});

export function standingsFor(c: ClassFull): Standing[] {
  return computeStandings(
    c.entries,
    c.races,
    c.races.flatMap((r) => r.results ?? []),
    c.discard_rules ?? []
  );
}

export function isPast(ev: EventFull): boolean {
  if (ev.status === "finished") return true;
  if (!ev.end_date) return false;
  const today = new Date().toISOString().slice(0, 10);
  return ev.end_date < today;
}

export function formatDates(start: string | null, end: string | null): string {
  if (!start) return "";
  const f = (d: string, withYear: boolean) =>
    new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", ...(withYear ? { year: "numeric" } : {}) }).replace(".", "");
  if (!end || end === start) return f(start, true);
  return `${f(start, false)} – ${f(end, true)}`;
}

/* ---------------- Perfil do velejador ---------------- */

export type SailorHistory = {
  name: string;
  cbvela: string | null;
  club: string | null;
  country: string | null;
  state: string | null;
  rows: {
    eventName: string;
    eventSlug: string;
    date: string | null;
    className: string;
    rank: number;
    of: number;
    net: number;
    races: number;
    crew: string | null;
  }[];
};

export const getSailor = cache(async function getSailor(entryId: string): Promise<SailorHistory | null> {
  if (!isConfigured()) return null;
  const sb = supabaseServer();
  const { data: me } = await sb.from("entries").select("*").eq("id", entryId).maybeSingle();
  if (!me) return null;
  const base = me as EntryRow;
  const q = sb.from("entries").select("id, class_id, helm_name, crew_name");
  const { data: mine } = base.helm_cbvela
    ? await q.or(`helm_cbvela.eq.${base.helm_cbvela},crew_cbvela.eq.${base.helm_cbvela}`)
    : await q.eq("helm_name", base.helm_name);
  const list = (mine ?? []) as Pick<EntryRow, "id" | "class_id" | "helm_name" | "crew_name">[];
  const classIds = [...new Set(list.map((e) => e.class_id))];
  if (!classIds.length) return null;
  const { data: classes } = await sb
    .from("classes")
    .select("*, events(name, slug, start_date, status), entries(*), races(*, results(*))")
    .in("id", classIds);

  const rows: SailorHistory["rows"] = [];
  for (const c of (classes ?? []) as (ClassFull & { events: { name: string; slug: string; start_date: string | null; status: string } })[]) {
    if (!c.events || c.events.status === "draft") continue;
    c.entries = (c.entries ?? []).filter(isConfirmed);
    c.races = (c.races ?? []).sort((a, b) => a.number - b.number);
    const st = standingsFor(c);
    for (const e of list.filter((x) => x.class_id === c.id)) {
      const s = st.find((x) => x.entry.id === e.id);
      if (!s) continue;
      rows.push({
        eventName: c.events.name,
        eventSlug: c.events.slug,
        date: c.events.start_date,
        className: c.name,
        rank: s.rank,
        of: st.length,
        net: s.net,
        races: c.races.length,
        crew: e.helm_name === base.helm_name ? e.crew_name : e.helm_name,
      });
    }
  }
  rows.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return { name: base.helm_name, cbvela: base.helm_cbvela, club: base.club, country: base.country, state: base.state, rows };
});

/* ---------------- Circuitos (ranking somando etapas) ---------------- */

export type CircuitStanding = {
  key: string;
  name: string;
  entryId: string;
  club: string | null;
  country: string | null;
  state: string | null;
  cells: { points: number; rank: number | null }[];
  total: number;
  pos: number;
};

export type CircuitView = {
  id: string;
  name: string;
  slug: string;
  stages: { eventName: string; eventSlug: string; className: string; date: string | null }[];
  standings: CircuitStanding[];
};

const sailorKey = (e: EntryRow) =>
  e.helm_cbvela ? `cb:${e.helm_cbvela}` : `n:${e.helm_name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()}`;

export const getCircuit = cache(async function getCircuit(slug: string): Promise<CircuitView | null> {
  if (!isConfigured()) return null;
  const sb = supabaseServer();
  const { data: c, error } = await sb.from("circuits").select("*, circuit_events(*)").eq("slug", slug).maybeSingle();
  if (error || !c) return null;
  const links = (c.circuit_events ?? []) as { event_id: string; class_name: string }[];
  const eventIds = [...new Set(links.map((l) => l.event_id))];
  const { data: evs } = eventIds.length ? await sb.from("events").select(FULL_SELECT).in("id", eventIds) : { data: [] };
  const events = ((evs ?? []) as EventFull[]).map(normalize);

  const stages: CircuitView["stages"] = [];
  const stageResults: { map: Map<string, { rank: number; e: EntryRow }>; dnc: number }[] = [];
  const sorted = links
    .map((l) => ({ l, ev: events.find((e) => e.id === l.event_id) }))
    .filter((x) => x.ev)
    .sort((a, b) => (a.ev!.start_date ?? "").localeCompare(b.ev!.start_date ?? ""));
  for (const { l, ev } of sorted) {
    const cls = ev!.classes.find((k) => k.name.toLowerCase() === l.class_name.toLowerCase());
    stages.push({ eventName: ev!.name, eventSlug: ev!.slug, className: l.class_name, date: ev!.start_date });
    const map = new Map<string, { rank: number; e: EntryRow }>();
    if (cls && cls.races.length) for (const s of standingsFor(cls)) map.set(sailorKey(s.entry), { rank: s.rank, e: s.entry });
    stageResults.push({ map, dnc: (cls?.entries.length ?? 0) + 1 });
  }

  const people = new Map<string, EntryRow>();
  for (const st of stageResults) for (const [k, v] of st.map) if (!people.has(k)) people.set(k, v.e);

  const standings: CircuitStanding[] = [...people].map(([key, e]) => {
    const cells = stageResults.map((st) => {
      const r = st.map.get(key);
      return r ? { points: r.rank, rank: r.rank } : { points: st.dnc, rank: null };
    });
    return {
      key,
      name: e.helm_name,
      entryId: e.id,
      club: e.club,
      country: e.country,
      state: e.state,
      cells,
      total: cells.reduce((a, x) => a + x.points, 0),
      pos: 0,
    };
  });
  standings.sort((a, b) => {
    if (a.total !== b.total) return a.total - b.total;
    const sa = a.cells.map((x) => x.points).sort((x, y) => x - y);
    const sb2 = b.cells.map((x) => x.points).sort((x, y) => x - y);
    for (let i = 0; i < sa.length; i++) if (sa[i] !== sb2[i]) return sa[i] - sb2[i];
    for (let i = a.cells.length - 1; i >= 0; i--) if (a.cells[i].points !== b.cells[i].points) return a.cells[i].points - b.cells[i].points;
    return 0;
  });
  standings.forEach((s, i) => (s.pos = i + 1));
  return { id: c.id, name: c.name, slug: c.slug, stages, standings };
});

export async function listCircuits(): Promise<{ id: string; name: string; slug: string; organizer: string | null }[]> {
  if (!isConfigured()) return [];
  const { data, error } = await supabaseServer().from("circuits").select("id, name, slug, organizer").order("created_at", { ascending: false });
  return error ? [] : (data ?? []);
}
