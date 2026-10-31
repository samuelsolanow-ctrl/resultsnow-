export type FlagMode = "country" | "state" | "both" | "none";
export type EventStatus = "draft" | "live" | "finished";

export interface DiscardRule {
  /** a partir de quantas regatas completadas */
  races: number;
  /** quantos descartes */
  discards: number;
}

export interface EventRow {
  id: string;
  owner_id: string | null;
  organizer: string | null;
  slug: string;
  name: string;
  venue: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_url: string | null;
  flag_mode: FlagMode;
  status: EventStatus;
  registration_open?: boolean;
  /** o que aparece na súmula (padrão: sim) */
  show_club?: boolean;
  show_cbvela?: boolean;
  /** outros organizadores que ajudam a administrar */
  helpers?: string[];
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
  division?: string | null;
  status?: string | null;
  contact?: string | null;
}

export interface NoticeRow {
  id: string;
  event_id: string;
  title: string;
  body: string | null;
  created_at: string;
}

export interface ProtestRow {
  id: string;
  event_id: string;
  number: number | null;
  race: string | null;
  protestor: string;
  protestee: string | null;
  hearing_at: string | null;
  room: string | null;
  status: string;
  decision: string | null;
  created_at: string;
}

export interface CircuitRow {
  id: string;
  slug: string;
  name: string;
  organizer: string | null;
  created_at: string;
}

export interface RaceRow {
  id: string;
  class_id: string;
  number: number;
  sailed_on: string | null;
  conditions?: import("./conditions").RaceConditions | null;
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
export type EventFull = EventRow & { classes: ClassFull[]; notices?: NoticeRow[]; protests?: ProtestRow[] };
