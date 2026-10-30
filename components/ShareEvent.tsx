"use client";

import { useState } from "react";
import { WhatsIcon } from "./RaceShare";

/** Botões para compartilhar o link do evento */
export default function ShareEvent({ name, slug, compact }: { name: string; slug: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = () => `${window.location.origin}/eventos/${slug}`;
  const text = () => `⛵ ${name}\nResultados ao vivo: ${url()}`;

  function whatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(text())}`, "_blank");
  }

  async function copy() {
    if (navigator.share) {
      try {
        await navigator.share({ title: name, text: `⛵ ${name}`, url: url() });
        return;
      } catch {
        return;
      }
    }
    await navigator.clipboard.writeText(url()).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="no-print flex flex-wrap gap-2">
      <button onClick={whatsapp} className="btn bg-[#25D366] text-white hover:bg-[#1ebe5a]">
        <WhatsIcon /> {compact ? "WhatsApp" : "Enviar no WhatsApp"}
      </button>
      <button onClick={copy} className="btn-ghost">
        {copied ? "Link copiado ✓" : "Compartilhar link"}
      </button>
    </div>
  );
}
