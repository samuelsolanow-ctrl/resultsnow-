"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import AuthGate from "@/components/AuthGate";
import BackLink from "@/components/BackLink";
import ConditionsPanel from "@/components/ConditionsPanel";
import { cleanConditions, hasConditions, type RaceConditions } from "@/lib/conditions";
import RaceShare from "@/components/RaceShare";
import { db, uploadAttachment } from "@/lib/adminDb";
import { dropAudio, pendingAudios, queueAudio } from "@/lib/idbQueue";
import { CODE_LABELS, KEEP_PLACE_CODES, POINTS_CODES, computeStandings } from "@/lib/scoring";
import { matchSpoken } from "@/lib/voiceMatch";
import { sailDigits } from "@/lib/slug";
import type { ClassRow, EntryRow, EventRow, RaceRow, ResultRow } from "@/lib/types";

export default function RacePage() {
  return <AuthGate>{() => <RaceEditor />}</AuthGate>;
}

const QUICK_CODES = ["OCS", "DNF", "DNS", "RET", "DSQ", "BFD", "UFD", "NSC", "DNC"];
const ALL_CODES = [...QUICK_CODES, "DNE", "DGM", "RDG"];
/** marcações para quem cruzou a linha (mantém o lugar) */
const FINISH_MARKS = ["", "TIE", ...KEEP_PLACE_CODES];
const isKeep = (c?: string) => !!c && (KEEP_PLACE_CODES as readonly string[]).includes(c);
const isPts = (c?: string) => !!c && (POINTS_CODES as readonly string[]).includes(c);

