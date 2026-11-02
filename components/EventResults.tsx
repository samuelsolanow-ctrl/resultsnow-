"use client";

import { useEffect, useMemo, useState } from "react";
import ResultsTable from "./ResultsTable";
import LimaFlag from "./LimaFlag";
import { isResultNotice, noticeWhen } from "@/lib/noticeShare";
import NoticeShareButton from "./NoticeShareButton";
import OfficialResult from "./OfficialResult";
import { useCanManage } from "@/lib/useCanManage";
import { isDoc } from "@/lib/eventInfo";
import { downloadSumula, sumulaFile, type SumulaData } from "@/lib/pdf";
import { CODE_LABELS, type Standing } from "@/lib/scoring";
import { conditionsLine, hasConditions, type RaceConditions } from "@/lib/conditions";
import type { FlagMode, NoticeRow, ProtestRow } from "@/lib/types";

export type ClassView = {
  id: string;
  name: string;
  crewSize: number;
  entries: number;
  races: { id: string; number: number; conditions?: RaceConditions | null }[];
  nDiscards: number;
  standings: Standing[];
  usedCodes: string[];
};

const FOLLOW_KEY = "rn-follow";
function readFollow(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FOLLOW_KEY) ?? "[]");
  } catch {
    return [];
  }
}


/** Resultados (classes, divisões, seguir barcos, PDF) + Avisos + Protestos */
export default function EventResults({
  eventName,
  subtitle,
  flagMode,
  classes,
  updated,
  notices = [],
  protests = [],
  showClub = true,
  showCbvela = true,
  slug,
  registration,
  organizer,
  helpers,
  eventId,
}: {
  eventName: string;
  subtitle: string;
  flagMode: FlagMode;
  classes: ClassView[];
  updated: string;
  notices?: NoticeRow[];
  protests?: ProtestRow[];
  showClub?: boolean;
  showCbvela?: boolean;
  slug?: string;
  registration?: boolean;
  organizer?: string | null;
  helpers?: string[];
  eventId?: string;
}) {
  const canManage = useCanManage(organizer, helpers);
  const [tab, setTab] = useState<"res" | "avisos" | "docs" | "protestos">("res");
  const [activeId, setActiveId] = useState(classes[0]?.id);
  const [division, setDivision] = useState<string>("");
  const [followed, setFollowed] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [img, setImg] = useState<{ raceId: string; file: File } | null>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [now] = useState(() => Date.now());
  // link de um aviso (#aviso-…): rola até ele quando a aba abre
  useEffect(() => {
    if ((tab !== "avisos" && tab !== "docs") || !window.location.hash.startsWith("#aviso-")) return;
    const t = setTimeout(() => document.querySelector(window.location.hash)?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    return () => clearTimeout(t);
  }, [tab]);
  const docs = notices.filter(isDoc);
  const avisos = notices.filter((n) => !isDoc(n));
  const latest = [...avisos].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const showLatest = latest && now - new Date(latest.created_at).getTime() < 24 * 3600 * 1000 ? latest : null;

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const q = p.get("classe");
    if (q && classes.some((c) => c.id === q)) setActiveId(q);
    const t = p.get("aba");
    if (t === "avisos" || t === "docs" || t === "protestos") setTab(t);
    setFollowed(readFollow());
  }, [classes]);

  function setParam(k: string, v: string | null) {
    const url = new URL(window.location.href);
    if (v) url.searchParams.set(k, v);
    else url.searchParams.delete(k);
    window.history.replaceState(null, "", url);
  }

  function pick(id: string) {
    setActiveId(id);
    setDivision("");
    setParam("classe", id);
  }

  function toggleFollow(id: string) {
    const next = followed.includes(id) ? followed.filter((x) => x !== id) : [...followed, id];
    setFollowed(next);
    try {
      localStorage.setItem(FOLLOW_KEY, JSON.stringify(next));
    } catch {
      /* navegador sem armazenamento: segue só nesta visita */
    }
  }

  const cls = classes.find((c) => c.id === activeId) ?? classes[0];
  const divisions = useMemo(
    () => (cls ? [...new Set(cls.standings.map((s) => s.entry.division).filter(Boolean) as string[])].sort() : []),
    [cls]
  );
  // divisão: mesma pontuação, colocação recontada dentro da divisão
  const shown = useMemo(() => {
    if (!cls) return [];
    if (!division) return cls.standings;
    const sub = cls.standings.filter((s) => s.entry.division === division);
    const out: Standing[] = [];
    sub.forEach((s, i) => out.push({ ...s, rank: i > 0 && sub[i - 1].rank === s.rank ? out[i - 1].rank : i + 1 }));
    return out;
  }, [cls, division]);

  const tabs = [
    { k: "res" as const, label: "Resultados" },
    ...(avisos.length ? [{ k: "avisos" as const, label: "Avisos" }] : []),
    ...(docs.length ? [{ k: "docs" as const, label: "Docs" }] : []),
    ...(protests.length ? [{ k: "protestos" as const, label: "Protestos" }] : []),
  ];

  // imagem da classificação geral após a última regata (baixada antes: o iPhone exige o arquivo pronto no toque)
  const lastRace = cls?.races.length ? [...cls.races].sort((a, b) => b.number - a.number)[0] : null;
  useEffect(() => {
    if (!lastRace || img?.raceId === lastRace.id) return;
    let alive = true;
    const t = setTimeout(() => {
      fetch(`/api/card/${lastRace.id}?modo=geral`)
        .then((r) => (r.ok ? r.blob() : null))
        .then((b) => {
          if (alive && b && cls)
            setImg({ raceId: lastRace.id, file: new File([b], `${cls.name}-Geral-R${lastRace.number}.png`.replace(/\s+/g, "_"), { type: "image/png" }) });
        })
        .catch(() => null);
    }, 800);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRace?.id]);

  async function shareImage() {
    if (!lastRace || !cls) return;
    const file = img?.raceId === lastRace.id ? img.file : null;
    const url = slug ? `${window.location.origin}/e/${slug}` : window.location.href;
    if (file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: `${eventName} · ${cls.name}\n${url}` });
      } catch {
        /* cancelado */
      }
      return;
    }
    // computador (ou imagem ainda carregando): baixa
    setImgBusy(true);
    const a = document.createElement("a");
    a.href = file ? URL.createObjectURL(file) : `/api/card/${lastRace.id}?modo=geral`;
    a.download = file?.name ?? "resultado.png";
    a.click();
    setTimeout(() => setImgBusy(false), 800);
  }

  async function pdf() {
    if (!cls) return;
    setBusy(true);
    setErr(null);
    try {
      const data: SumulaData = {
        eventName,
        subtitle,
        className: division ? `${cls.name} · ${division}` : cls.name,
        info: infoText(cls),
        flagMode,
        showClub,
        showCbvela,
        crewSize: cls.crewSize,
        races: cls.races,
        standings: shown,
        legend: cls.usedCodes.map((c) => `${c} ${CODE_LABELS[c] ?? ""}`),
        updated,
      };
      await downloadSumula(data);
    } catch (e) {
      setErr("Não foi possível gerar o PDF. Tente de novo.");
      console.error(e);
    }
    setBusy(false);
  }

  return (
    <>
      {/* organizador: publicar o resultado oficial (o público não vê) */}
      {canManage && eventId && lastRace && cls && tab === "res" ? (
          <OfficialResult
            key={`${cls.id}-${lastRace.id}`}
            eventId={eventId}
            eventName={eventName}
            className={cls.name}
            raceNumber={lastRace.number}
            makePdf={() =>
              sumulaFile(
                {
                  eventName,
                  subtitle,
                  className: cls.name,
                  info: infoText(cls),
                  flagMode,
                  showClub,
                  showCbvela,
                  crewSize: cls.crewSize,
                  races: cls.races,
                  standings: cls.standings,
                  legend: cls.usedCodes.map((c) => `${c} ${CODE_LABELS[c] ?? ""}`),
                  updated: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }),
                },
                `Classificacao_Geral_${cls.name}_apos_R${lastRace.number}.pdf`.replace(/\s+/g, "_")
              )
            }
            notices={notices}
          />
      ) : null}
      {tabs.length > 1 ? (
        <div className="mb-4 flex rounded-xl bg-line/60 p-1">
          {tabs.map((t) => (
            <button
              key={t.k}
              onClick={() => {
                setTab(t.k);
                setParam("aba", t.k === "res" ? null : t.k);
              }}
              className={`relative h-9 flex-1 rounded-lg text-sm font-semibold transition ${tab === t.k ? "bg-white text-ink shadow-sm" : "text-ink-3"}`}
            >
              {t.label}
              {t.k === "avisos" && showLatest && tab !== "avisos" ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-flag" aria-label="aviso novo" /> : null}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "avisos" ? <Notices notices={avisos} eventName={eventName} canShare={canManage} /> : null}
      {tab === "docs" ? <Notices notices={docs} eventName={eventName} canShare={canManage} /> : null}
      {tab === "protestos" ? <Protests protests={protests} /> : null}

      {tab === "res" && !cls ? <p className="text-ink-3">Este evento ainda não tem classes cadastradas.</p> : null}
      {tab === "res" && cls ? (
        <>
          {classes.length > 1 ? (
            <nav className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
              {classes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => pick(c.id)}
                  className={`h-9 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition ${
                    c.id === cls.id ? "border-night bg-night text-white" : "border-line bg-white text-ink-2 hover:border-ink-3"
                  }`}
                >
                  {c.name} <span className="font-normal opacity-60">{c.entries}</span>
                </button>
              ))}
            </nav>
          ) : null}

          <section className="card overflow-hidden">
            <div className="flex items-end justify-between gap-3 px-4 pb-2 pt-3">
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-bold leading-none">
                  {cls.name}
                  {division ? <span className="text-sea"> · {division}</span> : null}
                </h2>
                <p className="mt-1 text-xs text-ink-3">{infoText(cls)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-sm font-semibold text-sea">
                {lastRace ? (
                  <button onClick={shareImage} disabled={imgBusy} className="disabled:opacity-50">🖼 Imagem</button>
                ) : null}
                <button onClick={pdf} disabled={busy || !cls.entries} className="disabled:opacity-50">{busy ? "Gerando…" : "⤓ PDF"}</button>
              </div>
            </div>

            {divisions.length ? (
              <div className="flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2.5">
                {["", ...divisions].map((d) => (
                  <button
                    key={d || "geral"}
                    onClick={() => setDivision(d)}
                    className={`h-8 shrink-0 rounded-full px-3 text-xs font-semibold ${
                      division === d ? "bg-sea text-white" : "bg-paper text-ink-2 hover:bg-sea-50"
                    }`}
                  >
                    {d || "Geral"}
                  </button>
                ))}
              </div>
            ) : null}

            {err ? <p className="border-b border-line bg-red-50 px-4 py-2 text-sm text-flag">{err}</p> : null}
            {cls.entries ? (
              <ResultsTable
                standings={shown}
                races={cls.races}
                flagMode={flagMode}
                crewSize={cls.crewSize}
                followed={followed}
                onFollow={toggleFollow}
                showClub={showClub}
                showCbvela={showCbvela}
              />
            ) : (
              <p className="p-4 text-sm text-ink-3">Nenhum inscrito ainda.</p>
            )}
            {cls.races.some((r) => hasConditions(r.conditions)) ? (
              <details className="group border-t border-line">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                  🌬 Condições das regatas
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="ml-auto text-ink-3 transition group-open:rotate-180" aria-hidden>
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <div className="divide-y divide-line border-t border-line">
                  {cls.races.filter((r) => hasConditions(r.conditions)).map((r) => (
                    <div key={r.id} className="flex gap-3 px-4 py-2 text-sm">
                      <span className="w-8 shrink-0 font-display font-bold text-sea">R{r.number}</span>
                      <span className="min-w-0 text-ink-2">
                        {conditionsLine(r.conditions)}
                        {r.conditions?.notes ? <span className="block text-xs text-ink-3">{r.conditions.notes}</span> : null}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line p-4 text-xs text-ink-3">
              <span>☆ toque para seguir um barco</span>
              <span>( ) descartado</span>
              {cls.usedCodes.map((c) => (
                <span key={c}>
                  <b className="text-ink-2">{c}</b> {CODE_LABELS[c] ?? ""}
                </span>
              ))}
              <span className="sm:ml-auto">Atualizado em {updated}</span>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}

function infoText(cls: ClassView) {
  return [
    `${cls.entries} inscritos`,
    `${cls.races.length} regata${cls.races.length === 1 ? "" : "s"}`,
    cls.nDiscards ? `${cls.nDiscards} descarte${cls.nDiscards > 1 ? "s" : ""}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function Notices({ notices, eventName, canShare }: { notices: NoticeRow[]; eventName: string; canShare: boolean }) {
  const sign = (n: NoticeRow) => `${noticeWhen(n.created_at)} · Comissão de Regata`;
  const ext = (n: NoticeRow) => (n.file_name?.split(".").pop() ?? "arq").slice(0, 4).toUpperCase();
  return (
    <div className="card divide-y divide-line overflow-hidden">
      {notices.map((n) => {
        const body = n.body && !isResultNotice(n) ? n.body : null;
        const img = n.file_url && /\.(png|jpe?g|webp)$/i.test(n.file_url);
        const row = (
          <>
            <LimaFlag size={24} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold leading-tight">{n.title}</span>
              <span className="block truncate text-xs text-ink-3">{sign(n)}</span>
            </span>
            {n.file_url ? <span className="shrink-0 rounded-md border border-sea/30 px-1.5 py-0.5 text-[10px] font-bold text-sea">{ext(n)}</span> : null}
          </>
        );
        return (
          <div key={n.id} id={`aviso-${n.id}`} className="scroll-mt-20">
            {/* só PDF/arquivo, sem texto: um toque abre */}
            {n.file_url && !body && !img ? (
              <div className="flex items-center gap-3 px-4 py-3">
                <a href={n.file_url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-3">
                  {row}
                  <span className="text-ink-3">›</span>
                </a>
                {canShare ? <NoticeShareButton notice={n} eventName={eventName} official label="Enviar" className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-night px-3 text-xs font-bold text-white" /> : null}
              </div>
            ) : (
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  {row}
                  <span className="text-ink-3 transition group-open:rotate-90">›</span>
                </summary>
                <div className="space-y-3 px-4 pb-4 pl-[52px]">
                  {body ? <p className="whitespace-pre-line text-sm text-ink-2">{body}</p> : null}
                  {img ? (
                    <a href={n.file_url!} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={n.file_url!} alt={n.title} loading="lazy" className="w-full" />
                    </a>
                  ) : n.file_url ? (
                    <a href={n.file_url} target="_blank" rel="noreferrer" className="inline-flex text-sm font-semibold text-sea">
                      ⤓ {n.file_name ?? "Abrir anexo"}
                    </a>
                  ) : null}
                  {canShare ? <NoticeShareButton notice={n} eventName={eventName} official /> : null}
                </div>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

const statusColor = (s: string) =>
  /decid|julgad/i.test(s) ? "bg-sea-50 text-sea" : /retir|cancel/i.test(s) ? "bg-paper text-ink-3" : "bg-amber-50 text-amber-700";

function Protests({ protests }: { protests: ProtestRow[] }) {
  return (
    <div className="card divide-y divide-line">
      {protests.map((p) => (
        <div key={p.id} className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            {p.number != null ? <span className="font-display text-lg font-bold">Nº {p.number}</span> : null}
            {p.race ? <span className="text-sm text-ink-3">{p.race}</span> : null}
            <span className={`ml-auto rounded px-2 py-0.5 text-xs font-semibold ${statusColor(p.status)}`}>{p.status}</span>
          </div>
          <p className="mt-1 text-sm">
            <b>{p.protestor}</b>
            {p.protestee ? <> × <b>{p.protestee}</b></> : null}
          </p>
          {p.hearing_at || p.room ? (
            <p className="mt-0.5 text-sm text-ink-3">Audiência: {[p.hearing_at, p.room].filter(Boolean).join(" · ")}</p>
          ) : null}
          {p.decision ? <p className="mt-1 whitespace-pre-line text-sm text-ink-2">Decisão: {p.decision}</p> : null}
        </div>
      ))}
    </div>
  );
}
