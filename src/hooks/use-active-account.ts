"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "sosis.activeAccountId";
const LEGACY_STORAGE_KEY = "easyapp.activeAccountId";

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === LEGACY_STORAGE_KEY) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

/**
 * Reads the active account id, transparently falling back to the legacy
 * `easyapp.activeAccountId` key set by older Sosis builds. `account-switcher`
 * migrates the value forward on next write.
 */
export function useActiveAccountId(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (typeof window === "undefined") return null;
      return localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    },
    () => null,
  );
}
