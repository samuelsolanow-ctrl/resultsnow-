// Sistema de pontuação baixa — RRS Apêndice A
import type { DiscardRule, EntryRow, RaceRow, ResultRow } from "./types";

/** Códigos que valem "inscritos na série + 1" */
export const PENALTY_CODES = ["DNC", "DNS", "OCS", "DNF", "RET", "DSQ", "BFD", "UFD", "NSC", "DNE"] as const;
/** Códigos com pontuação informada pela comissão / júri */
export const POINTS_CODES = ["RDG", "DPI", "SCP", "ZFP"] as const;
/** Não descartáveis (A5.3 / regra 90.3) */
export const NON_DISCARDABLE = ["DNE"];

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
  RDG: "Reparação concedida",
  DPI: "Penalidade discricionária",
  SCP: "Penalidade de pontuação",
  ZFP: "Penalidade de 20%",
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
  for (const r of results) byKey.set(`${r.race_id}:${r.entry_id}`, r);
  const nDiscards = discardsFor(sortedRaces.length, rules);

  const rows = entries.map((entry) => {
    const cells: Cell[] = sortedRaces.map((race) => {
      const r = byKey.get(`${race.id}:${entry.id}`);
      let points = penalty;
      let label = "DNC";
      let code: string | null = "DNC";
      if (r) {
        code = r.code ? r.code.toUpperCase() : null;
        if (code && (POINTS_CODES as readonly string[]).includes(code)) {
          points = r.points ?? r.position ?? penalty;
          label = `${code} ${fmt(points)}`;
        } else if (code) {
          points = penalty;
          label = code;
        } else if (r.position != null) {
          points = r.position;
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
