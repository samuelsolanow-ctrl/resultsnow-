import Link from "next/link";
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
  followed = [],
  onFollow,
  showClub = true,
  showCbvela = true,
}: {
  standings: Standing[];
  races: Pick<RaceRow, "id" | "number">[];
  flagMode: FlagMode;
  crewSize: number;
  followed?: string[];
  onFollow?: (entryId: string) => void;
  showClub?: boolean;
  showCbvela?: boolean;
}) {
  const showFlag = flagMode !== "none";
  // barcos seguidos aparecem no topo, destacados, e também na posição normal
  const pinned = standings.filter((s) => followed.includes(s.entry.id));
  const rows: { s: Standing; pin: boolean }[] = [
    ...pinned.map((s) => ({ s, pin: true })),
    ...standings.map((s) => ({ s, pin: false })),
  ];
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
            {showFlag ? <th className={`${th} ${wide} border-b-2 border-night`}>Bandeira</th> : null}
            <th className={`${th} ${wide} border-b-2 border-night`}>Nº vela</th>
            {showClub ? <th className={`${th} ${wide} border-b-2 border-night`}>Clube</th> : null}
            {showCbvela ? <th className={`${th} ${wide} border-b-2 border-night`}>ID CBVela</th> : null}
            {races.map((r) => (
              <th key={r.id} className={`${th} border-b-2 border-night text-center`}>R{r.number}</th>
            ))}
            <th className={`${th} border-b-2 border-night text-center`}>Total</th>
            <th className={`${th} border-b-2 border-night text-center text-ink`}>Líq.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ s, pin }, i) => {
            const star = followed.includes(s.entry.id);
            const bg = pin ? "bg-sky-100" : star ? "bg-sky-50" : i % 2 ? "bg-paper" : "bg-white";
            const td = `border-b border-line ${bg}`;
            const e = s.entry;
            const dual = crewSize > 1 && e.crew_name;
            return (
              <tr key={`${pin ? "p" : "r"}-${e.id}`} className="align-middle">
                <td className={`${td} sticky left-0 z-[1] w-10 px-1 py-2 text-center ${pin && i === pinned.length - 1 ? "border-b-2 border-b-sky-600" : ""}`}>
                  <span className={`num block font-display text-lg font-bold leading-6 ${s.rank <= 3 ? "text-sea" : ""}`}>{s.rank}</span>
                  {onFollow ? (
                    <button
                      onClick={() => onFollow(e.id)}
                      aria-label={star ? "Deixar de seguir" : "Seguir este barco"}
                      className={`text-sm leading-4 ${star ? "text-amber-500" : "text-ink-3/50 hover:text-amber-500"}`}
                    >
                      {star ? "★" : "☆"}
                    </button>
                  ) : null}
                </td>
                <td className={`${td} sticky left-10 z-[1] max-w-[190px] px-2 py-2 shadow-[6px_0_8px_-8px_rgba(0,0,0,0.25)] sm:max-w-[260px] lg:shadow-none`}>
                  <Link href={`/velejador/${e.id}`} className="block truncate font-semibold leading-5 hover:text-sea hover:underline">
                    {e.helm_name}
                  </Link>
                  {dual ? <div className="truncate text-xs leading-5 text-ink-3">{e.crew_name}</div> : null}
                  {e.division ? <span className="mr-1 rounded bg-sea-50 px-1 text-[10px] font-semibold text-sea">{e.division}</span> : null}
                  <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-ink-3 lg:hidden">
                    <Flags mode={flagMode} country={e.country} state={e.state} />
                    <span className="num font-semibold text-ink-2">{e.sail_number}</span>
                    {showClub && e.club ? <span className="truncate">· {e.club}</span> : null}
                  </div>
                </td>
                {showFlag ? (
                  <td className={`${td} ${wide} px-2 py-2`}>
                    <Flags mode={flagMode} country={e.country} state={e.state} />
                  </td>
                ) : null}
                <td className={`${td} ${wide} num whitespace-nowrap px-2 py-2 font-semibold`}>{e.sail_number}</td>
                {showClub ? <td className={`${td} ${wide} px-2 py-2 text-ink-2`}>{e.club ?? ""}</td> : null}
                {showCbvela ? (
                  <td className={`${td} ${wide} num px-2 py-2 text-xs leading-5 text-ink-2`}>
                    <div>{e.helm_cbvela ?? "—"}</div>
                    {dual ? <div>{e.crew_cbvela ?? "—"}</div> : null}
                  </td>
                ) : null}
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
