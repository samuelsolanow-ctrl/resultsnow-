"use client";
// Guarda áudios no próprio celular quando não há sinal (IndexedDB), para enviar depois

const DB = "resultsnow";
const STORE = "audios";

function open(): Promise<IDBDatabase> {
  return new Promise((ok, fail) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((ok, fail) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });
}

export type PendingAudio = { raceId: string; name: string; type: string; at: string; secs: number; blob: Blob };

export const queueAudio = (key: string, v: PendingAudio) => tx("readwrite", (s) => s.put(v, key)).catch(() => null);
export const dropAudio = (key: string) => tx("readwrite", (s) => s.delete(key)).catch(() => null);
export async function pendingAudios(raceId: string): Promise<[string, PendingAudio][]> {
  try {
    const keys = (await tx("readonly", (s) => s.getAllKeys())) as string[];
    const out: [string, PendingAudio][] = [];
    for (const k of keys) {
      if (!String(k).startsWith(raceId)) continue;
      const v = (await tx("readonly", (s) => s.get(k))) as PendingAudio;
      if (v) out.push([k, v]);
    }
    return out;
  } catch {
    return [];
  }
}
