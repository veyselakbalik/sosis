"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, HardDriveDownload, ShieldCheck } from "lucide-react";
import { useActiveAccountId } from "@/hooks/use-active-account";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

interface BackupRecord {
  id: string;
  kind: "app-screenshot" | "app-store-version-localization" | "subscription-localization";
  resourceId: string;
  createdAt: string;
  status: "ready" | "restored" | "failed";
  sourceDeletedAt?: string;
  restoredAt?: string;
  restoredResourceId?: string;
}

const labels: Record<BackupRecord["kind"], string> = {
  "app-screenshot": "Screenshot",
  "app-store-version-localization": "Version localization",
  "subscription-localization": "Subscription localization",
};

export function RecentBackups() {
  const accountId = useActiveAccountId();
  const queryClient = useQueryClient();
  const backups = useQuery({
    queryKey: ["backups", accountId],
    enabled: Boolean(accountId),
    queryFn: async () => {
      const response = await fetch("/api/backups?limit=10", {
        headers: { "x-easyapp-account": accountId! },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || body.error || "Could not load backups");
      return (body.backups ?? []) as BackupRecord[];
    },
  });
  const restore = useMutation({
    mutationFn: async (backupId: string) => {
      const response = await fetch("/api/backups", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-easyapp-account": accountId!,
        },
        body: JSON.stringify({ action: "restore", backupId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || body.error || "Restore failed");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backups", accountId] });
      queryClient.invalidateQueries({ queryKey: ["asc", accountId] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <HardDriveDownload className="h-4 w-4" /> Deletion backups
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!accountId || backups.data?.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">No destructive-operation backup yet.</p>
        ) : null}
        {backups.isLoading && <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>}
        {backups.isError && <p className="text-sm text-[var(--destructive)]">{(backups.error as Error).message}</p>}
        {restore.isError && <p className="text-sm text-[var(--destructive)]">{(restore.error as Error).message}</p>}
        {backups.data?.map((backup) => (
          <div key={backup.id} className="rounded-lg border border-[var(--border)] p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium">{labels[backup.kind]}</p>
              <p className="text-xs font-mono truncate">{backup.resourceId}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{formatDateTime(backup.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                <ShieldCheck className="h-3.5 w-3.5" /> {backup.status}
              </span>
              {backup.status !== "restored" && backup.sourceDeletedAt ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={restore.isPending}
                  onClick={() => {
                    if (confirm(`Restore ${labels[backup.kind]} backup?`)) restore.mutate(backup.id);
                  }}
                >
                  <ArchiveRestore className="h-3.5 w-3.5" /> Restore
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
