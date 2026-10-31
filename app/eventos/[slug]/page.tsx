import { notFound } from "next/navigation";
import type { Metadata } from "next";
import EventCover from "@/components/EventCover";
import OrganizerBar from "@/components/OrganizerBar";
import EventResults, { type ClassView } from "@/components/EventResults";
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
        <div className="mx-auto max-w-4xl sm:px-6 sm:pt-5">
          <EventCover url={ev.cover_url} name={ev.name} priority rounded={false} />
          <div className="px-4 pb-4 pt-3 sm:px-0">
            <h1 className="text-[17px] font-bold leading-snug text-white sm:text-2xl">{ev.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/60 sm:text-sm">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isPast(ev) ? "bg-white/15 text-white" : "bg-flag text-white"}`}>
                {isPast(ev) ? "Resultado final" : "● Ao vivo"}
              </span>
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="wrap max-w-4xl py-4 sm:py-6">
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
          slug={ev.slug}
          registration={!!ev.registration_open}
          organizer={ev.organizer}
          helpers={ev.helpers ?? []}
          eventId={ev.id}
        />
      </div>
    </div>
  );
}
