import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, readToken } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Transcreve a gravação da chegada (funciona com áudio de qualquer celular).
 * Recebe o link do áudio já salvo no Storage + dicas (numerais e nomes) para acertar mais.
 */
export async function POST(req: Request) {
  if (!readToken((await cookies()).get(COOKIE)?.value)) {
    return NextResponse.json({ error: "Faça login novamente." }, { status: 401 });
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Falta a chave OPENAI_API_KEY na Vercel para transcrever." }, { status: 500 });

  const { url, hints } = (await req.json().catch(() => ({}))) as { url?: string; hints?: string };
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url || !base || !url.startsWith(base)) return NextResponse.json({ error: "Gravação inválida." }, { status: 400 });

  const audio = await fetch(url);
  if (!audio.ok) return NextResponse.json({ error: "Não achei a gravação." }, { status: 404 });
  const blob = await audio.blob();
  const ext = (url.split("?")[0].split(".").pop() || "m4a").toLowerCase();

  const form = new FormData();
  form.append("file", new File([blob], `chegada.${ext === "webm" ? "webm" : "m4a"}`, { type: blob.type || "audio/mp4" }));
  form.append("model", "gpt-4o-transcribe");
  form.append("language", "pt");
  form.append(
    "prompt",
    `Comissão de regata de vela narrando a ordem de chegada: números de vela e nomes de velejadores. ${String(hints ?? "").slice(0, 800)}`
  );

  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return NextResponse.json({ error: j?.error?.message ?? "Falha ao transcrever." }, { status: 502 });
  return NextResponse.json({ text: String(j.text ?? "") });
}
