import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResultsNOW — Resultados de vela",
  description: "Resultados de regatas de vela em tempo real.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">
        <header className="no-print sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2">
              <Logo />
              <span className="font-display text-xl font-bold tracking-tight">
                Results<span className="text-flag">NOW</span>
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm font-medium">
              <Link href="/" className="rounded-md px-3 py-2 text-ink-2 hover:bg-paper">Eventos</Link>
              <Link href="/admin" className="rounded-md px-3 py-2 text-ink-2 hover:bg-paper">Organizador</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="no-print mx-auto max-w-6xl px-4 py-10 text-xs text-ink-3">
          ResultsNOW · Pontuação baixa, RRS Apêndice A
        </footer>
      </body>
    </html>
  );
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#0B1B2B" />
      <path d="M16 5 L16 23 L8 23 Z" fill="#fff" />
      <path d="M17.5 9 L17.5 23 L24 23 Z" fill="#D7263D" />
      <path d="M6 25.5 H26" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
