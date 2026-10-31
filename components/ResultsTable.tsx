import Link from "next/link";
import Flags from "./Flags";
import type { Standing } from "@/lib/scoring";
import type { FlagMode, RaceRow } from "@/lib/types";

/** "Rafael Sampaio" → "Rafael S." (celular) */
const shortName = (n: string) => {
  const p = n.trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : n;
};

/**
 * Súmula.
 * Celular: tabela compacta (nome curto + numeral, todas as regatas e o líquido cabem na tela).
 * iPad: nome completo, bandeira/numeral/clube embaixo do nome.
 * Notebook: cada informação em sua coluna.
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
  const many = races.length > 8;
  const th = "border-b border-line bg-white px-1 py-2 text-[10px] font-bold uppercase tracking-wide text-ink-3/80 whitespace-nowrap sm:px-2 sm:text-[11px]";
  const wide = "hidden lg:table-cell";
  const cellPad = "px-0.5 py-1.5 sm:px-2 sm:py-2";
  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <table className="w-full border-separate border-spacing-0 text-[12px] sm:text-sm">
        <thead>
          <tr>
            <th className={`${th} sticky left-0 z-[2] w-8 text-center sm:w-10`}>#</th>
            <th className={`${th} sticky left-8 z-[2] text-left sm:left-10 sm:min-w-[200px]`}>
              {crewSize > 1 ? <span className="hidden sm:inline">Timoneiro / Proeiro</span> : <span className="hidden sm:inline">Velejador</span>}
              <span className="sm:hidden">{crewSize > 1 ? "Dupla" : "Velejador"}</span>
            </th>
            {showFlag ? <th className={`${th} ${wide} text-left`}>Bandeira</th> : null}
            <th className={`${th} ${wide} text-left`}>Nº vela</th>
            {showClub ? <th className={`${th} ${wide} text-left`}>Clube</th> : null}
            {showCbvela ? <th className={`${th} ${wide} text-left`}>ID CBVela</th> : null}
            {races.map((r) => (
              <th key={r.id} className={`${th} text-center`}>R{r.number}</th>
            ))}
            <th className={`${th} hidden text-center sm:table-cell`}>Total</th>
            <th className={`${th} pr-2 text-center`}>Líq</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ s, pin }, i) => {
            const star = followed.includes(s.entry.id);
            const bg = pin ? "bg-sky-100" : star ? "bg-sky-50" : "bg-white";
            const td = `border-b border-line/70 ${bg}`;
            const e = s.entry;
            const dual = crewSize > 1 && e.crew_name;
            return (
              <tr key={`${pin ? "p" : "r"}-${e.id}`} className="align-middle">
                <td className={`${td} sticky left-0 z-[1] w-8 px-0.5 py-1.5 text-center sm:w-10 sm:py-2`}>
                  {s.rank <= 3 ? (
                    <span
                      className={`num mx-auto grid h-6 w-6 place-items-center rounded-full font-display text-sm font-bold text-white sm:h-7 sm:w-7 sm:text-base ${
                        s.rank === 1 ? "bg-[#E9B949]" : s.rank === 2 ? "bg-[#A7B1BC]" : "bg-[#C8875A]"
                      }`}
                    >
                      {s.rank}
                    </span>
                  ) : (
                    <span className="num block font-display text-base font-bold leading-6 sm:text-lg">{s.rank}</span>
                  )}
                  {onFollow ? (
                    <button
                      onClick={() => onFollow(e.id)}
                      aria-label={star ? "Deixar de seguir" : "Seguir este barco"}
                      className={`text-[11px] leading-3 sm:text-sm sm:leading-4 ${star ? "text-amber-500" : "text-ink-3/40 hover:text-amber-500"}`}
                    >
                      {star ? "★" : "☆"}
                    </button>
                  ) : null}
                </td>
                <td
                  className={`${td} sticky left-8 z-[1] max-w-[104px] px-1 py-1.5 shadow-[6px_0_8px_-8px_rgba(0,0,0,0.25)] sm:left-10 sm:max-w-[260px] sm:px-2 sm:py-2 lg:shadow-none`}
                >
                  <Link href={`/velejador/${e.id}`} className="block truncate font-bold leading-4 hover:text-sea hover:underline sm:font-semibold sm:leading-5">
                    <span className="sm:hidden">{shortName(e.helm_name)}</span>
                    <span className="hidden sm:inline">{e.helm_name}</span>
                  </Link>
                  {dual ? (
                    <div className="truncate text-[11px] leading-4 text-ink-3 sm:text-xs sm:leading-5">
                      <span className="sm:hidden">{shortName(e.crew_name!)}</span>
                      <span className="hidden sm:inline">{e.crew_name}</span>
                    </div>
                  ) : null}
                  {/* celular: só o numeral */}
                  <div className="num truncate text-[10px] leading-4 text-ink-3 sm:hidden">{e.sail_number}</div>
                  {/* iPad: bandeira, numeral, clube */}
                  <div className="mt-0.5 hidden items-center gap-1.5 truncate text-[11px] text-ink-3 sm:flex lg:hidden">
                    <Flags mode={flagMode} country={e.country} state={e.state} />
                    <span className="num font-semibold text-ink-2">{e.sail_number}</span>
                    {showClub && e.club ? <span className="truncate">· {e.club}</span> : null}
                  </div>
                  {e.division ? (
                    <span className="hidden rounded bg-sea-50 px-1 text-[10px] font-semibold text-sea sm:inline">{e.division}</span>
                  ) : null}
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
                    className={`${td} num whitespace-nowrap text-center ${cellPad} ${many ? "text-[10px] sm:text-sm" : "text-[11px] sm:text-sm"} ${
                      c.discarded ? "text-ink-3/50" : c.code ? "font-semibold text-flag" : ""
                    }`}
                  >
                    {/* celular: "4.2 SCP" vira "4.2" (vermelho) para caber */}
                    <span className="sm:hidden">{c.discarded ? `(${c.label.split(" ")[0]})` : c.label.split(" ")[0]}</span>
                    <span className="hidden sm:inline">{c.discarded ? `(${c.label})` : c.label}</span>
                  </td>
                ))}
                <td className={`${td} num hidden px-2 py-2 text-center text-ink-3 sm:table-cell`}>{s.total}</td>
                <td className={`${td} num py-1.5 pl-1 pr-2 text-center font-bold sm:px-3 sm:py-2`}>{s.net}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
