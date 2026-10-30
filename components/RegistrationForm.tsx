"use client";

import { useState } from "react";
import { BR_STATES } from "@/lib/flags";

type Cls = { id: string; name: string; crew: number };

type Fields = { flag: "country" | "state" | "both" | "none"; club: boolean; cbvela: boolean };

export default function RegistrationForm({
  slug,
  classes,
  fields = { flag: "country", club: true, cbvela: true },
}: {
  slug: string;
  classes: Cls[];
  fields?: Fields;
}) {
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
        <h2 className="mt-2 font-display text-2xl font-bold">Inscrição feita!</h2>
        <p className="mt-1 text-sm text-ink-3">Seu barco já está na lista do evento. Boas regatas!</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <a href={`/eventos/${slug}/inscricao`} className="btn-ghost">Inscrever outro barco</a>
          <a href={`/eventos/${slug}`} className="btn-primary">Ver o evento</a>
        </div>
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
        <label className="label">Numeral (nº de vela)</label>
        <input className="input" required value={f.sail_number} onChange={set("sail_number")} placeholder="BRA 215" />
      </div>
      {fields.flag !== "none" ? (
        <div className="grid grid-cols-2 gap-3">
          {fields.flag !== "state" ? (
            <div>
              <label className="label">País</label>
              <input className="input uppercase" maxLength={3} value={f.country} onChange={set("country")} />
            </div>
          ) : null}
          {fields.flag !== "country" ? (
            <div>
              <label className="label">Estado</label>
              <select className="input" value={f.state} onChange={set("state")}>
                <option value="">—</option>
                {BR_STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          ) : null}
        </div>
      ) : <div className="hidden sm:block" />}
      <div>
        <label className="label">{duo ? "Timoneiro" : "Velejador"}</label>
        <input className="input" required value={f.helm_name} onChange={set("helm_name")} autoComplete="name" />
      </div>
      {fields.cbvela ? (
        <div>
          <label className="label">ID CBVela</label>
          <input className="input" value={f.helm_cbvela} onChange={set("helm_cbvela")} placeholder="se tiver" />
        </div>
      ) : null}
      {duo ? (
        <>
          <div>
            <label className="label">Proeiro</label>
            <input className="input" value={f.crew_name} onChange={set("crew_name")} />
          </div>
          {fields.cbvela ? (
            <div>
              <label className="label">ID CBVela proeiro</label>
              <input className="input" value={f.crew_cbvela} onChange={set("crew_cbvela")} placeholder="se tiver" />
            </div>
          ) : null}
        </>
      ) : null}
      {fields.club ? (
        <div>
          <label className="label">Clube</label>
          <input className="input" required value={f.club} onChange={set("club")} placeholder="YCSA, ICRJ, VDS…" />
        </div>
      ) : null}
      <div>
        <label className="label">Divisão (se houver)</label>
        <input className="input" value={f.division} onChange={set("division")} placeholder="Feminino, Master, Sub-19…" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">WhatsApp para contato (opcional)</label>
        <input className="input" inputMode="tel" value={f.contact} onChange={set("contact")} placeholder="(11) 99999-9999" />
      </div>
      <input type="text" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} className="hidden" aria-hidden />
      {err ? <p className="text-sm text-flag sm:col-span-2">{err}</p> : null}
      <div className="sm:col-span-2">
        <button className="btn-primary w-full sm:w-auto" disabled={busy}>{busy ? "Enviando…" : "Enviar inscrição"}</button>
      </div>
    </form>
  );
}
