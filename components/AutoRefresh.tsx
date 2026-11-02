"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Mantém a página do evento sempre atualizada:
 * ao abrir, ao voltar para o app/aba e a cada 60 s enquanto está na tela.
 */
export default function AutoRefresh({ every = 60 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    router.refresh();
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), every * 1000);
    const back = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", back);
    window.addEventListener("focus", back);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener("focus", back);
    };
  }, [router, every]);
  return null;
}
