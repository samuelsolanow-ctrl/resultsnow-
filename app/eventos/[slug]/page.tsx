import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import BackLink from "@/components/BackLink";
import EventCover from "@/components/EventCover";
import OrganizerBar from "@/components/OrganizerBar";
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
      races: c.races.map((r) => ({ id: r.id, number: r.number, conditions: r.conditions ?? null })),
      nDiscards: discardsFor(c.races.length, c.discard_rules),
      standings,
      usedCodes: Array.from(new Set(standings.flatMap((s) => s.cells.map((x) => x.code)).filter(Boolean) as string[])),
    };
  });

  return (
    <div>
      <OrganizerBar eventId={ev.id} organizer={ev.organizer} helpers={ev.helpers ?? []} />
      <div className="bg-night">
        <div className="wrap max-w-4xl pb-6 pt-3 sm:pt-5">
          <BackLink href="/">Eventos</BackLink>
          <div className="mt-3">
            <EventCover
              url={ev.cover_url}
              name={ev.name}
              priority
              badge={{ label: isPast(ev) ? "Resultado final" : "Ao vivo", live: !isPast(ev) }}
            />
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-white sm:text-4xl">{ev.name}</h1>
          {subtitle ? <p className="mt-1 text-sm text-white/70">{subtitle}</p> : null}
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
          showClub={ev.show_club !== false}
          showCbvela={ev.show_cbvela !== false}
          protests={ev.protests}
        />
      </div>
    </div>
  );
}
