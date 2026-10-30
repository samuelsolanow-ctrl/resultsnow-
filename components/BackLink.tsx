import Link from "next/link";

/** Botão de voltar, grande o bastante para o dedo */
export default function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-sea hover:bg-sea-50"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {children}
    </Link>
  );
}
