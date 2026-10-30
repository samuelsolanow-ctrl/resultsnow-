/** Capa do evento no formato 16:9 (como miniatura do YouTube) */
export default function EventCover({
  url,
  name,
  badge,
  rounded = true,
  priority,
  showName = true,
}: {
  url: string | null;
  name: string;
  badge?: { label: string; live?: boolean };
  rounded?: boolean;
  priority?: boolean;
  showName?: boolean;
}) {
  return (
    <div className={`relative aspect-video w-full overflow-hidden ${rounded ? "rounded-xl" : ""} ${url ? "bg-night" : "cover-default"}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} fetchPriority={priority ? "high" : undefined} loading={priority ? undefined : "lazy"} className="absolute inset-0 h-full w-full object-cover" />
      ) : !showName ? null : (
        // sem capa: o nome do evento entra na arte padrão
        <div className="absolute inset-0 flex items-end p-[6%]">
          <p className="max-w-[70%] font-display text-[clamp(1.1rem,4.5vw,2.6rem)] font-bold leading-tight text-white">{name}</p>
        </div>
      )}
      {badge ? (
        <span
          className={`absolute left-3 top-3 rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
            badge.live ? "bg-flag text-white" : "bg-white/90 text-ink-2"
          }`}
        >
          {badge.label}
        </span>
      ) : null}
    </div>
  );
}
