"use client";

import { use, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Globe, Plus } from "lucide-react";
import { useVersions, useVersionLocalizations } from "@/hooks/use-asc";
import { useActiveAccountId } from "@/hooks/use-active-account";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VersionStateBadge } from "@/components/version-badge";
import { ScreenshotsPanel } from "@/components/screenshots-panel";
import { AddLocaleModal } from "@/components/add-locale-modal";
import { AppInfoSection } from "@/components/app-info-section";
import { LocalePicker } from "@/components/locale-picker";
import { ascFetch } from "@/lib/asc-client-fetch";
import { useT } from "@/components/i18n-provider";
import { interpolate } from "@/lib/i18n/dict";
import type { AppStoreVersionLocalizationAttributes } from "@/lib/asc/types";

export default function MetadataPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = use(params);
  const accountId = useActiveAccountId();
  const qcMain = useQueryClient();
  const t = useT();
  const { data: versions, isLoading: vLoading } = useVersions(accountId, appId);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [addLocaleOpen, setAddLocaleOpen] = useState(false);
  const [deletingLocId, setDeletingLocId] = useState<string | null>(null);

  useEffect(() => {
    if (!versionId && versions?.data?.length) {
      const editable = versions.data.find((v) =>
        ["PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED"].includes(v.attributes?.appStoreState ?? ""),
      );
      setVersionId((editable ?? versions.data[0]).id);
    }
  }, [versions, versionId]);

  const { data: locs, isLoading: lLoading } = useVersionLocalizations(accountId, versionId);
  const [localeId, setLocaleId] = useState<string | null>(null);

  useEffect(() => {
    if (locs && !localeId) {
      const en = locs.find((l) => l.attributes?.locale?.startsWith("en"));
      setLocaleId((en ?? locs[0])?.id ?? null);
    }
  }, [locs, localeId]);

  if (vLoading) return <Card><CardContent className="p-6 text-sm text-[var(--muted-foreground)]">{t.common.loading}</CardContent></Card>;
  if (!versions || versions.data.length === 0) {
    return <Card><CardContent className="p-10 text-center text-[var(--muted-foreground)]">{t.metadata.noVersions}</CardContent></Card>;
  }

  const activeVersion = versions.data.find((v) => v.id === versionId);

  const activeLocale = locs?.find((l) => l.id === localeId)?.attributes?.locale;

  return (
    <div className="space-y-4">
      {accountId && (
        <AppInfoSection accountId={accountId} appId={appId} preferredLocale={activeLocale} />
      )}
      <Card>
        <CardContent className="p-4">
          <Label className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] mb-2 block">{t.metadata.version}</Label>
          <div className="flex items-center gap-2 flex-wrap">
            {versions.data.slice(0, 8).map((v) => (
              <button
                key={v.id}
                onClick={() => { setVersionId(v.id); setLocaleId(null); }}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  v.id === versionId ? "border-[var(--foreground)] bg-[var(--muted)]" : "border-[var(--border)] hover:bg-[var(--muted)]"
                }`}
              >
                <span className="font-mono">{v.attributes?.versionString}</span>
              </button>
            ))}
          </div>
          {activeVersion && (
            <div className="mt-2"><VersionStateBadge state={activeVersion.attributes?.appStoreState} /></div>
          )}
        </CardContent>
      </Card>

      {lLoading && <Card><CardContent className="p-6 text-sm text-[var(--muted-foreground)]">{t.metadata.loadingLocs}</CardContent></Card>}

      {locs && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                <Globe className="h-3 w-3 inline mr-1" /> {t.metadata.locale}
              </Label>
            </div>
            <LocalePicker
              locales={locs}
              activeId={localeId}
              onSelect={setLocaleId}
              deletingId={deletingLocId}
              onDelete={async (l) => {
                if (!confirm(interpolate(t.metadata.deleteLocalConfirm, { locale: l.attributes?.locale ?? "?" }))) return;
                setDeletingLocId(l.id);
                try {
                  await ascFetch(`v1/appStoreVersionLocalizations/${l.id}`, {
                    accountId: accountId!,
                    method: "DELETE",
                  });
                  if (localeId === l.id) setLocaleId(null);
                  qcMain.invalidateQueries({ queryKey: ["asc", accountId, "version", versionId, "localizations"] });
                } catch (e) {
                  alert(`${t.common.error}: ${(e as Error).message}`);
                } finally {
                  setDeletingLocId(null);
                }
              }}
              trailing={
                <button
                  onClick={() => setAddLocaleOpen(true)}
                  className="rounded-lg border border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xs px-2 py-1.5 flex items-center justify-center gap-1"
                >
                  <Plus className="h-3 w-3" /> {t.metadata.addLanguage}
                </button>
              }
            />
          </CardContent>
        </Card>
      )}

      {localeId && locs && (
        <LocaleEditor
          key={localeId}
          accountId={accountId!}
          versionId={versionId!}
          localizationId={localeId}
          initial={locs.find((l) => l.id === localeId)?.attributes ?? null}
        />
      )}

      {localeId && accountId && (
        <ScreenshotsPanel
          accountId={accountId}
          localizationId={localeId}
          localizations={locs}
        />
      )}

      {addLocaleOpen && accountId && versionId && locs && (
        <AddLocaleModal
          open={addLocaleOpen}
          onClose={() => setAddLocaleOpen(false)}
          accountId={accountId}
          versionId={versionId}
          existingLocales={locs.map((l) => l.attributes?.locale).filter((x): x is string => !!x)}
        />
      )}
    </div>
  );
}

function LocaleEditor({
  accountId,
  versionId,
  localizationId,
  initial,
}: {
  accountId: string;
  versionId: string;
  localizationId: string;
  initial: AppStoreVersionLocalizationAttributes | null;
}) {
  const qc = useQueryClient();
  const t = useT();
  const [form, setForm] = useState({
    description: initial?.description ?? "",
    keywords: initial?.keywords ?? "",
    whatsNew: initial?.whatsNew ?? "",
    promotionalText: initial?.promotionalText ?? "",
    marketingUrl: initial?.marketingUrl ?? "",
    supportUrl: initial?.supportUrl ?? "",
  });

  const dirty =
    form.description !== (initial?.description ?? "") ||
    form.keywords !== (initial?.keywords ?? "") ||
    form.whatsNew !== (initial?.whatsNew ?? "") ||
    form.promotionalText !== (initial?.promotionalText ?? "") ||
    form.marketingUrl !== (initial?.marketingUrl ?? "") ||
    form.supportUrl !== (initial?.supportUrl ?? "");

  const save = useMutation({
    mutationFn: async () => {
      await ascFetch(`v1/appStoreVersionLocalizations/${localizationId}`, {
        accountId,
        method: "PATCH",
        body: {
          data: {
            id: localizationId,
            type: "appStoreVersionLocalizations",
            attributes: {
              description: form.description || null,
              keywords: form.keywords || null,
              whatsNew: form.whatsNew || null,
              promotionalText: form.promotionalText || null,
              marketingUrl: form.marketingUrl || null,
              supportUrl: form.supportUrl || null,
            },
          },
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asc", accountId, "version", versionId, "localizations"] });
    },
  });

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <Field
          label={t.metadata.description}
          max={4000}
      >
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            maxLength={4000}
            rows={8}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] resize-y"
          />
        </Field>
        <Field
          label={t.metadata.whatsNew}
          max={4000}
        >
          <textarea
            value={form.whatsNew}
            onChange={(e) => setForm({ ...form, whatsNew: e.target.value })}
            maxLength={4000}
            rows={4}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] resize-y"
          />
        </Field>
        <Field
          label={t.metadata.keywordsHint}
          max={100}
        >
          <Input value={form.keywords} maxLength={100} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
        </Field>
        <Field
          label={t.metadata.promotionalText}
          max={170}
        >
          <textarea
            value={form.promotionalText}
            onChange={(e) => setForm({ ...form, promotionalText: e.target.value })}
            maxLength={170}
            rows={2}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] resize-y"
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{t.metadata.marketingUrl}</Label>
            <Input value={form.marketingUrl} onChange={(e) => setForm({ ...form, marketingUrl: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.metadata.supportUrl}</Label>
            <Input value={form.supportUrl} onChange={(e) => setForm({ ...form, supportUrl: e.target.value })} />
          </div>
        </div>
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Label>{label}</Label>
          {max && <span className="text-xs text-[var(--muted-foreground)]">Max {max}</span>}
        </div>
      </div>
      {children}
    </div>
  );
}
