"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/adminDb";

/** Ranking na página inicial; quem pode (master ou quem criou) vê a lixeira */
export default function RankingChip({ id, name, slug, organizer }: { id: string; name: string; slug: string; organizer: string | null }) {
  const router = useRouter();
  const [can, setCan] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    fetch("/api/login", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.user && setCan(!!j.master || (organizer ?? "").toLowerCase() === String(j.user).toLowerCase()))
      .catch(() => null);
  }, [organizer]);

  async function remove() {
    if (!confirm(`Apagar o ranking "${name}"?\n\nOs eventos continuam existindo. Não dá para desfazer.`)) return;
    const { error } = await db.from("circuits").delete().eq("id", id);
    if (error) return alert(error.message);
    setGone(true);
    router.refresh();
  }

  if (gone) return null;
  return (
    <div className="card flex items-center">
      <Link href={`/rankings/${slug}`} className="flex items-center gap-2 py-3 pl-4 pr-3 font-semibold hover:text-sea">
        <span className="text-sea">🏆</span> {name}
      </Link>
      {can ? (
        <button
          onClick={remove}
          aria-label={`Apagar ${name}`}
          title="Apagar ranking"
          className="mr-1.5 grid h-9 w-9 place-items-center rounded-lg text-ink-3 hover:bg-red-50 hover:text-red-700"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
