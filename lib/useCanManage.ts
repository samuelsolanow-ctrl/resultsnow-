"use client";

import { useEffect, useState } from "react";
import { PUBLIC_EVENT, isPublicMode } from "./publicMode";

/** true só para o organizador do evento (dono, ajudante ou master) e fora do modo "ver como público" */
export function useCanManage(organizer?: string | null, helpers: string[] = []): boolean {
  const [can, setCan] = useState(false);
  const [pub, setPub] = useState(false);
  const key = helpers.join(",");

  useEffect(() => {
    fetch("/api/login", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.user) return;
        const u = String(j.user).toLowerCase();
        setCan(!!j.master || (organizer ?? "").toLowerCase() === u || key.toLowerCase().split(",").includes(u));
      })
      .catch(() => null);
  }, [organizer, key]);

  useEffect(() => {
    const sync = () => setPub(isPublicMode());
    sync();
    window.addEventListener(PUBLIC_EVENT, sync);
    return () => window.removeEventListener(PUBLIC_EVENT, sync);
  }, []);

  return can && !pub;
}
