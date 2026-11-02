"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
import BackLink from "@/components/BackLink";
import { db } from "@/lib/adminDb";
import { startRace } from "@/lib/startRace";

/** Botão "Lançar" da página do evento: 1 classe → abre a regata direto; várias → escolhe a classe */
export default function LaunchPage() {
  return <AuthGate>{() => <Launch />}</AuthGate>;
}

function Launch() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();
  const [classes, setClasses] = useState<{ id: string; name: string }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function go(classId: string) {
    setBusy(classId);
    const r = await startRace(classId);
    if (r.error || !r.id) {
      setBusy(null);
      return setErr(r.error ?? "Não foi possível abrir a regata.");
    }
    router.replace(`/admin/regata/${r.id}`);
  }

  useEffect(() => {
    (async () => {
      const { data, error } = await db.from("classes").select("id, name").eq("event_id", eventId).order("sort_order").order("name");
      if (error) return setErr(error.message);
      const list = (data ?? []) as { id: string; name: string }[];
      setClasses(list);
      if (list.length === 1) go(list[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  return (
    <div className="wrap max-w-md py-6">
      <BackLink href={`/admin/eventos/${eventId}`}>Evento</BackLink>
      <h1 className="mt-4 font-display text-3xl font-bold">🏁 Lançar regata</h1>
      {err ? <p className="mt-3 text-sm text-flag">{err}</p> : null}
      {!classes || (classes.length === 1 && !err) ? <p className="mt-6 text-sm text-ink-3">Abrindo a regata…</p> : null}
      {classes && !classes.length ? <p className="mt-4 text-sm text-ink-3">Cadastre uma classe primeiro.</p> : null}
      {classes && classes.length > 1 ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-ink-3">Qual classe?</p>
          {classes.map((c) => (
            <button
              key={c.id}
              onClick={() => go(c.id)}
              disabled={!!busy}
              className="flex h-14 w-full items-center justify-between rounded-xl bg-sea px-4 text-lg font-bold text-white disabled:opacity-60"
            >
              {c.name} <span>{busy === c.id ? "Abrindo…" : "›"}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
