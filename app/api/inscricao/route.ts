import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const clip = (v: unknown, n = 120) => {
  const s = String(v ?? "").trim().slice(0, n);
  return s || null;
};

/** Inscrição pública: entra como "pendente" até o organizador aprovar */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || b.website) return NextResponse.json({ ok: true }); // robô
  const sb = supabaseAdmin();
  const { data: ev } = await sb.from("events").select("id, registration_open").eq("slug", String(b.slug ?? "")).maybeSingle();
  if (!ev?.registration_open) return NextResponse.json({ error: "Inscrições fechadas." }, { status: 400 });
  const { data: cls } = await sb.from("classes").select("id, crew_size").eq("id", String(b.class_id ?? "")).eq("event_id", ev.id).maybeSingle();
  if (!cls) return NextResponse.json({ error: "Classe inválida." }, { status: 400 });
  if (!clip(b.sail_number) || !clip(b.helm_name) || !clip(b.contact)) {
    return NextResponse.json({ error: "Preencha nº de vela, nome e contato." }, { status: 400 });
  }
  const duo = cls.crew_size > 1;
  const { error } = await sb.from("entries").insert({
    class_id: cls.id,
    status: "pending",
    sail_number: clip(b.sail_number, 20),
    country: clip(b.country, 3)?.toUpperCase() ?? null,
    state: clip(b.state, 2)?.toUpperCase() ?? null,
    club: clip(b.club),
    helm_name: clip(b.helm_name),
    helm_cbvela: clip(b.helm_cbvela, 30),
    crew_name: duo ? clip(b.crew_name) : null,
    crew_cbvela: duo ? clip(b.crew_cbvela, 30) : null,
    division: clip(b.division, 40),
    contact: clip(b.contact),
  });
  if (error) return NextResponse.json({ error: "Não foi possível salvar. Tente de novo." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
