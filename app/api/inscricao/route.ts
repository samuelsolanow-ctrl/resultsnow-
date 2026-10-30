import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const clip = (v: unknown, n = 120) => {
  const s = String(v ?? "").trim().slice(0, n);
  return s || null;
};

/** Inscrição pública: o velejador se inscreve e já entra na lista do evento */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || b.website) return NextResponse.json({ ok: true }); // robô
  const sb = supabaseAdmin();
  const { data: ev } = await sb.from("events").select("*").eq("slug", String(b.slug ?? "")).maybeSingle();
  if (!ev?.registration_open) return NextResponse.json({ error: "Inscrições fechadas." }, { status: 400 });
  const { data: cls } = await sb.from("classes").select("id, crew_size").eq("id", String(b.class_id ?? "")).eq("event_id", ev.id).maybeSingle();
  if (!cls) return NextResponse.json({ error: "Classe inválida." }, { status: 400 });
  const needClub = ev.show_club !== false;
  if (!clip(b.sail_number) || !clip(b.helm_name) || (needClub && !clip(b.club))) {
    return NextResponse.json({ error: needClub ? "Preencha numeral, nome e clube." : "Preencha numeral e nome." }, { status: 400 });
  }
  // numeral repetido na mesma classe
  const digits = (x: string) => x.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  const { data: others } = await sb.from("entries").select("sail_number").eq("class_id", cls.id);
  if ((others ?? []).some((o) => digits(o.sail_number) === digits(String(b.sail_number)))) {
    return NextResponse.json({ error: "Esse numeral já está inscrito nesta classe. Fale com a organização se for engano." }, { status: 400 });
  }
  const duo = cls.crew_size > 1;
  const { error } = await sb.from("entries").insert({
    class_id: cls.id,
    status: "confirmed",
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
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
