"use client";

import { useState } from "react";
import { WhatsIcon } from "./RaceShare";

/**
 * Compartilhar o evento: um botão só, que abre uma janela com a mensagem pronta,
 * link curto e as opções (WhatsApp, copiar, QR, outros apps).
 */
export default function ShareEvent({
  name,
  slug,
  compact,
  path,
  registration,
}: {
  name: string;
  slug: string;
  compact?: boolean;
  path?: string;
  registration?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [what, setWhat] = useState<"res" | "insc">("res");
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  const url = () => {
    if (path) return `${window.location.origin}${path}`;
    return what === "insc" ? `${window.location.origin}/eventos/${slug}/inscricao` : `${window.location.origin}/e/${slug}`;
  };
  const text = () => (what === "insc" ? `⛵ *${name}*\nInscrições abertas 👇\n${url()}` : `⛵ *${name}*\nResultados ao vivo 👇\n${url()}`);

  function whatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(text())}`, "_blank");
  }
  async function copy() {
    await navigator.clipboard.writeText(url()).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  async function others() {
    if (navigator.share) {
      try {
        await navigator.share({ title: name, text: text().replace(/\n?https?:\S+$/, ""), url: url() });
      } catch {
        /* cancelado */
      }
    } else copy();
  }
  async function openQr() {
    const QR = await import("qrcode");
    setQr(await QR.toDataURL(url(), { width: 1024, margin: 2, color: { dark: "#2A2F35", light: "#FFFFFF" } }));
  }

  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-semibold ${on ? "border-sea bg-sea-50 text-sea" : "border-line bg-white text-ink-3"}`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`btn bg-[#25D366] font-bold text-white hover:bg-[#1ebe5a] ${compact ? "" : "h-12 w-full text-base sm:w-auto sm:px-8"}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" />
        </svg>
        {compact ? "Compartilhar link" : "Compartilhar resultados"}
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-night/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-5 sm:rounded-3xl"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line sm:hidden" />
            <p className="text-xs font-bold uppercase tracking-widest text-sea">Compartilhar</p>
            <h2 className="font-display text-xl font-bold leading-tight">{name}</h2>

            {registration && !path ? (
              <div className="mt-3 flex gap-2">
                <button className={chip(what === "res")} onClick={() => setWhat("res")}>Resultados</button>
                <button className={chip(what === "insc")} onClick={() => setWhat("insc")}>Link de inscrição</button>
              </div>
            ) : null}

            <div className="mt-3 whitespace-pre-line break-all rounded-xl border border-line bg-paper p-3 text-sm leading-relaxed">
              {typeof window !== "undefined" ? text().replace(/\*/g, "") : ""}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={whatsapp} className="btn h-12 bg-[#25D366] text-base font-bold text-white hover:bg-[#1ebe5a]">
                <WhatsIcon /> WhatsApp
              </button>
              <button onClick={copy} className="btn-ghost h-12 text-base">{copied ? "Copiado ✓" : "📋 Copiar link"}</button>
              <button onClick={openQr} className="btn-ghost h-12 text-base">▦ QR Code</button>
              <button onClick={others} className="btn-ghost h-12 text-base">⋯ Outros apps</button>
            </div>
            <p className="mt-2 text-center text-xs text-ink-3">No WhatsApp aparece a capa do evento como prévia.</p>
          </div>
        </div>
      ) : null}

      {qr ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-night/60 p-4 backdrop-blur-sm" onClick={() => setQr(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-bold uppercase tracking-widest text-sea">{what === "insc" ? "Inscrições" : "Resultados ao vivo"}</p>
            <h2 className="font-display text-2xl font-bold leading-tight">{name}</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR Code" className="mx-auto mt-3 aspect-square w-full max-w-[280px]" />
            <p className="mt-1 text-xs text-ink-3">Aponte a câmera do celular</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a href={qr} download={`QR_${slug}.png`} className="btn-primary">Baixar imagem</a>
              <button onClick={() => setQr(null)} className="btn-ghost">Fechar</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
