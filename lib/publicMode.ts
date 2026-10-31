"use client";
// "Ver como público": esconde tudo do organizador nesta aba do navegador

const KEY = "rn-public";

export function isPublicMode(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setPublicMode(on: boolean) {
  try {
    if (on) sessionStorage.setItem(KEY, "1");
    else sessionStorage.removeItem(KEY);
  } catch {
    /* sem armazenamento */
  }
  window.dispatchEvent(new Event(KEY));
}

export const PUBLIC_EVENT = KEY;
