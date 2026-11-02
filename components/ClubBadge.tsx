import { clubInitials } from "@/lib/eventInfo";

/** Logo do clube (ou as iniciais num círculo, quando não há logo) */
export default function ClubBadge({ name, logo, size = 34 }: { name?: string | null; logo?: string | null; size?: number }) {
  if (!name && !logo) return null;
  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt={name ?? "Clube"} width={size} height={size} className="shrink-0 rounded-full bg-white object-contain ring-2 ring-white shadow-sm" style={{ width: size, height: size }} />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-[#0b3f7a] font-bold text-white ring-2 ring-white shadow-sm"
      style={{ width: size, height: size, fontSize: Math.max(8, size * 0.3) }}
      aria-label={name ?? ""}
    >
      {clubInitials(name)}
    </span>
  );
}
