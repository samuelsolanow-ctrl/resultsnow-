import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, readToken } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const TABLES = new Set(["events", "classes", "entries", "races", "results"]);
const METHODS = new Set([
  "select", "insert", "update", "upsert", "delete",
  "eq", "neq", "in", "order", "limit", "single", "maybeSingle",
]);

type Op = { m: string; a: unknown[] };

/** Executa no banco as operações do painel, só para organizador logado */
export async function POST(req: Request) {
  const user = readToken((await cookies()).get(COOKIE)?.value);
  if (!user) return NextResponse.json({ data: null, error: { message: "Faça login novamente." } }, { status: 401 });

  const { table, ops } = (await req.json()) as { table: string; ops: Op[] };
  if (!TABLES.has(table) || !Array.isArray(ops)) {
    return NextResponse.json({ data: null, error: { message: "Operação inválida." } }, { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabaseAdmin().from(table);
    for (const op of ops) {
      if (!METHODS.has(op.m)) throw new Error(`Método não permitido: ${op.m}`);
      let args = op.a ?? [];
      // carimba quem criou o evento
      if (table === "events" && op.m === "insert") {
        const rows = args[0];
        const stamp = (r: Record<string, unknown>) => ({ ...r, organizer: user });
        args = [Array.isArray(rows) ? rows.map(stamp) : stamp(rows as Record<string, unknown>), ...args.slice(1)];
      }
      q = q[op.m](...args);
    }
    const { data, error, count } = await q;
    return NextResponse.json({ data, error, count });
  } catch (e) {
    return NextResponse.json({ data: null, error: { message: (e as Error).message } }, { status: 500 });
  }
}
