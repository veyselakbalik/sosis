"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Type } from "lucide-react";
import { useAppInfos, useAppInfoLocalizations } from "@/hooks/use-asc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/components/i18n-provider";
import { ascFetch } from "@/lib/asc-client-fetch";

interface Props {
  accountId: string;
  appId: string;
  /** Highlighted locale (matches the metadata page's current locale tab). */
  preferredLocale?: string;
}

export function AppInfoSection({ accountId, appId, preferredLocale }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const { data: appInfos } = useAppInfos(accountId, appId);

  // Pick the editable / latest app info (Apple lets you have an "editable" copy
  // even when the live one is read-only).
  const editable = appInfos?.find((a) => {
    const state = a.attributes?.appStoreState ?? "";
    return state !== "READY_FOR_SALE" && state !== "DEVELOPER_REMOVED_FROM_SALE";
  }) ?? appInfos?.[0];

  const { data: locs, isLoading } = useAppInfoLocalizations(accountId, editable?.id ?? null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const preferred = preferredLocale
    ? locs?.find((l) => l.attributes?.locale === preferredLocale)
    : undefined;
  const english = locs?.find((l) => l.attributes?.locale?.startsWith("en"));
  const fallbackId = (preferred ?? english ?? locs?.[0])?.id ?? null;
  const activeId = locs?.some((l) => l.id === selectedId) ? selectedId : fallbackId;
  const current = locs?.find((l) => l.id === activeId) ?? null;

  if (!editable) return null;
  if (isLoading || !locs) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-[var(--muted-foreground)]">{t.common.loading}</CardContent>
      </Card>
    );
  }
  if (locs.length === 0 || !current) return null;

  return <AppInfoEditor accountId={accountId} appInfoId={editable.id} key={current.id} locs={locs} activeId={activeId!} setActiveId={setSelectedId} onSaved={() => qc.invalidateQueries({ queryKey: ["asc", accountId, "appInfo", editable.id, "localizations"] })} />;
}

function AppInfoEditor({
  accountId, appInfoId, locs, activeId, setActiveId, onSaved,
}: {
  accountId: string; appInfoId: string;
  locs: Array<{ id: string; attributes?: { locale?: string; name?: string | null; subtitle?: string | null; privacyPolicyUrl?: string | null } }>;
  activeId: string;
  setActiveId: (id: string) => void;
  onSaved: () => void;
}) {
  const t = useT();
  const current = locs.find((l) => l.id === activeId);
  const [name, setName] = useState<string>(current?.attributes?.name ?? "");
  const [subtitle, setSubtitle] = useState<string>(current?.attributes?.subtitle ?? "");
  const [privacyUrl, setPrivacyUrl] = useState<string>(current?.attributes?.privacyPolicyUrl ?? "");

  const dirty =
    name !== (current?.attributes?.name ?? "") ||
    subtitle !== (current?.attributes?.subtitle ?? "") ||
    privacyUrl !== (current?.attributes?.privacyPolicyUrl ?? "");

  const save = useMutation({
    mutationFn: async () => {
      await ascFetch(`v1/appInfoLocalizations/${activeId}`, {
        accountId,
        method: "PATCH",
        body: {
          data: {
            id: activeId,
            type: "appInfoLocalizations",
            attributes: {
              name: name || null,
              subtitle: subtitle || null,
              privacyPolicyUrl: privacyUrl || null,
            },
          },
        },
      });
    },
    onSuccess: onSaved,
  });

  void appInfoId;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-semibold flex items-center gap-2">
            <Type className="h-4 w-4" /> App Info
          </h3>
          <p className="text-xs text-[var(--muted-foreground)]">{locs.length} locale</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {locs.map((l) => (
            <button
              key={l.id}
              onClick={() => setActiveId(l.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono border ${
                l.id === activeId ? "border-[var(--foreground)] bg-[var(--muted)]" : "border-[var(--border)] hover:bg-[var(--muted)]"
              }`}
            >
              {l.attributes?.locale}
            </button>
          ))}
        </div>

        <Field label="Title (Name)" max={30}>
          <Input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Subtitle" max={30}>
          <Input value={subtitle} maxLength={30} onChange={(e) => setSubtitle(e.target.value)} />
        </Field>
        <Field label="Privacy Policy URL">
          <Input value={privacyUrl} onChange={(e) => setPrivacyUrl(e.target.value)} placeholder="https://..." />
        </Field>

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
          {save.isError && <p className="text-xs text-[var(--destructive)] self-center mr-auto">{(save.error as Error).message}</p>}
          {save.isSuccess && !dirty && <p className="text-xs text-green-600 self-center mr-auto">{t.common.saved}</p>}
          <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            <Save className="h-4 w-4" />
            {save.isPending ? t.common.loading : t.common.save}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, max, children }: { label: string; max?: number; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {max && <span className="text-xs text-[var(--muted-foreground)]">Max {max}</span>}
      </div>
      {children}
    </div>
  );
}
