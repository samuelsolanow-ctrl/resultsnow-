import { notFound } from "next/navigation";
import type { Metadata } from "next";
import BackLink from "@/components/BackLink";
import RegistrationForm from "@/components/RegistrationForm";
import { getEventBySlug } from "@/lib/data";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ev = await getEventBySlug((await params).slug);
  return { title: ev ? `Inscrição — ${ev.name}` : "Inscrição" };
}

export default async function RegistrationPage({ params }: Props) {
  const ev = await getEventBySlug((await params).slug);
  if (!ev) notFound();
  return (
    <div className="wrap max-w-xl py-5 sm:py-8">
      <BackLink href={`/eventos/${ev.slug}`}>{ev.name}</BackLink>
      <h1 className="mt-2 font-display text-3xl font-bold">Inscrição</h1>
      {ev.registration_open ? (
        <>
          <p className="mb-5 mt-1 text-sm text-ink-3">Preencha os dados do barco. A organização confere e confirma a inscrição.</p>
          <RegistrationForm
            slug={ev.slug}
            classes={ev.classes.map((c) => ({ id: c.id, name: c.name, crew: c.crew_size }))}
          />
        </>
      ) : (
        <p className="mt-2 text-ink-3">As inscrições pelo site estão fechadas para este evento.</p>
      )}
    </div>
  );
}
