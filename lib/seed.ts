// Eventos de demonstração com nomes fictícios (só o master cria)
import type { SupabaseClient } from "@supabase/supabase-js";

const FIRST = ["Lucas", "Mariana", "Pedro", "Beatriz", "Rafael", "Camila", "Thiago", "Larissa", "Gustavo", "Fernanda", "Bruno", "Juliana", "Diego", "Isabela", "Felipe", "Natália", "Henrique", "Carolina", "Vitor", "Aline"];
const LAST = ["Andrade", "Barreto", "Cavalcanti", "Duarte", "Esteves", "Fontana", "Guedes", "Holanda", "Ibiapina", "Junqueira", "Lacerda", "Moraes", "Nogueira", "Pacheco", "Queiroz", "Rezende", "Sampaio", "Teixeira", "Valadares", "Xavier"];
const CLUBS = ["Iate Clube Ventania", "Clube de Vela Maré Alta", "Náutico Ponta Azul", "Yacht Club Ilha Clara", "Clube do Farol"];
const STATES = ["SP", "RJ", "RS", "SC", "BA", "PR"];

export const SEED_SLUGS = ["teste-copa-ventania", "teste-regata-primavera"];

/** gerador pseudoaleatório com semente (sempre o mesmo resultado) */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

type Person = { name: string; club: string; state: string; cbvela: string; skill: number; fem: boolean };