type Draft = { order: string[]; codes: Record<string, string>; tied: string[]; pts: Record<string, string>; date: string; cond?: RaceConditions; t: number };

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
  const [tied, setTied] = useState<string[]>([]);
  const [history, setHistory] = useState<{ order: string[]; codes: Record<string, string>; tied: string[] }[]>([]);
  const [mode, setMode] = useState<string>("FIN"); // FIN = chegada, ou um código
  const [filter, setFilter] = useState("");
  const [date, setDate] = useState("");
  const [cond, setCond] = useState<RaceConditions>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [moreCodes, setMoreCodes] = useState(false);
  const filterRef = useRef<HTMLInputElement>(null);
  // sem sinal: rascunho no celular + envio automático quando a internet volta
  const [pendingSync, setPendingSync] = useState(false);
  const [draftFound, setDraftFound] = useState<Draft | null>(null);
  const draftKey = `rn-draft-${raceId}`;
  const saveRef = useRef<() => void>(() => {});
  const pendingSyncRef = useRef(false);
  pendingSyncRef.current = pendingSync;
  // voz
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const listeningRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const speechRef = useRef<(t: string) => void>(() => {});
  // gravação do áudio da chegada
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recStartRef = useRef<number>(0);
  const [pendingAudio, setPendingAudio] = useState(0);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const audioUploadRef = useRef<() => void>(() => {});

  useEffect(() => {
    (async () => {
      // uma única ida ao servidor traz regata, classe, evento, inscritos e resultados
      const { data: race } = await db
        .from("races")
        .select("*, classes(*, events(*), entries(*), races(*, results(*)))")
        .eq("id", raceId)
        .single();
      if (!race) return;
      const { events: ev, entries, races, ...cls } = race.classes;
      const list = ((entries as EntryRow[]) ?? []).filter((e) => e.status !== "pending").sort((a, b) =>
        a.sail_number.localeCompare(b.sail_number, "pt-BR", { numeric: true })
      );
      const allRaces = ((races ?? []) as (RaceRow & { results: ResultRow[] })[]).sort((x, y) => x.number - y.number);
      const mine = allRaces.find((r) => r.id === raceId)?.results ?? [];
      const fin = mine.filter((r) => r.position != null).sort((a, b) => a.position! - b.position!);
      setOrder(fin.map((r) => r.entry_id));
      setTied(fin.filter((r, i) => i > 0 && r.position === fin[i - 1].position).map((r) => r.entry_id));
      setCodes(Object.fromEntries(mine.filter((r) => r.code && r.code !== "DNC").map((r) => [r.entry_id, r.code!])));
      setPts(Object.fromEntries(mine.filter((r) => r.points != null).map((r) => [r.entry_id, String(r.points)])));
      setDate(race.sailed_on ?? "");
      // condições: as já salvas; numa regata nova, repete raia e percurso da anterior
      if (hasConditions(race.conditions)) setCond(race.conditions);
      else {
        const prev = allRaces.filter((r) => r.number < race.number).pop() as (RaceRow & { conditions?: RaceConditions }) | undefined;
        const pc = prev?.conditions ?? {};
        setCond(cleanConditions({ area: pc.area, course: pc.course, recordings: race.conditions?.recordings }));
      }
      try {
        const d = localStorage.getItem(`rn-draft-${raceId}`);
        if (d) setDraftFound(JSON.parse(d));
      } catch {
        /* sem armazenamento */
      }
      setData({
        race: { id: race.id, class_id: race.class_id, number: race.number, sailed_on: race.sailed_on, conditions: race.conditions ?? null },
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

  // guarda o rascunho no celular a cada mudança
  useEffect(() => {
    if (!dirty) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ order, codes, tied, pts, date, cond, t: Date.now() }));
    } catch {
      /* sem armazenamento */
    }
  }, [dirty, order, codes, tied, pts, date, cond, draftKey]);

  // internet voltou: envia o que ficou pendente
  useEffect(() => {
    const on = () => {
      if (pendingSyncRef.current) saveRef.current();
      audioUploadRef.current();
    };
    const t = setTimeout(() => audioUploadRef.current(), 1500);
    window.addEventListener("online", on);
    return () => {
      clearTimeout(t);
      window.removeEventListener("online", on);
    };
  }, []);

  // desliga o microfone ao sair da tela
  useEffect(
    () => () => {
      listeningRef.current = false;
      recRef.current?.stop?.();
      if (mediaRef.current && mediaRef.current.state !== "inactive") mediaRef.current.stop();
    },
    []
  );

  if (!data) return <p className="p-8 text-center text-sm text-ink-3">Carregando…</p>;
  const { race, cls, ev, entries } = data;

  function snapshot() {
    setHistory((h) => [...h.slice(-50), { order, codes, tied }]);
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

  /** vários barcos de uma vez (usado pela voz) */
  function tapMany(ids: string[]) {
    if (!ids.length) return;
    snapshot();
    if (mode === "FIN") setOrder((o) => [...o, ...ids.filter((x) => !o.includes(x))]);
    else setCodes((c) => ({ ...c, ...Object.fromEntries(ids.map((x) => [x, mode])) }));
    if (navigator.vibrate) navigator.vibrate(25);
  }

  speechRef.current = (text: string) => {
    // entende numeral E nome do velejador, na ordem falada
    const { ids, misses: miss } = matchSpoken(
      text,
      pending.map((e) => ({ id: e.id, sail: e.sail_number, names: [e.helm_name, e.crew_name ?? ""] }))
    );
    tapMany(ids);
    setMsg(miss.length ? `Não achei (ou já lançado): ${miss.join(", ")}` : null);
  };

  /** envia áudios guardados no celular e registra na regata */
  async function flushAudios() {
    const list = await pendingAudios(race.id);
    setPendingAudio(list.length);
    if (!list.length || !navigator.onLine) return;
    setUploadingAudio(true);
    const added: { url: string; at: string; secs?: number }[] = [];
    for (const [key, a] of list) {
      const up = await uploadAttachment(new File([a.blob], a.name, { type: a.type }), ev.id);
      if (up.url) {
        added.push({ url: up.url, at: a.at, secs: a.secs });
        await dropAudio(key);
      }
    }
    if (added.length) {
      const next = cleanConditions({ ...cond, recordings: [...(cond.recordings ?? []), ...added] });
      setCond(next);
      await db.from("races").update({ conditions: next }).eq("id", race.id);
    }
    setPendingAudio((await pendingAudios(race.id)).length);
    setUploadingAudio(false);
  }
  audioUploadRef.current = flushAudios;

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported?.(t)) ?? "";
      const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const mime = mr.mimeType || "audio/mp4";
        const blob = new Blob(chunksRef.current, { type: mime });
        if (!blob.size) return;
        const at = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
        const secs = Math.round((Date.now() - recStartRef.current) / 1000);
        const ext = mime.includes("webm") ? "webm" : "m4a";
        const name = `${cls.name}-R${race.number}-chegada-${at.replace(":", "h")}.${ext}`.replace(/\s+/g, "_");
        await queueAudio(`${race.id}:${Date.now()}`, { raceId: race.id, name, type: mime, at, secs, blob });
        audioUploadRef.current(); // usa o estado mais recente da regata
      };
      recStartRef.current = Date.now();
      mr.start(1000);
      mediaRef.current = mr;
    } catch {
      setMsg("Não deu para gravar o áudio (microfone bloqueado). O ditado continua funcionando.");
    }
  }

  function stopRecording() {
    if (mediaRef.current && mediaRef.current.state !== "inactive") mediaRef.current.stop();
    mediaRef.current = null;
  }

  function toggleVoice() {
    if (listening) {
      listeningRef.current = false;
      setListening(false);
      recRef.current?.stop?.();
      stopRecording();
      setHeard("");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      // sem reconhecimento: ao menos grava o áudio para escutar depois
      setMsg("Este navegador não transcreve a voz, mas a chegada está sendo gravada.");
      listeningRef.current = true;
      setListening(true);
      startRecording();
      return;
    }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (ev: any) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript as string;
        if (ev.results[i].isFinal) {
          setHeard(t);
          speechRef.current(t);
        } else setHeard(t + "…");
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        listeningRef.current = false;
        setListening(false);
        setMsg("Libere o microfone para o site nas configurações do navegador.");
      }
    };
    rec.onend = () => {
      // o celular para de ouvir depois de um silêncio: religa enquanto estiver ativo
      if (listeningRef.current) {
        try {
          rec.start();
        } catch {
          /* já ligado */
        }
      }
    };
    recRef.current = rec;
    listeningRef.current = true;
    setListening(true);
    setMsg(null);
    try {
      rec.start();
    } catch {
      /* já ligado */
    }
    startRecording();
  }

  function restoreDraft() {
    if (!draftFound) return;
    setOrder(draftFound.order ?? []);
    setCodes(draftFound.codes ?? {});
    setTied(draftFound.tied ?? []);
    setPts(draftFound.pts ?? {});
    if (draftFound.date) setDate(draftFound.date);
    if (draftFound.cond) setCond(draftFound.cond);
    setDraftFound(null);
    setDirty(true);
  }

  function discardDraft() {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ok */
    }
    setDraftFound(null);
  }

  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setOrder(last.order);
    setCodes(last.codes);
    setTied(last.tied);
    setHistory((h) => h.slice(0, -1));
    setDirty(true);
  }

  function release(id: string) {
    snapshot();
    setOrder((o) => o.filter((x) => x !== id));
    setCodes(({ [id]: _, ...rest }) => rest);
    setTied((t) => t.filter((x) => x !== id));
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    snapshot();
    const o = [...order];
    [o[i], o[j]] = [o[j], o[i]];
    setOrder(o);
  }

  /** marca de quem chegou: empate com o de cima, SCP, ZFP, DPI ou RDG */
  function markFinisher(id: string, mark: string) {
    snapshot();
    setTied((t) => (mark === "TIE" ? [...t.filter((x) => x !== id), id] : t.filter((x) => x !== id)));
    setCodes(({ [id]: _, ...rest }) => (isKeep(mark) ? { ...rest, [id]: mark } : rest));
  }

  /** posições com empate (A7): empatados repetem a posição, o seguinte pula */
  function positions(): number[] {
    const out: number[] = [];
    order.forEach((id, i) => out.push(i > 0 && tied.includes(id) ? out[i - 1] : i + 1));
    return out;
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
      ...order.map((entry_id, i) => {
        const code = isKeep(codes[entry_id]) ? codes[entry_id] : null;
        return {
          race_id: race.id,
          entry_id,
          position: positions()[i],
          code,
          points: code && isPts(code) && pts[entry_id] ? Number(pts[entry_id].replace(",", ".")) : null,
        };
      }),
      ...entries
        .filter((e) => !order.includes(e.id))
        .map((e) => {
          const code = codes[e.id] ?? "DNC";
          return {
            race_id: race.id,
            entry_id: e.id,
            position: null,
            code,
            points: isPts(code) && pts[e.id] ? Number(pts[e.id].replace(",", ".")) : null,
          };
        }),
    ];
  }

  const isNetwork = (m?: string) => !!m && /fetch|network|load failed|internet|offline/i.test(m);

  async function save() {
    setBusy(true);
    setMsg(null);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setBusy(false);
      setPendingSync(true);
      return;
    }
    const rows = buildRows();
    const del = await db.from("results").delete().eq("race_id", race.id);
    if (isNetwork(del.error?.message)) {
      setBusy(false);
      setPendingSync(true);
      return;
    }
    const ins = del.error ? del : await db.from("results").insert(rows);
    const upd = await db
      .from("races")
      .update({ sailed_on: date || null, ...(hasConditions(cond) || hasConditions(race.conditions) || cond.recordings?.length ? { conditions: cleanConditions(cond) } : {}) })
      .eq("id", race.id);
    if (isNetwork(ins.error?.message) || isNetwork(upd.error?.message)) {
      setBusy(false);
      setPendingSync(true);
      return;
    }
    // primeira regata salva publica o evento
    if (!ins.error && ev.status === "draft") {
      await db.from("events").update({ status: "live" }).eq("id", ev.id);
      setData({ ...data!, ev: { ...ev, status: "live" } });
    }
    setBusy(false);
    const error = ins.error ?? upd.error;
    if (error) return setMsg(error.message);
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ok */
    }
    setPendingSync(false);
    setDirty(false);
    setSaved(true);
  }
  saveRef.current = save;

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
    <div className="mx-auto w-full max-w-4xl pb-32">
      {/* topo fixo */}
      <div className="sticky top-14 z-10 border-b border-line bg-white/95 px-4 pb-3 pt-3 backdrop-blur sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <BackLink href={`/admin/eventos/${cls.event_id}`}>{cls.name}</BackLink>
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

        {draftFound ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
            <span className="flex-1">Há um rascunho não enviado desta regata.</span>
            <button className="btn h-8 bg-amber-600 px-3 text-white" onClick={restoreDraft}>Recuperar</button>
            <button className="btn h-8 px-3 text-amber-800" onClick={discardDraft}>Descartar</button>
          </div>
        ) : null}
        {pendingSync ? (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500" />
            Sem sinal. A regata está guardada no celular e é enviada sozinha quando a internet voltar.
          </div>
        ) : null}
        {listening ? (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 p-2 text-sm text-flag">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-flag" />
            <span className="min-w-0 flex-1 truncate">{heard || "🔴 Gravando · fale o numeral ou o nome, na ordem de chegada"}</span>
          </div>
        ) : null}
        <div className="mt-2 flex gap-2">
        <input
          ref={filterRef}
          className="input min-w-0 flex-1"
          inputMode="numeric"
          placeholder="Digite o nº de vela e Enter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onFilterEnter())}
        />
          <button
            onClick={toggleVoice}
            className={`btn h-10 shrink-0 px-3 ${listening ? "bg-flag text-white" : "border border-line bg-white text-ink"}`}
            aria-label={listening ? "Parar ditado" : "Ditar números por voz"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
            {listening ? "Parar" : "Voz"}
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6">
        <p className={`mt-3 text-xs font-semibold ${modeIsCode ? "text-flag" : "text-ink-3"}`}>
          {modeIsCode
            ? `Toque nos barcos para marcar ${mode}: ${CODE_LABELS[mode] ?? ""}`
            : "Toque nos barcos na ordem em que cruzam a linha"}
        </p>

        <ConditionsPanel value={cond} onChange={(c) => { setCond(c); setDirty(true); setSaved(false); }} />

        {/* grade de barcos */}
        <div className="mt-2 grid grid-cols-3 gap-2 min-[400px]:grid-cols-4 sm:grid-cols-5 lg:grid-cols-7">
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
            const pos = positions()[i];
            const mark = tied.includes(id) && i > 0 ? "TIE" : isKeep(codes[id]) ? codes[id] : "";
            return (
              <div key={id} className="px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className={`num w-8 text-right font-display text-xl font-bold ${pos <= 3 ? "text-sea" : ""}`}>
                    {mark === "TIE" ? "=" : ""}{pos}
                  </span>
                  <span className="num w-16 shrink-0 font-semibold">{e.sail_number}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{e.helm_name}</span>
                  <select
                    aria-label="Marcação"
                    className={`h-8 w-[74px] shrink-0 rounded-lg border px-1 text-xs font-semibold ${mark ? "border-red-200 bg-red-50 text-flag" : "border-line bg-white text-ink-3"}`}
                    value={mark}
                    onChange={(ev) => markFinisher(id, ev.target.value)}
                  >
                    {FINISH_MARKS.filter((m) => m !== "TIE" || i > 0).map((m) => (
                      <option key={m} value={m}>{m === "" ? "—" : m === "TIE" ? "Empate" : m}</option>
                    ))}
                  </select>
                  <IconBtn onClick={() => move(i, -1)} label="Subir">↑</IconBtn>
                  <IconBtn onClick={() => move(i, 1)} label="Descer">↓</IconBtn>
                  <IconBtn onClick={() => release(id)} label="Tirar" danger>×</IconBtn>
                </div>
                {mark === "SCP" || mark === "ZFP" ? (
                  <p className="ml-10 text-xs text-ink-3">+20% dos pontos de DNF (regra {mark === "SCP" ? "44.3" : "30.2"}). Os outros barcos não mudam de lugar.</p>
                ) : null}
                {mark === "TIE" ? <p className="ml-10 text-xs text-ink-3">Empatado com o barco de cima: dividem os pontos (A7).</p> : null}
                {isPts(mark) ? (
                  <div className="ml-10 mt-1 flex items-center gap-2 text-xs text-ink-3">
                    <input
                      className="input h-8 w-20"
                      inputMode="decimal"
                      placeholder="pontos"
                      value={pts[id] ?? ""}
                      onChange={(ev) => { setPts({ ...pts, [id]: ev.target.value }); setDirty(true); }}
                    />
                    {mark === "DPI" ? "pontos de penalidade a somar (decisão do júri)" : "pontuação final dada pelo júri"}
                  </div>
                ) : null}
              </div>
            );
          })}
          {!order.length ? <p className="p-3 text-sm text-ink-3">Ninguém chegou ainda.</p> : null}
        </div>

        {/* gravações da chegada */}
        {cond.recordings?.length || pendingAudio ? (
          <>
            <h2 className="mb-2 mt-6 font-display text-xl font-bold">
              🎧 Gravações da chegada <span className="text-ink-3">{cond.recordings?.length ?? 0}</span>
            </h2>
            <div className="card divide-y divide-line">
              {(cond.recordings ?? []).map((r, i) => (
                <div key={r.url} className="space-y-1 px-3 py-2">
                  <p className="text-xs font-semibold text-ink-3">
                    Gravação {i + 1} · {r.at}
                    {r.secs ? ` · ${Math.floor(r.secs / 60)}:${String(r.secs % 60).padStart(2, "0")}` : ""}
                  </p>
                  <audio controls preload="none" src={r.url} className="h-10 w-full" />
                </div>
              ))}
              {pendingAudio ? (
                <p className="flex items-center gap-2 px-3 py-2 text-sm text-amber-700">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                  {uploadingAudio ? "Enviando gravação…" : `${pendingAudio} gravação guardada no celular, envia quando tiver sinal.`}
                </p>
              ) : null}
            </div>
          </>
        ) : null}

        {/* com código */}
        {coded.length ? (
          <>
            <h2 className="mb-2 mt-6 font-display text-xl font-bold">
              Penalidades <span className="text-ink-3">{coded.length}</span>
            </h2>
            <div className="card divide-y divide-line">
              {coded.map((e) => {
                const code = codes[e.id];
                const needsPts = isPts(code);
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
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3 sm:px-6">
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
