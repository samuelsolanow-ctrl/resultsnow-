"use client";

import { useEffect, useState } from "react";
import ResultsTable from "./ResultsTable";
import { downloadSumula, type SumulaData } from "@/lib/pdf";
import { CODE_LABELS, type Standing } from "@/lib/scoring";
import type { FlagMode } from "@/lib/types";

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

/** Abas de classe + tabela + súmula em PDF (troca de classe sem recarregar a página) */
export default function EventResults({
  eventName,
  subtitle,
  flagMode,
  classes,
  updated,
}: {
  eventName: string;
  subtitle: string;
  flagMode: FlagMode;
  classes: ClassView[];
  updated: string;
}) {
  const [activeId, setActiveId] = useState(classes[0]?.id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("classe");
    if (q && classes.some((c) => c.id === q)) setActiveId(q);
  }, [classes]);

  function pick(id: string) {
    setActiveId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("classe", id);
    window.history.replaceState(null, "", url);
  }

  const cls = classes.find((c) => c.id === activeId) ?? classes[0];
  if (!cls) return <p className="text-ink-3">Este evento ainda não tem classes cadastradas.</p>;

  const info = [
    `${cls.entries} inscritos`,
    `${cls.races.length} regata${cls.races.length === 1 ? "" : "s"}`,
    cls.nDiscards ? `${cls.nDiscards} descarte${cls.nDiscards > 1 ? "s" : ""}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  async function pdf() {
    setBusy(true);
    setErr(null);
    try {
      const data: SumulaData = {
        eventName,
        subtitle,
        className: cls.name,
        info,
        flagMode,
        crewSize: cls.crewSize,
        races: cls.races,
        standings: cls.standings,
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
      {classes.length > 1 ? (
        <nav className="-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
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
            <h2 className="font-display text-2xl font-bold leading-tight">{cls.name}</h2>
            <p className="text-sm text-ink-3">{info}</p>
          </div>
          <button onClick={pdf} disabled={busy || !cls.entries} className="btn-ghost">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3" />
            </svg>
            {busy ? "Gerando…" : "Súmula PDF"}
          </button>
        </div>
        {err ? <p className="border-b border-line bg-red-50 px-4 py-2 text-sm text-flag">{err}</p> : null}
        {cls.entries ? (
          <ResultsTable standings={cls.standings} races={cls.races} flagMode={flagMode} crewSize={cls.crewSize} />
        ) : (
          <p className="p-4 text-sm text-ink-3">Nenhum inscrito ainda.</p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line p-4 text-xs text-ink-3">
          <span>( ) resultado descartado</span>
          {cls.usedCodes.map((c) => (
            <span key={c}>
              <b className="text-ink-2">{c}</b> {CODE_LABELS[c] ?? ""}
            </span>
          ))}
          <span className="sm:ml-auto">Atualizado em {updated}</span>
        </div>
      </section>
    </>
  );
}
