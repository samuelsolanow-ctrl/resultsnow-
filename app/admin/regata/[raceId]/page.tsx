"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import AuthGate from "@/components/AuthGate";
import RaceShare from "@/components/RaceShare";
import { db } from "@/lib/adminDb";
import { CODE_LABELS, POINTS_CODES, computeStandings } from "@/lib/scoring";
import { sailDigits } from "@/lib/slug";
import type { ClassRow, EntryRow, EventRow, RaceRow, ResultRow } from "@/lib/types";

export default function RacePage() {
  return <AuthGate>{() => <RaceEditor />}</AuthGate>;
}

const QUICK_CODES = ["OCS", "DNF", "DNS", "RET", "DSQ", "BFD", "UFD", "NSC", "DNC"];
const ALL_CODES = [...QUICK_CODES, "DNE", ...POINTS_CODES];

type Loaded = {
  race: RaceRow;
  cls: ClassRow;
  ev: EventRow;
  entries: EntryRow[];
  races: RaceRow[];
  otherResults: ResultRow[];
};

function RaceEditor() {
  const { raceId } = useParams<{ raceId: string }>();
  const router = useRouter();
  const [data, setData] = useState<Loaded | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [pts, setPts] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<{ order: string[]; codes: Record<string, string> }[]>([]);
  const [mode, setMode] = useState<string>("FIN"); // FIN = chegada, ou um código
  const [filter, setFilter] = useState("");
  const [date, setDate] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [moreCodes, setMoreCodes] = useState(false);
  const filterRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: race } = await db.from("races").select("*").eq("id", raceId).single();
      if (!race) return;
      const [{ data: cls }, { data: entries }, { data: races }] = await Promise.all([
        db.from("classes").select("*").eq("id", race.class_id).single(),
        db.from("entries").select("*").eq("class_id", race.class_id),
        db.from("races").select("*, results(*)").eq("class_id", race.class_id).order("number"),
      ]);
      const { data: ev } = await db.from("events").select("*").eq("id", cls.event_id).single();
      const list = ((entries as EntryRow[]) ?? []).sort((a, b) =>
        a.sail_number.localeCompare(b.sail_number, "pt-BR", { numeric: true })
      );
      const allRaces = (races ?? []) as (RaceRow & { results: ResultRow[] })[];
      const mine = allRaces.find((r) => r.id === raceId)?.results ?? [];
      setOrder(mine.filter((r) => r.position != null && !r.code).sort((a, b) => a.position! - b.position!).map((r) => r.entry_id));
      setCodes(Object.fromEntries(mine.filter((r) => r.code && r.code !== "DNC").map((r) => [r.entry_id, r.code!])));
      setPts(Object.fromEntries(mine.filter((r) => r.points != null).map((r) => [r.entry_id, String(r.points)])));
      setDate(race.sailed_on ?? "");
      setData({
        race: race as RaceRow,
        cls: cls as ClassRow,
        ev: ev as EventRow,
        entries: list,
        races: allRaces.map(({ results: _r, ...r }) => r as RaceRow),
        otherResults: allRaces.filter((r) => r.id !== raceId).flatMap((r) => r.results ?? []),
      });
    })();
  }, [raceId]);

  const byId = useMemo(() => new Map(data?.entries.map((e) => [e.id, e]) ?? []), [data]);
  const pending = useMemo(
    () => (data?.entries ?? []).filter((e) => !order.includes(e.id) && !codes[e.id]),
    [data, order, codes]
  );
  const coded = useMemo(() => (data?.entries ?? []).filter((e) => !order.includes(e.id) && codes[e.id]), [data, order, codes]);
  const visible = useMemo(() => {
    const d = sailDigits(filter);
    const f = filter.trim().toLowerCase();
    if (!f) return pending;
    return pending.filter((e) => (d && sailDigits(e.sail_number).startsWith(d)) || e.helm_name.toLowerCase().includes(f));
  }, [pending, filter]);

  if (!data) return <p className="p-8 text-center text-sm text-ink-3">Carregando…</p>;
  const { race, cls, ev, entries } = data;

  function snapshot() {
    setHistory((h) => [...h.slice(-50), { order, codes }]);
    setDirty(true);
    setSaved(false);
  }

  function tap(id: string) {
    snapshot();
    if (mode === "FIN") {
      setOrder((o) => [...o, id]);
    } else {
      setCodes((c) => ({ ...c, [id]: mode }));
    }
    setFilter("");
    if (navigator.vibrate) navigator.vibrate(15);
  }

  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setOrder(last.order);
    setCodes(last.codes);
    setHistory((h) => h.slice(0, -1));
    setDirty(true);
  }

  function release(id: string) {
    snapshot();
    setOrder((o) => o.filter((x) => x !== id));
    setCodes(({ [id]: _, ...rest }) => rest);
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    snapshot();
    const o = [...order];
    [o[i], o[j]] = [o[j], o[i]];
    setOrder(o);
  }

  function onFilterEnter() {
    if (visible.length === 1) tap(visible[0].id);
    else {
      const d = sailDigits(filter);
      const exact = visible.filter((e) => sailDigits(e.sail_number) === d);
      if (exact.length === 1) tap(exact[0].id);
    }
  }

  function buildRows(): ResultRow[] {
    return [
      ...order.map((entry_id, i) => ({ race_id: race.id, entry_id, position: i + 1, code: null, points: null })),
      ...entries
        .filter((e) => !order.includes(e.id))
        .map((e) => {
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
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const rows = buildRows();
    const del = await db.from("results").delete().eq("race_id", race.id);
    const ins = del.error ? del : await db.from("results").insert(rows);
    const upd = await db.from("races").update({ sailed_on: date || null }).eq("id", race.id);
    // primeira regata salva publica o evento
    if (!ins.error && ev.status === "draft") {
      await db.from("events").update({ status: "live" }).eq("id", ev.id);
      setData({ ...data!, ev: { ...ev, status: "live" } });
    }
    setBusy(false);
    const error = ins.error ?? upd.error;
    if (error) return setMsg(error.message);
    setDirty(false);
    setSaved(true);
  }

  async function nextRace() {
    const nextNumber = Math.max(...data!.races.map((r) => r.number)) + 1;
    const { data: created, error } = await db
      .from("races")
      .insert({ class_id: cls.id, number: nextNumber, sailed_on: date || null })
      .select()
      .single();
    if (error) return setMsg(error.message);
    router.push(`/admin/regata/${created.id}`);
  }

  async function removeRace() {
    if (!confirm(`Excluir a regata ${race.number}?`)) return;
    await db.from("races").delete().eq("id", race.id);
    router.push(`/admin/eventos/${cls.event_id}`);
  }

  const done = order.length + coded.length;
  const modeIsCode = mode !== "FIN";
  const rowsNow = saved ? buildRows() : [];
  const standingsNow = saved
    ? computeStandings(
        entries,
        data.races.filter((r) => r.number <= race.number),
        [...data.otherResults.filter((r) => data.races.find((x) => x.id === r.race_id)!.number <= race.number), ...rowsNow],
        cls.discard_rules ?? []
      )
    : [];

  return (
    <div className="mx-auto max-w-3xl pb-32">
      {/* topo fixo */}
      <div className="sticky top-14 z-10 border-b border-line bg-white/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/admin/eventos/${cls.event_id}`} className="text-sm text-sea">← {cls.name}</Link>
          <input type="date" className="input h-8 w-36 text-xs" value={date} onChange={(e) => { setDate(e.target.value); setDirty(true); }} />
        </div>
        <div className="mt-1 flex items-end justify-between">
          <h1 className="font-display text-3xl font-bold leading-none">Regata {race.number}</h1>
          <span className="num text-sm text-ink-3">
            <b className="text-ink">{done}</b>/{entries.length} lançados
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper">
          <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${entries.length ? (done / entries.length) * 100 : 0}%` }} />
        </div>

        {/* modo */}
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
          <ModeChip active={mode === "FIN"} onClick={() => setMode("FIN")} strong>
            🏁 Chegada
          </ModeChip>
          {(moreCodes ? ALL_CODES : QUICK_CODES.slice(0, 4)).map((c) => (
            <ModeChip key={c} active={mode === c} onClick={() => setMode(c)} code>
              {c}
            </ModeChip>
          ))}
          <ModeChip active={false} onClick={() => setMoreCodes(!moreCodes)}>
            {moreCodes ? "menos" : "mais…"}
          </ModeChip>
        </div>

        <input
          ref={filterRef}
          className="input mt-2"
          inputMode="numeric"
          placeholder="Digite o nº de vela e Enter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onFilterEnter())}
        />
      </div>

      <div className="px-4">
        <p className={`mt-3 text-xs font-semibold ${modeIsCode ? "text-flag" : "text-ink-3"}`}>
          {modeIsCode
            ? `Toque nos barcos para marcar ${mode}: ${CODE_LABELS[mode] ?? ""}`
            : "Toque nos barcos na ordem em que cruzam a linha"}
        </p>

        {/* grade de barcos */}
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {visible.map((e) => (
            <button
              key={e.id}
              onClick={() => tap(e.id)}
              className={`flex h-[74px] flex-col items-center justify-center rounded-xl border-2 px-1 text-center shadow-sm transition active:scale-95 ${
                modeIsCode ? "border-red-200 bg-red-50 active:bg-red-100" : "border-line bg-white active:bg-sky/20"
              }`}
            >
              <span className="num font-display text-2xl font-bold leading-none">{e.sail_number.replace(/^[A-Z]{3}\s*/, "")}</span>
              <span className="mt-1 w-full truncate text-[11px] text-ink-3">{e.helm_name.split(" ")[0]}</span>
            </button>
          ))}
        </div>
        {!visible.length && pending.length ? <p className="mt-3 text-sm text-ink-3">Nenhum barco com “{filter}”.</p> : null}
        {!pending.length ? (
          <p className="mt-2 rounded-lg bg-sea-50 p-3 text-sm font-semibold text-sea">✓ Todos os barcos lançados. Confira e salve.</p>
        ) : null}

        {/* chegada */}
        <h2 className="mb-2 mt-7 font-display text-xl font-bold">
          Chegada <span className="text-ink-3">{order.length}</span>
        </h2>
        <div className="card divide-y divide-line">
          {order.map((id, i) => {
            const e = byId.get(id)!;
            return (
              <div key={id} className="flex items-center gap-2 px-3 py-1.5">
                <span className={`num w-8 text-right font-display text-xl font-bold ${i < 3 ? "text-sea" : ""}`}>{i + 1}</span>
                <span className="num w-16 shrink-0 font-semibold">{e.sail_number}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{e.helm_name}</span>
                <IconBtn onClick={() => move(i, -1)} label="Subir">↑</IconBtn>
                <IconBtn onClick={() => move(i, 1)} label="Descer">↓</IconBtn>
                <IconBtn onClick={() => release(id)} label="Tirar" danger>×</IconBtn>
              </div>
            );
          })}
          {!order.length ? <p className="p-3 text-sm text-ink-3">Ninguém chegou ainda.</p> : null}
        </div>

        {/* com código */}
        {coded.length ? (
          <>
            <h2 className="mb-2 mt-6 font-display text-xl font-bold">
              Penalidades <span className="text-ink-3">{coded.length}</span>
            </h2>
            <div className="card divide-y divide-line">
              {coded.map((e) => {
                const code = codes[e.id];
                const needsPts = (POINTS_CODES as readonly string[]).includes(code);
                return (
                  <div key={e.id} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                    <span className="w-12 rounded bg-red-50 py-0.5 text-center text-xs font-bold text-flag">{code}</span>
                    <span className="num w-16 shrink-0 font-semibold">{e.sail_number}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{e.helm_name}</span>
                    {needsPts ? (
                      <input
                        className="input h-8 w-20"
                        inputMode="decimal"
                        placeholder="pontos"
                        value={pts[e.id] ?? ""}
                        onChange={(ev) => { setPts({ ...pts, [e.id]: ev.target.value }); setDirty(true); }}
                      />
                    ) : null}
                    <IconBtn onClick={() => release(e.id)} label="Tirar" danger>×</IconBtn>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        {pending.length ? (
          <p className="mt-4 text-xs text-ink-3">
            {pending.length} barco{pending.length > 1 ? "s" : ""} sem lançamento {pending.length > 1 ? "ficarão" : "ficará"} como <b>DNC</b> ao salvar.
          </p>
        ) : null}
        {msg ? <p className="mt-3 text-sm text-flag">{msg}</p> : null}

        <button className="btn-danger mt-10" onClick={removeRace}>Excluir regata</button>
      </div>

      {/* barra inferior */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <button className="btn-ghost" onClick={undo} disabled={!history.length}>↶ Desfazer</button>
          <span className="hidden text-sm text-ink-3 sm:inline">{dirty ? "Não salvo" : saved ? "Publicado" : ""}</span>
          <button className="btn-primary ml-auto h-11 px-6 text-base" disabled={busy} onClick={save}>
            {busy ? "Salvando…" : "Salvar e publicar"}
          </button>
        </div>
      </div>

      {saved ? (
        <RaceShare
          onClose={() => setSaved(false)}
          onNext={nextRace}
          raceId={race.id}
          eventName={ev.name}
          eventSlug={ev.slug}
          eventId={ev.id}
          className={cls.name}
          raceNumber={race.number}
          entries={entries}
          results={rowsNow}
          standings={standingsNow}
        />
      ) : null}
    </div>
  );
}

function ModeChip({
  active,
  onClick,
  children,
  code,
  strong,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  code?: boolean;
  strong?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold transition ${
        active
          ? code
            ? "border-flag bg-flag text-white"
            : "border-night bg-night text-white"
          : "border-line bg-white text-ink-2"
      } ${strong ? "px-4" : ""}`}
    >
      {children}
    </button>
  );
}

function IconBtn({ onClick, label, danger, children }: { onClick: () => void; label: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`h-9 w-9 shrink-0 rounded-lg text-lg ${danger ? "text-red-700 hover:bg-red-50" : "text-ink-3 hover:bg-paper"}`}
    >
      {children}
    </button>
  );
}
