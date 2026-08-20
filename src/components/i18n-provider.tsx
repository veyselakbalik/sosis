"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type Locale, type Messages, getMessages, DEFAULT_LOCALE } from "@/lib/i18n/dict";

interface I18nContext {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Messages;
}

const Ctx = createContext<I18nContext | null>(null);
const STORAGE_KEY = "sosis.locale";

function detectLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (saved && getMessages(saved)) return saved;
  const nav = navigator.language?.slice(0, 2) as Locale | undefined;
  if (nav && ["en", "tr", "de", "es", "fr", "ja"].includes(nav)) return nav;
  return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const detected = detectLocale();
    // Locale storage is client-only; synchronize once after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocaleState(detected);
    document.documentElement.lang = detected;
  }, []);

  function setLocale(l: Locale) {
    setLocaleState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, l);
      document.documentElement.lang = l;
    }
  }

  const t = getMessages(locale);
  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

export function useT(): Messages {
  return useI18n().t;
}
