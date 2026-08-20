"use client";

import Link from "next/link";
import { AppWindow, KeyRound, Rocket, MessageSquare, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RecentChanges } from "@/components/recent-changes";
import { RecentBackups } from "@/components/recent-backups";
import { useT } from "@/components/i18n-provider";

export default function DashboardPage() {
  const t = useT();
  const quickLinks = [
    { href: "/apps", icon: AppWindow, title: t.dashboard.appsCard, desc: t.dashboard.appsDesc },
    { href: "/accounts", icon: KeyRound, title: t.dashboard.accountsCard, desc: t.dashboard.accountsDesc },
  ];

  return (
    <div className="max-w-5xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.dashboard.welcome}</h1>
        <p className="text-[var(--muted-foreground)] text-sm">{t.dashboard.subtitle}</p>
      </div>
      <Card>
        <CardContent className="p-5 flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-green-500/10 text-green-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium">{t.dashboard.localTitle}</p>
            <p className="text-sm text-[var(--muted-foreground)]">{t.dashboard.localDesc}</p>
          </div>
        </CardContent>
      </Card>
      <div className="grid sm:grid-cols-2 gap-4">
        {quickLinks.map((l) => {
          const Icon = l.icon;
          return (
            <Link key={l.href} href={l.href}>
              <Card className="hover:border-[var(--accent)] transition-colors h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[var(--muted)] flex items-center justify-center">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{l.title}</CardTitle>
                  </div>
                  <CardDescription>{l.desc}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.dashboard.tipsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[var(--muted-foreground)] space-y-2">
          <p className="flex items-start gap-2"><Rocket className="h-4 w-4 mt-0.5 shrink-0" /> {t.dashboard.tipMulti}</p>
          <p className="flex items-start gap-2"><MessageSquare className="h-4 w-4 mt-0.5 shrink-0" /> {t.dashboard.tipLock}</p>
        </CardContent>
      </Card>
      <RecentChanges />
      <RecentBackups />
    </div>
  );
}
