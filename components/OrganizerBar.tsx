"use client";

import { useEffect, useState } from "react";
import { PUBLIC_EVENT, isPublicMode, setPublicMode } from "@/lib/publicMode";

/** Só para o organizador logado (dono, ajudante ou master): barra fixa no rodapé com atalhos */
export default function OrganizerBar({ eventId, organizer, helpers = [] }: { eventId: string; organizer: string | null; helpers?: string[] }) {
  const [can, setCan] = useState(false);
  const [pub, setPub] = useState(false);

  useEffect(() => {
    const sync = () => setPub(isPublicMode());
    sync();
    window.addEventListener(PUBLIC_EVENT, sync);
    return () => window.removeEventListener(PUBLIC_EVENT, sync);
  }, []);

  useEffect(() => {
    fetch("/api/login", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.user) return;
        const u = String(j.user).toLowerCase();
        const own = (organizer ?? "").toLowerCase() === u;
        const helper = helpers.some((h) => h.toLowerCase() === u);
        setCan(!!j.master || own || helper);
      })
      .catch(() => null);
  }, [organizer, helpers]);

  if (!can) return null;

  // vendo como público: só um botãozinho para voltar
  if (pub) {
    return (
      <button
        onClick={() => setPublicMode(false)}
        className="fixed bottom-3 right-3 z-30 rounded-full bg-night/90 px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        👁 Público · <u>voltar</u>
      </button>
    );
  }

  // os botões de lançar/editar ficam abaixo do título (OrganizerActions)
  return null;
}
