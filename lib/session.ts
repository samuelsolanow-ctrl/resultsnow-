// Login simples: usuários e senhas vêm da variável ORGANIZERS na Vercel
// Formato: ORGANIZERS=Samuel:senha1,Nene:senha2
import { createHmac, timingSafeEqual } from "crypto";

export const COOKIE = "rn_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

const secret = () => process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-secret";

function organizers(): Map<string, { name: string; password: string }> {
  const map = new Map<string, { name: string; password: string }>();
  for (const pair of (process.env.ORGANIZERS ?? "").split(",")) {
    const i = pair.indexOf(":");
    if (i < 1) continue;
    const name = pair.slice(0, i).trim();
    map.set(name.toLowerCase(), { name, password: pair.slice(i + 1).trim() });
  }
  return map;
}

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Master: variável MASTER na Vercel, ou o primeiro nome de ORGANIZERS (Samuel) */
export function isMaster(name: string): boolean {
  const master = process.env.MASTER?.trim() || [...organizers().values()][0]?.name || "";
  return master.toLowerCase() === name.toLowerCase();
}

export function checkLogin(user: string, password: string): string | null {
  const o = organizers().get(user.trim().toLowerCase());
  return o && same(o.password, password) ? o.name : null;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function makeToken(name: string): string {
  const payload = Buffer.from(JSON.stringify({ n: name, e: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readToken(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !same(sign(payload), sig)) return null;
  try {
    const { n, e } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (Date.now() > e) return null;
    return organizers().has(String(n).toLowerCase()) ? String(n) : null;
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};
