import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { checkAccess } from "@/lib/access";
import { COOKIE, isMaster, readToken } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Gera um link de envio direto para o Storage (o arquivo não passa pela Vercel,
 * então PDFs grandes de instrução de regata funcionam).
 */
export async function POST(req: Request) {
  const user = readToken((await cookies()).get(COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "Faça login novamente." }, { status: 401 });
  const { eventId, filename } = (await req.json().catch(() => ({}))) as { eventId?: string; filename?: string };
  if (!eventId || !filename) return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });

  const sb = supabaseAdmin();
  const denied = await checkAccess(sb, user, isMaster(user), "events", [
    { m: "update", a: [{}] },
    { m: "eq", a: ["id", eventId] },
  ]);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const safe = filename
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.\-]+/g, "_")
    .slice(-80);
  const path = `docs/${eventId.replace(/[^a-z0-9-]/gi, "")}/${Date.now()}_${safe}`;
  const { data, error } = await sb.storage.from("covers").createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Falha ao preparar envio." }, { status: 500 });
  return NextResponse.json({
    path,
    token: data.token,
    publicUrl: sb.storage.from("covers").getPublicUrl(path).data.publicUrl,
  });
}
