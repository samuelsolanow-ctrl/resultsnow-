import { computeStandings, type Standing } from "./scoring";
import { isConfigured, supabaseServer } from "./supabase";
import type { ClassFull, EventFull } from "./types";

const FULL_SELECT = "*, classes(*, entries(*), races(*, results(*)))";

function normalize(ev: EventFull): EventFull {
  ev.classes = (ev.classes ?? []).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  for (const c of ev.classes) {
    c.entries = c.entries ?? [];
    c.races = (c.races ?? []).sort((a, b) => a.number - b.number);
  }
  return ev;
}

export async function listPublicEvents(): Promise<EventFull[]> {
  if (!isConfigured()) return [];
  const { data, error } = await supabaseServer()
    .from("events")
    .select(FULL_SELECT)
    .neq("status", "draft")
    .order("start_date", { ascending: false, nullsFirst: false })
    .limit(60);
  if (error) {
    console.error(error);
    return [];
  }
  return (data as EventFull[]).map(normalize);
}

export async function getEventBySlug(slug: string): Promise<EventFull | null> {
  if (!isConfigured()) return null;
  const { data, error } = await supabaseServer().from("events").select(FULL_SELECT).eq("slug", slug).maybeSingle();
  if (error || !data) return null;
  return normalize(data as EventFull);
}

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
