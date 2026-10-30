import type { Standing } from "./scoring";
import type { EntryRow, ResultRow } from "./types";

export function siteUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return prod ? `https://${prod}` : "http://localhost:3000";
}

export const eventUrl = (slug: string) => `${siteUrl()}/eventos/${slug}`;

const medal = (i: number) => (i === 1 ? "🥇" : i === 2 ? "🥈" : i === 3 ? "🥉" : `${i}º`);

/** Texto do WhatsApp com o resultado da regata + classificação geral */
export function raceShareText(opts: {
  eventName: string;
  className: string;
  raceNumber: number;
  entries: EntryRow[];
  results: ResultRow[];
  standings: Standing[];
  url: string;
  top?: number;
}): string {
  const { eventName, className, raceNumber, entries, results, standings, url, top = 10 } = opts;
  const byId = new Map(entries.map((e) => [e.id, e]));
  const finishers = results
    .filter((r) => r.position != null)
    .sort((a, b) => a.position! - b.position!);
  const coded = results.filter((r) => r.position == null && r.code && r.code !== "DNC");

  const lines: string[] = [];
  lines.push(`⛵ *${eventName}*`);
  lines.push(`*${className} · Geral após R${raceNumber}*`);
  lines.push("");
  for (const s of standings.slice(0, top)) lines.push(`${medal(s.rank)} ${s.entry.helm_name} · ${s.net} pts`);
  if (standings.length > top) lines.push(`… +${standings.length - top} barcos`);
  lines.push("");
  lines.push(`🏁 *Regata ${raceNumber}*`);
  for (const r of finishers.slice(0, 3)) {
    const e = byId.get(r.entry_id);
    if (e) lines.push(`${r.position}º ${e.sail_number} · ${e.helm_name}${r.code ? ` (${r.code})` : ""}`);
  }
  if (coded.length) {
    const groups = new Map<string, string[]>();
    for (const r of coded) {
      const e = byId.get(r.entry_id);
      if (e) groups.set(r.code!, [...(groups.get(r.code!) ?? []), e.sail_number]);
    }
    for (const [code, sails] of groups) lines.push(`${code}: ${sails.join(", ")}`);
  }
  lines.push("");
  lines.push(`Resultados completos: ${url}`);
  return lines.join("\n");
}

export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
