// Sistema de pontuação baixa — RRS Apêndice A
import type { DiscardRule, EntryRow, RaceRow, ResultRow } from "./types";

/** A5.2: valem "inscritos na série + 1" */
export const PENALTY_CODES = ["DNC", "DNS", "OCS", "DNF", "RET", "DSQ", "BFD", "UFD", "NSC", "DNE", "DGM"] as const;
/** Barco que cruzou a linha e mantém o lugar (A6 não move os outros) */
export const KEEP_PLACE_CODES = ["SCP", "ZFP", "DPI", "RDG"] as const;
/** Códigos com pontos informados pelo júri */
export const POINTS_CODES = ["RDG", "DPI"] as const;
/** Não descartáveis — regra 90.3(b) */
export const NON_DISCARDABLE = ["DNE", "DGM"];

const round1 = (x: number) => Math.round(x * 10 + 1e-9) / 10;

/** Regra 44.3(c) / 30.2: 20% da pontuação de DNF, décimo mais próximo (0,05 para cima), sem passar de DNF */
export function percentPenalty(placePoints: number, dnfPoints: number): number {
  return Math.min(round1(placePoints + round1(0.2 * dnfPoints)), dnfPoints);
}

export const CODE_LABELS: Record<string, string> = {
  DNC: "Não largou nem foi à área de largada",
  DNS: "Não largou",
  OCS: "Queimou a largada",
  DNF: "Não terminou",
  RET: "Retirou-se",
  DSQ: "Desclassificado",
  BFD: "Desclassificado — bandeira preta",
  UFD: "Desclassificado — bandeira U",
  NSC: "Não completou o percurso",
  DNE: "Desclassificação não descartável",
  DGM: "Desclassificação por conduta grave (não descartável)",
  RDG: "Reparação concedida",
  DPI: "Penalidade discricionária",
  SCP: "Penalidade de pontuação, 20% (regra 44.3)",
  ZFP: "Penalidade de 20%, bandeira Z (regra 30.2)",
};

export interface Cell {
  raceId: string;
  raceNumber: number;
  points: number;
  /** texto exibido na súmula: "3", "OCS", "RDG 4.5" */
  label: string;
  code: string | null;
  discarded: boolean;
}

export interface Standing {
  rank: number;
  entry: EntryRow;
  cells: Cell[];
  total: number;
  net: number;
}

export function discardsFor(racesSailed: number, rules: DiscardRule[] | null | undefined): number {
  let d = 0;
  for (const r of rules ?? []) if (racesSailed >= r.races) d = Math.max(d, r.discards);
  return Math.min(d, Math.max(racesSailed - 1, 0));
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));

export function computeStandings(
  entries: EntryRow[],
  races: RaceRow[],
  results: ResultRow[],
  rules: DiscardRule[]
): Standing[] {
  const n = entries.length;
  const penalty = n + 1;
  const sortedRaces = [...races].sort((a, b) => a.number - b.number);
  const byKey = new Map<string, ResultRow>();
  // A7: barcos empatados na chegada (mesma posição) dividem os pontos
  const tieCount = new Map<string, number>();
  for (const r of results) {
    byKey.set(`${r.race_id}:${r.entry_id}`, r);
    if (r.position != null) {
      const k = `${r.race_id}:${r.position}`;
      tieCount.set(k, (tieCount.get(k) ?? 0) + 1);
    }
  }
  const placePoints = (r: ResultRow) => {
    const k = tieCount.get(`${r.race_id}:${r.position}`) ?? 1;
    return r.position! + (k - 1) / 2;
  };
  const nDiscards = discardsFor(sortedRaces.length, rules);

  const rows = entries.map((entry) => {
    const cells: Cell[] = sortedRaces.map((race) => {
      const r = byKey.get(`${race.id}:${entry.id}`);
      let points = penalty;
      let label = "DNC";
      let code: string | null = "DNC";
      if (r) {
        code = r.code ? r.code.toUpperCase() : null;
        const base = r.position != null ? placePoints(r) : penalty;
        if (code === "SCP" || code === "ZFP") {
          points = percentPenalty(base, penalty);
          label = `${fmt(points)} ${code}`;
        } else if (code === "DPI") {
          points = round1(base + (r.points ?? 0));
          label = `${fmt(points)} DPI`;
        } else if (code === "RDG") {
          points = r.points ?? base;
          label = `${fmt(points)} RDG`;
        } else if (code) {
          points = penalty;
          label = code;
        } else if (r.position != null) {
          points = base;
          label = fmt(points);
        }
      }
      return { raceId: race.id, raceNumber: race.number, points, label, code, discarded: false };
    });

    // descartes: piores resultados descartáveis (empate → o mais recente)
    const candidates = cells
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !NON_DISCARDABLE.includes(c.code ?? ""))
      .sort((a, b) => b.c.points - a.c.points || b.i - a.i);
    for (const { c } of candidates.slice(0, nDiscards)) c.discarded = true;

    const total = cells.reduce((s, c) => s + c.points, 0);
    const net = cells.reduce((s, c) => s + (c.discarded ? 0 : c.points), 0);
    return { rank: 0, entry, cells, total: round(total), net: round(net) };
  });

  rows.sort(compare);
  rows.forEach((row, i) => {
    row.rank = i > 0 && compare(rows[i - 1], row) === 0 ? rows[i - 1].rank : i + 1;
  });
  return rows;
}

const round = (x: number) => Math.round(x * 100) / 100;

/** A8.1 e A8.2 */
function compare(a: Standing, b: Standing): number {
  if (a.net !== b.net) return a.net - b.net;
  // A8.1 — resultados (sem descartes) do melhor ao pior, primeira diferença
  const sa = a.cells.filter((c) => !c.discarded).map((c) => c.points).sort((x, y) => x - y);
  const sb = b.cells.filter((c) => !c.discarded).map((c) => c.points).sort((x, y) => x - y);
  for (let i = 0; i < Math.min(sa.length, sb.length); i++) if (sa[i] !== sb[i]) return sa[i] - sb[i];
  // A8.2 — última regata, penúltima... (incluindo descartes)
  for (let i = a.cells.length - 1; i >= 0; i--) {
    const d = a.cells[i].points - (b.cells[i]?.points ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
