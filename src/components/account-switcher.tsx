"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

interface AccountSummary {
  id: string;
  label: string;
}

const STORAGE_KEY = "sosis.activeAccountId";
const LEGACY_STORAGE_KEY = "easyapp.activeAccountId";

/**
 * Read the active account ID from localStorage. Falls back to the legacy
 * `easyapp.activeAccountId` key for users upgrading from earlier builds and
 * migrates the value forward on read.
 */
function readActiveId(): string | null {
  if (typeof window === "undefined") return null;
  const current = localStorage.getItem(STORAGE_KEY);
  if (current) return current;
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy) {
    localStorage.setItem(STORAGE_KEY, legacy);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return legacy;
  }
  return null;
}

export function useActiveAccount(): { activeId: string | null; setActiveId: (id: string) => void; accounts: AccountSummary[]; loading: boolean } {
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/vault/accounts")
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((d: { accounts: AccountSummary[] }) => {
        setAccounts(d.accounts);
        const saved = readActiveId();
        let chosen: string | null = null;
        if (saved && d.accounts.some((a) => a.id === saved)) chosen = saved;
        else if (d.accounts[0]) chosen = d.accounts[0].id;
        if (typeof window !== "undefined") {
          if (chosen) {
            setActiveIdState(chosen);
            localStorage.setItem(STORAGE_KEY, chosen);
            window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: chosen }));
          } else {
            // No matching account — clear any stale ID so other pages don't
            // try to fetch with it and see "ACCOUNT_NOT_FOUND".
            if (saved) {
              localStorage.removeItem(STORAGE_KEY);
              localStorage.removeItem(LEGACY_STORAGE_KEY);
              window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: null }));
            }
            setActiveIdState(null);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function setActiveId(id: string) {
    setActiveIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: id }));
    }
  }

  return { activeId, setActiveId, accounts, loading };
}

export function AccountSwitcher() {
  const { activeId, setActiveId, accounts, loading } = useActiveAccount();
  const [open, setOpen] = useState(false);
  const active = accounts.find((a) => a.id === activeId);
  const t = useT();

  if (loading) {
    return <div className="h-9 w-48 bg-[var(--muted)] rounded-lg animate-pulse" />;
  }
  if (accounts.length === 0) {
    return (
      <a href="/accounts" className="text-sm text-[var(--accent)] hover:underline">
        + {t.accounts.addAccount}
      </a>
    );
  }

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)} className="min-w-48 justify-between">
        <span className="flex items-center gap-2 truncate">
          <Building2 className="h-4 w-4" />
          {active?.label || t.accountSwitcher.selectAccount}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 min-w-56 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg p-1">
            {accounts.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  setActiveId(a.id);
                  setOpen(false);
                  window.location.reload();
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-[var(--muted)]",
                  a.id === activeId && "bg-[var(--muted)]",
                )}
              >
                <Check className={cn("h-4 w-4", a.id === activeId ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{a.label}</span>
              </button>
            ))}
            <div className="border-t border-[var(--border)] my-1" />
            <a href="/accounts" className="block px-3 py-2 text-sm rounded-md hover:bg-[var(--muted)] text-[var(--accent)]">
              + {t.accounts.newAccount}
            </a>
          </div>
        </>
      )}
    </div>
  );
}
