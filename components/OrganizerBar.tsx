"use client";

import Link from "next/link";
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
  const base = `/admin/eventos/${eventId}`;

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

  // uma faixa fina no topo (não flutua sobre a súmula)
  const btn = "inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-bold";
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto bg-amber-50 px-3 py-1.5 text-amber-900 sm:px-4">
      <span className="mr-auto shrink-0 text-xs font-semibold">🔑 Organizador</span>
      <Link href={base} className={`${btn} shrink-0 bg-night text-white`}>✎ Editar</Link>
      <Link href={`/admin/lancar/${eventId}`} className={`${btn} shrink-0 bg-night text-white`}>🏁 Lançar</Link>
      <button onClick={() => setPublicMode(true)} className={`${btn} shrink-0 border border-amber-300 bg-white`}>👁 Público</button>
    </div>
  );
}
