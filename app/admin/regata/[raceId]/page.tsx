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
import { sumulaFile } from "@/lib/pdf";
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

const hhmm = () => new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const toMin = (t?: string) => {
  const m = t?.match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const addSecs = (t: string, secs?: number) => {
  const m = toMin(t);
  if (m == null || !secs) return null;
  const x = (m + Math.round(secs / 60)) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
};

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
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
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
  const liveGotRef = useRef(false); // o navegador transcreveu ao vivo nesta sessão?
  // tela sempre acesa enquanto grava
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeRef = useRef<any>(null);
  const [wakeOk, setWakeOk] = useState<boolean | null>(null);
  const [interrupted, setInterrupted] = useState(false);
  const [transcribing, setTranscribing] = useState<string | null>(null);
  // proteção da gravação: microfone cortado, silêncio, checklist, importar
  const streamRef = useRef<MediaStream | null>(null);
  const meterRef = useRef<{ ctx?: AudioContext; t?: ReturnType<typeof setInterval> }>({});
  const [level, setLevel] = useState(0);
  const [micAlert, setMicAlert] = useState<string | null>(null);
  const silentRef = useRef(false);
  const gapsRef = useRef<string[]>([]);
  const muteAtRef = useRef<string | null>(null);
  const [showCheck, setShowCheck] = useState(false);
  const [checkInfo, setCheckInfo] = useState<{ online: boolean; freeMb: number | null; wake: boolean }>({ online: true, freeMb: null, wake: true });
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

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
        if (d) {
          const dr = JSON.parse(d) as Draft;
          // continua de onde parou (a pessoa pode descartar se quiser)
          setOrder(dr.order ?? []);
          setCodes(dr.codes ?? {});
          setTied(dr.tied ?? []);
          setPts(dr.pts ?? {});
          if (dr.date) setDate(dr.date);
          if (dr.cond) setCond(dr.cond);
          setDirty(true);
          setDraftFound(dr);
        }
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

  // saiu do app / bloqueou a tela: para a gravação e guarda tudo no celular
  useEffect(() => {
    const away = (e?: Event) => {
      if (document.visibilityState === "visible") {
        // voltou: se a tela estava acesa por nós, pede de novo
        if (listeningRef.current) keepAwake();
        return;
      }
      if ((e?.type === "pagehide" || document.visibilityState === "hidden") && listeningRef.current) {
        listeningRef.current = false;
        setListening(false);
        setInterrupted(true);
        setMicAlert(`A gravação parou às ${hhmm()} porque o app saiu da tela. O que foi gravado até aí está salvo.`);
        recRef.current?.stop?.();
        if (mediaRef.current && mediaRef.current.state !== "inactive") mediaRef.current.stop();
        mediaRef.current = null;
      }
    };
    document.addEventListener("visibilitychange", away);
    window.addEventListener("pagehide", away);
    return () => {
      document.removeEventListener("visibilitychange", away);
      window.removeEventListener("pagehide", away);
    };
  }, []);

  // pede ao celular para não apagar as gravações guardadas e avisa antes de fechar com coisa não salva
  useEffect(() => {
    navigator.storage?.persist?.().catch(() => null);
    const warn = (e: BeforeUnloadEvent) => {
      if (listeningRef.current || dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
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
    if (ids.length) liveGotRef.current = true;
    setMsg(miss.length ? `Não achei (ou já lançado): ${miss.join(", ")}` : null);
  };

  /** transcreve uma gravação no servidor e lança os barcos (funciona em qualquer celular) */
  async function transcribe(url: string) {
    setTranscribing(url);
    setMsg(null);
    const hints = entries.map((e) => `${e.sail_number.replace(/\D/g, "")} ${e.helm_name}`).join(", ");
    const res = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, hints }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : { error: "Sem conexão." };
    setTranscribing(null);
    if (!res?.ok) return setMsg(j.error ?? "Não foi possível transcrever.");
    const text = String(j.text ?? "");
    setHeard(text);
    // lança na chegada, na ordem falada (só barcos ainda sem chegada)
    const { ids, misses } = matchSpoken(
      text,
      pending.map((e) => ({ id: e.id, sail: e.sail_number, names: [e.helm_name, e.crew_name ?? ""] }))
    );
    if (ids.length) {
      snapshot();
      setOrder((o) => [...o, ...ids.filter((x) => !o.includes(x))]);
    }
    setCond((c) => ({ ...c, recordings: (c.recordings ?? []).map((r) => (r.url === url ? { ...r, text } : r)) }));
    setDirty(true);
    setMsg(
      `${ids.length} barco${ids.length === 1 ? "" : "s"} lançado${ids.length === 1 ? "" : "s"} pela gravação.` +
        (misses.length ? ` Não achei: ${misses.join(", ")}.` : "")
    );
  }

  /** envia áudios guardados no celular e registra na regata */
  async function flushAudios() {
    const recording = !!mediaRef.current && mediaRef.current.state !== "inactive";
    const list = (await pendingAudios(race.id)).filter(([k]) => !(recording && k.endsWith(":live")));
    setPendingAudio(list.length);
    if (!list.length || !navigator.onLine) return;
    setUploadingAudio(true);
    const added: { url: string; at: string; end?: string; secs?: number; gaps?: string[] }[] = [];
    const auto: string[] = [];
    for (const [key, a] of list) {
      const up = await uploadAttachment(new File([a.blob], a.name, { type: a.type }), ev.id);
      if (up.url) {
        added.push({ url: up.url, at: a.at, end: a.end, secs: a.secs, ...(a.gaps?.length ? { gaps: a.gaps } : {}) });
        if (a.auto) auto.push(up.url);
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
    // o celular não transcreveu ao vivo: transcreve pela gravação
    for (const u of auto) await transcribe(u);
  }
  audioUploadRef.current = flushAudios;

  async function keepAwake() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any;
      if (!nav.wakeLock) return setWakeOk(false);
      wakeRef.current = await nav.wakeLock.request("screen");
      setWakeOk(true);
    } catch {
      setWakeOk(false);
    }
  }

  function releaseAwake() {
    wakeRef.current?.release?.().catch?.(() => null);
    wakeRef.current = null;
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      gapsRef.current = [];
      muteAtRef.current = null;
      const track = stream.getAudioTracks()[0];
      if (track) {
        // ligação, Siri ou alarme pegam o microfone: o iPhone "muta" a gravação
        track.onmute = () => {
          if (!listeningRef.current) return;
          muteAtRef.current = hhmm();
          setMicAlert(`Microfone cortado às ${muteAtRef.current} (ligação, Siri ou alarme?). Confira esse trecho no caderno.`);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        };
        track.onunmute = () => {
          if (muteAtRef.current) gapsRef.current.push(`${muteAtRef.current}–${hhmm()}`);
          muteAtRef.current = null;
          setMicAlert(null);
        };
        track.onended = () => {
          if (!listeningRef.current) return;
          interrupt(`O microfone foi desligado às ${hhmm()} (ligação ou outro app). O que foi gravado até aí está salvo.`);
        };
      }
      startMeter(stream);
      const type = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported?.(t)) ?? "";
      const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunksRef.current = [];
      const liveKey = `${race.id}:live`;
      const liveAt = hhmm();
      let n = 0;
      mr.ondataavailable = (e) => {
        if (!e.data.size) return;
        chunksRef.current.push(e.data);
        // a cada 3 s guarda no celular o que já foi gravado
        if (++n % 3 === 0) {
          const mime = mr.mimeType || "audio/mp4";
          queueAudio(liveKey, {
            raceId: race.id,
            name: `${cls.name}-R${race.number}-chegada-${liveAt.replace(":", "h")}.${mime.includes("webm") ? "webm" : "m4a"}`.replace(/\s+/g, "_"),
            type: mime,
            at: liveAt,
            secs: Math.round((Date.now() - recStartRef.current) / 1000),
            blob: new Blob(chunksRef.current, { type: mime }),
            auto: !liveGotRef.current,
            end: hhmm(),
            gaps: [...gapsRef.current],
          });
        }
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        stopMeter();
        const mime = mr.mimeType || "audio/mp4";
        const blob = new Blob(chunksRef.current, { type: mime });
        if (!blob.size) return;
        const end = hhmm();
        const gaps = [...gapsRef.current, ...(muteAtRef.current ? [`${muteAtRef.current}–${end}`] : [])];
        muteAtRef.current = null;
        const secs = Math.round((Date.now() - recStartRef.current) / 1000);
        const ext = mime.includes("webm") ? "webm" : "m4a";
        const name = `${cls.name}-R${race.number}-chegada-${liveAt.replace(":", "h")}.${ext}`.replace(/\s+/g, "_");
        await dropAudio(`${race.id}:live`); // a versão completa substitui a parcial
        await queueAudio(`${race.id}:${Date.now()}`, { raceId: race.id, name, type: mime, at: liveAt, end, secs, gaps, blob, auto: !liveGotRef.current });
        audioUploadRef.current(); // usa o estado mais recente da regata
      };
      recStartRef.current = Date.now();
      liveGotRef.current = false;
      mr.start(1000);
      mediaRef.current = mr;
    } catch {
      setMsg("Não deu para gravar o áudio (microfone bloqueado). O ditado continua funcionando.");
    }
  }

  function stopRecording() {
    if (mediaRef.current && mediaRef.current.state !== "inactive") mediaRef.current.stop();
    mediaRef.current = null;
    stopMeter();
    releaseAwake();
  }

  /** a gravação caiu sozinha: para tudo, guarda e mostra o botão de continuar */
  function interrupt(text: string) {
    listeningRef.current = false;
    setListening(false);
    setInterrupted(true);
    setMicAlert(text);
    recRef.current?.stop?.();
    stopRecording();
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  }

  /** barrinha de volume: mostra que o microfone está mesmo captando */
  function startMeter(stream: MediaStream) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new AC();
      ctx.resume?.().catch?.(() => null);
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Float32Array(an.fftSize);
      let quiet = 0;
      const t = setInterval(() => {
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        setLevel(Math.min(1, rms * 10));
        if (rms < 0.0008) quiet++;
        else {
          quiet = 0;
          if (silentRef.current) {
            silentRef.current = false;
            setMicAlert(null);
          }
        }
        // 10 s de silêncio absoluto: o microfone provavelmente não está captando
        if (quiet === 50 && !muteAtRef.current) {
          silentRef.current = true;
          setMicAlert("O microfone não capta som há 10 s. Fale algo: se a barrinha não mexer, toque em Parar e depois em Voz.");
        }
      }, 200);
      meterRef.current = { ctx, t };
    } catch {
      /* sem medidor: a gravação segue normal */
    }
  }

  function stopMeter() {
    clearInterval(meterRef.current.t);
    meterRef.current.ctx?.close?.().catch?.(() => null);
    meterRef.current = {};
    silentRef.current = false;
    setLevel(0);
  }

  /** antes da 1ª gravação do dia: checklist rápido */
  async function onVoice() {
    if (listening) return toggleVoice();
    let seen = false;
    try {
      seen = localStorage.getItem("rn-check") === new Date().toDateString();
    } catch {
      /* sem armazenamento */
    }
    if (seen || interrupted) return toggleVoice();
    setShowCheck(true);
    let freeMb: number | null = null;
    try {
      const est = await navigator.storage?.estimate?.();
      if (est?.quota != null) freeMb = Math.round((est.quota - (est.usage ?? 0)) / 1e6);
    } catch {
      /* sem informação */
    }
    setCheckInfo({ online: navigator.onLine, freeMb, wake: "wakeLock" in navigator });
  }

  function startFromCheck() {
    try {
      localStorage.setItem("rn-check", new Date().toDateString());
    } catch {
      /* sem armazenamento */
    }
    setShowCheck(false);
    toggleVoice();
  }

  /** importa um áudio do Gravador do iPhone (ou qualquer arquivo de áudio) */
  async function importAudio(f: File) {
    setImporting(true);
    setMsg(null);
    const secs = await new Promise<number | undefined>((ok) => {
      const a = new Audio();
      const u = URL.createObjectURL(f);
      const done = (v?: number) => {
        URL.revokeObjectURL(u);
        ok(v);
      };
      a.preload = "metadata";
      a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? Math.round(a.duration) : undefined);
      a.onerror = () => done(undefined);
      setTimeout(() => done(undefined), 4000);
      a.src = u;
    });
    const up = await uploadAttachment(f, ev.id);
    setImporting(false);
    if (!up.url) return setMsg(up.error ?? "Não foi possível enviar a gravação.");
    const t = new Date(f.lastModified || Date.now());
    const at = t.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    const next = cleanConditions({ ...cond, recordings: [...(cond.recordings ?? []), { url: up.url, at, secs, imported: true }] });
    setCond(next);
    await db.from("races").update({ conditions: next }).eq("id", race.id);
    setMsg("Gravação importada e salva nesta regata.");
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
      setMsg("Gravando. Ao tocar em Parar, a gravação é transcrita e os barcos entram na chegada.");
      listeningRef.current = true;
      setListening(true);
      setInterrupted(false);
      setMicAlert(null);
      keepAwake();
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
      if (e.error === "not-allowed" && !mediaRef.current) {
        listeningRef.current = false;
        setListening(false);
        setMsg("Libere o microfone para o site nas configurações do navegador.");
      }
      // qualquer outro erro do ao vivo: a gravação continua e é transcrita ao parar
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
    setInterrupted(false);
    setMicAlert(null);
    setMsg(null);
    keepAwake();
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
            <span className="flex-1">↺ Continuando a chegada de onde você parou (ainda não salva).</span>
            <button className="btn h-8 px-3 text-amber-800" onClick={() => setDraftFound(null)}>OK</button>
            <button
              className="btn h-8 px-3 text-amber-800 underline"
              onClick={() => {
                if (confirm("Descartar o que foi lançado e voltar ao que está salvo?")) {
                  discardDraft();
                  window.location.reload();
                }
              }}
            >
              Descartar
            </button>
          </div>
        ) : null}
        {pendingSync ? (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500" />
            Sem sinal. A regata está guardada no celular e é enviada sozinha quando a internet voltar.
          </div>
        ) : null}
        {micAlert ? (
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm font-semibold text-flag">⚠ {micAlert}</p>
        ) : null}
        {interrupted && !listening ? (
          <button
            onClick={toggleVoice}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-flag p-3 text-base font-bold text-white"
          >
            🔴 Gravação parada — toque para continuar
          </button>
        ) : null}
        {listening && wakeOk === false ? (
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
            Este celular não deixa o site manter a tela acesa. Para não cortar a gravação, coloque em Ajustes → Tela e Brilho → Bloqueio Automático → <b>Nunca</b> durante a regata.
          </p>
        ) : null}
        {listening ? (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 p-2 text-sm text-flag">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-flag" />
            <span className="min-w-0 flex-1 truncate">{heard || "🔴 Gravando · fale o numeral ou o nome, na ordem de chegada"}</span>
            <span className="h-2 w-12 shrink-0 overflow-hidden rounded-full bg-red-100" aria-label="Volume do microfone">
              <span className="block h-full rounded-full bg-flag transition-[width] duration-150" style={{ width: `${Math.max(4, level * 100)}%` }} />
            </span>
            {wakeOk ? <span className="shrink-0 text-[11px] font-semibold text-ink-3">☀︎</span> : null}
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
            onClick={onVoice}
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
        <>
            <div className="mb-2 mt-6 flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold">
                🎧 Gravações <span className="text-ink-3">{cond.recordings?.length ?? 0}</span>
              </h2>
              <button onClick={() => importRef.current?.click()} disabled={importing} className="btn-ghost h-9 px-3 text-xs">
                {importing ? "Enviando…" : "⬆ Importar gravação"}
              </button>
              <input
                ref={importRef}
                type="file"
                accept="audio/*,.m4a,.mp3,.wav,.aac,.caf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) importAudio(f);
                }}
              />
            </div>
            <div className="card divide-y divide-line">
              {!cond.recordings?.length && !pendingAudio ? (
                <p className="p-3 text-xs text-ink-3">
                  Gravou no Gravador do iPhone? Lá, toque em ⋯ → Compartilhar → Salvar em Arquivos. Depois toque em Importar gravação aqui.
                </p>
              ) : null}
              {(cond.recordings ?? []).map((r, i, all) => {
                const end = r.end ?? addSecs(r.at, r.secs);
                const prev = all[i - 1];
                const prevEnd = prev && !prev.imported && !r.imported ? prev.end ?? addSecs(prev.at, prev.secs) : null;
                const hole = prevEnd && toMin(r.at)! - toMin(prevEnd)! >= 1 ? `${prevEnd}–${r.at}` : null;
                return (
                <div key={r.url} className="space-y-1 px-3 py-2">
                  {hole ? <p className="-mt-0.5 rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">⚠ Sem gravação das {hole.replace("–", " às ")} — confira no caderno</p> : null}
                  <p className="text-xs font-semibold text-ink-3">
                    {r.imported ? "Importada" : `Gravação ${i + 1}`} · {r.at}{end && !r.imported ? ` → ${end}` : ""}
                    {r.secs ? ` · ${Math.floor(r.secs / 60)}:${String(r.secs % 60).padStart(2, "0")}` : ""}
                  </p>
                  {r.gaps?.length ? (
                    <p className="text-xs font-semibold text-flag">⚠ Microfone cortado: {r.gaps.join(", ")} — confira no caderno</p>
                  ) : null}
                  <audio controls preload="none" src={r.url} className="h-10 w-full" />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => transcribe(r.url)}
                      disabled={!!transcribing}
                      className="btn-ghost h-8 px-3 text-xs"
                    >
                      {transcribing === r.url ? "Transcrevendo…" : r.text ? "↻ Transcrever de novo" : "📝 Transcrever e lançar"}
                    </button>
                    {r.text ? <span className="min-w-0 flex-1 text-xs italic text-ink-3">“{r.text}”</span> : null}
                  </div>
                </div>
                );
              })}
              {pendingAudio ? (
                <p className="flex items-center gap-2 px-3 py-2 text-sm text-amber-700">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                  {uploadingAudio ? "Enviando gravação…" : `${pendingAudio} gravação guardada no celular, envia quando tiver sinal.`}
                </p>
              ) : null}
            </div>
        </>

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

      {showCheck ? (
        <div className="fixed inset-0 z-40 grid place-items-end bg-night/60 p-3 backdrop-blur-sm sm:place-items-center" onClick={() => setShowCheck(false)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-bold uppercase tracking-widest text-sea">Antes de largar</p>
            <h2 className="font-display text-2xl font-bold leading-tight">Para a gravação não cortar</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {[
                ["🌙", "Foco/Não Perturbe ligado, com chamadas de Ninguém e “chamadas repetidas” desligado"],
                ["🎙", "Gravador do iPhone gravando também (backup) — e o caderno à mão"],
                ["🎧", "Bluetooth desligado: fone, relógio e som do barco"],
                ["🔋", "Bateria boa, sem Modo de Pouca Energia, celular na sombra"],
                ["📱", "Não toque em notificações nem troque de app enquanto grava"],
              ].map(([i, t]) => (
                <li key={t} className="flex gap-2"><span>{i}</span><span>{t}</span></li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 rounded-lg bg-paper p-2 text-xs">
              <p>{checkInfo.online ? "✅ Internet ok" : "⚠ Sem internet: grava e lança à mão; o ditado ao vivo pode não funcionar"}</p>
              {checkInfo.freeMb != null ? (
                <p>{checkInfo.freeMb > 500 ? "✅ Espaço ok para gravar" : "⚠ Pouco espaço no celular — libere antes da regata"}</p>
              ) : null}
              <p>{checkInfo.wake ? "✅ O app mantém a tela acesa" : "⚠ Ponha Bloqueio Automático em Nunca (Ajustes → Tela e Brilho)"}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setShowCheck(false)} className="btn-ghost">Voltar</button>
              <button onClick={startFromCheck} className="btn-primary">🎙 Começar a gravar</button>
            </div>
            <p className="mt-2 text-center text-[11px] text-ink-3">Aparece só na primeira gravação do dia.</p>
          </div>
        </div>
      ) : null}

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
          makePdf={() => {
            const sailed = data.races
              .filter((r) => r.number <= race.number)
              .map((r) => (r.id === race.id ? { ...r, conditions: cond } : r));
            const codes = [...new Set(standingsNow.flatMap((s) => s.cells.map((c) => c.code)).filter(Boolean) as string[])];
            return sumulaFile(
              {
                eventName: ev.name,
                subtitle: ev.venue ?? "",
                className: cls.name,
                info: `${entries.length} inscritos · ${sailed.length} regata${sailed.length === 1 ? "" : "s"}`,
                flagMode: ev.flag_mode,
                showClub: ev.show_club !== false,
                showCbvela: ev.show_cbvela !== false,
                crewSize: cls.crew_size,
                races: sailed,
                standings: standingsNow,
                legend: codes.map((c) => `${c} ${CODE_LABELS[c] ?? ""}`),
                updated: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }),
              },
              `Resultados_${cls.name}_R${race.number}.pdf`.replace(/\s+/g, "_")
            );
          }}
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
