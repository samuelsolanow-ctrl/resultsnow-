import { ImageResponse } from "next/og";
import { computeStandings, type Standing } from "@/lib/scoring";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { EntryRow, RaceRow, ResultRow } from "@/lib/types";

export const runtime = "nodejs";

// súmula tradicional: fundo branco
const INK = "#22262B";
const MUTED = "#64748B";
const LINE = "#E3E8EE";
const ZEBRA = "#F6F8FA";
const SEA = "#1F7F96";
const RED = "#D7263D";
const NIGHT = "#2A2F35";
const W = 1080;

// fonte Barlow (a mesma do site); se não carregar, usa a padrão
type Font = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };
let fontsCache: Font[] | null = null;
async function loadFonts(): Promise<Font[]> {
  if (fontsCache) return fontsCache;
  try {
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Barlow:wght@400;700")).text();
    const urls = [...css.matchAll(/font-weight:\s*(\d+);[\s\S]*?src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/g)];
    const fonts: Font[] = [];
    for (const m of urls) {
      const weight = Number(m[1]) === 700 ? 700 : 400;
      if (fonts.some((f) => f.weight === weight)) continue;
      fonts.push({ name: "Barlow", data: await (await fetch(m[2])).arrayBuffer(), weight, style: "normal" });
    }
    fontsCache = fonts.length ? fonts : [];
  } catch {
    fontsCache = [];
  }
  return fontsCache;
}

/** setinha desenhada (não depende da fonte) */
function Tri({ up, color }: { up: boolean; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        width: 0,
        height: 0,
        borderLeft: "7px solid transparent",
        borderRight: "7px solid transparent",
        ...(up ? { borderBottom: `11px solid ${color}` } : { borderTop: `11px solid ${color}` }),
        marginRight: 4,
      }}
    />
  );
}

/**
 * Imagem para WhatsApp.
 *  ?modo=geral (padrão): súmula acumulada até esta regata + pódio da regata
 *  ?modo=regata: só a ordem de chegada desta regata
 */
