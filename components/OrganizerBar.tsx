"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Aparece só para o organizador logado (dono do evento ou master): atalhos para editar */
export default function OrganizerBar({ eventId, organizer, helpers = [] }: { eventId: string; organizer: string | null; helpers?: string[] }) {
  const [can, setCan] = useState(false);

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
  return (
    <div className="sticky top-14 z-20 border-b border-sky-600/40 bg-sky-50">
      <div className="wrap flex flex-wrap items-center gap-2 py-2">
        <span className="mr-auto flex items-center gap-2 text-sm font-semibold text-sea">
          <span className="h-2 w-2 rounded-full bg-sea" /> Você organiza este evento
        </span>
        <Link href={`${base}?aba=regatas`} className="btn-primary h-9 px-3">Lançar regata</Link>
        <Link href={`${base}?aba=inscritos`} className="btn-ghost h-9 px-3">Inscritos</Link>
        <Link href={base} className="btn-ghost h-9 px-3">Editar evento</Link>
      </div>
    </div>
  );
}
