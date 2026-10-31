"use client";

import { useEffect, useState } from "react";
import { noticeText } from "@/lib/noticeShare";
import type { NoticeRow } from "@/lib/types";
import { WhatsIcon } from "./RaceShare";
import LimaFlag from "./LimaFlag";

/**
 * Compartilha o aviso: texto com bandeira L + assinatura, e o anexo (PDF/imagem) como ARQUIVO, sem links.
 * O arquivo é baixado antes, porque o iPhone só abre o compartilhar se ele já estiver pronto no toque.
 */
export default function NoticeShareButton({
  notice,
  eventName,
  file: given,
  label,
  className,
  official,
}: {
  notice: NoticeRow;
  eventName: string;
  file?: File | null;
  label?: string;
  className?: string;
  /** botão escuro com a bandeira L (aviso oficial do organizador) */
  official?: boolean;
}) {
  const cls =
    className ??
    (official
      ? "inline-flex h-9 items-center gap-2 rounded-full bg-night px-4 text-sm font-bold text-white"
      : "inline-flex h-8 items-center gap-1.5 rounded-full bg-[#25D366] px-3 text-xs font-bold text-white");
  const text = label ?? (official ? "Enviar aviso oficial" : "Compartilhar aviso");
  const [file, setFile] = useState<File | null>(given ?? null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (given) return setFile(given);
    if (!notice.file_url) return;
    let alive = true;
    fetch(notice.file_url)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (alive && b) setFile(new File([b], notice.file_name ?? "anexo", { type: b.type || "application/octet-stream" }));
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, [notice.file_url, notice.file_name, given]);

  async function share() {
    const text = noticeText(notice, eventName);
    setMsg(null);
    // celular: texto + arquivo de uma vez
    if (file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
      } catch {
        /* cancelado */
      }
      return;
    }
    if (notice.file_url && !file) return setMsg("Preparando o anexo… toque de novo em 2 s.");
    // computador: baixa o anexo e abre o WhatsApp com o texto
    if (file) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      a.click();
      setMsg("Anexo baixado — arraste para a conversa do WhatsApp.");
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button onClick={share} className={cls}>
        {official ? <LimaFlag size={20} /> : <WhatsIcon />} {text}
        {official ? <WhatsIcon color="#25D366" /> : null}
      </button>
      {msg ? <span className="text-[11px] text-ink-3">{msg}</span> : null}
    </span>
  );
}
