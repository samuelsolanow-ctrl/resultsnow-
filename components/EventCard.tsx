import Link from "next/link";
import EventCover from "./EventCover";
import { formatDates, isPast, standingsFor } from "@/lib/data";
import type { EventFull } from "@/lib/types";

export default function EventCard({ ev }: { ev: EventFull }) {
  const first = ev.classes.find((c) => c.races.length > 0) ?? ev.classes[0];
  const top = first ? standingsFor(first).slice(0, 3) : [];
  const hasRaces = first ? first.races.length > 0 : false;
  const past = isPast(ev);

  return (
    <Link href={`/eventos/${ev.slug}`} className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <EventCover url={ev.cover_url} name={ev.name} rounded={false} showName={false} badge={{ label: past ? "Encerrado" : "Ao vivo", live: !past }} />
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-xl font-bold leading-tight group-hover:text-sea">{ev.name}</h3>
        <p className="mt-1 text-sm text-ink-3">
          {[ev.venue, formatDates(ev.start_date, ev.end_date)].filter(Boolean).join(" · ")}
        </p>
        {ev.classes.length ? (
          <p className="mt-2 flex flex-wrap gap-1">
            {ev.classes.map((c) => (
              <span key={c.id} className="rounded bg-sea-50 px-1.5 py-0.5 text-[11px] font-semibold text-sea">
                {c.name}
              </span>
            ))}
          </p>
        ) : null}
        <div className="mt-4 border-t border-line pt-3">
          {hasRaces && top.length ? (
            <>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                {first!.name} · {first!.races.length} regata{first!.races.length > 1 ? "s" : ""}
              </p>
              <ol className="space-y-1">
                {top.map((s) => (
                  <li key={s.entry.id} className="flex items-center gap-2 text-sm">
                    <span className="num w-4 font-bold text-ink-3">{s.rank}</span>
                    <span className="truncate font-medium">{s.entry.helm_name}</span>
                    <span className="num ml-auto font-semibold">{s.net}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="text-sm text-ink-3">Aguardando a primeira regata</p>
          )}
        </div>
      </div>
    </Link>
  );
}
