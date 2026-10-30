import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, checkLogin, cookieOptions, makeToken, readToken } from "@/lib/session";

export const runtime = "nodejs";

/** Quem está logado */
export async function GET() {
  const user = readToken((await cookies()).get(COOKIE)?.value);
  return user ? NextResponse.json({ user }) : NextResponse.json({ user: null }, { status: 401 });
}

/** Entrar */
export async function POST(req: Request) {
  const { user, password } = await req.json().catch(() => ({}));
  const name = checkLogin(String(user ?? ""), String(password ?? ""));
  if (!name) return NextResponse.json({ error: "Usuário ou senha incorretos." }, { status: 401 });
  const res = NextResponse.json({ user: name });
  res.cookies.set(COOKIE, makeToken(name), cookieOptions);
  return res;
}

/** Sair */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
}
