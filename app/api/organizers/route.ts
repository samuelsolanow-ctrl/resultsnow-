import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, organizerNames, readToken } from "@/lib/session";

export const runtime = "nodejs";

/** Lista de organizadores (para escolher ajudantes) */
export async function GET() {
  const user = readToken((await cookies()).get(COOKIE)?.value);
  if (!user) return NextResponse.json({ names: [] }, { status: 401 });
  return NextResponse.json({ names: organizerNames() });
}
