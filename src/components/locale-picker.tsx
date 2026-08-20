"use client";

import { useMemo, useState } from "react";
import { Search, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { localeFlag, localeName, sortLocalizations } from "@/lib/asc/locales";
import { useT } from "@/components/i18n-provider";
import { interpolate } from "@/lib/i18n/dict";

interface LocaleLike {
  id: string;
  attributes?: { locale?: string };
}

interface Props<T extends LocaleLike> {
  locales: T[];
  activeId: string | null | undefined;
  onSelect: (id: string) => void;
  onDelete?: (loc: T) => void;
  deletingId?: string | null;
  /** Action rendered after the last chip (e.g. "+ Add language"). */
  trailing?: React.ReactNode;
  /** Search box shown when locale count exceeds threshold. */
  searchThreshold?: number;
  /** ASC primary locale; pinned first in the sort. */
  primary?: string;
}

export function LocalePicker<T extends LocaleLike>({
  locales,
  activeId,
  onSelect,
  onDelete,
  deletingId = null,
  trailing,
  searchThreshold = 8,
  primary = "en-US",
}: Props<T>) {
  const [query, setQuery] = useState("");
  const t = useT();
  const sorted = useMemo(() => sortLocalizations(locales, primary), [locales, primary]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((l) => {
      const code = l.attributes?.locale ?? "";
      const name = localeName(code).toLowerCase();
      return code.toLowerCase().includes(q) || name.includes(q);
    });
  }, [sorted, query]);

  const showSearch = locales.length >= searchThreshold;

  return (
    <div className="space-y-2">
      {showSearch && (
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={interpolate(t.localePicker.searchPlaceholder, { n: locales.length })}
            className="w-full h-8 pl-7 pr-2 rounded-md border border-[var(--border)] bg-[var(--card)] text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          />
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5">
        {filtered.map((loc) => {
          const code = loc.attributes?.locale ?? loc.id;
          const isActive = loc.id === activeId;
          const isDeleting = deletingId === loc.id;
          return (
            <div
              key={loc.id}
              className={cn(
                "group relative rounded-lg border text-xs transition-colors overflow-hidden",
                isActive
                  ? "border-[var(--foreground)] bg-[var(--muted)]"
                  : "border-[var(--border)] hover:bg-[var(--muted)] hover:border-[var(--accent)]/40",
                isDeleting && "opacity-50",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(loc.id)}
                disabled={isDeleting}
                className="flex items-center gap-2 px-2 py-1.5 w-full text-left"
              >
                <span className="text-base leading-none shrink-0" aria-hidden>
                  {localeFlag(code)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate font-medium leading-tight">{localeName(code)}</span>
                  <span className="block truncate font-mono text-[10px] text-[var(--muted-foreground)] leading-tight">{code}</span>
                </span>
              </button>
              {onDelete && locales.length > 1 && (
                <button
                  type="button"
                  onClick={() => onDelete(loc)}
                  disabled={isDeleting}
                  className="absolute top-1 right-1 p-0.5 rounded text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 hover:text-[var(--destructive)] hover:bg-[var(--destructive)]/10 transition-opacity disabled:opacity-50"
                  title={interpolate(t.localePicker.deleteTitle, { code })}
                  aria-label={interpolate(t.localePicker.deleteTitle, { code })}
                >
                  <XIcon className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
        {trailing}
      </div>
      {filtered.length === 0 && (
        <p className="text-xs text-[var(--muted-foreground)] text-center py-2">{t.localePicker.noMatch}</p>
      )}
    </div>
  );
}
