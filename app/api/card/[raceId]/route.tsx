import { ImageResponse } from "next/og";
import { computeStandings } from "@/lib/scoring";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { EntryRow, ResultRow } from "@/lib/types";

export const runtime = "nodejs";

const NIGHT = "#2A2F35";
const NIGHT2 = "#353B42";
const SKY = "#7FC7D6";
const MUTED = "rgba(255,255,255,0.55)";

/** Imagem 1080x1350 do resultado da regata + classificação geral (para WhatsApp/Instagram) */
export async function GET(req: Request, { params }: { params: Promise<{ raceId: string }> }) {
  const { raceId } = await params;
  const sb = supabaseAdmin();

  const { data: race } = await sb.from("races").select("*").eq("id", raceId).maybeSingle();
  if (!race) return new Response("Regata não encontrada", { status: 404 });
  const { data: cls } = await sb
    .from("classes")
    .select("*, events(name, venue), entries(*), races(*, results(*))")
    .eq("id", race.class_id)
    .single();
  if (!cls) return new Response("Classe não encontrada", { status: 404 });

  const entries = ((cls.entries ?? []) as EntryRow[]).filter((e) => e.status !== "pending");
  const byId = new Map(entries.map((e) => [e.id, e]));
  // geral considera só as regatas até esta
  const races = (cls.races ?? [])
    .filter((r: { number: number }) => r.number <= race.number)
    .sort((a: { number: number }, b: { number: number }) => a.number - b.number);
  const allResults = races.flatMap((r: { results: ResultRow[] }) => r.results ?? []) as ResultRow[];
  const raceResults = allResults.filter((r) => r.race_id === race.id);
  const finishers = raceResults
    .filter((r) => r.position != null)
    .sort((a, b) => a.position! - b.position!);
  const standings = computeStandings(entries, races, allResults, cls.discard_rules ?? []);

  const ev = cls.events as { name: string; venue: string | null };
  const logo = new URL("/logo-horizontal.png", req.url).toString();
  const top = 10;

  const Row = ({ pos, sail, name, right, hi }: { pos: string; sail: string; name: string; right?: string; hi?: boolean }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 64,
        padding: "0 18px",
        borderRadius: 12,
        background: hi ? "rgba(127,199,214,0.14)" : "transparent",
        fontSize: 28,
        color: "white",
      }}
    >
      <div style={{ display: "flex", width: 54, fontWeight: 700, color: hi ? SKY : "white" }}>{pos}</div>
      <div style={{ display: "flex", width: 120, color: MUTED, fontSize: 24 }}>{sail}</div>
      <div style={{ display: "flex", flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{name}</div>
      {right ? <div style={{ display: "flex", width: 70, justifyContent: "flex-end", fontWeight: 700 }}>{right}</div> : null}
    </div>
  );

  const Col = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: NIGHT2, borderRadius: 24, padding: "24px 12px" }}>
      <div style={{ display: "flex", fontSize: 26, letterSpacing: 3, color: SKY, fontWeight: 700, padding: "0 18px 14px" }}>{title}</div>
      {children}
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: NIGHT, padding: 56, color: "white" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={266} height={64} alt="" />
          <div style={{ display: "flex", fontSize: 26, color: MUTED }}>{ev?.venue ?? ""}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>
          <div style={{ display: "flex", fontSize: 58, fontWeight: 700, lineHeight: 1.1 }}>{ev?.name ?? ""}</div>
          <div style={{ display: "flex", fontSize: 38, color: SKY, marginTop: 10 }}>{`${cls.name} · Regata ${race.number}`}</div>
        </div>

        <div style={{ display: "flex", gap: 24, marginTop: 40, flex: 1 }}>
          <Col title={`REGATA ${race.number}`}>
            {finishers.slice(0, top).map((r) => {
              const e = byId.get(r.entry_id);
              return <Row key={r.entry_id} pos={String(r.position)} sail={e?.sail_number ?? ""} name={`${e?.helm_name ?? ""}${r.code ? ` (${r.code})` : ""}`} hi={r.position! <= 3} />;
            })}
          </Col>
          <Col title="GERAL">
            {standings.slice(0, top).map((s) => (
              <Row key={s.entry.id} pos={String(s.rank)} sail={s.entry.sail_number} name={s.entry.helm_name} right={String(s.net)} hi={s.rank <= 3} />
            ))}
          </Col>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28, fontSize: 24, color: MUTED }}>
          <div style={{ display: "flex" }}>{`${entries.length} barcos · ${races.length} regata${races.length > 1 ? "s" : ""}`}</div>
          <div style={{ display: "flex" }}>resultsnow.vercel.app</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, headers: { "Cache-Control": "no-store" } }
  );
}
