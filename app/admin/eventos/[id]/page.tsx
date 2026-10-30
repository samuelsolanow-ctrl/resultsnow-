"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AuthGate from "@/components/AuthGate";
import BackLink from "@/components/BackLink";
import ShareEvent from "@/components/ShareEvent";
import StatusBadge from "@/components/StatusBadge";
import { BR_STATES } from "@/lib/flags";
import { db, uploadCover } from "@/lib/adminDb";
import type { ClassRow, DiscardRule, EntryRow, EventRow, FlagMode, RaceRow } from "@/lib/types";

const CLASS_PRESETS: { name: string; crew: number }[] = [
  { name: "Finn", crew: 1 },
  { name: "ILCA 7", crew: 1 },
  { name: "ILCA 6", crew: 1 },
  { name: "ILCA 4", crew: 1 },
  { name: "Optimist", crew: 1 },
  { name: "Optimist Estreante", crew: 1 },
  { name: "Snipe", crew: 2 },
  { name: "Star", crew: 2 },
  { name: "420", crew: 2 },
  { name: "470", crew: 2 },
  { name: "29er", crew: 2 },
  { name: "49er", crew: 2 },
  { name: "Nacra 17", crew: 2 },
  { name: "Lightning", crew: 2 },
  { name: "Dingue", crew: 2 },
  { name: "Hobie Cat 16", crew: 2 },
  { name: "Sunfish", crew: 1 },
  { name: "Formula Kite", crew: 1 },
  { name: "iQFOiL", crew: 1 },
];

type Tab = "evento" | "classes" | "inscritos" | "regatas";

export default function EventAdminPage() {
  return <AuthGate>{() => <EventAdmin />}</AuthGate>;
}

