"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n-provider";

type Variant = "success" | "warning" | "info" | "destructive" | "default";

const STATE_VARIANT: Record<string, Variant> = {
  READY_FOR_SALE: "success",
  PENDING_DEVELOPER_RELEASE: "info",
  PENDING_APPLE_RELEASE: "info",
  IN_REVIEW: "info",
  WAITING_FOR_REVIEW: "info",
  PREPARE_FOR_SUBMISSION: "warning",
  READY_FOR_REVIEW: "warning",
  METADATA_REJECTED: "destructive",
  REJECTED: "destructive",
  INVALID_BINARY: "destructive",
  DEVELOPER_REJECTED: "destructive",
  WAITING_FOR_EXPORT_COMPLIANCE: "warning",
  PROCESSING_FOR_APP_STORE: "warning",
  DEVELOPER_REMOVED_FROM_SALE: "default",
  REMOVED_FROM_SALE: "default",
  REPLACED_WITH_NEW_VERSION: "default",
};

export function VersionStateBadge({ state }: { state: string | undefined | null }) {
  const t = useT();
  if (!state) return <Badge variant="default">—</Badge>;
  const variant = STATE_VARIANT[state] ?? "default";
  const label = (t.versionState as Record<string, string>)[state] ?? state;
  return <Badge variant={variant}>{label}</Badge>;
}
