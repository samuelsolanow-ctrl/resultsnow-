"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuthGate, { type Organizer } from "@/components/AuthGate";
import BackLink from "@/components/BackLink";
import RegistrationLink, { Chevron } from "@/components/RegistrationLink";
import ShareEvent from "@/components/ShareEvent";
import StatusBadge from "@/components/StatusBadge";
import { BR_STATES } from "@/lib/flags";
import { parseList } from "@/lib/parseList";
import { db, uploadAttachment, uploadCover } from "@/lib/adminDb";
import type { ClassRow, DiscardRule, EntryRow, EventRow, FlagMode, NoticeRow, ProtestRow, RaceRow } from "@/lib/types";

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

type Tab = "evento" | "classes" | "inscritos" | "regatas" | "avisos";

export default function EventAdminPage() {
  return <AuthGate>{(org) => <EventAdmin org={org} />}</AuthGate>;
}

function EventAdmin({ org }: { org: Organizer }) {
  const { id } = useParams<{ id: string }>();
  const sb = db;
  const [ev, setEv] = useState<EventRow | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [tab, setTabRaw] = useState<Tab>("evento");
  const touchedRef = useRef(false);
  const setTab = (t: Tab | ((x: Tab) => Tab)) => setTabRaw(t);
  const pickTab = (t: Tab) => {
    touchedRef.current = true;
    setTabRaw(t);
  };
  // abre direto na aba pedida (?aba=regatas, vindo da página pública)
  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get("aba");
    if (a && ["evento", "classes", "inscritos", "regatas", "avisos"].includes(a)) setTab(a as Tab);
  }, []);
  const [classId, setClassId] = useState<string>("");
  const [raceMap, setRaceMap] = useState<Record<string, { id: string; number: number; n: number }[]>>({});
  const router = useRouter();
  const [starting, setStarting] = useState<string | null>(null);

  const loadEvent = useCallback(async () => {
    const { data } = await sb.from("events").select("*").eq("id", id).single();
    setEv(data as EventRow);
  }, [id]);

  const loadClasses = useCallback(async () => {
    const { data } = await sb
      .from("classes")
      .select("*, races(id, number, results(count))")
      .eq("event_id", id)
      .order("sort_order")
      .order("name");
    type WithRaces = ClassRow & { races?: { id: string; number: number; results?: { count: number }[] }[] };
    const raw = (data as WithRaces[]) ?? [];
    const list = raw.map(({ races: _r, ...c }) => c as ClassRow);
    setRaceMap(
      Object.fromEntries(
        raw.map((c) => [
          c.id,
          (c.races ?? []).map((r) => ({ id: r.id, number: r.number, n: r.results?.[0]?.count ?? 0 })).sort((a, b) => a.number - b.number),
        ])
      )
    );
    setClasses(list);
    // evento já montado: abre direto em Regatas (o que mais se usa no dia)
    if (list.length && !new URLSearchParams(window.location.search).get("aba")) setTab((t) => (t === "evento" && !touchedRef.current ? "regatas" : t));
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
    ["regatas", "🏁 Regatas"],
    ["avisos", "Avisos e protestos"],
  ];

  return (
    <div className="wrap max-w-4xl py-5 sm:py-8">
      <BackLink href="/admin">Meus eventos</BackLink>
      <div className="mb-3 mt-3 flex flex-wrap items-center gap-2">
        <h1 className="w-full font-display text-2xl font-bold leading-tight sm:text-3xl">{ev.name}</h1>
        <StatusBadge status={ev.status} />
        {ev.status !== "draft" ? (
          <Link href={`/eventos/${ev.slug}`} target="_blank" className="text-sm font-semibold text-sea">
            Ver página pública ↗
          </Link>
        ) : null}
      </div>

      {/* destaque: lançar a próxima regata de cada classe */}
      {classes.length ? (
        <div className="mb-3 space-y-2">
          {classes.map((c) => {
            const rs = raceMap[c.id] ?? [];
            const last = rs[rs.length - 1];
            // última regata criada mas ainda sem resultado: continua nela
            const open = last && !last.n ? last : null;
            const next = rs.length ? Math.max(...rs.map((r) => r.number)) + 1 : 1;
            return (
              <div key={c.id} className="flex items-stretch gap-2">
                <button
                  disabled={starting === c.id}
                  onClick={async () => {
                    if (open) return router.push(`/admin/regata/${open.id}`);
                    setStarting(c.id);
                    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
                    const { data, error } = await sb.from("races").insert({ class_id: c.id, number: next, sailed_on: today }).select().single();
                    setStarting(null);
                    if (error || !data) return alert(error?.message ?? "Não foi possível criar a regata.");
                    router.push(`/admin/regata/${data.id}`);
                  }}
                  className="flex min-h-[64px] flex-1 items-center gap-3 rounded-xl bg-sea px-4 text-left text-white shadow-md transition active:scale-[0.98] disabled:opacity-60"
                >
                  <span className="text-3xl leading-none">🏁</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-xl font-bold leading-tight">
                      {starting === c.id ? "Abrindo…" : open ? `Continuar regata ${open.number}` : `Lançar regata ${next}`}
                    </span>
                    <span className="block truncate text-xs text-white/80">
                      {c.name}
                      {rs.filter((r) => r.n).length ? ` · ${rs.filter((r) => r.n).length} regata${rs.filter((r) => r.n).length > 1 ? "s" : ""} já lançada${rs.filter((r) => r.n).length > 1 ? "s" : ""}` : " · primeira regata"}
                    </span>
                  </span>
                  <span className="text-2xl leading-none text-white/80">›</span>
                </button>
                {rs.some((r) => r.n) ? (
                  <button
                    onClick={() => {
                      setClassId(c.id);
                      pickTab("regatas");
                    }}
                    className="grid w-16 shrink-0 place-items-center rounded-xl border border-line bg-white text-center text-[11px] font-semibold leading-tight text-ink-2"
                  >
                    Corrigir<br />anterior
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* janelas compactas que abrem e fecham */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <RegistrationLink
          eventId={ev.id}
          name={ev.name}
          slug={ev.slug}
          open={!!ev.registration_open}
          hasClasses={classes.length > 0}
          onChange={loadEvent}
          onManual={() => pickTab("inscritos")}
        />
        {ev.status !== "draft" ? (
          <details className="group card overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
              <span className="font-semibold">Compartilhar resultados</span>
              <Chevron />
            </summary>
            <div className="border-t border-line p-3">
              <ShareEvent name={ev.name} slug={ev.slug} compact />
            </div>
          </details>
        ) : null}
      </div>

      <div className="sticky top-14 z-10 -mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line bg-paper/95 px-4 backdrop-blur">
        {tabs.map(([t, label]) => (
          <button
            key={t}
            onClick={() => pickTab(t)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${
              tab === t ? "border-sea text-sea" : "border-transparent text-ink-3"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "evento" ? <EventForm ev={ev} onSaved={loadEvent} org={org} /> : null}
      {tab === "avisos" ? <NoticesTab eventId={ev.id} /> : null}
      {tab === "classes" ? <ClassesTab eventId={ev.id} classes={classes} onChange={loadClasses} /> : null}
      {(tab === "inscritos" || tab === "regatas") && !classes.length ? (
        <p className="text-sm text-ink-3">Cadastre uma classe primeiro.</p>
      ) : null}
      {(tab === "inscritos" || tab === "regatas") && classes.length ? (
        <>
          <ClassPicker classes={classes} value={classId} onChange={setClassId} />
          {tab === "inscritos" && classId ? (
            <EntriesTab
              cls={classes.find((c) => c.id === classId)!}
              show={{ flag: ev.flag_mode, club: ev.show_club !== false, cbvela: ev.show_cbvela !== false }}
              linkMode={!!ev.registration_open}
            />
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

function EventForm({ ev, onSaved, org }: { ev: EventRow; onSaved: () => void; org: Organizer }) {
  const isOwner = org.master || (ev.organizer ?? "").toLowerCase() === org.user.toLowerCase();
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
        ...(next.show_club !== undefined ? { show_club: next.show_club } : {}),
        ...(next.show_cbvela !== undefined ? { show_cbvela: next.show_cbvela } : {}),
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
        <div className={`relative aspect-video ${f.cover_url ? "bg-ink" : "cover-default"}`}>
          {f.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-sm font-semibold text-white/70">Capa padrão</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 p-3">
          <p className="w-full text-xs text-ink-3">Formato 16:9, igual miniatura do YouTube (ex.: 1280 × 720 px).</p>
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
        <div className="rounded-lg border border-line bg-paper p-3 sm:col-span-2">
          <p className="text-sm font-semibold">O que aparece na súmula</p>
          <p className="mb-3 text-xs text-ink-3">Posição, numeral, nome e resultados sempre aparecem. O resto você escolhe.</p>
          <label className="label">Bandeira</label>
          <div className="mb-3 grid grid-cols-2 gap-1 sm:grid-cols-4">
            {([
              ["country", "País"],
              ["state", "Estado"],
              ["both", "País e estado"],
              ["none", "Nenhuma"],
            ] as [FlagMode, string][]).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setF({ ...f, flag_mode: v })}
                className={`h-9 rounded-md border text-sm font-semibold ${f.flag_mode === v ? "border-sea bg-sea text-white" : "border-line bg-white text-ink-2"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            {([
              ["show_club", "Clube"],
              ["show_cbvela", "ID CBVela"],
            ] as const).map(([k, label]) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[#1F7F96]"
                  checked={f[k] !== false}
                  onChange={(e) => setF({ ...f, [k]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
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

      <HelpersBox ev={ev} canEdit={isOwner} onSaved={onSaved} />

      {isOwner ? <button className="btn-danger" onClick={remove}>Excluir evento</button> : null}
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

const emptyEntry = { sail_number: "", country: "BRA", state: "", club: "", helm_name: "", helm_cbvela: "", crew_name: "", crew_cbvela: "", division: "" };
const DIVISION_HINTS = ["Feminino", "Masculino", "Master", "Grand Master", "Sub-21", "Sub-19", "Sub-17", "Sub-15", "Estreante", "Veterano"];

function EntriesTab({
  cls,
  show,
  linkMode,
}: {
  cls: ClassRow;
  show: { flag: FlagMode; club: boolean; cbvela: boolean };
  linkMode: boolean;
}) {
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
    // só envia a divisão quando preenchida
    ...(x.division.trim() ? { division: x.division.trim() } : {}),
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
      division: en.division ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const pending = entries.filter((e) => e.status === "pending");
  const confirmed = entries.filter((e) => e.status !== "pending");

  async function approve(en: EntryRow) {
    const { error } = await sb.from("entries").update({ status: "confirmed" }).eq("id", en.id);
    if (error) return setMsg(error.message);
    load();
  }

  async function del(en: EntryRow) {
    if (!confirm(`Remover ${en.sail_number} ${en.helm_name}? Os resultados dele também saem.`)) return;
    await sb.from("entries").delete().eq("id", en.id);
    load();
  }

  const preview = useMemo(() => (bulk.trim() ? parseList(bulk, duo) : []), [bulk, duo]);

  async function importBulk() {
    if (!preview.length) return setMsg("Nenhum atleta reconhecido. Confira a lista.");
    const payload = preview.map(({ warning: _w, ...e }) => clean(e));
    const { error } = await sb.from("entries").insert(payload);
    if (error) return setMsg(error.message);
    const missing = preview.filter((e) => e.warning).length;
    setMsg(`${payload.length} atletas cadastrados.${missing ? ` ${missing} sem numeral: toque em Editar para completar.` : ""}`);
    setBulk("");
    setShowBulk(false);
    load();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="card grid gap-3 p-4 sm:grid-cols-4">
        <h2 className="font-display text-xl font-bold sm:col-span-4">{editing ? "Editar inscrito" : `Inscrever atleta · ${cls.name}`}</h2>
        {!editing && linkMode ? (
          <p className="-mt-2 text-xs text-ink-3 sm:col-span-4">As inscrições estão pelo link, mas você também pode inscrever alguém aqui.</p>
        ) : null}
        <div>
          <label className="label">Nº de vela</label>
          <input className="input" required value={f.sail_number} onChange={(e) => setF({ ...f, sail_number: e.target.value })} placeholder="BRA 215" />
        </div>
        {show.flag === "country" || show.flag === "both" ? (
          <div>
            <label className="label">País</label>
            <input className="input uppercase" maxLength={3} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} placeholder="BRA" />
          </div>
        ) : null}
        {show.flag === "state" || show.flag === "both" ? (
          <div>
            <label className="label">Estado</label>
            <select className="input" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })}>
              <option value="">—</option>
              {BR_STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        ) : null}
        {show.club ? (
          <div>
            <label className="label">Clube</label>
            <input className="input" value={f.club} onChange={(e) => setF({ ...f, club: e.target.value })} placeholder="YCSA" />
          </div>
        ) : null}
        <div className={show.cbvela ? "sm:col-span-3" : "sm:col-span-4"}>
          <label className="label">{duo ? "Timoneiro" : "Velejador"}</label>
          <input className="input" required value={f.helm_name} onChange={(e) => setF({ ...f, helm_name: e.target.value })} />
        </div>
        {show.cbvela ? (
          <div>
            <label className="label">ID CBVela</label>
            <input className="input" value={f.helm_cbvela} onChange={(e) => setF({ ...f, helm_cbvela: e.target.value })} placeholder="opcional" />
          </div>
        ) : null}
        {duo ? (
          <>
            <div className={show.cbvela ? "sm:col-span-3" : "sm:col-span-4"}>
              <label className="label">Proeiro</label>
              <input className="input" value={f.crew_name} onChange={(e) => setF({ ...f, crew_name: e.target.value })} />
            </div>
            {show.cbvela ? (
              <div>
                <label className="label">ID CBVela proeiro</label>
                <input className="input" value={f.crew_cbvela} onChange={(e) => setF({ ...f, crew_cbvela: e.target.value })} placeholder="opcional" />
              </div>
            ) : null}
          </>
        ) : null}
        <div className="sm:col-span-2">
          <label className="label">Divisão (opcional)</label>
          <input className="input" list="division-hints" value={f.division} onChange={(e) => setF({ ...f, division: e.target.value })} placeholder="Feminino, Master, Sub-19…" />
          <datalist id="division-hints">
            {DIVISION_HINTS.map((d) => <option key={d} value={d} />)}
          </datalist>
        </div>
        {msg ? <p className="text-sm text-ink-2 sm:col-span-4">{msg}</p> : null}
        <div className="flex gap-2 sm:col-span-4">
          <button className="btn-primary">{editing ? "Salvar" : "Adicionar"}</button>
          {editing ? (
            <button type="button" className="btn-ghost" onClick={() => { setEditing(null); setF({ ...emptyEntry }); }}>Cancelar</button>
          ) : (
            <button type="button" className="btn-ghost" onClick={() => setShowBulk(!showBulk)}>📋 Colar lista de atletas</button>
          )}
        </div>
      </form>

      {showBulk ? (
        <div className="card space-y-3 p-4">
          <p className="text-sm text-ink-2">
            Cole a lista do jeito que estiver (WhatsApp, e-mail, planilha). Uma linha por barco, por exemplo:
          </p>
          <p className="rounded bg-paper p-2 font-mono text-xs leading-5 text-ink-2">
            1. Rogério Guilger BRA 23<br />
            2. Cristiano Ruschman BRA108 (YCSA)<br />
            {duo ? <>3. João Lima / Pedro Reis BRA 30101<br /></> : null}
            4. Fabio Cotrim BRA ← sem número: completa depois
          </p>
          <textarea
            className="input h-44 py-2 font-mono text-sm"
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder="Cole aqui a lista de atletas"
          />
          {preview.length ? (
            <div className="overflow-hidden rounded-lg border border-line">
              <p className="bg-paper px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
                Prévia · {preview.length} atleta{preview.length > 1 ? "s" : ""}
              </p>
              <div className="max-h-72 divide-y divide-line overflow-y-auto">
                {preview.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                    <span className={`num w-20 shrink-0 font-semibold ${e.warning ? "text-amber-600" : ""}`}>{e.sail_number}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {e.helm_name}
                      {e.crew_name ? ` / ${e.crew_name}` : ""}
                      {e.club ? <span className="text-ink-3"> · {e.club}</span> : null}
                    </span>
                    {e.warning ? <span className="shrink-0 rounded bg-amber-50 px-1.5 text-[11px] font-semibold text-amber-700">{e.warning}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex gap-2">
            <button className="btn-primary" onClick={importBulk} disabled={!preview.length}>
              Cadastrar {preview.length || ""} atleta{preview.length === 1 ? "" : "s"}
            </button>
            <button className="btn-ghost" onClick={() => { setShowBulk(false); setBulk(""); }}>Cancelar</button>
          </div>
        </div>
      ) : null}

      {pending.length ? (
        <div className="card divide-y divide-line border-amber-300">
          <p className="bg-amber-50 p-3 text-xs font-semibold uppercase tracking-wide text-amber-700">
            {pending.length} inscrição{pending.length > 1 ? "ões" : ""} pelo link aguardando aprovação
          </p>
          {pending.map((en) => (
            <div key={en.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
              <span className="num w-20 shrink-0 font-semibold">{en.sail_number}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{en.helm_name}{en.crew_name ? ` / ${en.crew_name}` : ""}</p>
                <p className="truncate text-xs text-ink-3">
                  {[en.country, en.state, en.club, en.division, en.helm_cbvela ? `CBVela ${en.helm_cbvela}` : null, en.contact].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button className="btn-primary h-8 px-3" onClick={() => approve(en)}>Aprovar</button>
              <button className="btn-ghost h-8 px-3" onClick={() => del(en)}>Recusar</button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="card divide-y divide-line">
        <p className="p-3 text-xs font-semibold uppercase tracking-wide text-ink-3">{confirmed.length} inscritos</p>
        {confirmed.map((en) => (
          <div key={en.id} className="flex items-center gap-3 p-3 text-sm">
            <span className="num w-20 shrink-0 font-semibold">{en.sail_number}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{en.helm_name}{en.crew_name ? ` / ${en.crew_name}` : ""}</p>
              <p className="truncate text-xs text-ink-3">
                {[en.country, en.state, en.club, en.division, en.helm_cbvela ? `CBVela ${en.helm_cbvela}` : null].filter(Boolean).join(" · ")}
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

  async function removeRace(r: RaceRow & { results: { count: number }[] }) {
    const n = r.results?.[0]?.count ?? 0;
    if (!confirm(`Apagar a regata ${r.number} de ${cls.name}?${n ? `\n\nOs ${n} resultados dela também serão apagados.` : ""}\nNão dá para desfazer.`)) return;
    const { error } = await sb.from("races").delete().eq("id", r.id);
    if (error) return setErr(error.message);
    load();
  }

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
          <div key={r.id} className="flex items-center hover:bg-paper">
            <Link href={`/admin/regata/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3 p-3">
              <span className="font-display text-xl font-bold">R{r.number}</span>
              <span className="text-sm text-ink-3">
                {r.sailed_on ? new Date(r.sailed_on + "T12:00:00").toLocaleDateString("pt-BR") : ""}
              </span>
              <span className="ml-auto text-sm text-ink-3">{r.results?.[0]?.count ?? 0} resultados</span>
              <span className="text-sea">Editar →</span>
            </Link>
            <button
              onClick={() => removeRace(r)}
              aria-label={`Apagar regata ${r.number}`}
              title="Apagar regata"
              className="mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-red-50 hover:text-red-700"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
              </svg>
            </button>
          </div>
        ))}
        {!races.length ? <p className="p-3 text-sm text-ink-3">Nenhuma regata lançada.</p> : null}
      </div>
    </div>
  );
}

/* ---------------- Avisos e protestos ---------------- */

const PROTEST_STATUS = ["Agendado", "Em audiência", "Decidido", "Retirado"];

function NoticesTab({ eventId }: { eventId: string }) {
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [protests, setProtests] = useState<ProtestRow[]>([]);
  const [n, setN] = useState({ title: "", body: "" });
  const emptyP = { number: "", race: "", protestor: "", protestee: "", hearing_at: "", room: "", status: "Agendado", decision: "" };
  const [p, setP] = useState({ ...emptyP });
  const [editingP, setEditingP] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      db.from("notices").select("*").eq("event_id", eventId).order("created_at", { ascending: false }),
      db.from("protests").select("*").eq("event_id", eventId).order("number"),
    ]);
    if (a.error) setMsg("Rode o SQL das novas funções no Supabase para usar avisos e protestos.");
    setNotices((a.data as NoticeRow[]) ?? []);
    setProtests((b.data as ProtestRow[]) ?? []);
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  async function addNotice(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setMsg(null);
    let attach: { file_url: string; file_name: string } | null = null;
    if (file) {
      const up = await uploadAttachment(file, eventId);
      if (up.error || !up.url) {
        setSending(false);
        return setMsg(up.error ?? "Não foi possível enviar o arquivo.");
      }
      attach = { file_url: up.url, file_name: file.name };
    }
    const title = n.title.trim() || file?.name.replace(/\.[^.]+$/, "") || "Aviso";
    const { error } = await db.from("notices").insert({ event_id: eventId, title, body: n.body.trim() || null, ...(attach ?? {}) });
    setSending(false);
    if (error) return setMsg(error.message.includes("file_") ? "Rode o SQL dos anexos no Supabase." : error.message);
    setN({ title: "", body: "" });
    setFile(null);
    load();
  }

  async function delNotice(id: string) {
    if (!confirm("Apagar este aviso?")) return;
    await db.from("notices").delete().eq("id", id);
    load();
  }

  async function saveProtest(e: React.FormEvent) {
    e.preventDefault();
    const row = {
      event_id: eventId,
      number: p.number ? Number(p.number) : null,
      race: p.race.trim() || null,
      protestor: p.protestor.trim(),
      protestee: p.protestee.trim() || null,
      hearing_at: p.hearing_at.trim() || null,
      room: p.room.trim() || null,
      status: p.status,
      decision: p.decision.trim() || null,
    };
    const { error } = editingP
      ? await db.from("protests").update(row).eq("id", editingP)
      : await db.from("protests").insert(row);
    if (error) return setMsg(error.message);
    setP({ ...emptyP });
    setEditingP(null);
    load();
  }

  function editProtest(x: ProtestRow) {
    setEditingP(x.id);
    setP({
      number: x.number != null ? String(x.number) : "",
      race: x.race ?? "",
      protestor: x.protestor,
      protestee: x.protestee ?? "",
      hearing_at: x.hearing_at ?? "",
      room: x.room ?? "",
      status: x.status,
      decision: x.decision ?? "",
    });
  }

  async function delProtest(id: string) {
    if (!confirm("Apagar este protesto?")) return;
    await db.from("protests").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-8">
      {msg ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{msg}</p> : null}

      <section className="space-y-3">
        <h2 className="font-display text-2xl font-bold">Quadro de avisos</h2>
        <form onSubmit={addNotice} className="card space-y-3 p-4">
          <div>
            <label className="label">Título</label>
            <input className="input" required={!file} value={n.title} onChange={(e) => setN({ ...n, title: e.target.value })} placeholder="Instrução de Regata / Alteração nº 1" />
          </div>
          <div>
            <label className="label">Texto</label>
            <textarea className="input h-24 py-2" value={n.body} onChange={(e) => setN({ ...n, body: e.target.value })} placeholder="Largada da classe ILCA 7 adiada para 13h…" />
          </div>
          <div>
            <label className="label">Anexo (PDF, imagem ou documento)</label>
            <label className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed p-3 text-sm ${file ? "border-sea bg-sea-50" : "border-line bg-paper hover:border-ink-3"}`}>
              <span className="text-2xl" aria-hidden>📎</span>
              <span className="min-w-0 flex-1">
                {file ? (
                  <>
                    <b className="block truncate">{file.name}</b>
                    <span className="text-xs text-ink-3">{(file.size / 1024 / 1024).toFixed(1)} MB · toque para trocar</span>
                  </>
                ) : (
                  <span className="text-ink-2">Toque para anexar a instrução de regata ou outro arquivo</span>
                )}
              </span>
              {file ? (
                <button type="button" onClick={(ev) => { ev.preventDefault(); setFile(null); }} className="shrink-0 text-red-700">×</button>
              ) : null}
              <input
                type="file"
                className="hidden"
                accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
                onChange={(ev) => setFile(ev.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <button className="btn-primary" disabled={sending}>{sending ? "Enviando…" : "Publicar aviso"}</button>
        </form>
        <div className="card divide-y divide-line">
          {notices.map((x) => (
            <div key={x.id} className="flex gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-3">{new Date(x.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</p>
                <p className="font-semibold">{x.title}</p>
                {x.body ? <p className="whitespace-pre-line text-sm text-ink-2">{x.body}</p> : null}
                {x.file_url ? (
                  <a href={x.file_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-sea">
                    📎 {x.file_name ?? "Anexo"}
                  </a>
                ) : null}
              </div>
              <button className="h-8 text-sm text-red-700" onClick={() => delNotice(x.id)}>Apagar</button>
            </div>
          ))}
          {!notices.length ? <p className="p-3 text-sm text-ink-3">Nenhum aviso publicado.</p> : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl font-bold">Protestos e audiências</h2>
        <form onSubmit={saveProtest} className="card grid gap-3 p-4 sm:grid-cols-4">
          <div>
            <label className="label">Nº</label>
            <input className="input" inputMode="numeric" value={p.number} onChange={(e) => setP({ ...p, number: e.target.value })} placeholder="1" />
          </div>
          <div>
            <label className="label">Regata</label>
            <input className="input" value={p.race} onChange={(e) => setP({ ...p, race: e.target.value })} placeholder="ILCA 7 · R3" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Situação</label>
            <select className="input" value={p.status} onChange={(e) => setP({ ...p, status: e.target.value })}>
              {PROTEST_STATUS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Protestante</label>
            <input className="input" required value={p.protestor} onChange={(e) => setP({ ...p, protestor: e.target.value })} placeholder="BRA 215 João Silva" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Protestado</label>
            <input className="input" value={p.protestee} onChange={(e) => setP({ ...p, protestee: e.target.value })} placeholder="BRA 51 Pedro Lima" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Audiência (dia e hora)</label>
            <input className="input" value={p.hearing_at} onChange={(e) => setP({ ...p, hearing_at: e.target.value })} placeholder="Sáb 17h30" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Local</label>
            <input className="input" value={p.room} onChange={(e) => setP({ ...p, room: e.target.value })} placeholder="Sala do júri" />
          </div>
          <div className="sm:col-span-4">
            <label className="label">Decisão</label>
            <textarea className="input h-20 py-2" value={p.decision} onChange={(e) => setP({ ...p, decision: e.target.value })} placeholder="Protesto procedente, BRA 51 DSQ na R3" />
          </div>
          <div className="flex gap-2 sm:col-span-4">
            <button className="btn-primary">{editingP ? "Salvar" : "Adicionar protesto"}</button>
            {editingP ? <button type="button" className="btn-ghost" onClick={() => { setEditingP(null); setP({ ...emptyP }); }}>Cancelar</button> : null}
          </div>
        </form>
        <div className="card divide-y divide-line">
          {protests.map((x) => (
            <div key={x.id} className="flex items-center gap-3 p-3 text-sm">
              <span className="w-10 font-display text-lg font-bold">{x.number ?? "—"}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{x.protestor}{x.protestee ? ` × ${x.protestee}` : ""}</p>
                <p className="truncate text-xs text-ink-3">{[x.race, x.status, x.hearing_at, x.room].filter(Boolean).join(" · ")}</p>
              </div>
              <button className="text-sea" onClick={() => editProtest(x)}>Editar</button>
              <button className="text-red-700" onClick={() => delProtest(x.id)}>×</button>
            </div>
          ))}
          {!protests.length ? <p className="p-3 text-sm text-ink-3">Nenhum protesto.</p> : null}
        </div>
      </section>
    </div>
  );
}

/* ---------------- Ajudantes ---------------- */

function HelpersBox({ ev, canEdit, onSaved }: { ev: EventRow; canEdit: boolean; onSaved: () => void }) {
  const [names, setNames] = useState<string[]>([]);
  const [sel, setSel] = useState<string[]>(ev.helpers ?? []);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => setSel(ev.helpers ?? []), [ev.helpers]);
  useEffect(() => {
    fetch("/api/organizers")
      .then((r) => r.json())
      .then((j) => setNames((j.names ?? []).filter((n: string) => n.toLowerCase() !== (ev.organizer ?? "").toLowerCase())))
      .catch(() => null);
  }, [ev.organizer]);

  async function toggle(n: string) {
    if (!canEdit) return;
    const next = sel.includes(n) ? sel.filter((x) => x !== n) : [...sel, n];
    setSel(next);
    const { error } = await db.from("events").update({ helpers: next }).eq("id", ev.id);
    if (error) {
      setSel(sel);
      return setMsg(error.message.includes("helpers") ? "Rode o SQL dos ajudantes no Supabase." : error.message);
    }
    setMsg("Salvo.");
    onSaved();
  }

  return (
    <div className="card p-4">
      <p className="font-display text-xl font-bold">Organizadores ajudantes</p>
      <p className="mb-3 text-sm text-ink-3">
        Outro oficial de regata que ajuda neste evento: lança regatas, inscritos, avisos e protestos. Não pode apagar o evento.
        {ev.organizer ? <> Criado por <b>{ev.organizer}</b>.</> : null}
      </p>
      {names.length ? (
        <div className="flex flex-wrap gap-2">
          {names.map((n) => {
            const on = sel.includes(n);
            return (
              <button
                key={n}
                type="button"
                disabled={!canEdit}
                onClick={() => toggle(n)}
                className={`inline-flex h-10 items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold transition ${
                  on ? "border-sea bg-sea text-white" : "border-line bg-white text-ink-2"
                } ${canEdit ? "" : "opacity-70"}`}
              >
                {on ? "✓" : "+"} {n}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-ink-3">Nenhum outro organizador cadastrado. Para criar, adicione em ORGANIZERS na Vercel.</p>
      )}
      {!canEdit ? <p className="mt-2 text-xs text-ink-3">Só quem criou o evento escolhe os ajudantes.</p> : null}
      {msg ? <p className="mt-2 text-sm text-ink-3">{msg}</p> : null}
    </div>
  );
}