function EventAdmin() {
  const { id } = useParams<{ id: string }>();
  const sb = db;
  const [ev, setEv] = useState<EventRow | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [tab, setTab] = useState<Tab>("evento");
  const [classId, setClassId] = useState<string>("");

  const loadEvent = useCallback(async () => {
    const { data } = await sb.from("events").select("*").eq("id", id).single();
    setEv(data as EventRow);
  }, [id]);

  const loadClasses = useCallback(async () => {
    const { data } = await sb.from("classes").select("*").eq("event_id", id).order("sort_order").order("name");
    const list = (data as ClassRow[]) ?? [];
    setClasses(list);
    setClassId((cur) => (list.some((c) => c.id === cur) ? cur : list[0]?.id ?? ""));
  }, [id]);

  useEffect(() => {
    loadEvent();
    loadClasses();
  }, [loadEvent, loadClasses]);

  if (!ev) return <p className="p-8 text-center text-sm text-ink-3">Carregando…</p>;

  const tabs: [Tab, string][] = [
    ["evento", "Evento"],
    ["classes", `Classes (${classes.length})`],
    ["inscritos", "Inscritos"],
    ["regatas", "Regatas"],
  ];

  return (
    <div className="wrap max-w-4xl py-5 sm:py-8">
      <BackLink href="/admin">Meus eventos</BackLink>
      <div className="mb-4 mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold leading-tight">{ev.name}</h1>
        <StatusBadge status={ev.status} />
        {ev.status !== "draft" ? (
          <Link href={`/eventos/${ev.slug}`} target="_blank" className="ml-auto text-sm font-semibold text-sea">
            Ver página pública ↗
          </Link>
        ) : null}
      </div>

      {ev.status !== "draft" ? (
        <div className="mb-4">
          <ShareEvent name={ev.name} slug={ev.slug} compact />
        </div>
      ) : (
        <p className="mb-4 rounded-lg bg-paper p-3 text-sm text-ink-2">
          Rascunho: o link público aparece quando você salvar a primeira regata ou mudar a situação para “Ao vivo”.
        </p>
      )}

      <div className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4">
        {tabs.map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${
              tab === t ? "border-sea text-sea" : "border-transparent text-ink-3"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "evento" ? <EventForm ev={ev} onSaved={loadEvent} /> : null}
      {tab === "classes" ? <ClassesTab eventId={ev.id} classes={classes} onChange={loadClasses} /> : null}
      {(tab === "inscritos" || tab === "regatas") && !classes.length ? (
        <p className="text-sm text-ink-3">Cadastre uma classe primeiro.</p>
      ) : null}
      {(tab === "inscritos" || tab === "regatas") && classes.length ? (
        <>
          <ClassPicker classes={classes} value={classId} onChange={setClassId} />
          {tab === "inscritos" && classId ? (
            <EntriesTab cls={classes.find((c) => c.id === classId)!} />
          ) : null}
          {tab === "regatas" && classId ? <RacesTab cls={classes.find((c) => c.id === classId)!} /> : null}
        </>
      ) : null}
    </div>
  );
}

function ClassPicker({ classes, value, onChange }: { classes: ClassRow[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1">
      {classes.map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          className={`rounded-full border px-3 py-1 text-sm font-semibold ${
            c.id === value ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-2"
          }`}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Evento ---------------- */

function EventForm({ ev, onSaved }: { ev: EventRow; onSaved: () => void }) {
  const sb = db;
  const router = useRouter();
  const [f, setF] = useState(ev);
  const [msg, setMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => setF(ev), [ev]);

  async function save(patch: Partial<EventRow> = {}) {
    const next = { ...f, ...patch };
    const { error } = await sb
      .from("events")
      .update({
        name: next.name,
        venue: next.venue,
        start_date: next.start_date || null,
        end_date: next.end_date || null,
        flag_mode: next.flag_mode,
        status: next.status,
        cover_url: next.cover_url,
      })
      .eq("id", ev.id);
    setMsg(error ? error.message : "Salvo.");
    if (!error) onSaved();
  }

  async function upload(file: File) {
    setUploading(true);
    const { url, error } = await uploadCover(file, ev.id);
    setUploading(false);
    if (error || !url) return setMsg(error ?? "Falha ao enviar a imagem.");
    setF((x) => ({ ...x, cover_url: url }));
    await save({ cover_url: url });
  }

  async function remove() {
    if (!confirm("Excluir o evento e todos os resultados? Não dá para desfazer.")) return;
    await sb.from("events").delete().eq("id", ev.id);
    router.push("/admin");
  }

  return (
    <div className="space-y-5">
      <div className="card overflow-hidden">
        <div className={`relative aspect-[16/6] ${f.cover_url ? "bg-ink" : "cover-default"}`}>
          {f.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-sm font-semibold text-white/70">Capa padrão</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 p-3">
          <label className="btn-ghost cursor-pointer">
            {uploading ? "Enviando…" : f.cover_url ? "Trocar capa" : "Enviar capa"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          {f.cover_url ? (
            <button className="btn-ghost" onClick={() => { setF({ ...f, cover_url: null }); save({ cover_url: null }); }}>
              Usar capa padrão
            </button>
          ) : null}
        </div>
      </div>

      <div className="card grid gap-3 p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Nome</label>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Local</label>
          <input className="input" value={f.venue ?? ""} onChange={(e) => setF({ ...f, venue: e.target.value })} />
        </div>
        <div>
          <label className="label">Início</label>
          <input className="input" type="date" value={f.start_date ?? ""} onChange={(e) => setF({ ...f, start_date: e.target.value })} />
        </div>
        <div>
          <label className="label">Término</label>
          <input className="input" type="date" value={f.end_date ?? ""} onChange={(e) => setF({ ...f, end_date: e.target.value })} />
        </div>
        <div>
          <label className="label">Bandeira na súmula</label>
          <select className="input" value={f.flag_mode} onChange={(e) => setF({ ...f, flag_mode: e.target.value as FlagMode })}>
            <option value="country">País</option>
            <option value="state">Estado</option>
            <option value="both">País e estado</option>
          </select>
        </div>
        <div>
          <label className="label">Situação</label>
          <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as EventRow["status"] })}>
            <option value="draft">Rascunho (não aparece no site)</option>
            <option value="live">Ao vivo</option>
            <option value="finished">Encerrado (vai para passados)</option>
          </select>
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button className="btn-primary" onClick={() => save()}>Salvar</button>
          {msg ? <span className="text-sm text-ink-3">{msg}</span> : null}
        </div>
      </div>

      <button className="btn-danger" onClick={remove}>Excluir evento</button>
    </div>
  );
}

/* ---------------- Classes ---------------- */

function rulesText(rules: DiscardRule[]) {
  if (!rules?.length) return "Sem descarte";
  return rules.map((r) => `${r.discards} descarte${r.discards > 1 ? "s" : ""} a partir de ${r.races} regatas`).join(" · ");
}

function ClassesTab({ eventId, classes, onChange }: { eventId: string; classes: ClassRow[]; onChange: () => void }) {
  const sb = db;
  const [name, setName] = useState("");
  const [crew, setCrew] = useState(1);
  const [d1, setD1] = useState("4");
  const [d2, setD2] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function pick(n: string) {
    setName(n);
    const p = CLASS_PRESETS.find((x) => x.name.toLowerCase() === n.toLowerCase());
    if (p) setCrew(p.crew);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const rules: DiscardRule[] = [];
    if (+d1 > 0) rules.push({ races: +d1, discards: 1 });
    if (+d2 > 0) rules.push({ races: +d2, discards: 2 });
    const { error } = await sb.from("classes").insert({
      event_id: eventId,
      name,
      crew_size: crew,
      discard_rules: rules,
      sort_order: classes.length,
    });
    if (error) return setErr(error.message);
    setName("");
    setErr(null);
    onChange();
  }

  async function del(c: ClassRow) {
    if (!confirm(`Excluir a classe ${c.name} com inscritos e regatas?`)) return;
    await sb.from("classes").delete().eq("id", c.id);
    onChange();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {classes.map((c) => (
          <div key={c.id} className="card flex items-center gap-3 p-3">
            <div className="flex-1">
              <p className="font-semibold">{c.name} <span className="text-xs font-normal text-ink-3">{c.crew_size === 2 ? "· dupla" : "· individual"}</span></p>
              <p className="text-xs text-ink-3">{rulesText(c.discard_rules)}</p>
            </div>
            <button className="text-sm text-red-700" onClick={() => del(c)}>Excluir</button>
          </div>
        ))}
      </div>

      <form onSubmit={add} className="card grid gap-3 p-4 sm:grid-cols-2">
        <h2 className="font-display text-xl font-bold sm:col-span-2">Adicionar classe</h2>
        <div>
          <label className="label">Classe</label>
          <input className="input" list="class-presets" required value={name} onChange={(e) => pick(e.target.value)} placeholder="ILCA 7" />
          <datalist id="class-presets">
            {CLASS_PRESETS.map((p) => <option key={p.name} value={p.name} />)}
          </datalist>
        </div>
        <div>
          <label className="label">Tripulação</label>
          <select className="input" value={crew} onChange={(e) => setCrew(+e.target.value)}>
            <option value={1}>Individual</option>
            <option value={2}>Dupla (timoneiro + proeiro)</option>
          </select>
        </div>
        <div>
          <label className="label">1º descarte a partir de</label>
          <input className="input" type="number" min={0} value={d1} onChange={(e) => setD1(e.target.value)} placeholder="4 regatas" />
        </div>
        <div>
          <label className="label">2º descarte a partir de</label>
          <input className="input" type="number" min={0} value={d2} onChange={(e) => setD2(e.target.value)} placeholder="opcional" />
        </div>
        {err ? <p className="text-sm text-flag sm:col-span-2">{err}</p> : null}
        <div className="sm:col-span-2"><button className="btn-primary">Adicionar</button></div>
      </form>
    </div>
  );
}

/* ---------------- Inscritos ---------------- */

const emptyEntry = { sail_number: "", country: "BRA", state: "", club: "", helm_name: "", helm_cbvela: "", crew_name: "", crew_cbvela: "" };

function EntriesTab({ cls }: { cls: ClassRow }) {
  const sb = db;
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [f, setF] = useState({ ...emptyEntry });
  const [editing, setEditing] = useState<string | null>(null);
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const duo = cls.crew_size > 1;

  const load = useCallback(async () => {
    const { data } = await sb.from("entries").select("*").eq("class_id", cls.id);
    const list = ((data as EntryRow[]) ?? []).sort((a, b) =>
      a.sail_number.localeCompare(b.sail_number, "pt-BR", { numeric: true })
    );
    setEntries(list);
  }, [cls.id]);

  useEffect(() => {
    load();
    setEditing(null);
    setF({ ...emptyEntry });
  }, [load]);

  const clean = (x: typeof emptyEntry) => ({
    class_id: cls.id,
    sail_number: x.sail_number.trim(),
    country: x.country.trim().toUpperCase() || null,
    state: x.state.trim().toUpperCase() || null,
    club: x.club.trim() || null,
    helm_name: x.helm_name.trim(),
    helm_cbvela: x.helm_cbvela.trim() || null,
    crew_name: duo ? x.crew_name.trim() || null : null,
    crew_cbvela: duo ? x.crew_cbvela.trim() || null : null,
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const row = clean(f);
    const { error } = editing
      ? await sb.from("entries").update(row).eq("id", editing)
      : await sb.from("entries").insert(row);
    if (error) return setMsg(error.message);
    setMsg(null);
    setF({ ...emptyEntry, country: f.country, state: f.state });
    setEditing(null);
    load();
  }

  function edit(en: EntryRow) {
    setEditing(en.id);
    setF({
      sail_number: en.sail_number,
      country: en.country ?? "",
      state: en.state ?? "",
      club: en.club ?? "",
      helm_name: en.helm_name,
      helm_cbvela: en.helm_cbvela ?? "",
      crew_name: en.crew_name ?? "",
      crew_cbvela: en.crew_cbvela ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function del(en: EntryRow) {
    if (!confirm(`Remover ${en.sail_number} ${en.helm_name}? Os resultados dele também saem.`)) return;
    await sb.from("entries").delete().eq("id", en.id);
    load();
  }

  async function importBulk() {
    const rows = bulk
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.split(/\t|;/).map((x) => x.trim()))
      .filter((c) => c[0] && c[4]);
    if (!rows.length) return setMsg("Nenhuma linha válida. Confira o formato.");
    const payload = rows.map((c) =>
      clean({
        sail_number: c[0] ?? "",
        country: c[1] ?? "",
        state: c[2] ?? "",
        club: c[3] ?? "",
        helm_name: c[4] ?? "",
        helm_cbvela: c[5] ?? "",
        crew_name: c[6] ?? "",
        crew_cbvela: c[7] ?? "",
      })
    );
    const { error } = await sb.from("entries").insert(payload);
    if (error) return setMsg(error.message);
    setMsg(`${payload.length} inscritos importados.`);
    setBulk("");
    setShowBulk(false);
    load();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="card grid gap-3 p-4 sm:grid-cols-4">
        <h2 className="font-display text-xl font-bold sm:col-span-4">{editing ? "Editar inscrito" : `Novo inscrito · ${cls.name}`}</h2>
        <div>
          <label className="label">Nº de vela</label>
          <input className="input" required value={f.sail_number} onChange={(e) => setF({ ...f, sail_number: e.target.value })} placeholder="BRA 215" />
        </div>
        <div>
          <label className="label">País</label>
          <input className="input uppercase" maxLength={3} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} placeholder="BRA" />
        </div>
        <div>
          <label className="label">Estado</label>
          <select className="input" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })}>
            <option value="">—</option>
            {BR_STATES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Clube</label>
          <input className="input" value={f.club} onChange={(e) => setF({ ...f, club: e.target.value })} placeholder="YCSA" />
        </div>
        <div className="sm:col-span-3">
          <label className="label">{duo ? "Timoneiro" : "Velejador"}</label>
          <input className="input" required value={f.helm_name} onChange={(e) => setF({ ...f, helm_name: e.target.value })} />
        </div>
        <div>
          <label className="label">ID CBVela</label>
          <input className="input" value={f.helm_cbvela} onChange={(e) => setF({ ...f, helm_cbvela: e.target.value })} placeholder="opcional" />
        </div>
        {duo ? (
          <>
            <div className="sm:col-span-3">
              <label className="label">Proeiro</label>
              <input className="input" value={f.crew_name} onChange={(e) => setF({ ...f, crew_name: e.target.value })} />
            </div>
            <div>
              <label className="label">ID CBVela proeiro</label>
              <input className="input" value={f.crew_cbvela} onChange={(e) => setF({ ...f, crew_cbvela: e.target.value })} placeholder="opcional" />
            </div>
          </>
        ) : null}
        {msg ? <p className="text-sm text-ink-2 sm:col-span-4">{msg}</p> : null}
        <div className="flex gap-2 sm:col-span-4">
          <button className="btn-primary">{editing ? "Salvar" : "Adicionar"}</button>
          {editing ? (
            <button type="button" className="btn-ghost" onClick={() => { setEditing(null); setF({ ...emptyEntry }); }}>Cancelar</button>
          ) : (
            <button type="button" className="btn-ghost" onClick={() => setShowBulk(!showBulk)}>Colar lista</button>
          )}
        </div>
      </form>

      {showBulk ? (
        <div className="card space-y-3 p-4">
          <p className="text-sm text-ink-2">
            Cole da planilha (uma linha por barco, colunas separadas por tab ou <b>;</b>) nesta ordem:
          </p>
          <p className="rounded bg-paper p-2 font-mono text-xs text-ink-2">
            Nº vela ; País ; UF ; Clube ; {duo ? "Timoneiro" : "Velejador"} ; ID CBVela{duo ? " ; Proeiro ; ID CBVela proeiro" : ""}
          </p>
          <textarea
            className="input h-40 py-2 font-mono text-xs"
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={`BRA 215;BRA;SP;YCSA;João Silva;12345${duo ? ";Pedro Lima;23456" : ""}`}
          />
          <button className="btn-primary" onClick={importBulk}>Importar</button>
        </div>
      ) : null}

      <div className="card divide-y divide-line">
        <p className="p-3 text-xs font-semibold uppercase tracking-wide text-ink-3">{entries.length} inscritos</p>
        {entries.map((en) => (
          <div key={en.id} className="flex items-center gap-3 p-3 text-sm">
            <span className="num w-20 shrink-0 font-semibold">{en.sail_number}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{en.helm_name}{en.crew_name ? ` / ${en.crew_name}` : ""}</p>
              <p className="truncate text-xs text-ink-3">
                {[en.country, en.state, en.club, en.helm_cbvela ? `CBVela ${en.helm_cbvela}` : null].filter(Boolean).join(" · ")}
              </p>
            </div>
            <button className="text-sea" onClick={() => edit(en)}>Editar</button>
            <button className="text-red-700" onClick={() => del(en)}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Regatas ---------------- */

function RacesTab({ cls }: { cls: ClassRow }) {
  const sb = db;
  const router = useRouter();
  const [races, setRaces] = useState<(RaceRow & { results: { count: number }[] })[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await sb.from("races").select("*, results(count)").eq("class_id", cls.id).order("number");
    setRaces((data as typeof races) ?? []);
  }, [cls.id]);

  useEffect(() => {
    load();
  }, [load]);

  const nextNumber = useMemo(() => (races.length ? Math.max(...races.map((r) => r.number)) + 1 : 1), [races]);

  async function newRace() {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const { data, error } = await sb
      .from("races")
      .insert({ class_id: cls.id, number: nextNumber, sailed_on: today })
      .select()
      .single();
    if (error) return setErr(error.message);
    router.push(`/admin/regata/${data.id}`);
  }

  return (
    <div className="space-y-3">
      <button className="btn-primary" onClick={newRace}>+ Lançar regata {nextNumber} · {cls.name}</button>
      {err ? <p className="text-sm text-flag">{err}</p> : null}
      <div className="card divide-y divide-line">
        {races.map((r) => (
          <Link key={r.id} href={`/admin/regata/${r.id}`} className="flex items-center gap-3 p-3 hover:bg-paper">
            <span className="font-display text-xl font-bold">R{r.number}</span>
            <span className="text-sm text-ink-3">
              {r.sailed_on ? new Date(r.sailed_on + "T12:00:00").toLocaleDateString("pt-BR") : ""}
            </span>
            <span className="ml-auto text-sm text-ink-3">{r.results?.[0]?.count ?? 0} resultados</span>
            <span className="text-sea">Editar →</span>
          </Link>
        ))}
        {!races.length ? <p className="p-3 text-sm text-ink-3">Nenhuma regata lançada.</p> : null}
      </div>
    </div>
  );
}
