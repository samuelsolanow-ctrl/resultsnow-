import EventCard from "@/components/EventCard";
import Link from "next/link";
import { isPast, listCircuits, listPublicEvents } from "@/lib/data";
import { isConfigured } from "@/lib/supabase";

export const revalidate = 300;

export default async function Home() {
  const [events, circuits] = await Promise.all([listPublicEvents(), listCircuits()]);
  const live = events.filter((e) => !isPast(e));
  const past = events.filter((e) => isPast(e));

  return (
    <>
    <section className="cover-default">
      <div className="wrap py-10 sm:py-16">
        <h1 className="max-w-lg font-display text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
          Resultados de vela, <span className="text-sky">na hora.</span>
        </h1>
        <p className="mt-3 max-w-md text-white/70">Classificações oficiais das regatas, atualizadas pela organização.</p>
      </div>
    </section>
    <div className="wrap py-8">

      {!isConfigured() ? (
        <div className="card p-4 text-sm text-ink-2">
          Configure <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> na Vercel para começar.
        </div>
      ) : null}

      <Section title="Em andamento" empty="Nenhum evento em andamento agora.">
        {live.map((ev) => <EventCard key={ev.id} ev={ev} />)}
      </Section>

      {circuits.length ? (
        <section className="mb-12">
          <h2 className="mb-4 font-display text-2xl font-bold">Rankings</h2>
          <div className="flex flex-wrap gap-2">
            {circuits.map((c) => (
              <Link key={c.slug} href={`/rankings/${c.slug}`} className="card flex items-center gap-2 px-4 py-3 font-semibold hover:border-ink-3">
                <span className="text-sea">🏆</span> {c.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <Section title="Eventos passados" empty="Ainda não há eventos encerrados.">
        {past.map((ev) => <EventCard key={ev.id} ev={ev} />)}
      </Section>
    </div>
    </>
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
