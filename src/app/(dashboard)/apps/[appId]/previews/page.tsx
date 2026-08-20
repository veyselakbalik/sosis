"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Film, Plus, Trash2, UploadCloud } from "lucide-react";
import { useVersions, useVersionLocalizations } from "@/hooks/use-asc";
import { useActiveAccountId } from "@/hooks/use-active-account";
import { ascFetch } from "@/lib/asc-client-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LocalePicker } from "@/components/locale-picker";
import { useT } from "@/components/i18n-provider";
import { interpolate } from "@/lib/i18n/dict";
import type { AscListResponse, AscResource } from "@/lib/asc/types";

const PREVIEW_TYPES = [
  "IPHONE_65",
  "IPHONE_58",
  "IPHONE_55",
  "IPAD_PRO_3GEN_129",
  "IPAD_PRO_3GEN_11",
  "IPAD_PRO_129",
  "DESKTOP",
  "APPLE_TV",
  "WATCH_SERIES_4",
  "WATCH_SERIES_3",
];

type PreviewSet = AscResource<{ previewType: string }, { appPreviews?: { data?: Array<{ id: string }> } }>;
type Preview = AscResource<{
  fileName?: string;
  fileSize?: number;
  videoDeliveryState?: { state?: string } | null;
  assetDeliveryState?: { state?: string } | null;
  previewImage?: { templateUrl?: string; width?: number; height?: number } | null;
}>;

