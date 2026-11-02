import ClubBadge from "./ClubBadge";

/**
 * Capa do evento no formato 16:9 (como miniatura do YouTube).
 * Sem arte do organizador: capa automática, sempre no mesmo padrão
 * (troféu, nome, datas · cidade e o clube).
 */
export default function EventCover({
  url,
  name,
  badge,
  rounded = true,
  priority,
  showName = true,
  info,
}: {
  url: string | null;
  name: string;
  badge?: { label: string; live?: boolean; tone?: "sea" };
  rounded?: boolean;
  priority?: boolean;
  showName?: boolean;
  info?: { subtitle?: string | null; when?: string; place?: string; club?: string | null; logo?: string | null };
}) {
  return (
    <div className={`relative aspect-video w-full overflow-hidden ${rounded ? "rounded-xl" : ""} ${url ? "bg-night" : "cover-default"}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} fetchPriority={priority ? "high" : undefined} loading={priority ? undefined : "lazy"} className="absolute inset-0 h-full w-full object-cover" />
      ) : showName || info ? (
        <div className="absolute inset-0 flex flex-col justify-center p-[6%] text-white">
          {info?.subtitle ? <p className="text-[clamp(.6rem,2.2vw,.95rem)] font-semibold uppercase tracking-[.18em] text-white/80">{info.subtitle}</p> : null}
          <p className="mt-1 max-w-[80%] font-display text-[clamp(1.3rem,6vw,3rem)] font-bold uppercase leading-[1.02]">{name}</p>
          {info?.when || info?.place ? (
            <p className="mt-2 text-[clamp(.6rem,2.2vw,.95rem)] font-semibold uppercase tracking-wider text-white/85">
              {[info.when, info.place].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          {info?.club ? (
            <div className="absolute bottom-[6%] left-[6%] flex items-center gap-2 text-[clamp(.6rem,2vw,.9rem)] font-semibold">
              <ClubBadge name={info.club} logo={info.logo} size={26} />
              {info.club}
            </div>
          ) : null}
        </div>
      ) : null}
      {badge ? (
        <span
          className={`absolute left-3 top-3 rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
            badge.live ? "bg-flag text-white" : badge.tone === "sea" ? "bg-sea text-white" : "bg-white/90 text-ink-2"
          }`}
        >
          {badge.live ? "● " : ""}
          {badge.label}
        </span>
      ) : null}
    </div>
  );
}
