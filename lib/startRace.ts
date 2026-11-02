"use client";

import { db } from "./adminDb";

/** Abre a regata para lançar: continua a última sem resultado, ou cria a próxima. Devolve o id. */
export async function startRace(classId: string): Promise<{ id?: string; error?: string }> {
  const { data, error } = await db.from("races").select("id, number, results(count)").eq("class_id", classId).order("number");
  if (error) return { error: error.message };
  const rs = (data ?? []) as { id: string; number: number; results?: { count: number }[] }[];
  const last = rs[rs.length - 1];
  if (last && !(last.results?.[0]?.count ?? 0)) return { id: last.id };
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const next = rs.length ? Math.max(...rs.map((r) => r.number)) + 1 : 1;
  const ins = await db.from("races").insert({ class_id: classId, number: next, sailed_on: today }).select().single();
  if (ins.error || !ins.data) return { error: ins.error?.message ?? "Não foi possível criar a regata." };
  return { id: (ins.data as { id: string }).id };
}
