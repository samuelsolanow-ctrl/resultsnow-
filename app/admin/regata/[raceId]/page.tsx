"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AuthGate from "@/components/AuthGate";
import { PENALTY_CODES, POINTS_CODES } from "@/lib/scoring";
import { sailDigits } from "@/lib/slug";
import { supabaseBrowser } from "@/lib/supabase";
import type { ClassRow, EntryRow, RaceRow, ResultRow } from "@/lib/types";

export default function RacePage() {
  return <AuthGate>{() => <RaceEditor />}</AuthGate>;
}

type Loaded = { race: RaceRow; cls: ClassRow; entries: EntryRow[] };

function RaceEditor() {
  const { raceId } = useParams<{ raceId: string }>();
  const router = useRouter();
  const sb = supabaseBrowser();
  const [data, setData] = useState<Loaded | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [pts, setPts] = useState<Record<string, string>>({});
  const [typed, setTyped] = useState("");
  const [date, setDate] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: race } = await sb.from("races").select("*").eq("id", raceId).single();
      if (!race) return;
      const [{ data: cls }, { data: entries }, { data: results }] = await Promise.all([
        sb.from("classes").select("*").eq("id", race.class_id).single(),
        sb.from("entries").select("*").eq("class_id", race.class_id),
        sb.from("results").select("*").eq("race_id", raceId),
      ]);
      const list = ((entries as EntryRow[]) ?? []).sort((a, b) =>
        a.sail_number.localeCompare(b.sail_number, "pt-BR", { numeric: true })
      );
      const res = (results as ResultRow[]) ?? [];
      setOrder(res.filter((r) => r.position != null && !r.code).sort((a, b) => a.position! - b.position!).map((r) => r.entry_id));
      setCodes(Object.fromEntries(res.filter((r) => r.code).map((r) => [r.entry_id, r.code!])));
      setPts(Object.fromEntries(res.filter((r) => r.points != null).map((r) => [r.entry_id, String(r.points)])));
      setDate(race.sailed_on ?? "");
      setData({ race: race as RaceRow, cls: cls as ClassRow, entries: list });
    })();
  }, [raceId, sb]);

  const byId = useMemo(() => new Map(data?.entries.map((e) => [e.id, e]) ?? []), [data]);
  const pending = useMemo(() => (data?.entries ?? []).filter((e) => !order.includes(e.id)), [data, order]);

  if (!data) return <p className="p-8 text-center text-sm text-ink-3">Carregando…</p>;
  const { race, cls, entries } = data;

  const touch = () => setDirty(true);

  function append(id: string) {
    if (order.includes(id)) return;
    setOrder((o) => [...o, id]);
    setCodes(({ [id]: _, ...rest }) => rest);
    touch();
  }

  function addTyped() {
    const tokens = typed.split(/[\s,;]+/).filter(Boolean);
    const missing: string[] = [];
    const next = [...order];
    for (const t of tokens) {
      const d = sailDigits(t);
      const match = entries.filter((e) => sailDigits(e.sail_number) === d && !next.includes(e.id));
      if (match.length === 1) next.push(match[0].id);
      else missing.push(t);
    }
    setOrder(next);
    setCodes((c) => Object.fromEntries(Object.entries(c).filter(([k]) => !next.includes(k))));
    setTyped(missing.join(" "));
    setMsg(missing.length ? `Não encontrei (ou já lançado): ${missing.join(", ")}` : null);
    touch();
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const o = [...order];
    [o[i], o[j]] = [o[j], o[i]];
    setOrder(o);
    touch();
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const rows = [
      ...order.map((entry_id, i) => ({ race_id: race.id, entry_id, position: i + 1, code: null, points: null })),
      ...pending.map((e) => {
        const code = codes[e.id] ?? "DNC";
        const isPts = (POINTS_CODES as readonly string[]).includes(code);
        return {
          race_id: race.id,
          entry_id: e.id,
          position: null,
          code,
          points: isPts && pts[e.id] ? Number(pts[e.id].replace(",", ".")) : null,
        };
      }),
    ];
    const del = await sb.from("results").delete().eq("race_id", race.id);
    const ins = del.error ? del : await sb.from("results").insert(rows);
    const upd = await sb.from("races").update({ sailed_on: date || null }).eq("id", race.id);
    setBusy(false);
    const error = ins.error ?? upd.error;
    if (error) return setMsg(error.message);
    setDirty(false);
    setMsg("Regata salva. Resultados publicados.");
  }

  async function removeRace() {
    if (!confirm(`Excluir a regata ${race.number}?`)) return;
    await sb.from("races").delete().eq("id", race.id);
    router.back();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <Link href={`/admin/eventos/${cls.event_id}`} className="text-sm text-sea">← Voltar ao evento</Link>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{cls.name}</p>
          <h1 className="font-display text-4xl font-bold leading-none">Regata {race.number}</h1>
        </div>
        <input type="date" className="input w-auto" value={date} onChange={(e) => { setDate(e.target.value); touch(); }} />
      </div>

      {/* digitação rápida */}
      <div className="card mt-5 p-4">
        <label className="label">Digite os números na ordem de chegada</label>
        <div className="flex gap-2">
          <input
            className="input"
            inputMode="numeric"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTyped())}
            placeholder="10 20 30 51"
          />
          <button className="btn-primary shrink-0" onClick={addTyped}>Lançar</button>
        </div>
        {msg ? <p className="mt-2 text-sm text-ink-2">{msg}</p> : null}
      </div>

      {/* ordem de chegada */}
      <h2 className="mb-2 mt-6 font-display text-xl font-bold">Chegada <span className="text-ink-3">{order.length}</span></h2>
      <div className="card divide-y divide-line">
        {order.map((id, i) => {
          const e = byId.get(id)!;
          return (
            <div key={id} className="flex items-center gap-3 px-3 py-2">
              <span className="num w-7 text-right font-display text-xl font-bold">{i + 1}</span>
              <span className="num w-20 shrink-0 font-semibold">{e.sail_number}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{e.helm_name}</span>
              <button className="h-8 w-8 rounded text-ink-3 hover:bg-paper" onClick={() => move(i, -1)} aria-label="Subir">↑</button>
              <button className="h-8 w-8 rounded text-ink-3 hover:bg-paper" onClick={() => move(i, 1)} aria-label="Descer">↓</button>
              <button className="h-8 w-8 rounded text-red-700 hover:bg-red-50" onClick={() => { setOrder(order.filter((x) => x !== id)); touch(); }} aria-label="Tirar">×</button>
            </div>
          );
        })}
        {!order.length ? <p className="p-3 text-sm text-ink-3">Toque nos barcos abaixo ou digite os números acima.</p> : null}
      </div>

      {/* sem chegada */}
      <h2 className="mb-1 mt-6 font-display text-xl font-bold">Sem chegada <span className="text-ink-3">{pending.length}</span></h2>
      <p className="mb-2 text-xs text-ink-3">Toque no número para pôr na chegada. Quem ficar aqui recebe o código escolhido (padrão DNC).</p>
      <div className="card divide-y divide-line">
        {pending.map((e) => {
          const code = codes[e.id] ?? "DNC";
          const needsPts = (POINTS_CODES as readonly string[]).includes(code);
          return (
            <div key={e.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <button className="num h-9 w-20 shrink-0 rounded-md border border-sea/30 bg-sea-50 font-semibold text-sea" onClick={() => append(e.id)}>
                {e.sail_number}
              </button>
              <span className="min-w-0 flex-1 truncate text-sm">{e.helm_name}</span>
              <select
                className="input h-9 w-24"
                value={code}
                onChange={(ev) => { setCodes({ ...codes, [e.id]: ev.target.value }); touch(); }}
              >
                {[...PENALTY_CODES, ...POINTS_CODES].map((c) => <option key={c}>{c}</option>)}
              </select>
              {needsPts ? (
                <input
                  className="input h-9 w-20"
                  inputMode="decimal"
                  placeholder="pontos"
                  value={pts[e.id] ?? ""}
                  onChange={(ev) => { setPts({ ...pts, [e.id]: ev.target.value }); touch(); }}
                />
              ) : null}
            </div>
          );
        })}
        {!pending.length ? <p className="p-3 text-sm text-ink-3">Todos os barcos com chegada.</p> : null}
      </div>

      <button className="btn-danger mt-8" onClick={removeRace}>Excluir regata</button>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <span className="text-sm text-ink-3">{dirty ? "Alterações não salvas" : "Tudo salvo"}</span>
          <button className="btn-primary ml-auto" disabled={busy} onClick={save}>
            {busy ? "Salvando…" : "Salvar regata"}
          </button>
        </div>
      </div>
    </div>
  );
}
