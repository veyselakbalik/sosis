"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { ImageIcon, Trash2, UploadCloud, Loader2, AlertCircle, GripVertical, Save, RotateCcw, FolderUp, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ascFetch } from "@/lib/asc-client-fetch";
import { ScreenshotDirectoryUpload } from "@/components/screenshot-directory-upload";
import { useT } from "@/components/i18n-provider";
import { interpolate } from "@/lib/i18n/dict";
import type { AppStoreVersionLocalization, AscListResponse, AscResource } from "@/lib/asc/types";

interface ScreenshotSetAttrs {
  screenshotDisplayType: string;
}
interface ScreenshotAttrs {
  fileName: string;
  fileSize: number;
  imageAsset?: {
    templateUrl: string;
    width: number;
    height: number;
  } | null;
  assetDeliveryState?: { state: string } | null;
  uploadOperations?: unknown;
}

type ScreenshotSet = AscResource<ScreenshotSetAttrs, { appScreenshots?: { data?: Array<{ id: string }> } }>;
type Screenshot = AscResource<ScreenshotAttrs>;

const DISPLAY_TYPE_LABELS: Record<string, string> = {
  APP_IPHONE_67: "iPhone 6.7\"",
  APP_IPHONE_69: "iPhone 6.9\"",
  APP_IPHONE_61: "iPhone 6.1\"",
  APP_IPHONE_65: "iPhone 6.5\"",
  APP_IPHONE_58: "iPhone 5.8\"",
  APP_IPHONE_55: "iPhone 5.5\"",
  APP_IPHONE_47: "iPhone 4.7\"",
  APP_IPHONE_40: "iPhone 4\"",
  APP_IPHONE_35: "iPhone 3.5\"",
  APP_IPAD_PRO_3GEN_129: "iPad Pro 12.9\" (3rd+)",
  APP_IPAD_PRO_129: "iPad Pro 12.9\"",
  APP_IPAD_PRO_3GEN_11: "iPad Pro 11\"",
  APP_IPAD_105: "iPad 10.5\"",
  APP_IPAD_97: "iPad 9.7\"",
  APP_DESKTOP: "Mac",
  APP_APPLE_TV: "Apple TV",
  APP_APPLE_VISION_PRO: "Vision Pro",
  APP_WATCH_ULTRA: "Apple Watch Ultra",
  APP_WATCH_SERIES_10: "Apple Watch S10",
  APP_WATCH_SERIES_7: "Apple Watch S7+",
  APP_WATCH_SERIES_4: "Apple Watch S4-6",
  APP_WATCH_SERIES_3: "Apple Watch S3",
};

function displayLabel(t: string): string {
  return DISPLAY_TYPE_LABELS[t] ?? t.replace(/^APP_/, "").replace(/_/g, " ");
}

function imageUrl(asset: ScreenshotAttrs["imageAsset"], maxW = 400): string | null {
  if (!asset?.templateUrl) return null;
  const w = Math.min(asset.width, maxW);
  const h = Math.round((asset.height / asset.width) * w);
  return asset.templateUrl.replace("{w}", String(w)).replace("{h}", String(h)).replace("{f}", "png");
}

