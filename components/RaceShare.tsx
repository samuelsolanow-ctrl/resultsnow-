"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Standing } from "@/lib/scoring";
import { eventUrl, raceShareText, whatsappLink } from "@/lib/share";
import type { EntryRow, ResultRow } from "@/lib/types";

export default function RaceShare(props: {
  onClose: () => void;
  onNext: () => void;
  raceId: string;
  eventName: string;
  eventSlug: string;
  eventId: string;
  className: string;
  raceNumber: number;
  entries: EntryRow[];
  results: ResultRow[];
  standings: Standing[];
}) {
  const url = eventUrl(props.eventSlug);
  const text = raceShareText({
    eventName: props.eventName,
    className: props.className,
    raceNumber: props.raceNumber,
    entries: props.entries,
    results: props.results,
    standings: props.standings,
    url,
  });
  const [stamp] = useState(() => Date.now());
  const [mode, setMode] = useState<"geral" | "regata">("geral");
  const imgSrc = `/api/card/${props.raceId}?modo=${mode}&v=${stamp}`;
  const [files, setFiles] = useState<Record<string, File>>({});
  const file = files[mode] ?? null;
  const [copied, setCopied] = useState(false);

  // baixa a imagem antes, para o compartilhar abrir na hora do toque (iPhone exige)
  useEffect(() => {
    if (files[mode]) return;
    let alive = true;
    const name = `${props.className}-${mode === "geral" ? `Geral-R${props.raceNumber}` : `R${props.raceNumber}`}.png`.replace(/\s+/g, "_");
    fetch(imgSrc)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (alive && b) setFiles((f) => ({ ...f, [mode]: new File([b], name, { type: "image/png" }) }));
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const canShareFile = typeof navigator !== "undefined" && !!file && !!navigator.canShare?.({ files: [file] });

  async function shareImage() {
    if (file && canShareFile) {
      try {
        await navigator.share({ files: [file], text: `${props.eventName} · ${props.className} R${props.raceNumber}\n${url}` });
        return;
      } catch {
        return; // cancelado
      }
    }
    // computador: baixa a imagem
    const a = document.createElement("a");
    a.href = imgSrc;
    a.download = file?.name ?? "resultado.png";
    a.click();
  }

  async function copy() {
    await navigator.clipboard.writeText(text).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-night/60 backdrop-blur-sm sm:items-center" onClick={props.onClose}>
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-sea">Publicado ✓</p>
            <h2 className="font-display text-2xl font-bold">{props.className} · Regata {props.raceNumber}</h2>
          </div>
          <button onClick={props.onClose} className="h-9 w-9 rounded-lg text-xl text-ink-3 hover:bg-paper" aria-label="Fechar">×</button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-paper p-1">
          {(["geral", "regata"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`h-9 rounded-md text-sm font-semibold ${mode === m ? "bg-white text-ink shadow-sm" : "text-ink-3"}`}
            >
              {m === "geral" ? "Geral (acumulado)" : `Só a R${props.raceNumber}`}
            </button>
          ))}
        </div>

        <div className="mt-3 max-h-[46vh] overflow-y-auto rounded-xl border border-line bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={imgSrc} src={imgSrc} alt="Imagem do resultado" className="w-full" />
        </div>

        <div className="mt-4 grid gap-2">
          <button onClick={shareImage} className="btn h-12 bg-[#25D366] text-base text-white hover:bg-[#1ebe5a]">
            <WhatsIcon /> {canShareFile ? "Enviar imagem" : file ? "Baixar imagem" : "Preparando imagem…"}
          </button>
          <a href={whatsappLink(text)} target="_blank" rel="noreferrer" className="btn-ghost h-12 text-base">
            <WhatsIcon color="#25D366" /> Enviar em texto no WhatsApp
          </a>
          <button onClick={copy} className="btn-ghost">{copied ? "Copiado ✓" : "Copiar texto"}</button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4">
          <button onClick={props.onNext} className="btn-primary">Próxima regata →</button>
          <Link href={`/eventos/${props.eventSlug}`} target="_blank" className="btn-ghost">Ver resultados</Link>
        </div>
      </div>
    </div>
  );
}

export function WhatsIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.62.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.89 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.48-8.42" />
    </svg>
  );
}