export default function PreviewsPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = use(params);
  const accountId = useActiveAccountId();
  const t = useT();
  const { data: versions } = useVersions(accountId, appId);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const versionId = selectedVersionId ?? versions?.data[0]?.id ?? null;
  const { data: locs } = useVersionLocalizations(accountId, versionId);
  const [selectedLocaleId, setSelectedLocaleId] = useState<string | null>(null);
  const localeId = selectedLocaleId ?? (locs?.find((l) => l.attributes?.locale?.startsWith("en")) ?? locs?.[0])?.id ?? null;
  const [previewType, setPreviewType] = useState(PREVIEW_TYPES[0]);

  const activeVersion = versions?.data.find((v) => v.id === versionId);
  const activeLocale = locs?.find((l) => l.id === localeId);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] mb-2 block">{t.metadata.version}</Label>
            <div className="flex flex-wrap gap-2">
              {versions?.data.slice(0, 10).map((v) => (
                <button
                  key={v.id}
                  onClick={() => { setSelectedVersionId(v.id); setSelectedLocaleId(null); }}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${v.id === versionId ? "border-[var(--foreground)] bg-[var(--muted)]" : "border-[var(--border)] hover:bg-[var(--muted)]"}`}
                >
                  {v.attributes?.versionString}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] mb-2 block">{t.previews.locale}</Label>
            {locs && locs.length > 0 ? (
              <LocalePicker
                locales={locs}
                activeId={localeId}
                onSelect={setSelectedLocaleId}
              />
            ) : (
              <p className="text-xs text-[var(--muted-foreground)]">{t.previews.noLocale}</p>
            )}
          </div>
          {activeVersion && activeLocale && (
            <p className="text-xs text-[var(--muted-foreground)]">Editing previews for {activeVersion.attributes?.versionString} / {activeLocale.attributes?.locale}</p>
          )}
        </CardContent>
      </Card>

      {accountId && localeId && (
        <>
          <PreviewSets accountId={accountId} localizationId={localeId} />
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> {t.previews.createSet}</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label>{t.previews.previewType}</Label>
                <select value={previewType} onChange={(e) => setPreviewType(e.target.value)} className="h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm">
                  {PREVIEW_TYPES.map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <CreatePreviewSetButton accountId={accountId} localizationId={localeId} previewType={previewType} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function PreviewSets({ accountId, localizationId }: { accountId: string; localizationId: string }) {
  const qc = useQueryClient();
  const t = useT();
  const { data, error } = useQuery<AscListResponse<PreviewSet>>({
    queryKey: ["asc", accountId, "loc", localizationId, "previewSets"],
    queryFn: () => ascFetch(`v1/appStoreVersionLocalizations/${localizationId}/appPreviewSets?limit=50&include=appPreviews`, { accountId }),
  });
  const previewsById = new Map<string, Preview>();
  for (const inc of data?.included ?? []) {
    if (inc.type === "appPreviews") previewsById.set(inc.id, inc as unknown as Preview);
  }
  const remove = useMutation({
    mutationFn: (id: string) => ascFetch(`v1/appPreviews/${id}`, { accountId, method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asc", accountId, "loc", localizationId, "previewSets"] }),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Film className="h-4 w-4" /> {t.previews.sectionTitle}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-[var(--destructive)]">{(error as Error).message}</p>}
        {(data?.data ?? []).map((set) => {
          const ids = set.relationships?.appPreviews?.data ?? [];
          const previews = ids.map((r) => previewsById.get(r.id)).filter(Boolean) as Preview[];
          return (
            <div key={set.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{set.attributes?.previewType ?? set.id}</Badge>
                <span className="text-xs text-[var(--muted-foreground)]">{interpolate(t.previews.setLabel, { n: previews.length })}</span>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {previews.map((p) => (
                  <div key={p.id} className="rounded-lg border border-[var(--border)] p-3 text-sm space-y-2">
                    <p className="font-medium truncate">{p.attributes?.fileName ?? p.id}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{p.attributes?.videoDeliveryState?.state ?? p.attributes?.assetDeliveryState?.state ?? t.previews.videoState}</p>
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(p.id)}><Trash2 className="h-4 w-4 text-[var(--destructive)]" /></Button>
                  </div>
                ))}
                <PreviewUpload accountId={accountId} setId={set.id} localizationId={localizationId} />
              </div>
            </div>
          );
        })}
        {data?.data.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">{t.previews.noSets}</p>}
      </CardContent>
    </Card>
  );
}

function CreatePreviewSetButton({ accountId, localizationId, previewType }: { accountId: string; localizationId: string; previewType: string }) {
  const qc = useQueryClient();
  const t = useT();
  const create = useMutation({
    mutationFn: () => ascFetch("v1/appPreviewSets", {
      accountId,
      method: "POST",
      body: {
        data: {
          type: "appPreviewSets",
          attributes: { previewType },
          relationships: { appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: localizationId } } },
        },
      },
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asc", accountId, "loc", localizationId, "previewSets"] }),
  });
  return <Button onClick={() => create.mutate()} disabled={create.isPending}><Plus className="h-4 w-4" /> {t.previews.create}</Button>;
}

function PreviewUpload({ accountId, setId, localizationId }: { accountId: string; setId: string; localizationId: string }) {
  const qc = useQueryClient();
  const t = useT();
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("previewSetId", setId);
      fd.append("file", file);
      const res = await fetch("/api/asc/previews/upload", { method: "POST", headers: { "x-easyapp-account": accountId }, body: fd });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.body?.errors?.[0]?.detail || e?.message || e?.error || `Upload ${res.status}`);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asc", accountId, "loc", localizationId, "previewSets"] }),
  });
  return (
    <label className="rounded-lg border-2 border-dashed border-[var(--border)] p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-[var(--muted)] text-sm text-[var(--muted-foreground)] min-h-28">
      <UploadCloud className="h-5 w-5" />
      <span>{upload.isPending ? t.previews.uploadingVideo : t.previews.uploadVideo}</span>
      <input
        type="file"
        className="hidden"
        accept=".mov,.mp4,video/quicktime,video/mp4"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file);
          e.currentTarget.value = "";
        }}
      />
      {upload.isError && <span className="text-[10px] text-[var(--destructive)] text-center">{(upload.error as Error).message}</span>}
    </label>
  );
}
