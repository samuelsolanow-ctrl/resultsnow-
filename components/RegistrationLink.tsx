"use client";

import { useState } from "react";
import { WhatsIcon } from "./RaceShare";
import { db } from "@/lib/adminDb";

/** Cartão do painel: link de inscrição pronto para mandar no WhatsApp */
export default function RegistrationLink({
  eventId,
  name,
  slug,
  open,
  hasClasses,
  onChange,
}: {
  eventId: string;
  name: string;
  slug: string;
  open: boolean;
  hasClasses: boolean;
  onChange: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const url = () => `${window.location.origin}/eventos/${slug}/inscricao`;

  async function toggle() {
    setBusy(true);
    await db.from("events").update({ registration_open: !open }).eq("id", eventId);
    setBusy(false);
    onChange();
  }

  function whatsapp() {
    const text = `⛵ *${name}*\nInscrições abertas! Faça a sua aqui (numeral, nome e clube):\n${url()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function copy() {
    await navigator.clipboard.writeText(url()).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function openQr() {
    const QR = await import("qrcode");
    setQr(await QR.toDataURL(url(), { width: 1024, margin: 2, color: { dark: "#2A2F35", light: "#FFFFFF" } }));
  }

  return (
    <div className={`card mb-4 overflow-hidden ${open ? "border-sea/40" : ""}`}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-display text-xl font-bold">
            <span className={`h-2.5 w-2.5 rounded-full ${open ? "bg-[#25D366]" : "bg-ink-3/40"}`} />
            Inscrições {open ? "abertas" : "fechadas"}
          </p>
          <p className="text-sm text-ink-3">
            {open
              ? "Mande o link: cada velejador coloca numeral, nome e clube e já entra na lista."
              : "Ninguém consegue se inscrever pelo link agora."}
          </p>
        </div>
        <button onClick={toggle} disabled={busy} className="btn-ghost">
          {open ? "Fechar inscrições" : "Abrir inscrições"}
        </button>
      </div>
      {open ? (
        <div className="border-t border-line bg-paper p-4">
          {!hasClasses ? (
            <p className="mb-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
              Cadastre ao menos uma classe na aba <b>Classes</b> antes de mandar o link.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button onClick={whatsapp} className="btn bg-[#25D366] text-white hover:bg-[#1ebe5a]">
              <WhatsIcon /> Mandar link no WhatsApp
            </button>
            <button onClick={copy} className="btn-ghost">{copied ? "Copiado ✓" : "Copiar link"}</button>
            <button onClick={openQr} className="btn-ghost">QR</button>
            <a href={`/eventos/${slug}/inscricao`} target="_blank" className="btn-ghost">Ver página ↗</a>
          </div>
        </div>
      ) : null}

      {qr ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-night/60 p-4 backdrop-blur-sm" onClick={() => setQr(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-bold uppercase tracking-widest text-sea">Inscrições</p>
            <h2 className="font-display text-2xl font-bold leading-tight">{name}</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR Code de inscrição" className="mx-auto mt-3 aspect-square w-full max-w-[280px]" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a href={qr} download={`Inscricao_${slug}.png`} className="btn-primary">Baixar</a>
              <button onClick={() => setQr(null)} className="btn-ghost">Fechar</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
