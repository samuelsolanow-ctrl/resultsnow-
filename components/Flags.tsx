import { countryEmoji } from "@/lib/flags";
import type { FlagMode } from "@/lib/types";

export default function Flags({ mode, country, state }: { mode: FlagMode; country: string | null; state: string | null }) {
  if (mode === "none") return null;
  const showCountry = mode !== "state" && country;
  const showState = mode !== "country" && state;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {showCountry ? (
        <span className="inline-flex items-center gap-1" title={country ?? ""}>
          <span className="text-base leading-none">{countryEmoji(country)}</span>
          <span className="text-[11px] font-semibold text-ink-3">{country?.toUpperCase()}</span>
        </span>
      ) : null}
      {showState ? (
        <span className="rounded border border-line bg-paper px-1 text-[11px] font-semibold text-ink-2">
          {state?.toUpperCase()}
        </span>
      ) : null}
    </span>
  );
}