export async function GET(req: Request, { params }: { params: Promise<{ raceId: string }> }) {
  const { raceId } = await params;
  const mode = new URL(req.url).searchParams.get("modo") === "regata" ? "regata" : "geral";
  const sb = supabaseAdmin();

  const { data: race } = await sb.from("races").select("*").eq("id", raceId).maybeSingle();
  if (!race) return new Response("Regata não encontrada", { status: 404 });
  const { data: cls } = await sb
    .from("classes")
    .select("*, events(*), entries(*), races(*, results(*))")
    .eq("id", race.class_id)
    .single();
  if (!cls) return new Response("Classe não encontrada", { status: 404 });

  const entries = ((cls.entries ?? []) as EntryRow[]).filter((e) => e.status !== "pending");
  const byId = new Map(entries.map((e) => [e.id, e]));
  const allRaces = ((cls.races ?? []) as (RaceRow & { results: ResultRow[] })[]).sort((a, b) => a.number - b.number);
  const upTo = allRaces.filter((r) => r.number <= race.number);
  const before = allRaces.filter((r) => r.number < race.number);
  const res = (rs: typeof allRaces) => rs.flatMap((r) => r.results ?? []);
  const rules = cls.discard_rules ?? [];
  const standings = computeStandings(entries, upTo, res(upTo), rules);
  const prev = before.length ? computeStandings(entries, before, res(before), rules) : [];
  const prevRank = new Map(prev.map((s) => [s.entry.id, s.rank]));
  const raceRes = (allRaces.find((r) => r.id === race.id)?.results ?? []) as ResultRow[];
  const finishers = raceRes.filter((r) => r.position != null).sort((a, b) => a.position! - b.position!);
  const penalized = raceRes.filter((r) => r.position == null && r.code && r.code !== "DNC");

  const ev = cls.events as { name: string; venue: string | null; show_club?: boolean };
  const fonts = await loadFonts();
  const logo = new URL("/logo-horizontal.png", req.url).toString();
  const discards = standings[0]?.cells.filter((c) => c.discarded).length ?? 0;

  // ---------- tamanhos ----------
  const MAX_ROWS = 30;
  const shownStandings = standings.slice(0, MAX_ROWS);
  const nRaces = upTo.length;
  const ROW = mode === "geral" ? (nRaces > 10 ? 50 : 56) : 56;
  const rowsCount = mode === "geral" ? shownStandings.length : Math.min(finishers.length, MAX_ROWS);
  const HEADER = 300;
  const FOOT = mode === "geral" ? 210 : 140;
  const H = Math.max(1080, HEADER + 60 + rowsCount * ROW + FOOT);

  // colunas da súmula
  const colPos = 64;
  const colMove = 58;
  const colNet = 96;
  const colName = nRaces > 8 ? 300 : 360;
  const colRace = Math.max(38, Math.floor((W - 96 - colPos - colMove - colName - colNet) / Math.max(nRaces, 1)));
  const raceFont = colRace < 52 ? 19 : 22;

  const move = (s: Standing) => {
    const p = prevRank.get(s.entry.id);
    if (!p || p === s.rank) return { t: p ? "=" : "", c: "#94A3B8", up: null as boolean | null };
    return p > s.rank ? { t: String(p - s.rank), c: "#16A34A", up: true } : { t: String(s.rank - p), c: RED, up: false };
  };

  const header = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: NIGHT, padding: "22px 48px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={232} height={56} alt="" />
        <div style={{ display: "flex", color: "rgba(255,255,255,0.7)", fontSize: 22 }}>{ev?.venue ?? ""}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", padding: "30px 48px 0" }}>
        <div style={{ display: "flex", fontSize: 50, fontWeight: 700, color: INK, lineHeight: 1.1 }}>{ev?.name ?? ""}</div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 14, gap: 14 }}>
          <div style={{ display: "flex", background: SEA, color: "white", fontSize: 24, fontWeight: 700, padding: "6px 16px", borderRadius: 8 }}>
            {cls.name}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: MUTED }}>
            {mode === "geral"
              ? `Classificação geral após ${nRaces} regata${nRaces > 1 ? "s" : ""}${discards ? ` · ${discards} descarte${discards > 1 ? "s" : ""}` : ""}`
              : `Regata ${race.number} · ordem de chegada`}
          </div>
        </div>
      </div>
    </div>
  );

  const th = (label: string, width: number, align: "flex-start" | "center" = "center") => (
    <div style={{ display: "flex", width, justifyContent: align, fontSize: 18, fontWeight: 700, color: MUTED, letterSpacing: 1 }}>{label}</div>
  );

  const geral = (
    <div style={{ display: "flex", flexDirection: "column", padding: "28px 48px 0" }}>
      <div style={{ display: "flex", alignItems: "center", height: 44, borderBottom: `3px solid ${INK}` }}>
        {th("#", colPos)}
        {th("", colMove)}
        {th("VELEJADOR", colName, "flex-start")}
        {upTo.map((r) => th(`R${r.number}`, colRace))}
        {th("LÍQ.", colNet)}
      </div>
      {shownStandings.map((s, i) => {
        const m = move(s);
        return (
          <div
            key={s.entry.id}
            style={{ display: "flex", alignItems: "center", height: ROW, background: i % 2 ? ZEBRA : "white", borderBottom: `1px solid ${LINE}` }}
          >
            <div style={{ display: "flex", width: colPos, justifyContent: "center", fontSize: 28, fontWeight: 700, color: s.rank <= 3 ? SEA : INK }}>
              {String(s.rank)}
            </div>
            <div style={{ display: "flex", width: colMove, justifyContent: "center", alignItems: "center", fontSize: 18, fontWeight: 700, color: m.c }}>
              {m.up !== null ? <Tri up={m.up} color={m.c} /> : null}
              {m.t}
            </div>
            <div style={{ display: "flex", flexDirection: "column", width: colName, overflow: "hidden" }}>
              <div style={{ display: "flex", fontSize: 25, fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {s.entry.helm_name}
              </div>
              <div style={{ display: "flex", fontSize: 17, color: MUTED, whiteSpace: "nowrap", overflow: "hidden" }}>
                {[s.entry.sail_number, ev?.show_club !== false ? s.entry.club : null].filter(Boolean).join(" · ")}
              </div>
            </div>
            {s.cells.map((c) => (
              <div
                key={c.raceId}
                style={{
                  display: "flex",
                  width: colRace,
                  justifyContent: "center",
                  fontSize: c.label.length > 4 ? raceFont - 5 : raceFont,
                  color: c.discarded ? "#94A3B8" : c.code ? RED : INK,
                  fontWeight: c.raceNumber === race.number ? 700 : 400,
                }}
              >
                {c.discarded ? `(${c.label})` : c.label}
              </div>
            ))}
            <div style={{ display: "flex", width: colNet, justifyContent: "center", fontSize: 28, fontWeight: 700, color: INK }}>{String(s.net)}</div>
          </div>
        );
      })}
      {standings.length > MAX_ROWS ? (
        <div style={{ display: "flex", fontSize: 20, color: MUTED, marginTop: 10 }}>{`+ ${standings.length - MAX_ROWS} barcos · súmula completa no link`}</div>
      ) : null}
    </div>
  );

  const regata = (
    <div style={{ display: "flex", flexDirection: "column", padding: "28px 48px 0" }}>
      <div style={{ display: "flex", alignItems: "center", height: 44, borderBottom: `3px solid ${INK}` }}>
        {th("#", 90)}
        {th("NUMERAL", 180, "flex-start")}
        {th("VELEJADOR", 520, "flex-start")}
        {ev?.show_club !== false ? th("CLUBE", 194, "flex-start") : null}
      </div>
      {finishers.slice(0, MAX_ROWS).map((r, i) => {
        const e = byId.get(r.entry_id);
        return (
          <div key={r.entry_id} style={{ display: "flex", alignItems: "center", height: ROW, background: i % 2 ? ZEBRA : "white", borderBottom: `1px solid ${LINE}` }}>
            <div style={{ display: "flex", width: 90, justifyContent: "center", fontSize: 28, fontWeight: 700, color: r.position! <= 3 ? SEA : INK }}>
              {String(r.position)}
            </div>
            <div style={{ display: "flex", width: 180, fontSize: 22, color: MUTED }}>{e?.sail_number ?? ""}</div>
            <div style={{ display: "flex", width: 520, fontSize: 25, fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {`${e?.helm_name ?? ""}${r.code ? ` (${r.code})` : ""}`}
            </div>
            {ev?.show_club !== false ? (
              <div style={{ display: "flex", width: 194, fontSize: 20, color: MUTED, whiteSpace: "nowrap", overflow: "hidden" }}>{e?.club ?? ""}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  const podium = finishers.slice(0, 3).map((r) => byId.get(r.entry_id)?.helm_name ?? "");
  const penText = penalized
    .map((r) => `${r.code} ${byId.get(r.entry_id)?.sail_number ?? ""}`)
    .join(" · ");

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "white", fontFamily: fonts.length ? "Barlow" : undefined }}>
        {header}
        {mode === "geral" ? geral : regata}
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", padding: "0 48px 34px" }}>
          {mode === "geral" && podium.length ? (
            <div style={{ display: "flex", flexDirection: "column", border: `2px solid ${LINE}`, borderRadius: 14, padding: "16px 22px", marginBottom: 18 }}>
              <div style={{ display: "flex", fontSize: 18, fontWeight: 700, color: SEA, letterSpacing: 2 }}>{`REGATA ${race.number}`}</div>
              <div style={{ display: "flex", fontSize: 24, color: INK, marginTop: 6, gap: 26 }}>
                {podium.map((n, i) => (
                  <div key={i} style={{ display: "flex" }}>{`${i + 1}º ${n}`}</div>
                ))}
              </div>
              {penText ? <div style={{ display: "flex", fontSize: 18, color: RED, marginTop: 6 }}>{penText}</div> : null}
            </div>
          ) : null}
          {mode === "regata" && penText ? <div style={{ display: "flex", fontSize: 20, color: RED, marginBottom: 12 }}>{penText}</div> : null}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 19, color: MUTED }}>
            <div style={{ display: "flex" }}>
              {mode === "geral" ? `${entries.length} barcos · ( ) descarte${prev.length ? ` · setas: posições desde a R${race.number - 1}` : ""}` : `${entries.length} barcos`}
            </div>
            <div style={{ display: "flex" }}>resultsnow.vercel.app</div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts: fonts.length ? fonts : undefined, headers: { "Cache-Control": "no-store" } }
  );
}
