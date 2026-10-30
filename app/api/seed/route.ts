import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { SEED_SLUGS, createSeed } from "@/lib/seed";
import { COOKIE, isMaster, readToken } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

async function master() {
  const user = readToken((await cookies()).get(COOKIE)?.value);
  return user && isMaster(user) ? user : null;
}

/** Cria (ou recria) os eventos de teste */
export async function POST() {
  const user = await master();
  if (!user) return NextResponse.json({ error: "Só o master pode criar eventos de teste." }, { status: 403 });
  try {
    await createSeed(supabaseAdmin(), user);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Apaga os eventos de teste */
export async function DELETE() {
  if (!(await master())) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const sb = supabaseAdmin();
  await sb.from("events").delete().in("slug", SEED_SLUGS);
  await sb.from("circuits").delete().eq("slug", "teste-ranking-ventania");
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
