"use client";

import { useEffect, useMemo, useState } from "react";
import ResultsTable from "./ResultsTable";
import { downloadSumula, type SumulaData } from "@/lib/pdf";
import { CODE_LABELS, type Standing } from "@/lib/scoring";
import type { FlagMode, NoticeRow, ProtestRow } from "@/lib/types";

export type ClassView = {
  id: string;
  name: string;
  crewSize: number;
  entries: number;
  races: { id: string; number: number }[];
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

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

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
}) {
  const [tab, setTab] = useState<"res" | "avisos" | "protestos">("res");
  const [activeId, setActiveId] = useState(classes[0]?.id);
  const [division, setDivision] = useState<string>("");
  const [followed, setFollowed] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const q = p.get("classe");
    if (q && classes.some((c) => c.id === q)) setActiveId(q);
    const t = p.get("aba");
    if (t === "avisos" || t === "protestos") setTab(t);
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
    ...(notices.length ? [{ k: "avisos" as const, label: `Avisos ${notices.length}` }] : []),
    ...(protests.length ? [{ k: "protestos" as const, label: `Protestos ${protests.length}` }] : []),
  ];

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
      {tabs.length > 1 ? (
        <div className="mb-4 flex gap-1 border-b border-line">
          {tabs.map((t) => (
            <button
              key={t.k}
              onClick={() => {
                setTab(t.k);
                setParam("aba", t.k === "res" ? null : t.k);
              }}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === t.k ? "border-sea text-sea" : "border-transparent text-ink-3"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "avisos" ? <Notices notices={notices} /> : null}
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
              <div>
                <h2 className="font-display text-2xl font-bold leading-tight">
                  {cls.name}
                  {division ? <span className="text-sea"> · {division}</span> : null}
                </h2>
                <p className="text-sm text-ink-3">{infoText(cls)}</p>
              </div>
              <button onClick={pdf} disabled={busy || !cls.entries} className="btn-ghost">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3" />
                </svg>
                {busy ? "Gerando…" : "Súmula PDF"}
              </button>
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

function Notices({ notices }: { notices: NoticeRow[] }) {
  return (
    <div className="space-y-3">
      {notices.map((n) => (
        <article key={n.id} className="card p-4">
          <p className="text-xs font-semibold text-ink-3">{fmtTime(n.created_at)}</p>
          <h3 className="mt-0.5 font-display text-xl font-bold">{n.title}</h3>
          {n.body ? <p className="mt-1 whitespace-pre-line text-sm text-ink-2">{n.body}</p> : null}
        </article>
      ))}
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
