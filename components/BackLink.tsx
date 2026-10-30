import Link from "next/link";

/** Botão de voltar: pílula escura, bem visível e grande o bastante para o dedo */
export default function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 max-w-full items-center gap-1.5 rounded-full bg-night pl-3 pr-4 text-sm font-semibold text-white shadow-md ring-1 ring-white/25 transition hover:bg-night-2 active:scale-95"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      <span className="truncate">Voltar · {children}</span>
    </Link>
  );
}
