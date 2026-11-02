"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { db } from "@/lib/adminDb";
import { useCanManage } from "@/lib/useCanManage";

/** Só organizador: botão grande para lançar a próxima regata + editar o evento */
export default function OrganizerActions({
  eventId,
  organizer,
  helpers,
  label,
  finished,
}: {
  eventId: string;
  organizer: string | null;
  helpers: string[];
  label: string;
  finished?: boolean;
}) {
  const can = useCanManage(organizer, helpers);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!can) return null;

  async function setStatus(status: "finished" | "live") {
    if (status === "finished" && !confirm("Encerrar o evento? A classificação atual vira a final e o evento vai para Eventos passados.")) return;
    setBusy(true);
    await db.from("events").update({ status }).eq("id", eventId);
    setBusy(false);
    router.refresh();
  }

  if (finished) {
    return (
      <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-white px-3 py-2.5 text-sm">
        <span className="font-semibold text-ink-2">🏆 Evento encerrado</span>
        <button onClick={() => setStatus("live")} disabled={busy} className="text-xs font-semibold text-sea underline">
          {busy ? "…" : "Reabrir"}
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex gap-2">
        <Link
          href={`/admin/lancar/${eventId}`}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-sea text-base font-bold text-white shadow-sm active:scale-[0.99]"
        >
          🏁 {label}
        </Link>
        <Link
          href={`/admin/eventos/${eventId}`}
          aria-label="Editar evento"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-white text-ink-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </Link>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px]">
        <button onClick={() => setStatus("finished")} disabled={busy} className="font-semibold text-ink-3 underline">
          {busy ? "Encerrando…" : "🏆 Encerrar evento"}
        </button>
        <span className="text-ink-3">só você vê</span>
      </div>
    </div>
  );
}
