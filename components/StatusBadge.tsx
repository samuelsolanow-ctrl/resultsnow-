import type { EventRow } from "@/lib/types";

export default function StatusBadge({ status }: { status: EventRow["status"] }) {
  const map = {
    draft: ["Rascunho", "bg-paper text-ink-3 border-line"],
    live: ["Ao vivo", "bg-red-50 text-flag border-red-200"],
    finished: ["Encerrado", "bg-sea-50 text-sea border-sea/20"],
  } as const;
  const [label, cls] = map[status];
  return <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
