"use client";

import { useState } from "react";
import { publishOfficialResult, resultTitle } from "@/lib/officialResult";
import type { Standing } from "@/lib/scoring";
import type { NoticeRow } from "@/lib/types";
import LimaFlag from "./LimaFlag";
import NoticeShareButton from "./NoticeShareButton";

const medal = (r: number) => (r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : `${r}º`);

/** Só organizador: publica o resultado (geral após a última regata) como aviso oficial e envia no WhatsApp */
export default function OfficialResult({
  eventId,
  eventName,
  className,
  raceNumber,
  standings,
  file,
  notices,
}: {
  eventId: string;
  eventName: string;
  className: string;
  raceNumber: number;
  standings: Standing[];
  file: File | null;
  notices: NoticeRow[];
}) {
  const title = resultTitle(className, raceNumber);
  const [posted, setPosted] = useState<NoticeRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const existing = posted ?? notices.find((n) => n.title === title) ?? null;

  async function publish() {
    setBusy(true);
    setErr(null);
    const lines = [`Geral após R${raceNumber}`, ...standings.slice(0, 10).map((s) => `${medal(s.rank)} ${s.entry.helm_name} · ${s.net} pts`)];
    if (standings.length > 10) lines.push(`… +${standings.length - 10} barcos`);
    const r = await publishOfficialResult({ eventId, className, raceNumber, body: lines.join("\n"), file });
    setBusy(false);
    if (r.error) return setErr(r.error);
    setPosted(r.notice!);
  }

  if (existing) {
    return (
      <span className="inline-flex flex-col">
        <NoticeShareButton notice={existing} eventName={eventName} file={file} official label={`Enviar resultado R${raceNumber}`} />
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