function people(n: number, rand: () => number, offset = 0): Person[] {
  return Array.from({ length: n }, (_, i) => {
    const fi = (i * 7 + offset) % FIRST.length;
    return {
      name: `${FIRST[fi]} ${LAST[(i * 3 + offset * 5) % LAST.length]}`,
      club: CLUBS[(i + offset) % CLUBS.length],
      state: STATES[(i * 5 + offset) % STATES.length],
      cbvela: String(10000 + i * 37 + offset * 1000),
      skill: rand(),
      fem: fi % 2 === 1,
    };
  });
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

async function must<T = unknown>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

type ClassSpec = {
  name: string;
  crew: number;
  boats: Person[];
  crewPeople?: Person[];
  races: number;
  sailPrefix: string;
  sailBase: number;
  division?: (p: Person, i: number) => string | null;
  penalties?: Record<number, { boat: number; code: string; keepPlace?: boolean }[]>;
  tie?: { race: number; at: number };
};

async function createClass(sb: SupabaseClient, eventId: string, spec: ClassSpec, order: number, startDate: string, rand: () => number) {
  const cls = await must<{ id: string }>(
    sb
      .from("classes")
      .insert({ event_id: eventId, name: spec.name, crew_size: spec.crew, discard_rules: [{ races: 4, discards: 1 }], sort_order: order })
      .select("id")
      .single()
  );
  const entries = await must<{ id: string }[]>(
    sb
      .from("entries")
      .insert(
        spec.boats.map((p, i) => ({
          class_id: cls.id,
          sail_number: `${spec.sailPrefix} ${spec.sailBase + i * 7}`,
          country: i === 3 ? "ARG" : i === 8 ? "URU" : "BRA",
          state: i === 3 || i === 8 ? null : p.state,
          club: p.club,
          helm_name: p.name,
          helm_cbvela: i % 4 === 2 ? null : p.cbvela,
          crew_name: spec.crew > 1 ? spec.crewPeople?.[i]?.name ?? null : null,
          crew_cbvela: spec.crew > 1 ? spec.crewPeople?.[i]?.cbvela ?? null : null,
          division: spec.division?.(p, i) ?? null,
          status: "confirmed",
        }))
      )
      .select("id")
  );

  for (let r = 1; r <= spec.races; r++) {
    const race = await must<{ id: string }>(
      sb.from("races").insert({ class_id: cls.id, number: r, sailed_on: startDate }).select("id").single()
    );
    const pen = spec.penalties?.[r] ?? [];
    const out = new Set(pen.filter((p) => !p.keepPlace).map((p) => p.boat));
    // ordem: habilidade + sorte
    const order = spec.boats
      .map((p, i) => ({ i, score: p.skill * 0.65 + rand() * 0.35 }))
      .filter((x) => !out.has(x.i))
      .sort((a, b) => b.score - a.score);
    const rows = order.map((x, k) => {
      let position = k + 1;
      if (spec.tie && spec.tie.race === r && k === spec.tie.at) position = k; // empate com o de cima
      else if (spec.tie && spec.tie.race === r && k > spec.tie.at) position = k + 1;
      const keep = pen.find((p) => p.boat === x.i && p.keepPlace);
      return { race_id: race.id, entry_id: entries[x.i].id, position, code: keep?.code ?? null, points: null };
    });
    for (const p of pen.filter((p) => !p.keepPlace)) {
      rows.push({ race_id: race.id, entry_id: entries[p.boat].id, position: null as unknown as number, code: p.code, points: null });
    }
    await must(sb.from("results").insert(rows));
  }
  return cls.id;
}

export async function createSeed(sb: SupabaseClient, organizer: string) {
  // refaz do zero se já existir
  await sb.from("events").delete().in("slug", SEED_SLUGS);
  await sb.from("circuits").delete().eq("slug", "teste-ranking-ventania");

  const rand = rng(2026);
  const ilca = people(14, rand, 0);
  const snipeHelm = people(8, rand, 3);
  const snipeCrew = people(8, rand, 11);
  const opti = people(16, rand, 6);

  // Evento 1 — ao vivo
  const ev1 = await must<{ id: string }>(
    sb
      .from("events")
      .insert({
        slug: SEED_SLUGS[0],
        name: "Copa Ventania de Vela 2026 (teste)",
        venue: "Iate Clube Ventania, Ilha Clara/SP",
        start_date: addDays(-1),
        end_date: addDays(1),
        flag_mode: "both",
        status: "live",
        registration_open: true,
        organizer,
      })
      .select("id")
      .single()
  );
  await createClass(sb, ev1.id, {
    name: "ILCA 7", crew: 1, boats: ilca, races: 5, sailPrefix: "BRA", sailBase: 201,
    division: (p, i) => (i % 5 === 0 ? "Master" : i % 4 === 1 ? "Sub-21" : null),
    penalties: { 1: [{ boat: 5, code: "OCS" }], 3: [{ boat: 9, code: "DNF" }, { boat: 2, code: "SCP", keepPlace: true }], 5: [{ boat: 11, code: "DNS" }] },
    tie: { race: 2, at: 4 },
  }, 0, addDays(-1), rand);
  await createClass(sb, ev1.id, {
    name: "Snipe", crew: 2, boats: snipeHelm, crewPeople: snipeCrew, races: 4, sailPrefix: "BRA", sailBase: 30101,
    division: (p) => (p.fem ? "Feminino" : null),
    penalties: { 2: [{ boat: 6, code: "BFD" }], 4: [{ boat: 1, code: "RET" }] },
  }, 1, addDays(-1), rand);

  await sb.from("notices").insert([
    { event_id: ev1.id, title: "Alteração nº 1 das Instruções de Regata", body: "A largada da classe Snipe no domingo passa para 12h30." },
    { event_id: ev1.id, title: "Reunião de comandantes", body: "Sábado, 9h, no salão principal do clube." },
  ]);
  await sb.from("protests").insert([
    { event_id: ev1.id, number: 1, race: "ILCA 7 · R3", protestor: `BRA 215 ${ilca[2].name}`, protestee: `BRA 264 ${ilca[9].name}`, hearing_at: "Sáb 17h30", room: "Sala do júri", status: "Decidido", decision: "Protesto improcedente." },
    { event_id: ev1.id, number: 2, race: "Snipe · R4", protestor: "Comissão de Regata", protestee: `BRA 30108 ${snipeHelm[1].name}`, hearing_at: "Dom 16h", room: "Sala do júri", status: "Agendado" },
  ]);

  // Evento 2 — encerrado
  const ev2 = await must<{ id: string }>(
    sb
      .from("events")
      .insert({
        slug: SEED_SLUGS[1],
        name: "Regata de Primavera Maré Alta (teste)",
        venue: "Clube de Vela Maré Alta, Baía Serena/RJ",
        start_date: addDays(-30),
        end_date: addDays(-29),
        flag_mode: "state",
        status: "finished",
        registration_open: false,
        organizer,
      })
      .select("id")
      .single()
  );
  await createClass(sb, ev2.id, {
    name: "Optimist", crew: 1, boats: opti, races: 6, sailPrefix: "BRA", sailBase: 1101,
    division: (p, i) => (i % 3 === 0 ? "Estreante" : p.fem ? "Feminino" : null),
    penalties: { 4: [{ boat: 3, code: "OCS" }], 6: [{ boat: 10, code: "DSQ" }] },
  }, 0, addDays(-30), rand);
  await createClass(sb, ev2.id, {
    name: "ILCA 7", crew: 1, boats: ilca.slice(0, 10), races: 4, sailPrefix: "BRA", sailBase: 201,
    penalties: { 2: [{ boat: 7, code: "DNF" }] },
  }, 1, addDays(-30), rand);

  // Ranking com as duas etapas de ILCA 7
  const circ = await sb.from("circuits").insert({ slug: "teste-ranking-ventania", name: "Ranking ILCA 7 (teste)", organizer }).select("id").single();
  if (circ.data) {
    await sb.from("circuit_events").insert([
      { circuit_id: circ.data.id, event_id: ev2.id, class_name: "ILCA 7" },
      { circuit_id: circ.data.id, event_id: ev1.id, class_name: "ILCA 7" },
    ]);
  }
  return SEED_SLUGS;
}
