"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, AppWindow, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

const HOVER_DELAY_MS = 3000;

export function Sidebar() {
  const pathname = usePathname();
  const t = useT();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showLarge, setShowLarge] = useState(false);

  const navItems = [
    { href: "/dashboard", label: t.nav.overview, icon: LayoutDashboard },
    { href: "/apps", label: t.nav.apps, icon: AppWindow },
    { href: "/accounts", label: t.nav.accounts, icon: KeyRound },
  ];

  function handleEnter() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowLarge(true), HOVER_DELAY_MS);
  }

  function handleLeave() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setShowLarge(false);
  }

  // Close on Escape too
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowLarge(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <aside className="w-60 shrink-0 border-r border-[var(--border)] bg-[var(--card)] flex flex-col">
        <Link
          href="/dashboard"
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          onClick={handleLeave}
          className="h-14 flex items-center gap-2 px-5 border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors group"
        >
          <Image
            src="/icon.png"
            alt="sosis"
            width={24}
            height={24}
            className="rounded-md object-cover transition-transform group-hover:scale-110"
            unoptimized
          />
          <span className="font-semibold tracking-tight lowercase">sosis</span>
        </Link>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-[var(--muted)] text-[var(--foreground)] font-medium"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {showLarge && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md sosis-fade-in"
          onClick={() => setShowLarge(false)}
          onMouseLeave={() => setShowLarge(false)}
        >
          <div className="relative sosis-pop-in">
            <Image
              src="/icon.png"
              alt="sosis"
              width={520}
              height={520}
              className="rounded-3xl shadow-2xl object-cover"
              unoptimized
              priority
            />
            <p className="text-center mt-4 text-white/80 font-semibold tracking-widest lowercase text-sm">sosis</p>
          </div>
        </div>
      )}
    </>
  );
}
