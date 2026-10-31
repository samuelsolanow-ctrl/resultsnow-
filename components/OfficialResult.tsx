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
  const old = notices.find((n) => n.title === title) ?? null;
  // só vale o que já tem o PDF; aviso antigo (texto/imagem) é refeito com o PDF
  const existing = posted ?? (old && /\.pdf$/i.test(old.file_url ?? "") ? old : null);

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
    const r = await publishOfficialResult({ eventId, className, raceNumber, body: "", file: pdf, replaceId: old?.id });
    setBusy(false);
    if (r.error) return setErr(r.error);
    setFile(pdf);
    setPosted(r.notice!);
  }

  if (existing) {
    return (
      <div className="mb-4">
        <NoticeShareButton
          notice={existing}
          eventName={eventName}
          file={posted ? file : null}
          official
          label={`Enviar resultado R${raceNumber}`}
          className="flex h-11 w-full items-center gap-2 rounded-xl bg-night px-3 text-sm font-bold text-white"
        />
      </div>
    );
  }
  return (
    <div className="mb-4">
      <button
        onClick={publish}
        disabled={busy}
        className="flex h-11 w-full items-center gap-2 rounded-xl bg-night px-3 text-sm font-bold text-white disabled:opacity-60"
      >
        <LimaFlag size={22} /> {busy ? "Publicando…" : `Publicar resultado R${raceNumber}`}
        <span className="ml-auto text-[11px] font-normal text-white/50">só você vê</span>
      </button>
      {err ? <span className="text-[11px] text-flag">{err}</span> : null}
    </div>
  );
}
