"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PUBLIC_EVENT, isPublicMode, setPublicMode } from "@/lib/publicMode";

/** Topo: "Entrar" discreto para visitantes; o nome do organizador quando está logado */
export default function HeaderUser() {
  const path = usePathname();
  const [user, setUser] = useState<string | null>(null);
  const [pub, setPub] = useState(false);
  const [menu, setMenu] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/login", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setUser(j?.user ?? null))
      .catch(() => null);
  }, [path]);

  useEffect(() => {
    // entrou no painel: sai do modo público
    if (path.startsWith("/admin") && isPublicMode()) setPublicMode(false);
    const sync = () => setPub(isPublicMode());
    sync();
    window.addEventListener(PUBLIC_EVENT, sync);
    return () => window.removeEventListener(PUBLIC_EVENT, sync);
  }, [path]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menu]);

  if (!user || pub) {
    return (
      <Link href="/admin" className="rounded-md px-2 py-2 text-xs text-white/50 hover:text-white">
        Entrar
      </Link>
    );
  }

  async function logout() {
    await fetch("/api/login", { method: "DELETE" });
    window.dispatchEvent(new Event("rn-logout"));
    window.location.href = "/";
  }

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setMenu((m) => !m)}
        className="flex items-center gap-1.5 rounded-full bg-sky px-3 py-1.5 text-xs font-bold text-night"
      >
        <span className="h-2 w-2 rounded-full bg-night" />
        {user} ▾
      </button>
      {menu ? (
        <div className="absolute right-0 top-10 z-40 w-48 overflow-hidden rounded-xl border border-line bg-white text-sm text-ink shadow-lg">
          <Link href="/admin" onClick={() => setMenu(false)} className="block px-4 py-3 font-semibold hover:bg-paper">Meus eventos</Link>
          {path.startsWith("/eventos") ? (
            <button
              onClick={() => {
                setPublicMode(true);
                setMenu(false);
              }}
              className="block w-full px-4 py-3 text-left hover:bg-paper"
            >
              👁 Ver como público
            </button>
          ) : null}
          <button onClick={logout} className="block w-full border-t border-line px-4 py-3 text-left text-red-700 hover:bg-red-50">Sair</button>
        </div>
      ) : null}
    </div>
  );
}
