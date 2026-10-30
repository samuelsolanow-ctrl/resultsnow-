import Flags from "./Flags";
import type { Standing } from "@/lib/scoring";
import type { FlagMode, RaceRow } from "@/lib/types";

/**
 * Súmula. No celular: Rank + Velejador ficam fixos à esquerda e as regatas rolam para o lado;
 * bandeira, nº de vela, clube e CBVela aparecem embaixo do nome.
 * A partir do iPad/notebook: cada informação em sua coluna.
 */
export default function ResultsTable({
  standings,
  races,
  flagMode,
  crewSize,
}: {
  standings: Standing[];
  races: Pick<RaceRow, "id" | "number">[];
  flagMode: FlagMode;
  crewSize: number;
}) {
  const th = "px-2 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-3 whitespace-nowrap";
  const wide = "hidden lg:table-cell";
  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className={`${th} sticky left-0 z-[2] w-10 border-b-2 border-night bg-white text-center`}>#</th>
            <th className={`${th} sticky left-10 z-[2] min-w-[150px] border-b-2 border-night bg-white sm:min-w-[200px]`}>
              {crewSize > 1 ? "Timoneiro / Proeiro" : "Velejador"}
            </th>
            <th className={`${th} ${wide} border-b-2 border-night`}>Bandeira</th>
            <th className={`${th} ${wide} border-b-2 border-night`}>Nº vela</th>
            <th className={`${th} ${wide} border-b-2 border-night`}>Clube</th>
            <th className={`${th} ${wide} border-b-2 border-night`}>ID CBVela</th>
            {races.map((r) => (
              <th key={r.id} className={`${th} border-b-2 border-night text-center`}>R{r.number}</th>
            ))}
            <th className={`${th} border-b-2 border-night text-center`}>Total</th>
            <th className={`${th} border-b-2 border-night text-center text-ink`}>Líq.</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => {
            const bg = i % 2 ? "bg-paper" : "bg-white";
            const td = `border-b border-line ${bg}`;
            const e = s.entry;
            const dual = crewSize > 1 && e.crew_name;
            return (
              <tr key={e.id} className="align-middle">
                <td className={`${td} sticky left-0 z-[1] w-10 px-2 py-2 text-center`}>
                  <span className={`num font-display text-lg font-bold ${s.rank <= 3 ? "text-sea" : ""}`}>{s.rank}</span>
                </td>
                <td className={`${td} sticky left-10 z-[1] max-w-[190px] px-2 py-2 shadow-[6px_0_8px_-8px_rgba(0,0,0,0.25)] sm:max-w-[260px] lg:shadow-none`}>
                  <div className="truncate font-semibold leading-5">{e.helm_name}</div>
                  {dual ? <div className="truncate text-xs leading-5 text-ink-3">{e.crew_name}</div> : null}
                  <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-ink-3 lg:hidden">
                    <Flags mode={flagMode} country={e.country} state={e.state} />
                    <span className="num font-semibold text-ink-2">{e.sail_number}</span>
                    {e.club ? <span className="truncate">· {e.club}</span> : null}
                  </div>
                </td>
                <td className={`${td} ${wide} px-2 py-2`}>
                  <Flags mode={flagMode} country={e.country} state={e.state} />
                </td>
                <td className={`${td} ${wide} num whitespace-nowrap px-2 py-2 font-semibold`}>{e.sail_number}</td>
                <td className={`${td} ${wide} px-2 py-2 text-ink-2`}>{e.club ?? ""}</td>
                <td className={`${td} ${wide} num px-2 py-2 text-xs leading-5 text-ink-2`}>
                  <div>{e.helm_cbvela ?? "—"}</div>
                  {dual ? <div>{e.crew_cbvela ?? "—"}</div> : null}
                </td>
                {s.cells.map((c) => (
                  <td
                    key={c.raceId}
                    className={`${td} num whitespace-nowrap px-2 py-2 text-center ${
                      c.discarded ? "text-ink-3" : c.code ? "font-semibold text-flag" : ""
                    }`}
                  >
                    {c.discarded ? `(${c.label})` : c.label}
                  </td>
                ))}
                <td className={`${td} num px-2 py-2 text-center text-ink-3`}>{s.total}</td>
                <td className={`${td} num px-3 py-2 text-center font-bold`}>{s.net}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
