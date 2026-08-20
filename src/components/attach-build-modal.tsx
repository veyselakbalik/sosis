"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, AlertCircle, CheckCircle2, Hourglass, Package, ShieldCheck, ShieldAlert } from "lucide-react";
import { useBuilds } from "@/hooks/use-asc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, cn } from "@/lib/utils";
import { ascFetch } from "@/lib/asc-client-fetch";
import { buildLabel, preReleaseVersionForBuild } from "@/lib/asc/build-label";
import { useT } from "@/components/i18n-provider";
import { interpolate } from "@/lib/i18n/dict";
import type { AscResource } from "@/lib/asc/types";

interface Props {
  open: boolean;
  onClose: () => void;
  accountId: string;
  appId: string;
  versionId: string;
  currentBuildId?: string | null;
}

type ComplianceChoice = "exempt" | "non-exempt" | null;

export function AttachBuildModal({ open, onClose, accountId, appId, versionId, currentBuildId }: Props) {
  const qc = useQueryClient();
  const t = useT();
  const { data, isLoading } = useBuilds(accountId, appId);
  const [selected, setSelected] = useState<string | null>(currentBuildId ?? null);
  const [compliance, setCompliance] = useState<ComplianceChoice>(null);
  const [error, setError] = useState<string | null>(null);

  const builds = data?.data ?? [];
  const included = data?.included as Array<AscResource<Record<string, unknown>>> | undefined;
  const validBuilds = builds.filter((b) => !b.attributes?.expired && b.attributes?.processingState === "VALID");
  const selectedBuild = builds.find((b) => b.id === selected) ?? null;
  const needsCompliance = selectedBuild && selectedBuild.attributes?.usesNonExemptEncryption == null;

  const attach = useMutation({
    mutationFn: async () => {
      if (!selected || !selectedBuild) throw new Error(t.versions.suggestBuildFirst);
      if (needsCompliance) {
        if (compliance === null) throw new Error(t.attachBuild.complianceQuestion);
        await ascFetch(`v1/builds/${selected}`, {
          accountId,
          method: "PATCH",
          body: {
            data: {
              id: selected,
              type: "builds",
              attributes: { usesNonExemptEncryption: compliance === "non-exempt" },
            },
          },
        });
      }
      await ascFetch(`v1/appStoreVersions/${versionId}/relationships/build`, {
        accountId,
        method: "PATCH",
        body: { data: { type: "builds", id: selected } },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asc", accountId, "app", appId, "versions"] });
      qc.invalidateQueries({ queryKey: ["asc", accountId, "app", appId, "builds"] });
      qc.invalidateQueries({ queryKey: ["asc", accountId, "version", versionId] });
      onClose();
    },
    onError: (e: unknown) => {
      const err = e as { body?: { errors?: Array<{ detail?: string; title?: string }> }; message?: string };
      setError(err?.body?.errors?.[0]?.detail || err?.body?.errors?.[0]?.title || err?.message || "Build eklenemedi.");
    },
  });

  if (!open) return null;

  const submitDisabled = !selected || attach.isPending || (needsCompliance && compliance === null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <h2 className="font-semibold">{t.attachBuild.title}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-2">
          {isLoading && <p className="text-sm text-[var(--muted-foreground)]">{t.attachBuild.loading}</p>}
          {!isLoading && builds.length === 0 && (
            <Card><CardContent className="p-10 text-center text-[var(--muted-foreground)]">{t.attachBuild.noBuilds}</CardContent></Card>
          )}
          {!isLoading && builds.length > 0 && validBuilds.length === 0 && (
            <Card><CardContent className="p-6 text-sm text-[var(--muted-foreground)]">{t.attachBuild.noValid}</CardContent></Card>
          )}

          {validBuilds.map((b) => {
            const isSelected = selected === b.id;
            const isCurrent = currentBuildId === b.id;
            const compState = b.attributes?.usesNonExemptEncryption;
            const versionString = preReleaseVersionForBuild(b, included);
            return (
              <button
                key={b.id}
                onClick={() => { setSelected(b.id); setCompliance(null); setError(null); }}
                className={cn(
                  "w-full text-left rounded-lg border p-3 flex items-center justify-between gap-3 transition-colors",
                  isSelected
                    ? "border-[var(--foreground)] bg-[var(--muted)]"
                    : "border-[var(--border)] hover:bg-[var(--muted)]",
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-[var(--muted)] flex items-center justify-center shrink-0">
                    <Package className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium font-mono text-sm">{buildLabel(versionString, b.attributes?.version)}</p>
                      <Badge variant="success" className="text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1 inline" />{t.attachBuild.valid}</Badge>
                      {isCurrent && <Badge variant="info" className="text-[10px]">{t.attachBuild.currentSelection}</Badge>}
                      {compState == null && (
                        <Badge variant="warning" className="text-[10px]"><AlertCircle className="h-3 w-3 mr-1 inline" />{t.attachBuild.missingComp}</Badge>
                      )}
                      {compState === false && (
                        <Badge variant="default" className="text-[10px]"><ShieldCheck className="h-3 w-3 mr-1 inline" />{t.attachBuild.complianceOk}</Badge>
                      )}
                      {compState === true && (
                        <Badge variant="default" className="text-[10px]"><ShieldAlert className="h-3 w-3 mr-1 inline" />{t.attachBuild.nonExempt}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {formatDateTime(b.attributes?.uploadedDate)}
                      {b.attributes?.minOsVersion && <> · iOS {b.attributes.minOsVersion}+</>}
                    </p>
                  </div>
                </div>
                <input
                  type="radio"
                  checked={isSelected}
                  onChange={() => setSelected(b.id)}
                  className="accent-[var(--foreground)]"
                />
              </button>
            );
          })}

          {builds.length > 0 && validBuilds.length < builds.length && (
            <details className="text-xs text-[var(--muted-foreground)]">
              <summary className="cursor-pointer">{interpolate(t.attachBuild.hiddenBuilds, { n: builds.length - validBuilds.length })}</summary>
              <div className="space-y-1 mt-2">
                {builds.filter((b) => b.attributes?.expired || b.attributes?.processingState !== "VALID").map((b) => {
                  const vs = preReleaseVersionForBuild(b, included);
                  return (
                    <div key={b.id} className="px-3 py-2 rounded border border-[var(--border)] flex items-center justify-between">
                      <span className="font-mono text-xs">{buildLabel(vs, b.attributes?.version)}</span>
                      {b.attributes?.expired && <Badge variant="destructive" className="text-[10px]">{t.attachBuild.expired}</Badge>}
                      {b.attributes?.processingState === "PROCESSING" && <Badge variant="warning" className="text-[10px]"><Hourglass className="h-3 w-3 mr-1 inline" />{t.attachBuild.processing}</Badge>}
                      {b.attributes?.processingState === "FAILED" && <Badge variant="destructive" className="text-[10px]">{t.attachBuild.failed}</Badge>}
                      {b.attributes?.processingState === "INVALID" && <Badge variant="destructive" className="text-[10px]">{t.attachBuild.invalid}</Badge>}
                    </div>
                  );
                })}
              </div>
            </details>
          )}

          {needsCompliance && selectedBuild && (
            <Card className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{t.attachBuild.complianceHeader}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{t.attachBuild.complianceDesc}</p>
                  </div>
                </div>
                <p className="text-xs font-medium">{t.attachBuild.complianceQuestion}</p>
                <div className="space-y-1.5">
                  <label className={cn(
                    "flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer",
                    compliance === "exempt" ? "border-[var(--foreground)] bg-[var(--card)]" : "border-[var(--border)] hover:bg-[var(--card)]",
                  )}>
                    <input
                      type="radio"
                      name="compliance"
                      checked={compliance === "exempt"}
                      onChange={() => setCompliance("exempt")}
                      className="mt-0.5 accent-[var(--foreground)]"
                    />
                    <div className="text-xs">
                      <p className="font-medium">{t.attachBuild.exemptOption}</p>
                      <p className="text-[var(--muted-foreground)]">{t.attachBuild.exemptDesc}</p>
                    </div>
                  </label>
                  <label className={cn(
                    "flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer",
                    compliance === "non-exempt" ? "border-[var(--foreground)] bg-[var(--card)]" : "border-[var(--border)] hover:bg-[var(--card)]",
                  )}>
                    <input
                      type="radio"
                      name="compliance"
                      checked={compliance === "non-exempt"}
                      onChange={() => setCompliance("non-exempt")}
                      className="mt-0.5 accent-[var(--foreground)]"
                    />
                    <div className="text-xs">
                      <p className="font-medium">{t.attachBuild.nonExemptOption}</p>
                      <p className="text-[var(--muted-foreground)]">{t.attachBuild.nonExemptDesc}</p>
                    </div>
                  </label>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <div className="text-sm text-[var(--destructive)] bg-red-50 dark:bg-red-950/30 p-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-[var(--border)]">
          <Button variant="outline" onClick={onClose} disabled={attach.isPending}>{t.common.cancel}</Button>
          <Button
            disabled={submitDisabled || (selected === currentBuildId && !needsCompliance)}
            onClick={() => attach.mutate()}
          >
            {attach.isPending ? t.attachBuild.saving : needsCompliance ? t.attachBuild.saveWithComp : t.attachBuild.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
