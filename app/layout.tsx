import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

// fontes servidas pelo próprio site (mais rápido que buscar no Google a cada visita)
const sans = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans", display: "swap" });
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display", display: "swap" });

const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const metadata: Metadata = {
  metadataBase: new URL(prod ? `https://${prod}` : "http://localhost:3000"),
  openGraph: { siteName: "ResultsNOW", images: ["/logo-full.jpg"], locale: "pt_BR" },
  title: "ResultsNOW — Resultados de vela",
  description: "Resultados de regatas de vela em tempo real.",
};

export const viewport: Viewport = {
  themeColor: "#2A2F35",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${display.variable}`}>
      <body className="flex min-h-screen flex-col">
        <header className="no-print sticky top-0 z-20 bg-night">
          <div className="wrap flex h-14 items-center justify-between">
            <Link href="/" aria-label="ResultsNOW — início" className="flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-horizontal.png" alt="resultsnow" width={150} height={36} className="h-8 w-auto sm:h-9" />
            </Link>
            <nav className="flex items-center gap-1 text-sm font-medium">
              <Link href="/" className="rounded-md px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">Eventos</Link>
              <Link href="/admin" className="rounded-md px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">Organizador</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="no-print mt-10 bg-night">
          <div className="wrap flex flex-wrap items-center justify-between gap-3 py-6 text-xs text-white/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-horizontal.png" alt="resultsnow" width={100} height={24} loading="lazy" className="h-6 w-auto" />
            <span>Pontuação baixa · RRS Apêndice A</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
