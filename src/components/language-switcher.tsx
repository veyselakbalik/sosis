"use client";

import { useState } from "react";
import { Languages, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "./i18n-provider";
import { LOCALES } from "@/lib/i18n/dict";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const current = LOCALES.find((l) => l.id === locale) ?? LOCALES[0];

  return (
    <div className="relative">
      <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
        <Languages className="h-4 w-4" />
        <span className="hidden md:inline">{current.native}</span>
        <ChevronDown className="h-3 w-3 opacity-50" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 min-w-44 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg p-1">
            {LOCALES.map((l) => (
              <button
                key={l.id}
                onClick={() => { setLocale(l.id); setOpen(false); }}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-[var(--muted)]",
                  l.id === locale && "bg-[var(--muted)]",
                )}
              >
                <span>
                  <span className="font-medium">{l.native}</span>
                  <span className="text-xs text-[var(--muted-foreground)] ml-2">{l.id}</span>
                </span>
                {l.id === locale && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
