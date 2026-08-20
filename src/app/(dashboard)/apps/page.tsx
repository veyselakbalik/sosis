"use client";

import Link from "next/link";
import { RefreshCw, ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useApps } from "@/hooks/use-asc";
import { useActiveAccountId } from "@/hooks/use-active-account";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppIcon } from "@/components/app-icon";
import { useT } from "@/components/i18n-provider";
import { interpolate } from "@/lib/i18n/dict";

export default function AppsPage() {
  const accountId = useActiveAccountId();
  const qc = useQueryClient();
  const t = useT();
  const { data, isLoading, error, isFetching } = useApps(accountId);

  if (!accountId) {
    return (
      <div className="max-w-4xl mx-auto w-full">
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <p>{t.apps.needAccount}</p>
            <Link href="/accounts" className="text-[var(--accent)] hover:underline">{t.apps.goAccounts}</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.apps.title}</h1>
          <p className="text-sm text-[var(--muted-foreground)]">{t.apps.subtitle}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["asc", accountId, "apps"] })}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          {t.common.refresh}
        </Button>
      </div>

      {isLoading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 h-20 bg-[var(--muted)] animate-pulse" />
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="p-6 text-sm">
            <p className="text-[var(--destructive)] font-medium">
              {interpolate(t.apps.loadFailed, { message: (error as Error).message })}
            </p>
          </CardContent>
        </Card>
      )}

      {data && data.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-[var(--muted-foreground)]">
            {t.apps.empty}
          </CardContent>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.map((app) => (
            <Link key={app.id} href={`/apps/${app.id}/versions`}>
              <Card className="hover:border-[var(--accent)] transition-colors h-full group">
                <CardContent className="p-4 flex items-center gap-3">
                  <AppIcon appId={app.id} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{app.attributes?.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)] truncate font-mono">{app.attributes?.bundleId}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
