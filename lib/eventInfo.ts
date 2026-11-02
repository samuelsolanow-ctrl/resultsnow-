import type { EventRow, NoticeRow } from "./types";

/** "Ilhabela/SP · Canal de São Sebastião" (ou o texto antigo de local) */
export function placeText(ev: Pick<EventRow, "city" | "uf" | "area" | "venue">, withArea = true): string {
  const city = [ev.city, ev.uf].filter(Boolean).join("/");
  const s = [city, withArea ? ev.area : null].filter(Boolean).join(" · ");
  return s || (ev.venue ?? "");
}

/** iniciais do clube para o selo quando não há logo: "Yacht Club de Ilhabela" → "YCI" */
export function clubInitials(name?: string | null): string {
  if (!name) return "";
  const words = name.split(/\s+/).filter((w) => w.length > 2 || /^[A-Z]{2,}$/.test(w));
  return (words.map((w) => w[0]).join("") || name.slice(0, 3)).toUpperCase().slice(0, 4);
}

/** documento oficial (AR, IR, emendas)? — usa o campo novo, ou adivinha pelo título nos antigos */
export function isDoc(n: Pick<NoticeRow, "kind" | "title">): boolean {
  if (n.kind) return n.kind === "doc";
  return /\b(AR|IR|NoR|SI)\b/.test(n.title) || /instru[cç][aãõ]o|instru[cç][oõ]es de regata|aviso de regata|emenda/i.test(n.title);
}

/** "AR · IR" a partir dos documentos publicados */
export function docsBadge(notices: Pick<NoticeRow, "kind" | "title">[]): string {
  const docs = notices.filter(isDoc);
  const ar = docs.some((d) => /\bAR\b|\bNoR\b/.test(d.title) || /aviso de regata/i.test(d.title));
  const ir = docs.some((d) => /\bIR\b|\bSI\b/.test(d.title) || /instru/i.test(d.title));
  return [ar ? "AR" : null, ir ? "IR" : null].filter(Boolean).join(" · ") || (docs.length ? `${docs.length} doc${docs.length > 1 ? "s" : ""}` : "");
}
