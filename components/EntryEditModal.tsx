"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { db } from "@/lib/adminDb";
import { BR_STATES } from "@/lib/flags";
import type { EntryRow } from "@/lib/types";

/** Organizador corrige o velejador direto na súmula (nome, numeral, clube…) */
export default function EntryEditModal({ entry, crewSize, onClose }: { entry: EntryRow; crewSize: number; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState(entry);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const field = (k: keyof EntryRow, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label">{label}</label>
      <input className="input" value={(f[k] as string) ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />
    </div>
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const clean = (v: string | null | undefined) => (v ?? "").trim() || null;
    const { error } = await db
      .from("entries")
      .update({
        helm_name: f.helm_name.trim(),
        crew_name: clean(f.crew_name),
        sail_number: f.sail_number.trim(),
        club: clean(f.club),
        country: clean(f.country)?.toUpperCase() ?? null,
        state: clean(f.state),
        helm_cbvela: clean(f.helm_cbvela),
        crew_cbvela: clean(f.crew_cbvela),
      })
      .eq("id", entry.id);
    setBusy(false);
    if (error) return setErr(error.message);
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-night/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-sea">Corrigir inscrição</p>
            <h2 className="font-display text-2xl font-bold leading-tight">{entry.helm_name}</h2>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-lg text-xl text-ink-3" aria-label="Fechar">×</button>
        </div>
        {field("helm_name", crewSize > 1 ? "Timoneiro" : "Velejador", { required: true })}
        {crewSize > 1 ? field("crew_name", "Proeiro") : null}
        <div className="grid grid-cols-2 gap-3">
          {field("sail_number", "Nº de vela", { required: true })}
          {field("helm_cbvela", "ID CBVela")}
        </div>
        {field("club", "Clube")}
        <div className="grid grid-cols-2 gap-3">
          {field("country", "País", { maxLength: 3, placeholder: "BRA" })}
          <div>
            <label className="label">Estado</label>
            <select className="input" value={f.state ?? ""} onChange={(e) => setF({ ...f, state: e.target.value || null })}>
              <option value="">—</option>
              {BR_STATES.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>
        {err ? <p className="text-sm text-flag">{err}</p> : null}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost h-11">Cancelar</button>
          <button className="btn-primary h-11" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
        </div>
        <p className="text-center text-[11px] text-ink-3">A súmula e o PDF atualizam na hora.</p>
      </form>
    </div>
  );
}
