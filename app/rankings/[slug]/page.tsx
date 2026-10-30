import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import BackLink from "@/components/BackLink";
import Flags from "@/components/Flags";
import ShareEvent from "@/components/ShareEvent";
import { formatDates, getCircuit } from "@/lib/data";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getCircuit((await params).slug);
  return { title: c ? `${c.name} — Ranking — ResultsNOW` : "ResultsNOW" };
}

export default async function RankingPage({ params }: Props) {
  const c = await getCircuit((await params).slug);
  if (!c) notFound();
  const th = "px-2 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3 whitespace-nowrap border-b-2 border-night";
  return (
    <div>
      <div className="cover-default">
        <div className="wrap py-8 sm:py-12">
          <Link href="/" className="inline-flex h-9 items-center gap-1 rounded-full bg-night/60 pl-2.5 pr-3.5 text-sm font-semibold text-white hover:bg-night/80">
            ← Eventos
          </Link>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-sky">Ranking</p>
          <h1 className="font-display text-3xl font-bold leading-tight text-white sm:text-5xl">{c.name}</h1>
          <p className="mt-1 text-sm text-white/70">
            {c.stages.length} etapa{c.stages.length === 1 ? "" : "s"} · soma das colocações, menor total vence
          </p>
        </div>
      </div>

      <div className="wrap py-5 sm:py-8">
        <div className="mb-5">
          <ShareEvent name={c.name} slug={c.slug} path={`/rankings/${c.slug}`} />
        </div>

        <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {c.stages.map((s, i) => (
            <Link key={i} href={`/eventos/${s.eventSlug}`} className="card flex items-center gap-3 p-3 hover:border-ink-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-night font-display text-lg font-bold text-sky">E{i + 1}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{s.eventName}</span>
                <span className="block truncate text-xs text-ink-3">{[s.className, formatDates(s.date, null)].filter(Boolean).join(" · ")}</span>
              </span>
            </Link>
          ))}
        </div>

        <section className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className={`${th} sticky left-0 z-[2] w-10 bg-white text-center`}>#</th>
                  <th className={`${th} sticky left-10 z-[2] min-w-[150px] bg-white text-left`}>Velejador</th>
                  {c.stages.map((_, i) => (
                    <th key={i} className={`${th} text-center`}>E{i + 1}</th>
                  ))}
                  <th className={`${th} text-center text-ink`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {c.standings.map((s, i) => {
                  const td = `border-b border-line ${i % 2 ? "bg-paper" : "bg-white"}`;
                  return (
                    <tr key={s.key}>
                      <td className={`${td} sticky left-0 z-[1] px-2 py-2 text-center`}>
                        <span className={`num font-display text-lg font-bold ${s.pos <= 3 ? "text-sea" : ""}`}>{s.pos}</span>
                      </td>
                      <td className={`${td} sticky left-10 z-[1] max-w-[220px] px-2 py-2`}>
                        <Link href={`/velejador/${s.entryId}`} className="block truncate font-semibold hover:text-sea hover:underline">{s.name}</Link>
                        <div className="flex items-center gap-1.5 truncate text-[11px] text-ink-3">
                          <Flags mode="both" country={s.country} state={s.state} />
                          {s.club ? <span className="truncate">{s.club}</span> : null}
                        </div>
                      </td>
                      {s.cells.map((x, j) => (
                        <td key={j} className={`${td} num px-2 py-2 text-center ${x.rank == null ? "text-ink-3" : ""}`}>
                          {x.rank == null ? `(${x.points})` : x.points}
                        </td>
                      ))}
                      <td className={`${td} num px-3 py-2 text-center font-bold`}>{s.total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line p-4 text-xs text-ink-3">
            Pontos = colocação final em cada etapa. ( ) não correu a etapa: inscritos da etapa + 1. Empate: melhores resultados, depois a última etapa.
          </p>
        </section>
      </div>
    </div>
  );
}
