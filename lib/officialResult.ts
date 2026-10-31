"use client";

import { db, uploadAttachment } from "./adminDb";
import type { NoticeRow } from "./types";

export const resultTitle = (className: string, raceNumber: number) => `Resultados · ${className} · Regata ${raceNumber}`;

/** Publica o resultado no quadro de avisos (imagem + classificação), como aviso oficial */
export async function publishOfficialResult(o: {
  eventId: string;
  className: string;
  raceNumber: number;
  body: string;
  file?: File | null;
}): Promise<{ notice?: NoticeRow; error?: string }> {
  let attach: { file_url: string; file_name: string } | Record<string, never> = {};
  if (o.file) {
    const up = await uploadAttachment(o.file, o.eventId);
    if (up.url) attach = { file_url: up.url, file_name: o.file.name };
  }
  const { data, error } = await db
    .from("notices")
    .insert({ event_id: o.eventId, title: resultTitle(o.className, o.raceNumber), body: o.body || null, ...attach })
    .select()
    .single();
  if (error || !data) return { error: error?.message ?? "Não foi possível publicar." };
  return { notice: data as NoticeRow };
}
