"use client";

import { useState } from "react";
import { Sun, Moon, Monitor, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme, type Theme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const ITEMS: Array<{ id: Theme; label: string; Icon: typeof Sun }> = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "system", label: "System", Icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const CurrentIcon = theme === "system" ? Monitor : resolvedTheme === "dark" ? Moon : Sun;

  return (
    <div className="relative">
      <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
        <CurrentIcon className="h-4 w-4" />
        <ChevronDown className="h-3 w-3 opacity-50" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 min-w-40 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg p-1">
            {ITEMS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => { setTheme(id); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-[var(--muted)]",
                  theme === id && "bg-[var(--muted)]",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
