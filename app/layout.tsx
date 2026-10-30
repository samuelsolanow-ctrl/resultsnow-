import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResultsNOW — Resultados de vela",
  description: "Resultados de regatas de vela em tempo real.",
};

export const viewport: Viewport = { themeColor: "#2A2F35" };

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
      <body className="flex min-h-screen flex-col">
        <header className="no-print sticky top-0 z-20 bg-night">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/" aria-label="ResultsNOW — início" className="flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-horizontal.png" alt="resultsnow" className="h-8 w-auto sm:h-9" />
            </Link>
            <nav className="flex items-center gap-1 text-sm font-medium">
              <Link href="/" className="rounded-md px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">Eventos</Link>
              <Link href="/admin" className="rounded-md px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">Organizador</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="no-print mt-10 bg-night">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-white/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-horizontal.png" alt="resultsnow" className="h-6 w-auto" />
            <span>Pontuação baixa · RRS Apêndice A</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
