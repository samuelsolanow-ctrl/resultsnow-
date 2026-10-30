"use client";

import { useState } from "react";
import { WhatsIcon } from "./RaceShare";

/** Compartilhar o evento: WhatsApp, link e QR Code para o mural do clube */
export default function ShareEvent({ name, slug, compact, path }: { name: string; slug: string; compact?: boolean; path?: string }) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const url = () => `${window.location.origin}${path ?? `/eventos/${slug}`}`;

  function whatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(`⛵ ${name}\nResultados ao vivo: ${url()}`)}`, "_blank");
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: name, text: `⛵ ${name}`, url: url() });
      } catch {
        /* cancelado */
      }
      return;
    }
    await navigator.clipboard.writeText(url()).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function openQr() {
    const QR = await import("qrcode");
    setQr(await QR.toDataURL(url(), { width: 1024, margin: 2, color: { dark: "#2A2F35", light: "#FFFFFF" } }));
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button onClick={whatsapp} className="btn bg-[#25D366] text-white hover:bg-[#1ebe5a]">
          <WhatsIcon /> {compact ? "WhatsApp" : "Enviar no WhatsApp"}
        </button>
        <button onClick={share} className="btn-ghost">{copied ? "Link copiado ✓" : "Compartilhar"}</button>
        <button onClick={openQr} className="btn-ghost" aria-label="QR Code do evento">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4z" />
          </svg>
          QR
        </button>
      </div>

      {qr ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-night/60 p-4 backdrop-blur-sm" onClick={() => setQr(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-bold uppercase tracking-widest text-sea">Resultados ao vivo</p>
            <h2 className="font-display text-2xl font-bold leading-tight">{name}</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR Code do evento" className="mx-auto mt-3 aspect-square w-full max-w-[280px]" />
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
