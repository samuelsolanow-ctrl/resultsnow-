"use client";

import { db, uploadAttachment } from "./adminDb";
import type { NoticeRow } from "./types";

/** "Classificação geral · Finn · após 3 regatas" (a súmula inteira, não só a última regata) */
export const resultTitle = (className: string, raceNumber: number) =>
  `Classificação geral · ${className} · após ${raceNumber} regata${raceNumber === 1 ? "" : "s"}`;
/** título antigo, para substituir avisos publicados antes */
export const oldResultTitle = (className: string, raceNumber: number) => `Resultados · ${className} · Regata ${raceNumber}`;

/** Publica o resultado no quadro de avisos (imagem + classificação), como aviso oficial */
export async function publishOfficialResult(o: {
  eventId: string;
  className: string;
  raceNumber: number;
  body: string;
  file?: File | null;
  /** aviso antigo do mesmo resultado (com texto/imagem): é substituído pelo PDF */
  replaceId?: string;
}): Promise<{ notice?: NoticeRow; error?: string }> {
  let attach: { file_url: string; file_name: string } | Record<string, never> = {};
  if (o.file) {
    const up = await uploadAttachment(o.file, o.eventId);
    if (up.url) attach = { file_url: up.url, file_name: o.file.name };
  }
  const row = { event_id: o.eventId, title: resultTitle(o.className, o.raceNumber), body: o.body || null, ...attach };
  const { data, error } = o.replaceId
    ? await db.from("notices").update(row).eq("id", o.replaceId).select().single()
    : await db.from("notices").insert(row).select().single();
  if (error || !data) return { error: error?.message ?? "Não foi possível publicar." };
  return { notice: data as NoticeRow };
}
