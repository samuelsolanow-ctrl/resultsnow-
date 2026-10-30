// Quem pode mexer em quê: o master mexe em tudo; os outros organizadores só nos próprios eventos
import type { SupabaseClient } from "@supabase/supabase-js";

type Op = { m: string; a: unknown[] };
const WRITES = new Set(["insert", "update", "upsert", "delete"]);
const FIELD_TABLE: Record<string, string> = { event_id: "events", class_id: "classes", race_id: "races", entry_id: "entries" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pick = (row: any): string | null => {
  const c = Array.isArray(row?.classes) ? row.classes[0] : row?.classes;
  return c?.event_id ?? null;
};

/** Descobre a quais eventos a operação se refere (pelos filtros .eq e pelas linhas inseridas) */
async function eventIdsFor(sb: SupabaseClient, table: string, ops: Op[]): Promise<string[] | null> {
  const anchors: { field: string; value: string }[] = [];
  for (const op of ops) {
    if (op.m === "eq") anchors.push({ field: String(op.a[0]), value: String(op.a[1]) });
    if (op.m === "insert" || op.m === "upsert") {
      const rows = Array.isArray(op.a[0]) ? op.a[0] : [op.a[0]];
      for (const r of rows as Record<string, unknown>[]) {
        for (const f of ["event_id", "class_id", "race_id", "entry_id"]) {
          if (r?.[f]) anchors.push({ field: f, value: String(r[f]) });
        }
      }
    }
  }
  const ids = new Set<string>();
  for (const { field, value } of anchors) {
    const kind = field === "id" ? table : FIELD_TABLE[field];
    let ev: string | null = null;
    if (kind === "events") ev = value;
    else if (kind === "classes") ev = (await sb.from("classes").select("event_id").eq("id", value).maybeSingle()).data?.event_id ?? null;
    else if (kind === "races") ev = pick((await sb.from("races").select("classes(event_id)").eq("id", value).maybeSingle()).data);
    else if (kind === "entries") ev = pick((await sb.from("entries").select("classes(event_id)").eq("id", value).maybeSingle()).data);
    else if (kind === "notices" || kind === "protests") ev = (await sb.from(kind).select("event_id").eq("id", value).maybeSingle()).data?.event_id ?? null;
    else continue;
    if (!ev) return null;
    ids.add(ev);
  }
  return ids.size ? [...ids] : null;
}

/** Retorna mensagem de erro se não puder; null se puder */
export async function checkAccess(sb: SupabaseClient, user: string, master: boolean, table: string, ops: Op[]): Promise<string | null> {
  if (master) return null;
  if (!ops.some((o) => WRITES.has(o.m))) return null; // leitura liberada (resultados são públicos)
  if (table === "events" && ops.some((o) => o.m === "insert")) return null; // criar o próprio evento
  if (table === "circuits" || table === "circuit_events") return circuitAccess(sb, user, table, ops);
  const ids = await eventIdsFor(sb, table, ops);
  if (!ids) return "Operação não permitida.";
  const { data } = await sb.from("events").select("*").in("id", ids);
  const rows = (data ?? []) as { id: string; organizer: string | null; helpers?: string[] | null }[];
  const u = user.toLowerCase();
  const isOwner = (e: (typeof rows)[number]) => (e.organizer ?? "").toLowerCase() === u;
  const isHelper = (e: (typeof rows)[number]) => (e.helpers ?? []).some((h) => h.toLowerCase() === u);
  if (rows.length !== ids.length) return "Operação não permitida.";
  // apagar o evento ou mudar os ajudantes: só o dono
  const ownerOnly =
    table === "events" &&
    (ops.some((o) => o.m === "delete") ||
      ops.some((o) => (o.m === "update" || o.m === "upsert") && o.a[0] && typeof o.a[0] === "object" && "helpers" in (o.a[0] as object)));
  if (ownerOnly) return rows.every(isOwner) ? null : "Só quem criou o evento pode apagar ou trocar os ajudantes.";
  return rows.every((e) => isOwner(e) || isHelper(e)) ? null : "Você só pode alterar os eventos que organiza ou ajuda.";
}

/** Circuitos: cada um mexe só nos rankings que criou */
async function circuitAccess(sb: SupabaseClient, user: string, table: string, ops: Op[]): Promise<string | null> {
  if (table === "circuits" && ops.some((o) => o.m === "insert")) return null;
  const ids = new Set<string>();
  for (const op of ops) {
    if (op.m === "eq" && ((table === "circuits" && op.a[0] === "id") || op.a[0] === "circuit_id")) ids.add(String(op.a[1]));
    if (op.m === "insert" || op.m === "upsert") {
      const rows = Array.isArray(op.a[0]) ? op.a[0] : [op.a[0]];
      for (const r of rows as Record<string, unknown>[]) if (r?.circuit_id) ids.add(String(r.circuit_id));
    }
  }
  if (!ids.size) return "Operação não permitida.";
  const { data } = await sb.from("circuits").select("id, organizer").in("id", [...ids]);
  const rows = (data ?? []) as { id: string; organizer: string | null }[];
  const ok = rows.length === ids.size && rows.every((c) => (c.organizer ?? "").toLowerCase() === user.toLowerCase());
  return ok ? null : "Você só pode alterar os seus rankings.";
}
