import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import EventResults, { type ClassView } from "@/components/EventResults";
import ShareEvent from "@/components/ShareEvent";
import { formatDates, getEventBySlug, isPast, standingsFor } from "@/lib/data";
import { discardsFor } from "@/lib/scoring";

// página guardada em cache; é atualizada na hora sempre que o organizador salva algo
export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

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

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const ev = await getEventBySlug(slug);
  if (!ev) notFound();

  const subtitle = [ev.venue, formatDates(ev.start_date, ev.end_date)].filter(Boolean).join(" · ");
  const updated = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const classes: ClassView[] = ev.classes.map((c) => {
    const standings = standingsFor(c);
    return {
      id: c.id,
      name: c.name,
      crewSize: c.crew_size,
      entries: c.entries.length,
      races: c.races.map((r) => ({ id: r.id, number: r.number })),
      nDiscards: discardsFor(c.races.length, c.discard_rules),
      standings,
      usedCodes: Array.from(new Set(standings.flatMap((s) => s.cells.map((x) => x.code)).filter(Boolean) as string[])),
    };
  });

  return (
    <div>
      <div className={`relative h-44 sm:h-60 lg:h-72 ${ev.cover_url ? "bg-night" : "cover-default"}`}>
        {ev.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ev.cover_url} alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover opacity-90" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-night/90 via-night/25 to-transparent" />
        <div className="wrap absolute inset-x-0 top-0 pt-3">
          <Link href="/" className="inline-flex h-9 items-center gap-1 rounded-full bg-night/60 pl-2.5 pr-3.5 text-sm font-semibold text-white backdrop-blur hover:bg-night/80">
            <span aria-hidden>←</span> Eventos
          </Link>
        </div>
        <div className="wrap absolute inset-x-0 bottom-0 pb-5 text-white">
          <span className="text-[11px] font-bold uppercase tracking-widest text-white/75">
            {isPast(ev) ? "Resultado final" : "Resultados ao vivo"}
          </span>
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-5xl">{ev.name}</h1>
          {subtitle ? <p className="mt-1 text-sm text-white/80">{subtitle}</p> : null}
        </div>
      </div>

      <div className="wrap py-5 sm:py-8">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <ShareEvent name={ev.name} slug={ev.slug} />
          {ev.registration_open ? (
            <Link href={`/eventos/${ev.slug}/inscricao`} className="btn-primary">
              Inscrever-se
            </Link>
          ) : null}
        </div>
        <EventResults
          eventName={ev.name}
          subtitle={subtitle}
          flagMode={ev.flag_mode}
          classes={classes}
          updated={updated}
          notices={ev.notices}
          protests={ev.protests}
        />
      </div>
    </div>
  );
}
