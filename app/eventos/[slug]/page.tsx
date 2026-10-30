import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PrintButton from "@/components/PrintButton";
import ResultsTable from "@/components/ResultsTable";
import ShareEvent from "@/components/ShareEvent";
import { formatDates, getEventBySlug, isPast, standingsFor } from "@/lib/data";
import { CODE_LABELS, discardsFor } from "@/lib/scoring";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ classe?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ev = await getEventBySlug(slug);
  if (!ev) return { title: "ResultsNOW" };
  const desc = [ev.venue, formatDates(ev.start_date, ev.end_date), ev.classes.map((c) => c.name).join(", ")]
    .filter(Boolean)
    .join(" · ");
  const image = ev.cover_url || "/logo-full.jpg";
  return {
    title: `${ev.name} — ResultsNOW`,
    description: `Resultados ao vivo · ${desc}`,
    openGraph: { title: ev.name, description: `Resultados ao vivo · ${desc}`, images: [image], type: "website" },
    twitter: { card: "summary_large_image", title: ev.name, images: [image] },
  };
}

export default async function EventPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { classe } = await searchParams;
  const ev = await getEventBySlug(slug);
  if (!ev) notFound();

  const cls = ev.classes.find((c) => c.id === classe) ?? ev.classes[0];
  const standings = cls ? standingsFor(cls) : [];
  const usedCodes = cls
    ? Array.from(new Set(standings.flatMap((s) => s.cells.map((c) => c.code)).filter(Boolean) as string[]))
    : [];
  const nDiscards = cls ? discardsFor(cls.races.length, cls.discard_rules) : 0;
  const updated = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

  return (
    <div>
      <div className={`no-print relative h-48 sm:h-64 ${ev.cover_url ? "bg-ink" : "cover-default"}`}>
        {ev.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ev.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-4 pb-5 text-white">
          <span className="text-[11px] font-bold uppercase tracking-widest text-white/75">
            {isPast(ev) ? "Resultado final" : "Resultados ao vivo"}
          </span>
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-5xl">{ev.name}</h1>
          <p className="mt-1 text-sm text-white/80">
            {[ev.venue, formatDates(ev.start_date, ev.end_date)].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* cabeçalho só na impressão */}
        <div className="print-only mb-3">
          <h1 className="font-display text-2xl font-bold">{ev.name}</h1>
          <p className="text-xs">
            {[ev.venue, formatDates(ev.start_date, ev.end_date)].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="mb-5">
          <ShareEvent name={ev.name} slug={ev.slug} />
        </div>

        {ev.classes.length > 1 ? (
          <nav className="no-print -mx-4 mb-5 flex gap-1 overflow-x-auto px-4">
            {ev.classes.map((c) => (
              <Link
                key={c.id}
                href={`/eventos/${ev.slug}?classe=${c.id}`}
                className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold ${
                  c.id === cls?.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-2 hover:border-ink-3"
                }`}
              >
                {c.name} <span className="font-normal opacity-60">{c.entries.length}</span>
              </Link>
            ))}
          </nav>
        ) : null}

        {!cls ? (
          <p className="text-ink-3">Este evento ainda não tem classes cadastradas.</p>
        ) : (
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line p-4">
              <div>
                <h2 className="font-display text-2xl font-bold">{cls.name}</h2>
                <p className="text-sm text-ink-3">
                  {cls.entries.length} inscritos · {cls.races.length} regata{cls.races.length === 1 ? "" : "s"}
                  {nDiscards ? ` · ${nDiscards} descarte${nDiscards > 1 ? "s" : ""}` : ""}
                </p>
              </div>
              <PrintButton />
            </div>
            {cls.entries.length ? (
              <ResultsTable standings={standings} races={cls.races} flagMode={ev.flag_mode} crewSize={cls.crew_size} />
            ) : (
              <p className="p-4 text-sm text-ink-3">Nenhum inscrito ainda.</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line p-4 text-xs text-ink-3">
              <span>( ) resultado descartado</span>
              {usedCodes.map((c) => (
                <span key={c}>
                  <b className="text-ink-2">{c}</b> {CODE_LABELS[c] ?? ""}
                </span>
              ))}
              <span className="ml-auto">Atualizado em {updated}</span>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
