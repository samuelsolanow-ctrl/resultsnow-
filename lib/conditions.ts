// Condições de cada regata, preenchidas pela comissão (tudo opcional)

export type RaceConditions = {
  start_time?: string; // "13:05"
  first_finish?: string; // 1º barco
  last_finish?: string; // fechamento da linha
  start_flag?: string; // P, I, U, Preta
  wind_dir?: string; // "NE" ou "045°"
  wind_min?: number;
  wind_max?: number;
  gust_max?: number;
  current_dir?: string;
  current_strength?: string; // fraca / média / forte
  course?: string;
  area?: string;
  notes?: string;
  /** gravações da chegada (só no painel) */
  recordings?: {
    url: string;
    at: string; // início
    end?: string; // fim
    secs?: number;
    text?: string;
    gaps?: string[]; // trechos em que o microfone foi cortado ("13:42–13:44")
    imported?: boolean; // veio do Gravador do iPhone
  }[];
};

export const WIND_DIRS = ["N", "NNE", "NE", "ENE", "L", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
export const CURRENT_STRENGTH = ["Fraca", "Média", "Forte"];
export const START_FLAGS = ["P", "I", "U", "Preta"];
export const COURSES = [
  "Barla-sotavento 2 voltas",
  "Barla-sotavento 3 voltas",
  "Trapézio interno",
  "Trapézio externo",
  "Triângulo",
  "Percurso de costa",
];

const toMin = (t?: string) => {
  const m = t?.match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** duração da 1ª chegada desde a largada: "52 min" ou "1h12" */
export function duration(c: RaceConditions): string | null {
  const a = toMin(c.start_time);
  const b = toMin(c.first_finish);
  if (a == null || b == null || b < a) return null;
  const d = b - a;
  return d >= 60 ? `${Math.floor(d / 60)}h${String(d % 60).padStart(2, "0")}` : `${d} min`;
}

export function windText(c: RaceConditions): string | null {
  const range = c.wind_min != null && c.wind_max != null ? `${c.wind_min}–${c.wind_max}` : c.wind_max ?? c.wind_min;
  const parts = [c.wind_dir, range != null ? `${range} nós` : null].filter(Boolean).join(" ");
  const gust = c.gust_max != null ? `rajadas ${c.gust_max}` : null;
  return [parts || null, gust].filter(Boolean).join(", ") || null;
}

/** resumo em uma linha: "13h05 · NE 8–12 nós, rajadas 16 · Barla-sotavento 2 voltas · Raia Alfa" */
export function conditionsLine(c?: RaceConditions | null): string {
  if (!c) return "";
  const corrente = c.current_dir || c.current_strength ? `corrente ${[c.current_dir, c.current_strength?.toLowerCase()].filter(Boolean).join(" ")}` : null;
  return [
    c.start_time ? `largada ${c.start_time.replace(":", "h")}` : null,
    duration(c),
    windText(c),
    corrente,
    c.course,
    c.area,
    c.start_flag ? `bandeira ${c.start_flag}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export const hasConditions = (c?: RaceConditions | null) =>
  !!c && Object.entries(c).some(([k, v]) => k !== "recordings" && v !== undefined && v !== null && v !== "");

/** remove campos vazios antes de salvar */
export function cleanConditions(c: RaceConditions): RaceConditions {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(c)) {
    if (v === "" || v === null || v === undefined || (typeof v === "number" && Number.isNaN(v))) continue;
    if (Array.isArray(v)) {
      if (v.length) out[k] = v;
      continue;
    }
    out[k] = typeof v === "string" ? v.trim() : v;
  }
  return out as RaceConditions;
}