export function ScreenshotsPanel({
  accountId,
  localizationId,
  localizations,
}: {
  accountId: string;
  localizationId: string;
  localizations?: AppStoreVersionLocalization[];
}) {
  const qc = useQueryClient();
  const t = useT();
  const [bulkOpen, setBulkOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["asc", accountId, "loc", localizationId, "screenshotSets"],
    queryFn: async () => {
      const r = await ascFetch<AscListResponse<ScreenshotSet>>(
        `v1/appStoreVersionLocalizations/${localizationId}/appScreenshotSets?limit=50&include=appScreenshots`,
        { accountId },
      );
      return r;
    },
  });

  const sets = data?.data ?? [];
  const screenshotsById = new Map<string, Screenshot>();
  for (const inc of data?.included ?? []) {
    if (inc.type === "appScreenshots") screenshotsById.set(inc.id, inc as unknown as Screenshot);
  }

  const canBulk = !!localizations && localizations.length > 0;

  function invalidateAllLocaleSets() {
    if (!localizations) return;
    for (const loc of localizations) {
      qc.invalidateQueries({ queryKey: ["asc", accountId, "loc", loc.id, "screenshotSets"] });
    }
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><ImageIcon className="h-4 w-4" /> {t.screenshots.title}</h3>
            <p className="text-xs text-[var(--muted-foreground)]">{t.screenshots.subtitle}</p>
          </div>
          <div className="flex items-center gap-1">
            {canBulk && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkOpen(true)}
                title={t.screenshots.bulkTooltip}
              >
                <FolderUp className="h-4 w-4" /> {t.screenshots.bulkButton}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ["asc", accountId, "loc", localizationId, "screenshotSets"] })}
            >
              {t.screenshots.refresh}
            </Button>
          </div>
        </div>

        {isLoading && <p className="text-sm text-[var(--muted-foreground)]">{t.screenshots.loading}</p>}
        {error && (
          <p className="text-sm text-[var(--destructive)] flex items-center gap-1"><AlertCircle className="h-4 w-4" /> {(error as Error).message}</p>
        )}
        {data && sets.length === 0 && (
          <div className="text-center py-8 text-sm text-[var(--muted-foreground)] border border-dashed border-[var(--border)] rounded-lg">
            {t.screenshots.empty}
          </div>
        )}

        <div className="space-y-4">
          {sets.map((set) => {
            const shotIds = set.relationships?.appScreenshots?.data ?? [];
            const shots = shotIds.map((s) => screenshotsById.get(s.id)).filter(Boolean) as Screenshot[];
            return (
              <ScreenshotSetSection
                key={set.id}
                accountId={accountId}
                localizationId={localizationId}
                setId={set.id}
                displayType={set.attributes?.screenshotDisplayType ?? "?"}
                shots={shots}
              />
            );
          })}
        </div>
      </CardContent>

      {bulkOpen && canBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <FolderUp className="h-5 w-5" />
                <div>
                  <h2 className="font-semibold">{t.screenshots.bulkTitle}</h2>
                  <p className="text-xs text-[var(--muted-foreground)]">{interpolate(t.screenshots.bulkLocaleCount, { n: localizations!.length })}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setBulkOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <ScreenshotDirectoryUpload
                accountId={accountId}
                localizations={localizations!}
                onUploaded={invalidateAllLocaleSets}
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function ScreenshotSetSection({
  accountId,
  localizationId,
  setId,
  displayType,
  shots,
}: {
  accountId: string;
  localizationId: string;
  setId: string;
  displayType: string;
  shots: Screenshot[];
}) {
  const qc = useQueryClient();
  const t = useT();
  const [uploads, setUploads] = useState<Array<{ id: string; name: string; state: "uploading" | "ok" | "error"; error?: string }>>([]);
  const [orderedIds, setOrderedIds] = useState<string[]>(shots.map((s) => s.id));
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Reset local order whenever incoming `shots` change (e.g. after refetch).
  useEffect(() => {
    setOrderedIds(shots.map((s) => s.id));
  }, [shots]);

  const originalIds = shots.map((s) => s.id);
  const orderChanged = orderedIds.length === originalIds.length
    && orderedIds.some((id, i) => id !== originalIds[i]);

  function onDragStart(e: React.DragEvent<HTMLDivElement>, id: string) {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }
  function onDragOverItem(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }
  function onDropItem(e: React.DragEvent<HTMLDivElement>, targetId: string) {
    e.preventDefault();
    const sourceId = draggedId ?? e.dataTransfer.getData("text/plain");
    setDraggedId(null);
    if (!sourceId || sourceId === targetId) return;
    setOrderedIds((curr) => {
      const next = curr.filter((id) => id !== sourceId);
      const targetIdx = next.indexOf(targetId);
      if (targetIdx === -1) return curr;
      next.splice(targetIdx, 0, sourceId);
      return next;
    });
  }

  const saveOrder = useMutation({
    mutationFn: async () => {
      await ascFetch(`v1/appScreenshotSets/${setId}/relationships/appScreenshots`, {
        accountId,
        method: "PATCH",
        body: {
          data: orderedIds.map((id) => ({ type: "appScreenshots", id })),
        },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asc", accountId, "loc", localizationId, "screenshotSets"] }),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const tempId = Math.random().toString(36).slice(2);
      setUploads((u) => [...u, { id: tempId, name: file.name, state: "uploading" }]);
      try {
        const fd = new FormData();
        fd.append("screenshotSetId", setId);
        fd.append("file", file);
        const r = await fetch("/api/asc/screenshots/upload", {
          method: "POST",
          headers: { "x-easyapp-account": accountId },
          body: fd,
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          const msg = e?.body?.errors?.[0]?.detail || e?.body?.errors?.[0]?.title || e?.message || `Upload ${r.status}`;
          setUploads((u) => u.map((x) => x.id === tempId ? { ...x, state: "error", error: msg } : x));
          throw new Error(msg);
        }
        setUploads((u) => u.map((x) => x.id === tempId ? { ...x, state: "ok" } : x));
        await new Promise((r) => setTimeout(r, 800));
        setUploads((u) => u.filter((x) => x.id !== tempId));
      } catch (e) {
        throw e;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asc", accountId, "loc", localizationId, "screenshotSets"] }),
  });

  const onDrop = useCallback((accepted: File[]) => {
    for (const file of accepted) {
      upload.mutate(file);
    }
  }, [upload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] },
    multiple: true,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await ascFetch(`v1/appScreenshots/${id}`, { accountId, method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asc", accountId, "loc", localizationId, "screenshotSets"] }),
  });

  const byId = new Map(shots.map((s) => [s.id, s]));
  const orderedShots = orderedIds.map((id) => byId.get(id)).filter(Boolean) as Screenshot[];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline">{displayLabel(displayType)}</Badge>
        <span className="text-xs text-[var(--muted-foreground)]">{interpolate(t.screenshots.imagesCount, { n: orderedShots.length })}</span>
        {orderChanged && (
          <div className="ml-auto flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setOrderedIds(originalIds)}
              disabled={saveOrder.isPending}
              className="h-7 text-xs"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
            <Button
              size="sm"
              onClick={() => saveOrder.mutate()}
              disabled={saveOrder.isPending}
              className="h-7 text-xs"
            >
              <Save className="h-3 w-3" />
              {saveOrder.isPending ? "Saving…" : "Save order"}
            </Button>
          </div>
        )}
        {saveOrder.isError && (
          <span className="text-[10px] text-[var(--destructive)]">{(saveOrder.error as Error).message}</span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {orderedShots.map((s) => {
          const url = imageUrl(s.attributes?.imageAsset ?? null, 600);
          const state = s.attributes?.assetDeliveryState?.state;
          const processing = state && state !== "COMPLETE";
          const isDragging = draggedId === s.id;
          return (
            <div
              key={s.id}
              draggable={!processing}
              onDragStart={(e) => onDragStart(e, s.id)}
              onDragEnd={() => setDraggedId(null)}
              onDragOver={onDragOverItem}
              onDrop={(e) => onDropItem(e, s.id)}
              className={cn(
                "group relative rounded-lg overflow-hidden border bg-[var(--muted)] aspect-[9/19.5] transition-all",
                isDragging ? "opacity-30 border-[var(--accent)] scale-95" : "border-[var(--border)]",
                !processing && "cursor-grab active:cursor-grabbing hover:border-[var(--accent)]",
              )}
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={s.attributes?.fileName ?? ""} draggable={false} className="w-full h-full object-contain pointer-events-none" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  {processing ? <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" /> : <ImageIcon className="h-5 w-5 text-[var(--muted-foreground)]" />}
                </div>
              )}
              {!processing && (
                <div className="absolute top-1 left-1 p-1 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <GripVertical className="h-3 w-3" />
                </div>
              )}
              {processing && (
                <div className="absolute top-1 left-1">
                  <Badge variant="warning" className="text-[10px]">{state}</Badge>
                </div>
              )}
              <button
                onClick={() => {
                  if (confirm(t.screenshots.deleteConfirm)) remove.mutate(s.id);
                }}
                className="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--destructive)]"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}

        {uploads.map((u) => (
          <div key={u.id} className="rounded-lg overflow-hidden border border-dashed border-[var(--border)] aspect-[9/19.5] flex flex-col items-center justify-center gap-2 p-2 text-center">
            {u.state === "uploading" && <Loader2 className="h-5 w-5 animate-spin" />}
            {u.state === "error" && <AlertCircle className="h-5 w-5 text-[var(--destructive)]" />}
            <p className="text-[10px] truncate max-w-full">{u.name}</p>
            {u.state === "error" && <p className="text-[10px] text-[var(--destructive)]">{u.error}</p>}
          </div>
        ))}

        <div
          {...getRootProps()}
          className={cn(
            "rounded-lg border-2 border-dashed cursor-pointer aspect-[9/19.5] flex flex-col items-center justify-center gap-1 text-center p-2 transition-colors",
            isDragActive ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--muted)]",
          )}
        >
          <input {...getInputProps()} />
          <UploadCloud className="h-5 w-5 text-[var(--muted-foreground)]" />
          <p className="text-[10px] text-[var(--muted-foreground)]">{t.screenshots.pngJpgDrop}</p>
        </div>
      </div>
    </div>
  );
}
