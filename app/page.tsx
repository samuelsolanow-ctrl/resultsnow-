import EventCard from "@/components/EventCard";
import { isPast, listPublicEvents } from "@/lib/data";
import { isConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Home() {
  const events = await listPublicEvents();
  const live = events.filter((e) => !isPast(e));
  const past = events.filter((e) => isPast(e));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <section className="mb-10">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Resultados de vela</h1>
        <p className="mt-2 max-w-xl text-ink-3">Classificações oficiais das regatas, atualizadas pela organização.</p>
      </section>

      {!isConfigured() ? (
        <div className="card p-4 text-sm text-ink-2">
          Configure <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> na Vercel para começar.
        </div>
      ) : null}

      <Section title="Em andamento" empty="Nenhum evento em andamento agora.">
        {live.map((ev) => <EventCard key={ev.id} ev={ev} />)}
      </Section>

      <Section title="Eventos passados" empty="Ainda não há eventos encerrados.">
        {past.map((ev) => <EventCard key={ev.id} ev={ev} />)}
      </Section>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-bold">
        {title}
        <span className="num text-base font-semibold text-ink-3">{children.length || ""}</span>
      </h2>
      {children.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      ) : (
        <p className="text-sm text-ink-3">{empty}</p>
      )}
    </section>
  );
}
