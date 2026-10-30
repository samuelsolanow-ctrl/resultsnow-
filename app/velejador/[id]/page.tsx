import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import BackLink from "@/components/BackLink";
import Flags from "@/components/Flags";
import { formatDates, getSailor } from "@/lib/data";

export const revalidate = 300;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await getSailor((await params).id);
  return { title: s ? `${s.name} — ResultsNOW` : "ResultsNOW" };
}

const medal = (r: number) => (r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : "");

export default async function SailorPage({ params }: Props) {
  const s = await getSailor((await params).id);
  if (!s) notFound();
  const podiums = s.rows.filter((r) => r.rank <= 3).length;
  const wins = s.rows.filter((r) => r.rank === 1).length;
  const best = s.rows.length ? Math.min(...s.rows.map((r) => r.rank)) : null;

  return (
    <div className="wrap max-w-3xl py-5 sm:py-8">
      <BackLink href="/">Eventos</BackLink>
      <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
        <h1 className="font-display text-4xl font-bold leading-none">{s.name}</h1>
        <Flags mode="both" country={s.country} state={s.state} />
      </div>
      <p className="mt-1 text-sm text-ink-3">
        {[s.club, s.cbvela ? `CBVela ${s.cbvela}` : null].filter(Boolean).join(" · ")}
      </p>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          ["Eventos", String(s.rows.length)],
          ["Pódios", String(podiums)],
          [wins ? "Vitórias" : "Melhor", wins ? String(wins) : best ? `${best}º` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="card p-3 text-center">
            <p className="num font-display text-3xl font-bold">{v}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{k}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-7 font-display text-xl font-bold">Histórico</h2>
      <div className="card divide-y divide-line">
        {s.rows.map((r, i) => (
          <Link key={i} href={`/eventos/${r.eventSlug}`} className="flex items-center gap-3 p-3 hover:bg-paper">
            <div className="w-14 shrink-0 text-center">
              <p className={`num font-display text-2xl font-bold leading-none ${r.rank <= 3 ? "text-sea" : ""}`}>
                {medal(r.rank) || `${r.rank}º`}
              </p>
              <p className="text-[11px] text-ink-3">de {r.of}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{r.eventName}</p>
              <p className="truncate text-xs text-ink-3">
                {[r.className, formatDates(r.date, null), `${r.races} regatas`, `${r.net} pts`, r.crew ? `com ${r.crew}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </Link>
        ))}
        {!s.rows.length ? <p className="p-3 text-sm text-ink-3">Sem resultados publicados ainda.</p> : null}
      </div>
      {!s.cbvela ? (
        <p className="mt-3 text-xs text-ink-3">Histórico reunido pelo nome. Com o ID CBVela cadastrado, os eventos se juntam com mais precisão.</p>
      ) : null}
    </div>
  );
}
