// Converte o que a comissão fala ("dez, vinte, numeral cinquenta e um") em números: [10, 20, 51]

const UNITS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, meia: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16,
  dezessete: 17, dezassete: 17, dezoito: 18, dezenove: 19, dezanove: 19,
};
const TENS: Record<string, number> = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, cincoenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
};
const HUNDREDS: Record<string, number> = {
  cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500,
  seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900, mil: 1000,
};

const valueOf = (w: string): number | null => UNITS[w] ?? TENS[w] ?? HUNDREDS[w] ?? null;
const magnitude = (n: number) => (n >= 100 ? 100 : n >= 20 ? 10 : 1);

export function parsePtNumbers(text: string): number[] {
  const tokens = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/(\d)[.\s](?=\d{3}\b)/g, "$1") // "1.051" → "1051"
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  const out: number[] = [];
  let cur: number | null = null;
  let lastMag = 0;
  let joined = false; // veio um "e" antes

  const flush = () => {
    if (cur != null) out.push(cur);
    cur = null;
    lastMag = 0;
  };

  for (const t of tokens) {
    if (/^\d+$/.test(t)) {
      flush();
      out.push(parseInt(t, 10));
      joined = false;
      continue;
    }
    if (t === "e") {
      joined = cur != null;
      continue;
    }
    const v = valueOf(t);
    if (v == null) {
      // palavra qualquer ("numeral", "barco", "vela"): separa números
      flush();
      joined = false;
      continue;
    }
    const mag = magnitude(v);
    if (cur != null && joined && mag < lastMag) {
      cur += v; // "cinquenta e um", "cento e vinte e dois"
    } else {
      flush();
      cur = v;
    }
    lastMag = mag;
    joined = false;
  }
  flush();
  return out;
}
