"use client";

import { useState } from "react";
import { WhatsIcon } from "./RaceShare";
import { db } from "@/lib/adminDb";

/** Inscrições (compacto, abre e fecha): pelo link ou manual */
export default function RegistrationLink({
  eventId,
  name,
  slug,
  open,
  hasClasses,
  onChange,
  onManual,
}: {
  eventId: string;
  name: string;
  slug: string;
  open: boolean;
  hasClasses: boolean;
  onChange: () => void;
  onManual: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const url = () => `${window.location.origin}/eventos/${slug}/inscricao`;

  async function setMode(link: boolean) {
    if (link === open) return;
    setBusy(true);
    await db.from("events").update({ registration_open: link }).eq("id", eventId);
    setBusy(false);
    onChange();
  }

  function whatsapp() {
    const text = `⛵ *${name}*\nInscrições abertas! Faça a sua aqui:\n${url()}`;
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
    <details className="group card overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
        <span className="font-semibold">Inscrições</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${open ? "bg-[#25D366]/15 text-[#128C4A]" : "bg-paper text-ink-2"}`}>
          {open ? "pelo link" : "manual"}
        </span>
        <Chevron />
      </summary>

      <div className="space-y-3 border-t border-line p-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-paper p-1 text-sm">
          <button disabled={busy} onClick={() => setMode(true)} className={`h-9 rounded-md font-semibold ${open ? "bg-white shadow-sm" : "text-ink-3"}`}>
            Pelo link
          </button>
          <button disabled={busy} onClick={() => setMode(false)} className={`h-9 rounded-md font-semibold ${!open ? "bg-white shadow-sm" : "text-ink-3"}`}>
            Manual
          </button>
        </div>
        {!hasClasses ? <p className="text-xs text-amber-700">Cadastre uma classe na aba Classes primeiro.</p> : null}
        {open ? (
          <>
            <p className="text-xs text-ink-3">Cada velejador se inscreve sozinho e já entra na lista.</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={whatsapp} className="btn h-9 bg-[#25D366] px-3 text-white hover:bg-[#1ebe5a]">
                <WhatsIcon /> Mandar link
              </button>
              <button onClick={copy} className="btn-ghost h-9 px-3">{copied ? "Copiado ✓" : "Copiar"}</button>
              <button onClick={openQr} className="btn-ghost h-9 px-3">QR</button>
              <a href={`/eventos/${slug}/inscricao`} target="_blank" className="btn-ghost h-9 px-3">Ver ↗</a>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-ink-3">Você cadastra os atletas (um a um ou colando a lista).</p>
            <button onClick={onManual} className="btn-primary h-9 px-3">+ Inscrever atletas</button>
          </>
        )}
      </div>

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
    </details>
  );
}

export function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="ml-auto text-ink-3 transition group-open:rotate-180" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
