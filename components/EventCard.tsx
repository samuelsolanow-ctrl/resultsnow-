import Link from "next/link";
import ClubBadge from "./ClubBadge";
import EventCover from "./EventCover";
import { formatDates, isPast } from "@/lib/data";
import { docsBadge, placeText } from "@/lib/eventInfo";
import type { EventFull } from "@/lib/types";

/** Card padronizado: sempre os mesmos campos, na mesma ordem */
export default function EventCard({ ev }: { ev: EventFull }) {
  const past = isPast(ev);
  const when = formatDates(ev.start_date, ev.end_date);
  const place = placeText(ev);
  const sailed = Math.max(0, ...ev.classes.map((c) => c.races.length));
  const planned = Math.max(0, ...ev.classes.map((c) => c.planned_races ?? 0));
  const boats = ev.classes.reduce((n, c) => n + c.entries.length, 0);
  const docs = docsBadge(ev.notices ?? []);
  const badge = past
    ? { label: "Encerrado" }
    : ev.registration_open && !sailed
      ? { label: "Inscrições abertas", tone: "sea" as const }
      : { label: "Ao vivo", live: true };

  return (
    <Link href={`/eventos/${ev.slug}`} className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <EventCover
        url={ev.cover_url}
        name={ev.name}
        rounded={false}
        badge={badge}
        info={{ subtitle: ev.subtitle, when, place: placeText(ev, false), club: ev.host_club, logo: ev.club_logo_url }}
      />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2.5">
          <ClubBadge name={ev.host_club} logo={ev.club_logo_url} size={32} />
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold leading-tight group-hover:text-sea">{ev.name}</h3>
            {ev.subtitle ? <p className="truncate text-xs text-ink-3">{ev.subtitle}</p> : null}
          </div>
        </div>
        <dl className="mt-2.5 grid grid-cols-[18px_1fr] gap-x-2 gap-y-1 text-[13px] text-ink-2">
          {ev.host_club ? (
            <>
              <dt aria-label="Clube">🏛</dt>
              <dd className="font-semibold">{ev.host_club}</dd>
            </>
          ) : null}
          {place ? (
            <>
              <dt aria-label="Local">📍</dt>
              <dd>{place}</dd>
            </>
          ) : null}
          {when ? (
            <>
              <dt aria-label="Datas">📅</dt>
              <dd>{when}</dd>
            </>
          ) : null}
        </dl>
        {ev.classes.length || ev.level ? (
          <p className="mt-2.5 flex flex-wrap gap-1">
            {ev.level ? <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink-2">{ev.level}</span> : null}
            {ev.classes.map((c) => (
              <span key={c.id} className="rounded-full bg-sea-50 px-2 py-0.5 text-[11px] font-semibold text-sea">
                {c.name}
                {c.entries.length ? ` · ${c.entries.length}` : ""}
              </span>
            ))}
          </p>
        ) : null}
        <div className="mt-auto flex justify-between gap-2 border-t border-line pt-2.5 text-[11px] text-ink-3" style={{ marginTop: 12 }}>
          <span>{sailed ? `🏁 ${sailed}${planned ? ` de ${planned}` : ""} regata${sailed > 1 || planned > 1 ? "s" : ""}` : boats ? `${boats} barcos` : "Aguardando regatas"}</span>
          {docs ? <span>📄 {docs}</span> : null}
        </div>
      </div>
    </Link>
  );
}
