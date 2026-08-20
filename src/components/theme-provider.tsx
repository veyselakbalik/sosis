"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (t: Theme) => void;
}

const Ctx = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "sosis.theme";

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  const resolved = theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
  html.dataset.theme = resolved;
  html.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const saved = (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null) as Theme | null;
    const initial: Theme = saved && ["light", "dark", "system"].includes(saved) ? saved : "system";
    // Theme storage is client-only; synchronize once after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(initial);
    applyTheme(initial);

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if ((localStorage.getItem(STORAGE_KEY) as Theme | null) === "system" || !localStorage.getItem(STORAGE_KEY)) {
        applyTheme("system");
      }
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t);
  }

  const resolvedTheme = theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;

  return <Ctx.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
