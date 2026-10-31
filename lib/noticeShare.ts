import type { NoticeRow } from "./types";

const TZ = "America/Sao_Paulo";

/** "31/10 às 10:17" */
export function noticeWhen(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  return `${day} às ${time}`;
}

/** Assinatura: "Publicado em 31/10 às 10:17 por Samuel" */
export function noticeSignature(n: NoticeRow): string {
  return `Publicado em ${noticeWhen(n.created_at)}${n.author ? ` por ${n.author}` : ""}`;
}

/** Mensagem do aviso para o WhatsApp, com a bandeira Lima (L) desenhada */
export function noticeText(n: NoticeRow, eventName: string, url: string): string {
  const lines = ["🟨⬛", "⬛🟨  *AVISO AOS COMPETIDORES*", `_${eventName}_`, "", `*${n.title}*`];
  if (n.body) lines.push(n.body.length > 600 ? `${n.body.slice(0, 600)}…` : n.body);
  if (n.file_url) lines.push("", `📎 ${n.file_name ?? "Anexo"}:`, n.file_url);
  lines.push("", `🕐 ${noticeSignature(n)}`, `Quadro de avisos: ${url}`);
  return lines.join("\n");
}

export const noticeUrl = (origin: string, slug: string, id: string) => `${origin}/e/${slug}?aba=avisos#aviso-${id}`;
