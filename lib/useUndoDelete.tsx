"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Apagar com "Desfazer": o item some na hora e só é apagado de verdade depois de 5 s.
 * Se a pessoa sair da tela antes, apaga na hora (nada fica pela metade).
 */
export function useUndoDelete() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ id: string; label: string } | null>(null);
  const pending = useRef(new Map<string, { t: ReturnType<typeof setTimeout>; run: () => PromiseLike<unknown> }>());

  function remove(id: string, label: string, run: () => PromiseLike<unknown>, after?: () => void) {
    setHidden((h) => new Set(h).add(id));
    setToast({ id, label });
    const t = setTimeout(async () => {
      pending.current.delete(id);
      await run();
      setToast((x) => (x?.id === id ? null : x));
      after?.();
    }, 5000);
    pending.current.set(id, { t, run });
  }

  function undo(id: string) {
    const p = pending.current.get(id);
    if (p) clearTimeout(p.t);
    pending.current.delete(id);
    setHidden((h) => {
      const n = new Set(h);
      n.delete(id);
      return n;
    });
    setToast(null);
  }

  useEffect(() => {
    const flush = () => {
      for (const [, p] of pending.current) {
        clearTimeout(p.t);
        p.run();
      }
      pending.current.clear();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const node = toast ? (
    <div
      className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-[min(92vw,420px)] items-center gap-3 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lg"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <span className="min-w-0 flex-1 truncate">{toast.label}</span>
      <button onClick={() => undo(toast.id)} className="shrink-0 font-bold text-sky">Desfazer</button>
    </div>
  ) : null;

  return { hidden, remove, node };
}
