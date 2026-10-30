"use client";

import { useState } from "react";
import { WhatsIcon } from "./RaceShare";
import { db } from "@/lib/adminDb";

/** Como os atletas entram no evento: pelo link (cada um se inscreve) ou manual (o organizador inscreve) */
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

  const opt = (active: boolean) =>
    `flex flex-1 flex-col items-start rounded-lg border-2 p-3 text-left transition ${
      active ? "border-sea bg-sea-50" : "border-line bg-white hover:border-ink-3"
    }`;

  return (
    <div className="card mb-4 overflow-hidden">
      <div className="p-4">
        <p className="mb-2 font-display text-xl font-bold">Inscrições</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button disabled={busy} onClick={() => setMode(true)} className={opt(open)}>
            <span className="flex items-center gap-2 font-semibold">
              <Radio on={open} /> Velejadores pelo link
            </span>
            <span className="ml-7 text-xs text-ink-3">Cada um se inscreve sozinho e já entra na lista.</span>
          </button>
          <button disabled={busy} onClick={() => setMode(false)} className={opt(!open)}>
            <span className="flex items-center gap-2 font-semibold">
              <Radio on={!open} /> Eu inscrevo manualmente
            </span>
            <span className="ml-7 text-xs text-ink-3">Você cadastra os atletas (um a um ou colando a lista).</span>
          </button>
        </div>
      </div>

      <div className="border-t border-line bg-paper p-4">
        {!hasClasses ? (
          <p className="mb-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
            Primeiro cadastre ao menos uma classe na aba <b>Classes</b>.
          </p>
        ) : null}
        {open ? (
          <div className="flex flex-wrap gap-2">
            <button onClick={whatsapp} className="btn bg-[#25D366] text-white hover:bg-[#1ebe5a]">
              <WhatsIcon /> Mandar link no WhatsApp
            </button>
            <button onClick={copy} className="btn-ghost">{copied ? "Copiado ✓" : "Copiar link"}</button>
            <button onClick={openQr} className="btn-ghost">QR</button>
            <a href={`/eventos/${slug}/inscricao`} target="_blank" className="btn-ghost">Ver página ↗</a>
          </div>
        ) : (
          <button onClick={onManual} className="btn-primary">
            + Inscrever atletas
          </button>
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
    </div>
  );
}

function Radio({ on }: { on: boolean }) {
  return (
    <span className={`grid h-5 w-5 place-items-center rounded-full border-2 ${on ? "border-sea" : "border-ink-3/40"}`}>
      {on ? <span className="h-2.5 w-2.5 rounded-full bg-sea" /> : null}
    </span>
  );
}
