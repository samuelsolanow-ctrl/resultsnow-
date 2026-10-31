"use client";
// Mesmo jeito de escrever do Supabase (db.from("x").select().eq()...),
// mas a operação roda no servidor, com a chave secreta, depois de checar o login.

type Result<T = any> = { data: T; error: { message: string } | null; count?: number | null }; // eslint-disable-line @typescript-eslint/no-explicit-any

class Query implements PromiseLike<Result> {
  private ops: { m: string; a: unknown[] }[] = [];
  constructor(private table: string) {}

  private add(m: string, a: unknown[]) {
    this.ops.push({ m, a });
    return this;
  }
  select(...a: unknown[]) { return this.add("select", a); }
  insert(...a: unknown[]) { return this.add("insert", a); }
  update(...a: unknown[]) { return this.add("update", a); }
  upsert(...a: unknown[]) { return this.add("upsert", a); }
  delete(...a: unknown[]) { return this.add("delete", a); }
  eq(...a: unknown[]) { return this.add("eq", a); }
  neq(...a: unknown[]) { return this.add("neq", a); }
  in(...a: unknown[]) { return this.add("in", a); }
  order(...a: unknown[]) { return this.add("order", a); }
  limit(...a: unknown[]) { return this.add("limit", a); }
  single() { return this.add("single", []); }
  maybeSingle() { return this.add("maybeSingle", []); }

  private async run(): Promise<Result> {
    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: this.table, ops: this.ops }),
      });
      const json = await res.json();
      if (res.status === 401) window.dispatchEvent(new Event("rn-logout"));
      return { data: json.data ?? null, error: json.error ?? null, count: json.count ?? null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  }

  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, fail?: ((r: unknown) => B | PromiseLike<B>) | null) {
    return this.run().then(ok, fail);
  }
}

export const db = {
  from: (table: string) => new Query(table),
};

export async function uploadCover(file: File, eventId: string): Promise<{ url?: string; error?: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("eventId", eventId);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  return res.json();
}

/** Envia um anexo (PDF, imagem…) direto para o Storage e devolve o link público */
export async function uploadAttachment(file: File, eventId: string): Promise<{ url?: string; error?: string }> {
  const res = await fetch("/api/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, filename: file.name }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return { error: j.error ?? "Não foi possível enviar." };
  const { supabaseBrowser } = await import("./supabase");
  const { error } = await supabaseBrowser()
    .storage.from("covers")
    .uploadToSignedUrl(j.path, j.token, file, { contentType: file.type || "application/octet-stream" });
  if (error) return { error: error.message };
  return { url: j.publicUrl };
}
