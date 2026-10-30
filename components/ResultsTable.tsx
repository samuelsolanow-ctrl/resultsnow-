import Flags from "./Flags";
import type { Standing } from "@/lib/scoring";
import type { FlagMode, RaceRow } from "@/lib/types";

export default function ResultsTable({
  standings,
  races,
  flagMode,
  crewSize,
}: {
  standings: Standing[];
  races: RaceRow[];
  flagMode: FlagMode;
  crewSize: number;
}) {
  const th = "px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-3";
  return (
    <div className="overflow-x-auto">
      <table className="print-table w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-ink">
            <th className={`${th} w-10 text-center`}>Rank</th>
            <th className={th}>Bandeira</th>
            <th className={th}>Nº vela</th>
            <th className={th}>{crewSize > 1 ? "Timoneiro / Proeiro" : "Velejador"}</th>
            <th className={th}>Clube</th>
            <th className={th}>ID CBVela</th>
            {races.map((r) => (
              <th key={r.id} className={`${th} text-center`}>R{r.number}</th>
            ))}
            <th className={`${th} text-center`}>Total</th>
            <th className={`${th} text-center text-ink`}>Líquido</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => (
            <tr key={s.entry.id} className="border-b border-line align-top odd:bg-white even:bg-paper/60">
              <td className="num px-2 py-2 text-center font-display text-lg font-bold leading-6">{s.rank}</td>
              <td className="px-2 py-2.5">
                <Flags mode={flagMode} country={s.entry.country} state={s.entry.state} />
              </td>
              <td className="num whitespace-nowrap px-2 py-2.5 font-semibold">{s.entry.sail_number}</td>
              <td className="px-2 py-2">
                <div className="font-semibold leading-5">{s.entry.helm_name}</div>
                {crewSize > 1 && s.entry.crew_name ? (
                  <div className="text-xs leading-5 text-ink-3">{s.entry.crew_name}</div>
                ) : null}
              </td>
              <td className="px-2 py-2.5 text-ink-2">{s.entry.club ?? ""}</td>
              <td className="num px-2 py-2 text-xs leading-5 text-ink-2">
                <div>{s.entry.helm_cbvela ?? "—"}</div>
                {crewSize > 1 && s.entry.crew_name ? <div>{s.entry.crew_cbvela ?? "—"}</div> : null}
              </td>
              {s.cells.map((c) => (
                <td
                  key={c.raceId}
                  className={`num whitespace-nowrap px-2 py-2.5 text-center ${
                    c.discarded ? "text-ink-3" : c.code ? "font-semibold text-flag" : ""
                  }`}
                >
                  {c.discarded ? `(${c.label})` : c.label}
                </td>
              ))}
              <td className="num px-2 py-2.5 text-center text-ink-2">{s.total}</td>
              <td className="num px-2 py-2.5 text-center font-bold">{s.net}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
