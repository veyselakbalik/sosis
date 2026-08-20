"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Search, Check, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ascFetch } from "@/lib/asc-client-fetch";
import { LOCALE_NAMES, localeName, localeFlag } from "@/lib/asc/locales";
import { useT } from "@/components/i18n-provider";
import { interpolate } from "@/lib/i18n/dict";

interface Props {
  open: boolean;
  onClose: () => void;
  accountId: string;
  versionId: string;
  existingLocales: string[];
}

interface Result {
  locale: string;
  status: "pending" | "ok" | "error";
  error?: string;
}

export function AddLocaleModal({ open, onClose, accountId, versionId, existingLocales }: Props) {
  const qc = useQueryClient();
  const t = useT();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Result[]>([]);
  const [phase, setPhase] = useState<"select" | "adding" | "done">("select");

  const candidates = useMemo(() => {
    const existing = new Set(existingLocales);
    const all = Object.keys(LOCALE_NAMES).filter((l) => !existing.has(l));
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((l) => l.toLowerCase().includes(q) || localeName(l).toLowerCase().includes(q));
  }, [existingLocales, query]);

  const add = useMutation({
    mutationFn: async () => {
      setPhase("adding");
      const locales = Array.from(selected);
      setResults(locales.map((l) => ({ locale: l, status: "pending" })));

      await Promise.all(
        locales.map(async (locale) => {
          try {
            await ascFetch("v1/appStoreVersionLocalizations", {
              accountId,
              method: "POST",
              body: {
                data: {
                  type: "appStoreVersionLocalizations",
                  attributes: { locale },
                  relationships: {
                    appStoreVersion: {
                      data: { type: "appStoreVersions", id: versionId },
                    },
                  },
                },
              },
            });
            setResults((rs) => rs.map((r) => (r.locale === locale ? { ...r, status: "ok" } : r)));
          } catch (e) {
            const err = e as { body?: { errors?: Array<{ detail?: string; title?: string }> }; message?: string };
            const msg = err?.body?.errors?.[0]?.detail || err?.body?.errors?.[0]?.title || err?.message || t.common.error;
            setResults((rs) => rs.map((r) => (r.locale === locale ? { ...r, status: "error", error: msg } : r)));
          }
        }),
      );

      qc.invalidateQueries({ queryKey: ["asc", accountId, "version", versionId, "localizations"] });
      setPhase("done");
    },
  });

  if (!open) return null;

  function toggle(loc: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(loc)) next.delete(loc);
      else next.add(loc);
      return next;
    });
  }

  function close() {
    setQuery("");
    setSelected(new Set());
    setResults([]);
    setPhase("select");
    onClose();
  }

  const okCount = results.filter((r) => r.status === "ok").length;
  const errCount = results.filter((r) => r.status === "error").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            <h2 className="font-semibold">{t.addLocale.title}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={close}><X className="h-4 w-4" /></Button>
        </div>

        {phase === "select" && (
          <>
            <div className="p-5 border-b border-[var(--border)] space-y-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.addLocale.searchPh}
                  className="pl-9"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t.addLocale.selected}: <span className="font-medium">{selected.size}</span> · {t.addLocale.available}: {candidates.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(new Set(candidates))}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    {t.translateModal.all}
                  </button>
                  <span className="text-xs text-[var(--muted-foreground)]">·</span>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    {t.translateModal.none}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-3 grid sm:grid-cols-2 gap-1.5">
              {candidates.map((loc) => {
                const checked = selected.has(loc);
                return (
                  <label
                    key={loc}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md border text-sm cursor-pointer",
                      checked ? "border-[var(--foreground)] bg-[var(--muted)]" : "border-[var(--border)] hover:bg-[var(--muted)]",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(loc)}
                      className="accent-[var(--foreground)]"
                    />
                    <span className="text-base leading-none" aria-hidden>{localeFlag(loc)}</span>
                    <span className="truncate flex-1">{localeName(loc)}</span>
                    <span className="font-mono text-[10px] text-[var(--muted-foreground)]">{loc}</span>
                  </label>
                );
              })}
              {candidates.length === 0 && (
                <p className="col-span-full text-sm text-[var(--muted-foreground)] text-center py-8">
                  {query ? t.addLocale.noResults : t.addLocale.allAdded}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 p-5 border-t border-[var(--border)]">
              <Button variant="outline" onClick={close}>{t.common.cancel}</Button>
              <Button onClick={() => add.mutate()} disabled={selected.size === 0}>
                <Plus className="h-4 w-4" /> {selected.size > 0 ? interpolate(t.addLocale.addN, { n: selected.size }) : t.addLocale.addNone}
              </Button>
            </div>
          </>
        )}

        {(phase === "adding" || phase === "done") && (
          <>
            <div className="flex-1 overflow-auto p-5 space-y-1.5">
              {results.map((r) => (
                <div
                  key={r.locale}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md border text-sm",
                    r.status === "ok" ? "border-green-600/30 bg-green-50 dark:bg-green-950/20" :
                    r.status === "error" ? "border-red-600/30 bg-red-50 dark:bg-red-950/20" :
                    "border-[var(--border)]",
                  )}
                >
                  {r.status === "pending" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {r.status === "ok" && <Check className="h-4 w-4 text-green-600" />}
                  {r.status === "error" && <AlertCircle className="h-4 w-4 text-[var(--destructive)]" />}
                  <span className="text-base leading-none" aria-hidden>{localeFlag(r.locale)}</span>
                  <span className="flex-1 truncate">{localeName(r.locale)}</span>
                  <span className="font-mono text-[10px] text-[var(--muted-foreground)]">{r.locale}</span>
                  {r.error && <span className="text-xs text-[var(--destructive)]">{r.error}</span>}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2 p-5 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--muted-foreground)]">
                {phase === "done" ? (
                  <>
                    <span className="text-green-600 font-medium">{okCount} {t.addLocale.addedOk}</span>
                    {errCount > 0 && <> · <span className="text-[var(--destructive)] font-medium">{errCount} {t.addLocale.addedErrors}</span></>}
                  </>
                ) : (
                  interpolate(t.addLocale.cantDelete, { n: okCount + errCount, total: results.length })
                )}
              </p>
              <Button onClick={close} disabled={phase === "adding"}>
                {phase === "done" ? t.common.close : t.addLocale.waiting}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
