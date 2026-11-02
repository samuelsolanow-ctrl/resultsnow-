import { notFound } from "next/navigation";
import type { Metadata } from "next";
import EventCover from "@/components/EventCover";
import ClubBadge from "@/components/ClubBadge";
import { placeText } from "@/lib/eventInfo";
import OrganizerBar from "@/components/OrganizerBar";
import AutoRefresh from "@/components/AutoRefresh";
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
  const desc = [ev.host_club, placeText(ev, false), formatDates(ev.start_date, ev.end_date), ev.classes.map((c) => c.name).join(", ")]
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

  const when = formatDates(ev.start_date, ev.end_date);
  // usado também no cabeçalho do PDF
  const subtitle = [ev.host_club, placeText(ev), when].filter(Boolean).join(" · ");
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
      <AutoRefresh />
      <OrganizerBar eventId={ev.id} organizer={ev.organizer} helpers={ev.helpers ?? []} />
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-4xl sm:px-6 sm:pt-5">
          <EventCover
            url={ev.cover_url}
            name={ev.name}
            priority
            rounded={false}
            info={{ subtitle: ev.subtitle, when, place: placeText(ev, false), club: ev.host_club, logo: ev.club_logo_url }}
          />
          <div className="flex items-start gap-3 px-4 py-3 sm:px-0 sm:py-4">
            <ClubBadge name={ev.host_club} logo={ev.club_logo_url} size={38} />
            <div className="min-w-0 flex-1">
              <h1 className="text-[17px] font-bold leading-snug sm:text-2xl">{ev.name}</h1>
              {ev.subtitle ? <p className="text-xs text-ink-3 sm:text-sm">{ev.subtitle}</p> : null}
              <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-2 sm:text-sm">
                {isPast(ev) ? <span className="font-semibold">Resultado final</span> : <span className="font-bold text-flag">● ao vivo</span>}
                {ev.host_club ? <span>🏛 {ev.host_club}</span> : null}
                {placeText(ev, false) ? <span>📍 {placeText(ev, false)}</span> : null}
                {when ? <span>📅 {when}</span> : null}
                {ev.registration_open ? (
                  <a href={`/eventos/${ev.slug}/inscricao`} className="font-semibold text-sea underline">inscrever-se</a>
                ) : null}
              </p>
            </div>
            <ShareEvent name={ev.name} slug={ev.slug} registration={!!ev.registration_open} round />
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
