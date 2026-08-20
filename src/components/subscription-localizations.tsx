"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Globe, Plus } from "lucide-react";
import { AddSubLocaleModal } from "@/components/add-sub-locale-modal";
import { LocalePicker } from "@/components/locale-picker";
import { useSubscriptionLocalizations } from "@/hooks/use-asc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/components/i18n-provider";
import { ascFetch } from "@/lib/asc-client-fetch";
import { localeName } from "@/lib/asc/locales";
import type { SubscriptionLocalization } from "@/lib/asc/types";

interface Props {
  accountId: string;
  subId: string;
}

const NAME_MAX = 30;
const DESC_MAX = 45;

export function SubscriptionLocalizations({ accountId, subId }: Props) {
  const t = useT();
  const { data: locs, isLoading } = useSubscriptionLocalizations(accountId, subId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const current = locs?.find((localization) => localization.id === (activeId ?? locs[0]?.id ?? "")) ?? null;

  if (isLoading) {
    return <Card><CardContent className="p-6 text-sm text-[var(--muted-foreground)]">{t.common.loading}</CardContent></Card>;
  }
  if (!locs || locs.length === 0) {
    return <Card><CardContent className="p-6 text-sm text-[var(--muted-foreground)]">No localizations yet.</CardContent></Card>;
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-semibold">{t.subscriptions.localizations}</h3>
          <p className="text-xs text-[var(--muted-foreground)]">{locs.length} locale</p>
        </div>

        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] block">
            <Globe className="h-3 w-3 inline mr-1" /> Locale
          </span>
          <LocalePicker
            locales={locs}
            activeId={activeId ?? locs[0]?.id}
            onSelect={setActiveId}
            trailing={
              <button
                onClick={() => setAddOpen(true)}
                className="rounded-lg border border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xs px-2 py-1.5 flex items-center justify-center gap-1"
              >
                <Plus className="h-3 w-3" /> {t.subscriptions.addLocale}
              </button>
            }
          />
        </div>

        {current && (
          <LocalizationEditor
            key={current.id}
            accountId={accountId}
            subId={subId}
            localization={current}
          />
        )}
      </CardContent>

      {addOpen && (
        <AddSubLocaleModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          accountId={accountId}
          subId={subId}
          existingLocales={locs.map((localization) => localization.attributes?.locale).filter((locale): locale is string => !!locale)}
          defaultName={current?.attributes?.name ?? locs[0]?.attributes?.name ?? undefined}
          sourceName={current?.attributes?.name ?? locs[0]?.attributes?.name ?? undefined}
          sourceDescription={current?.attributes?.description ?? locs[0]?.attributes?.description ?? undefined}
        />
      )}
    </Card>
  );
}

function LocalizationEditor({
  accountId,
  subId,
  localization,
}: {
  accountId: string;
  subId: string;
  localization: SubscriptionLocalization;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [name, setName] = useState(localization.attributes?.name ?? "");
  const [description, setDescription] = useState(localization.attributes?.description ?? "");
  const dirty = name !== (localization.attributes?.name ?? "")
    || description !== (localization.attributes?.description ?? "");

  const save = useMutation({
    mutationFn: async () => {
      await ascFetch(`v1/subscriptionLocalizations/${localization.id}`, {
        accountId,
        method: "PATCH",
        body: {
          data: {
            id: localization.id,
            type: "subscriptionLocalizations",
            attributes: { name: name || null, description: description || null },
          },
        },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asc", accountId, "subscription", subId, "localizations"] }),
  });

  return (
    <div className="space-y-4 pt-2 border-t border-[var(--border)]">
      <p className="text-xs text-[var(--muted-foreground)]">
        {localeName(localization.attributes?.locale ?? "")} · <span className="font-mono">{localization.attributes?.locale}</span>
      </p>

      <FieldRow label={t.subscriptions.name} max={NAME_MAX}>
        <Input value={name} maxLength={NAME_MAX} onChange={(event) => setName(event.target.value)} />
      </FieldRow>

      <FieldRow label={t.subscriptions.descriptionLabel} max={DESC_MAX}>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={DESC_MAX}
          rows={3}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] resize-y"
        />
      </FieldRow>

      <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
        {save.isError && <p className="text-xs text-[var(--destructive)] self-center mr-auto">{(save.error as Error).message}</p>}
        {save.isSuccess && !dirty && <p className="text-xs text-green-600 self-center mr-auto">{t.common.saved}</p>}
        <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          <Save className="h-4 w-4" />
          {save.isPending ? t.subscriptions.savingLoc : t.subscriptions.saveLoc}
        </Button>
      </div>
    </div>
  );
}

function FieldRow({ label, max, children }: { label: string; max: number; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-[var(--muted-foreground)]">Max {max}</span>
      </div>
      {children}
    </div>
  );
}
