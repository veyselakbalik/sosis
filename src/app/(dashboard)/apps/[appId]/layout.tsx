"use client";

import { use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useApp } from "@/hooks/use-asc";
import { useActiveAccountId } from "@/hooks/use-active-account";
import { AppIcon } from "@/components/app-icon";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

export default function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ appId: string }>;
}) {
  const { appId } = use(params);
  const accountId = useActiveAccountId();
  const { data: app } = useApp(accountId, appId);
  const pathname = usePathname();
  const t = useT();

  const tabs = [
    { slug: "versions", label: t.appTabs.versions },
    { slug: "release", label: t.appTabs.release },
    { slug: "testflight", label: t.appTabs.testflight },
    { slug: "testers", label: t.appTabs.testers },
    { slug: "metadata", label: t.appTabs.metadata },
    { slug: "previews", label: t.appTabs.previews },
    { slug: "subscriptions", label: t.appTabs.subscriptions },
    { slug: "reviews", label: t.appTabs.reviews },
  ];

  return (
    <div className="max-w-6xl mx-auto w-full">
      <Link href="/apps" className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-4">
        <ArrowLeft className="h-4 w-4" /> {t.common.backToApps}
      </Link>

      <div className="flex items-center gap-4 mb-6">
        <AppIcon appId={appId} size={56} className="rounded-xl" />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight truncate">
            {app?.attributes?.name ?? t.common.loading}
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] font-mono truncate">
            {app?.attributes?.bundleId}
          </p>
        </div>
      </div>

      <div className="border-b border-[var(--border)] mb-6">
        <nav className="flex gap-1 -mb-px">
          {tabs.map((t) => {
            const href = `/apps/${appId}/${t.slug}`;
            const active = pathname.startsWith(href);
            return (
              <Link
                key={t.slug}
                href={href}
                className={cn(
                  "px-4 py-2.5 text-sm border-b-2 transition-colors",
                  active
                    ? "border-[var(--foreground)] text-[var(--foreground)] font-medium"
                    : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
