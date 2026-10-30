// Leitura de evento pelo servidor com a chave secreta: a página de inscrição
// precisa funcionar mesmo com o evento ainda em rascunho
import { cache } from "react";
import { isConfirmed } from "./data";
import { supabaseAdmin } from "./supabaseAdmin";
import type { EntryRow } from "./types";

export type RegEvent = {
  id: string;
  name: string;
  slug: string;
  venue: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_url: string | null;
  registration_open: boolean;
  flag_mode?: string;
  show_club?: boolean;
  show_cbvela?: boolean;
  classes: { id: string; name: string; crew_size: number; entries: EntryRow[] }[];
};

export const getEventForRegistration = cache(async (slug: string): Promise<RegEvent | null> => {
  try {
    const { data } = await supabaseAdmin()
      .from("events")
      .select("*, classes(id, name, crew_size, sort_order, entries(*))")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return null;
    type RawClass = RegEvent["classes"][number] & { sort_order: number };
    const raw = data as unknown as Omit<RegEvent, "classes"> & { classes: RawClass[] };
    const ev: RegEvent = {
      ...raw,
      classes: (raw.classes ?? [])
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        .map((c) => ({
          id: c.id,
          name: c.name,
          crew_size: c.crew_size,
          entries: (c.entries ?? [])
            .filter(isConfirmed)
            .sort((a, b) => a.sail_number.localeCompare(b.sail_number, "pt-BR", { numeric: true })),
        })),
    };
    return ev;
  } catch {
    return null;
  }
});
