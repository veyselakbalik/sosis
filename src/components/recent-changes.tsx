"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, RotateCcw, ShieldCheck } from "lucide-react";
import { useActiveAccountId } from "@/hooks/use-active-account";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

interface ChangeSnapshot {
  id: string;
  kind: "app-store-version-localization" | "app-info-localization" | "subscription-localization" | "beta-build-localization" | "app-store-review-details";
  resourceId: string;
  createdAt: string;
  status: "pending" | "applied" | "uncertain" | "failed";
  changedFields: string[];
  before: Record<string, string | null>;
  actualAfter?: Record<string, string | null>;
  restoredAt?: string;
  restorable?: boolean;
  nonRestorableReason?: string;
}

const changeKindLabels: Record<ChangeSnapshot["kind"], string> = {
  "app-store-version-localization": "Version metadata",
  "app-info-localization": "App Info",
  "subscription-localization": "Subscription",
  "beta-build-localization": "TestFlight",
  "app-store-review-details": "App Review",
};

function compact(value: string | null | undefined): string {
  if (!value) return "∅";
  return value.length > 80 ? `${value.slice(0, 77)}…` : value;
}

export function RecentChanges() {
  const accountId = useActiveAccountId();
  const t = useT();
  const queryClient = useQueryClient();
  const snapshots = useQuery({
    queryKey: ["changes", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const response = await fetch("/api/changes?limit=10", {
        headers: { "x-easyapp-account": accountId! },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || body.error || "Could not load changes");
      return (body.snapshots ?? []) as ChangeSnapshot[];
    },
  });

  const restore = useMutation({
    mutationFn: async (snapshotId: string) => {
      const response = await fetch("/api/changes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-easyapp-account": accountId!,
        },
        body: JSON.stringify({ action: "restore", snapshotId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || body.error || "Restore failed");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["changes", accountId] });
      queryClient.invalidateQueries({ queryKey: ["asc", accountId] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" /> {t.dashboard.recentTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!accountId || snapshots.data?.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">{t.dashboard.recentEmpty}</p>
        ) : null}
        {snapshots.isLoading && <p className="text-sm text-[var(--muted-foreground)]">{t.common.loading}</p>}
        {snapshots.isError && <p className="text-sm text-[var(--destructive)]">{(snapshots.error as Error).message}</p>}
        {restore.isError && <p className="text-sm text-[var(--destructive)]">{(restore.error as Error).message}</p>}
        {snapshots.data?.map((snapshot) => (
          <div key={snapshot.id} className="rounded-lg border border-[var(--border)] p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{changeKindLabels[snapshot.kind] ?? snapshot.kind}</p>
                <p className="text-xs font-mono text-[var(--muted-foreground)] truncate">{snapshot.resourceId}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{formatDateTime(snapshot.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                  <ShieldCheck className="h-3.5 w-3.5" /> {snapshot.status}
                </span>
                {snapshot.restoredAt ? (
                  <span className="text-xs text-green-600">{t.dashboard.restored}</span>
                ) : snapshot.restorable === false ? (
                  <span className="text-xs text-[var(--muted-foreground)]" title={snapshot.nonRestorableReason}>
                    No automatic undo
                  </span>
                ) : snapshot.status === "applied" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={restore.isPending}
                    onClick={() => {
                      if (confirm(t.dashboard.restoreConfirm)) restore.mutate(snapshot.id);
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> {t.dashboard.restore}
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="space-y-1">
              {snapshot.changedFields.map((field) => (
                <div key={field} className="grid grid-cols-[7rem_1fr] gap-2 text-xs">
                  <span className="font-mono text-[var(--muted-foreground)]">{field}</span>
                  <span className="truncate" title={`${compact(snapshot.before[field])} → ${compact(snapshot.actualAfter?.[field])}`}>
                    {compact(snapshot.before[field])} → {compact(snapshot.actualAfter?.[field])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
