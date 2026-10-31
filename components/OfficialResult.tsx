"use client";

import { useState } from "react";
import { publishOfficialResult, resultTitle } from "@/lib/officialResult";
import type { NoticeRow } from "@/lib/types";
import LimaFlag from "./LimaFlag";
import NoticeShareButton from "./NoticeShareButton";

/** Só organizador: publica o resultado (súmula em PDF) como aviso oficial e envia no WhatsApp */
export default function OfficialResult({
  eventId,
  eventName,
  className,
  raceNumber,
  makePdf,
  notices,
}: {
  eventId: string;
  eventName: string;
  className: string;
  raceNumber: number;
  makePdf: () => Promise<File>;
  notices: NoticeRow[];
}) {
  const title = resultTitle(className, raceNumber);
  const [posted, setPosted] = useState<NoticeRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const existing = posted ?? notices.find((n) => n.title === title) ?? null;

  async function publish() {
    setBusy(true);
    setErr(null);
    let pdf: File | null = null;
    try {
      pdf = await makePdf();
    } catch {
      setBusy(false);
      return setErr("Não foi possível gerar o PDF.");
    }
    const r = await publishOfficialResult({ eventId, className, raceNumber, body: "", file: pdf });
    setBusy(false);
    if (r.error) return setErr(r.error);
    setFile(pdf);
    setPosted(r.notice!);
  }

  if (existing) {
    return (
      <span className="inline-flex flex-col">
        <NoticeShareButton notice={existing} eventName={eventName} file={posted ? file : null} official label={`Enviar resultado R${raceNumber}`} />
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        onClick={publish}
        disabled={busy}
        className="inline-flex h-9 items-center gap-2 rounded-full bg-night px-4 text-sm font-bold text-white disabled:opacity-60"
      >
        <LimaFlag size={20} /> {busy ? "Publicando…" : `Publicar resultado R${raceNumber}`}
      </button>
      {err ? <span className="text-[11px] text-flag">{err}</span> : null}
    </span>
  );
}
