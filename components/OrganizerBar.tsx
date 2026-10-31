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
        className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-night px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        👁 Vendo como público · <u>voltar</u>
      </button>
    );
  }

  return (
    <>
      {/* aviso: você está logado */}
      <div className="flex items-center justify-between gap-2 bg-amber-100 px-4 py-2 text-xs text-amber-900 sm:text-sm">
        <span>🔑 Você está como <b>organizador</b></span>
        <button onClick={() => setPublicMode(true)} className="font-bold underline">👁 Ver como público</button>
      </div>
      {/* espaço para a barra não cobrir o fim da página */}
      <div className="h-24" />
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-night/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="wrap flex items-center gap-2 py-3">
          <Link href={base} className="btn h-12 flex-1 bg-sky text-base font-bold text-night hover:bg-sky-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Editar evento
          </Link>
          <Link href={`${base}?aba=regatas`} className="btn h-12 flex-1 border border-white/25 text-base text-white hover:bg-white/10">
            🏁 Lançar regata
          </Link>
        </div>
      </div>
    </>
  );
}
