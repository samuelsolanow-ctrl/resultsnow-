import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, readToken } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** Envia a capa do evento para o Storage */
export async function POST(req: Request) {
  if (!readToken((await cookies()).get(COOKIE)?.value)) {
    return NextResponse.json({ error: "Faça login novamente." }, { status: 401 });
  }
  const form = await req.formData();
  const file = form.get("file");
  const eventId = String(form.get("eventId") ?? "misc").replace(/[^a-z0-9-]/gi, "");
  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Imagem maior que 8 MB." }, { status: 400 });

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${eventId}/${Date.now()}.${ext}`;
  const sb = supabaseAdmin();
  const { error } = await sb.storage.from("covers").upload(path, file, { contentType: file.type, upsert: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: sb.storage.from("covers").getPublicUrl(path).data.publicUrl });
}
