"use client";

import Link from "next/link";
import { useCanManage } from "@/lib/useCanManage";

/** Só organizador: botão grande para lançar a próxima regata + editar o evento */
export default function OrganizerActions({
  eventId,
  organizer,
  helpers,
  label,
}: {
  eventId: string;
  organizer: string | null;
  helpers: string[];
  label: string;
}) {
  const can = useCanManage(organizer, helpers);
  if (!can) return null;
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
      <p className="mt-1 text-right text-[10px] text-ink-3">só você vê</p>
    </div>
  );
}
