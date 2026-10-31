import type { NoticeRow } from "./types";

const TZ = "America/Sao_Paulo";

/** "31/10 às 10:17" */
export function noticeWhen(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  return `${day} às ${time}`;
}

/** Assinatura: "Publicado em 31/10 às 10:17 · Comissão de Regata · Samuel" (at = outro horário, ex.: o do envio) */
export function noticeSignature(n: NoticeRow, at?: string): string {
  return `Publicado em ${noticeWhen(at ?? n.created_at)} · Comissão de Regata${n.author ? ` · ${n.author}` : ""}`;
}

/**
 * Mensagem do aviso para o WhatsApp: bandeira L, título, texto e assinatura.
 * Horário = hora do envio. Sem links: o anexo (PDF, imagem) vai como arquivo junto.
 */
export function noticeText(n: NoticeRow, eventName: string): string {
  // ordem: título do aviso → bandeira L → evento → mensagem → assinatura
  const lines = ["*AVISO AOS COMPETIDORES*", "🟨⬛", "⬛🟨", "", `_${eventName}_`, `*${n.title}*`];
  // resultado vai só no PDF: nunca manda a classificação escrita
  if (n.body && !isResultNotice(n)) lines.push(n.body.length > 600 ? `${n.body.slice(0, 600)}…` : n.body);
  // o quadro oficial é o grupo do WhatsApp: vale a hora do envio
  lines.push("", `🕐 ${noticeSignature(n, new Date().toISOString())}`);
  return lines.join("\n");
}

/** Aviso de resultado oficial ("Resultados · Finn · Regata 3") */
export const isResultNotice = (n: Pick<NoticeRow, "title">) => n.title.startsWith("Resultados · ");
