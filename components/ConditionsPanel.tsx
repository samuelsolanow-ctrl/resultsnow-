"use client";

import { COURSES, CURRENT_STRENGTH, START_FLAGS, WIND_DIRS, conditionsLine, duration, hasConditions, type RaceConditions } from "@/lib/conditions";

const now = () => new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** Janela "Condições da regata" na tela de lançar (abre e fecha) */
export default function ConditionsPanel({ value, onChange }: { value: RaceConditions; onChange: (c: RaceConditions) => void }) {
  const set = <K extends keyof RaceConditions>(k: K, v: RaceConditions[K]) => onChange({ ...value, [k]: v });
  const num = (v: string) => (v === "" ? undefined : Number(v.replace(",", ".")));
  const chip = (on: boolean) =>
    `h-9 min-w-0 rounded-lg border px-2 text-sm font-semibold transition ${on ? "border-sea bg-sea text-white" : "border-line bg-white text-ink-2"}`;

  const timeField = (k: "start_time" | "first_finish" | "last_finish", label: string) => (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-1">
        <input type="time" className="input min-w-0 flex-1" value={value[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
        <button type="button" onClick={() => set(k, now())} className="btn-ghost h-10 shrink-0 px-2 text-xs">Agora</button>
      </div>
    </div>
  );

  const dur = duration(value);

  return (
    <details className="group card mt-3 overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
        <span className="font-semibold">🌬 Condições da regata</span>
        <span className="min-w-0 flex-1 truncate text-xs text-ink-3">
          {hasConditions(value) ? conditionsLine(value) : "horário, vento, percurso, raia…"}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="shrink-0 text-ink-3 transition group-open:rotate-180" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>

      <div className="space-y-4 border-t border-line p-3">
        {/* horários */}
        <div className="grid gap-3 sm:grid-cols-3">
          {timeField("start_time", "Largada")}
          {timeField("first_finish", "Chegada do 1º")}
          {timeField("last_finish", "Fechamento da linha")}
        </div>
        {dur ? <p className="-mt-2 text-xs text-ink-3">Duração do 1º barco: <b>{dur}</b></p> : null}

        {/* vento */}
        <div>
          <label className="label">Direção do vento</label>
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-8">
            {WIND_DIRS.map((d) => (
              <button key={d} type="button" onClick={() => set("wind_dir", value.wind_dir === d ? undefined : d)} className={chip(value.wind_dir === d)}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Vento de (nós)</label>
            <input className="input" inputMode="decimal" value={value.wind_min ?? ""} onChange={(e) => set("wind_min", num(e.target.value))} placeholder="8" />
          </div>
          <div>
            <label className="label">até (nós)</label>
            <input className="input" inputMode="decimal" value={value.wind_max ?? ""} onChange={(e) => set("wind_max", num(e.target.value))} placeholder="12" />
          </div>
          <div>
            <label className="label">Rajadas até</label>
            <input className="input" inputMode="decimal" value={value.gust_max ?? ""} onChange={(e) => set("gust_max", num(e.target.value))} placeholder="16" />
          </div>
        </div>

        {/* corrente */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Corrente — para onde vai</label>
            <select className="input" value={value.current_dir ?? ""} onChange={(e) => set("current_dir", e.target.value || undefined)}>
              <option value="">—</option>
              {WIND_DIRS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Força da corrente</label>
            <div className="flex gap-1">
              {CURRENT_STRENGTH.map((c) => (
                <button key={c} type="button" onClick={() => set("current_strength", value.current_strength === c ? undefined : c)} className={`flex-1 ${chip(value.current_strength === c)}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* percurso e raia */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Percurso</label>
            <input className="input" list="course-list" value={value.course ?? ""} onChange={(e) => set("course", e.target.value)} placeholder="Barla-sotavento 2 voltas" />
            <datalist id="course-list">{COURSES.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label className="label">Local da raia</label>
            <input className="input" value={value.area ?? ""} onChange={(e) => set("area", e.target.value)} placeholder="Raia Alfa, Canal de São Sebastião…" />
          </div>
        </div>

        <div>
          <label className="label">Bandeira de largada</label>
          <div className="flex gap-1">
            {START_FLAGS.map((f) => (
              <button key={f} type="button" onClick={() => set("start_flag", value.start_flag === f ? undefined : f)} className={`flex-1 ${chip(value.start_flag === f)}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Observações</label>
          <textarea className="input h-16 py-2" value={value.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Regata encurtada na marca 3…" />
        </div>
      </div>
    </details>
  );
}
