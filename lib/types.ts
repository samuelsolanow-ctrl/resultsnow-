export type FlagMode = "country" | "state" | "both";
export type EventStatus = "draft" | "live" | "finished";

export interface DiscardRule {
  /** a partir de quantas regatas completadas */
  races: number;
  /** quantos descartes */
  discards: number;
}

export interface EventRow {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  venue: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_url: string | null;
  flag_mode: FlagMode;
  status: EventStatus;
  created_at: string;
}

export interface ClassRow {
  id: string;
  event_id: string;
  name: string;
  crew_size: number;
  discard_rules: DiscardRule[];
  sort_order: number;
}

export interface EntryRow {
  id: string;
  class_id: string;
  sail_number: string;
  country: string | null;
  state: string | null;
  club: string | null;
  helm_name: string;
  helm_cbvela: string | null;
  crew_name: string | null;
  crew_cbvela: string | null;
}

export interface RaceRow {
  id: string;
  class_id: string;
  number: number;
  sailed_on: string | null;
}

export interface ResultRow {
  race_id: string;
  entry_id: string;
  position: number | null;
  code: string | null;
  points: number | null;
}

export type RaceWithResults = RaceRow & { results: ResultRow[] };
export type ClassFull = ClassRow & { entries: EntryRow[]; races: RaceWithResults[] };
export type EventFull = EventRow & { classes: ClassFull[] };
