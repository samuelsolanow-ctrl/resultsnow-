// Casa o que foi falado (números e nomes) com os barcos ainda sem chegada
import { normWord, parseSpokenItems } from "./ptNumbers";
import { sailDigits } from "./slug";

export type Candidate = { id: string; sail: string; names: string[] };

function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** a palavra falada bate com uma palavra do nome? (tolera 1 letra errada em nomes de 5+ letras) */
const wordHit = (spoken: string, name: string) =>
  spoken === name || (spoken.length >= 5 && name.length >= 5 && lev(spoken, name) <= 1);

const nameWords = (c: Candidate) =>
  c.names.flatMap((n) => normWord(n).split(/[^a-z0-9]+/)).filter((w) => w.length >= 3);

export function matchSpoken(text: string, pending: Candidate[]): { ids: string[]; misses: string[] } {
  const items = parseSpokenItems(text);
  const taken = new Set<string>();
  const ids: string[] = [];
  const misses: string[] = [];
  const free = () => pending.filter((c) => !taken.has(c.id));
  const take = (id: string) => {
    taken.add(id);
    ids.push(id);
  };

  let i = 0;
  while (i < items.length) {
    const it = items[i];
    if (it.kind === "num") {
      const m = free().filter((c) => sailDigits(c.sail) === String(it.n));
      if (m.length === 1) take(m[0].id);
      else misses.push(String(it.n));
      i++;
      continue;
    }
    // nomes: junta palavras seguidas até achar um único barco
    let cands = free().filter((c) => nameWords(c).some((w) => wordHit(it.w, w)));
    let used = 1;
    while (cands.length > 1 && i + used < items.length && items[i + used].kind === "word") {
      const nxt = (items[i + used] as { w: string }).w;
      const narrowed = cands.filter((c) => nameWords(c).some((w) => wordHit(nxt, w)));
      if (!narrowed.length) break;
      cands = narrowed;
      used++;
    }
    if (cands.length === 1) {
      take(cands[0].id);
      // engole o sobrenome logo em seguida ("Jorge Zarif")
      while (i + used < items.length && items[i + used].kind === "word" && nameWords(cands[0]).some((w) => wordHit((items[i + used] as { w: string }).w, w))) used++;
      i += used;
    } else {
      if (cands.length > 1) misses.push(`${it.w} (mais de um)`);
      else if (it.w.length >= 3) misses.push(it.w);
      i++;
    }
  }
  return { ids, misses };
}
