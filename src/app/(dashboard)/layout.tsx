import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import { AccountSwitcher } from "@/components/account-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-[var(--border)] flex items-center justify-end gap-2 px-6 bg-[var(--card)]">
          <LanguageSwitcher />
          <ThemeToggle />
          <div className="h-6 w-px bg-[var(--border)] mx-1" />
          <AccountSwitcher />
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
