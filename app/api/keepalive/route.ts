import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Chamado 1x por dia pela Vercel (vercel.json → crons).
 * Uma leitura simples no banco mantém o Supabase grátis "acordado" (ele pausa após ~7 dias sem uso).
 */
export async function GET() {
  const { count, error } = await supabaseServer().from("events").select("id", { count: "exact", head: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, events: count, at: new Date().toISOString() });
}
