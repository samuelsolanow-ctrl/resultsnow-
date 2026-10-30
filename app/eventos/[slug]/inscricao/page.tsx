import { notFound } from "next/navigation";
import type { Metadata } from "next";
import BackLink from "@/components/BackLink";
import Flags from "@/components/Flags";
import RegistrationForm from "@/components/RegistrationForm";
import { formatDates } from "@/lib/data";
import { getEventForRegistration } from "@/lib/eventAdminRead";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ev = await getEventForRegistration((await params).slug);
  if (!ev) return { title: "Inscrição" };
  const image = ev.cover_url || "/logo-full.jpg";
  return {
    title: `Inscrição — ${ev.name}`,
    description: "Faça sua inscrição: numeral, nome e clube.",
    openGraph: { title: `Inscrições abertas · ${ev.name}`, description: "Toque para se inscrever", images: [image] },
  };
}

export default async function RegistrationPage({ params }: Props) {
  const ev = await getEventForRegistration((await params).slug);
  if (!ev) notFound();
  const sub = [ev.venue, formatDates(ev.start_date, ev.end_date)].filter(Boolean).join(" · ");
  const total = ev.classes.reduce((n, c) => n + c.entries.length, 0);

  return (
    <div>
      <div className={`relative h-36 sm:h-48 ${ev.cover_url ? "bg-night" : "cover-default"}`}>
        {ev.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ev.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-night/90 via-night/25 to-transparent" />
        <div className="wrap absolute inset-x-0 bottom-0 max-w-2xl pb-4 text-white">
          <span className="text-[11px] font-bold uppercase tracking-widest text-sky">Inscrição</span>
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{ev.name}</h1>
          {sub ? <p className="text-sm text-white/80">{sub}</p> : null}
        </div>
      </div>

      <div className="wrap max-w-2xl py-5 sm:py-8">
        <div className="mb-4">
          <BackLink href={`/eventos/${ev.slug}`}>Evento</BackLink>
        </div>
        {ev.registration_open && ev.classes.length ? (
          <RegistrationForm slug={ev.slug} classes={ev.classes.map((c) => ({ id: c.id, name: c.name, crew: c.crew_size }))} />
        ) : (
          <p className="card p-4 text-ink-2">
            {ev.classes.length ? "As inscrições estão fechadas para este evento." : "A organização ainda está configurando as classes deste evento. Tente mais tarde."}
          </p>
        )}

        {total ? (
          <section className="mt-8">
            <h2 className="mb-2 font-display text-xl font-bold">Inscritos até agora <span className="text-ink-3">{total}</span></h2>
            <div className="space-y-4">
              {ev.classes.filter((c) => c.entries.length).map((c) => (
                <div key={c.id} className="card overflow-hidden">
                  <p className="border-b border-line bg-paper px-3 py-2 text-sm font-semibold">{c.name} · {c.entries.length}</p>
                  <div className="divide-y divide-line">
                    {c.entries.map((e) => (
                      <div key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span className="num w-16 shrink-0 font-semibold">{e.sail_number}</span>
                        <span className="min-w-0 flex-1 truncate">{e.helm_name}{e.crew_name ? ` / ${e.crew_name}` : ""}</span>
                        <span className="hidden truncate text-xs text-ink-3 sm:block">{e.club}</span>
                        <Flags mode="country" country={e.country} state={null} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
