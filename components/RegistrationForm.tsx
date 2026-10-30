"use client";

import { useState } from "react";
import { BR_STATES } from "@/lib/flags";

type Cls = { id: string; name: string; crew: number };

export default function RegistrationForm({ slug, classes }: { slug: string; classes: Cls[] }) {
  const [f, setF] = useState({
    class_id: classes[0]?.id ?? "",
    sail_number: "",
    country: "BRA",
    state: "",
    club: "",
    helm_name: "",
    helm_cbvela: "",
    crew_name: "",
    crew_cbvela: "",
    division: "",
    contact: "",
    website: "", // armadilha para robôs (fica escondido)
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const duo = (classes.find((c) => c.id === f.class_id)?.crew ?? 1) > 1;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/inscricao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, ...f }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(json.error ?? "Não foi possível enviar.");
    setDone(true);
  }

  if (done)
    return (
      <div className="card p-6 text-center">
        <p className="text-4xl">⛵</p>
        <h2 className="mt-2 font-display text-2xl font-bold">Inscrição enviada!</h2>
        <p className="mt-1 text-sm text-ink-3">A organização vai conferir e confirmar. Seu barco aparece na súmula depois da aprovação.</p>
        <a href={`/eventos/${slug}`} className="btn-primary mt-5">Ver o evento</a>
      </div>
    );

  return (
    <form onSubmit={submit} className="card grid gap-3 p-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label">Classe</label>
        <select className="input" value={f.class_id} onChange={set("class_id")} required>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Nº de vela</label>
        <input className="input" required value={f.sail_number} onChange={set("sail_number")} placeholder="BRA 215" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">País</label>
          <input className="input uppercase" maxLength={3} value={f.country} onChange={set("country")} />
        </div>
        <div>
          <label className="label">Estado</label>
          <select className="input" value={f.state} onChange={set("state")}>
            <option value="">—</option>
            {BR_STATES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">{duo ? "Timoneiro" : "Velejador"}</label>
        <input className="input" required value={f.helm_name} onChange={set("helm_name")} autoComplete="name" />
      </div>
      <div>
        <label className="label">ID CBVela</label>
        <input className="input" value={f.helm_cbvela} onChange={set("helm_cbvela")} placeholder="se tiver" />
      </div>
      {duo ? (
        <>
          <div>
            <label className="label">Proeiro</label>
            <input className="input" value={f.crew_name} onChange={set("crew_name")} />
          </div>
          <div>
            <label className="label">ID CBVela proeiro</label>
            <input className="input" value={f.crew_cbvela} onChange={set("crew_cbvela")} placeholder="se tiver" />
          </div>
        </>
      ) : null}
      <div>
        <label className="label">Clube</label>
        <input className="input" value={f.club} onChange={set("club")} />
      </div>
      <div>
        <label className="label">Divisão (se houver)</label>
        <input className="input" value={f.division} onChange={set("division")} placeholder="Feminino, Master, Sub-19…" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">WhatsApp ou e-mail para contato</label>
        <input className="input" required value={f.contact} onChange={set("contact")} placeholder="(11) 99999-9999" />
      </div>
      <input type="text" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} className="hidden" aria-hidden />
      {err ? <p className="text-sm text-flag sm:col-span-2">{err}</p> : null}
      <div className="sm:col-span-2">
        <button className="btn-primary w-full sm:w-auto" disabled={busy}>{busy ? "Enviando…" : "Enviar inscrição"}</button>
      </div>
    </form>
  );
}
