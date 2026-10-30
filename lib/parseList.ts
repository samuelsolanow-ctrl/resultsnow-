// Entende listas coladas do WhatsApp/planilha e transforma em inscritos.
// Aceita: "1. Rogério Guilger BRA 23", "⁠Cristiano Ruschman BRA108", "Fabio Cotrim BRA",
//         "João Silva / Pedro Lima BRA 12 (YCI)", e o formato de planilha com ; ou tab.

export type ParsedEntry = {
  sail_number: string;
  country: string;
  state: string;
  club: string;
  helm_name: string;
  helm_cbvela: string;
  crew_name: string;
  crew_cbvela: string;
  division: string;
  warning?: string;
};

const INVISIBLE = /[​-‏⁠-⁤﻿­]/g;

function titleCase(s: string) {
  return s
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase())
    .replace(/\b(Da|De|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase());
}

function cleanName(s: string) {
  const t = s.replace(/\s{2,}/g, " ").replace(/^[\s\-–—:·,.]+|[\s\-–—:·,.]+$/g, "").trim();
  // nome todo em maiúsculas vira "Nome Sobrenome"
  return t && t === t.toUpperCase() && /\p{L}{3}/u.test(t) ? titleCase(t) : t;
}

export function parseList(text: string, duo: boolean): ParsedEntry[] {
  const out: ParsedEntry[] = [];
  for (let raw of text.split(/\r?\n/)) {
    raw = raw.replace(INVISIBLE, "").trim();
    if (!raw) continue;

    // formato de planilha: Nº vela ; País ; UF ; Clube ; Nome ; CBVela [; Proeiro ; CBVela] ; Divisão
    if (/[;\t]/.test(raw)) {
      const c = raw.split(/\t|;/).map((x) => x.trim());
      if (!c[0] || !c[4]) continue;
      out.push({
        sail_number: c[0],
        country: c[1] ?? "",
        state: c[2] ?? "",
        club: c[3] ?? "",
        helm_name: c[4] ?? "",
        helm_cbvela: c[5] ?? "",
        crew_name: duo ? c[6] ?? "" : "",
        crew_cbvela: duo ? c[7] ?? "" : "",
        division: (duo ? c[8] : c[6]) ?? "",
      });
      continue;
    }

    // tira numeração e marcadores: "1.", "1)", "1 -", "•", "-"
    let line = raw.replace(/^\s*(\d{1,3}\s*[.)\-–ºº°]\s*|[•*\-–]\s+)/, "").trim();

    // clube entre parênteses
    let club = "";
    const par = line.match(/\(([^)]+)\)/);
    if (par) {
      club = par[1].trim();
      line = line.replace(par[0], " ").trim();
    }

    // numeral: "BRA 23", "BRA23", "BRA-23", "ARG 1234", ou só "BRA"
    let country = "";
    let num = "";
    const sail = line.match(/\b([A-Z]{3})\s*[-–]?\s*(\d{1,6})\b/) ?? line.match(/\b([A-Z]{3})\b(?!.*\b[A-Z]{3}\b)/);
    if (sail) {
      country = sail[1];
      num = sail[2] ?? "";
      line = (line.slice(0, sail.index) + " " + line.slice(sail.index! + sail[0].length)).trim();
    } else {
      // só um número solto no fim ou no começo: "João Silva 215"
      const n = line.match(/(?:^|\s)(\d{1,6})\s*$/) ?? line.match(/^(\d{1,6})\s+/);
      if (n) {
        num = n[1];
        line = line.replace(n[0], " ").trim();
      }
    }

    // dupla: "Timoneiro / Proeiro"
    let helm = line;
    let crew = "";
    if (duo && line.includes("/")) {
      const [a, b] = line.split("/");
      helm = a;
      crew = b ?? "";
    }
    helm = cleanName(helm);
    crew = cleanName(crew);
    if (!helm) continue;

    const entry: ParsedEntry = {
      sail_number: num ? `${country || "BRA"} ${num}` : `${country || "BRA"} s/n`,
      country: country || "BRA",
      state: "",
      club,
      helm_name: helm,
      helm_cbvela: "",
      crew_name: crew,
      crew_cbvela: "",
      division: "",
    };
    if (!num) entry.warning = "sem numeral";
    out.push(entry);
  }
  return out;
}
