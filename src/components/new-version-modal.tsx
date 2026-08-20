"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, AlertCircle, Plus, Smartphone, Monitor, Tv, Glasses } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ascFetch } from "@/lib/asc-client-fetch";
import { useT } from "@/components/i18n-provider";

const PLATFORMS = [
  { id: "IOS", label: "iOS", Icon: Smartphone },
  { id: "MAC_OS", label: "macOS", Icon: Monitor },
  { id: "TV_OS", label: "tvOS", Icon: Tv },
  { id: "VISION_OS", label: "visionOS", Icon: Glasses },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  accountId: string;
  appId: string;
  defaultPlatform?: string;
  suggestedVersion?: string;
}

export function NewVersionModal({ open, onClose, accountId, appId, defaultPlatform, suggestedVersion }: Props) {
  const qc = useQueryClient();
  const t = useT();
  const RELEASE_TYPES = [
    { id: "AFTER_APPROVAL", label: t.newVersion.afterApproval },
    { id: "MANUAL", label: t.newVersion.manualRelease },
    { id: "SCHEDULED", label: t.newVersion.scheduledRelease },
  ];
  const [versionString, setVersionString] = useState(suggestedVersion ?? "");
  const [platform, setPlatform] = useState(defaultPlatform ?? "IOS");
  const [releaseType, setReleaseType] = useState<string>("AFTER_APPROVAL");
  const [earliestReleaseDate, setEarliestReleaseDate] = useState<string>("");
  const [copyright, setCopyright] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const attributes: Record<string, unknown> = {
        versionString: versionString.trim(),
        platform,
        releaseType,
      };
      if (copyright.trim()) attributes.copyright = copyright.trim();
      if (releaseType === "SCHEDULED" && earliestReleaseDate) {
        attributes.earliestReleaseDate = new Date(earliestReleaseDate).toISOString();
      }
      return ascFetch<{ data: { id: string } }>("v1/appStoreVersions", {
        accountId,
        method: "POST",
        body: {
          data: {
            type: "appStoreVersions",
            attributes,
            relationships: {
              app: { data: { type: "apps", id: appId } },
            },
          },
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asc", accountId, "app", appId, "versions"] });
      onClose();
      setVersionString("");
      setCopyright("");
      setError(null);
    },
    onError: (e: unknown) => {
      const err = e as { body?: { errors?: Array<{ detail?: string; title?: string }> }; message?: string };
      const msg = err?.body?.errors?.[0]?.detail || err?.body?.errors?.[0]?.title || err?.message || t.common.error;
      setError(msg);
    },
  });

  if (!open) return null;

  const validVersion = /^\d+(\.\d+){1,2}$/.test(versionString.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            <h2 className="font-semibold">{t.newVersion.title}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vs">{t.newVersion.versionLabel}</Label>
            <Input
              id="vs"
              placeholder={t.newVersion.versionPh}
              value={versionString}
              onChange={(e) => setVersionString(e.target.value)}
              autoFocus
            />
            {versionString && !validVersion && (
              <p className="text-xs text-amber-600">{t.newVersion.versionFormatHint}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t.newVersion.platform}</Label>
            <div className="grid grid-cols-4 gap-2">
              {PLATFORMS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setPlatform(id)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs ${
                    platform === id ? "border-[var(--foreground)] bg-[var(--muted)]" : "border-[var(--border)] hover:bg-[var(--muted)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t.newVersion.releaseType}</Label>
            <div className="space-y-1.5">
              {RELEASE_TYPES.map((rt) => (
                <label
                  key={rt.id}
                  className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer text-sm ${
                    releaseType === rt.id ? "border-[var(--foreground)] bg-[var(--muted)]" : "border-[var(--border)] hover:bg-[var(--muted)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="releaseType"
                    value={rt.id}
                    checked={releaseType === rt.id}
                    onChange={() => setReleaseType(rt.id)}
                    className="accent-[var(--foreground)]"
                  />
                  <span>{rt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {releaseType === "SCHEDULED" && (
            <div className="space-y-2">
              <Label htmlFor="earliest">{t.newVersion.scheduledDate}</Label>
              <Input
                id="earliest"
                type="datetime-local"
                value={earliestReleaseDate}
                onChange={(e) => setEarliestReleaseDate(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="copy">{t.newVersion.copyright} <span className="text-[var(--muted-foreground)]">({t.common.optional})</span></Label>
            <Input
              id="copy"
              placeholder={t.newVersion.copyrightPh}
              value={copyright}
              onChange={(e) => setCopyright(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-sm text-[var(--destructive)] bg-red-50 dark:bg-red-950/30 p-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-[var(--border)]">
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>{t.common.cancel}</Button>
          <Button
            disabled={!validVersion || create.isPending || (releaseType === "SCHEDULED" && !earliestReleaseDate)}
            onClick={() => create.mutate()}
          >
            {create.isPending ? t.newVersion.creating : t.newVersion.create}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function suggestNextVersion(current?: string | null): string {
  if (!current) return "1.0";
  const parts = current.split(".").map((p) => parseInt(p, 10));
  if (parts.some(Number.isNaN)) return "";
  const last = parts.pop()!;
  return [...parts, last + 1].join(".");
}
