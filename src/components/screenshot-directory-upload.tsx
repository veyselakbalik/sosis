"use client";

import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, UploadCloud } from "lucide-react";
import { ascFetch } from "@/lib/asc-client-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n-provider";
import { interpolate } from "@/lib/i18n/dict";
import type { AppStoreVersionLocalization, AscListResponse, AscResource } from "@/lib/asc/types";

type Layout = "display-locale" | "locale-display";

interface Props {
  accountId: string;
  localizations: AppStoreVersionLocalization[];
  onUploaded?: () => void;
}

interface ScreenshotSetAttrs {
  screenshotDisplayType: string;
}

type ScreenshotSet = AscResource<ScreenshotSetAttrs, { appScreenshots?: { data?: Array<{ id: string }> } }>;

type UploadFile = File;

interface PlanItem {
  key: string;
  localizationId: string;
  locale: string;
  displayType: string;
  displayFolder: string;
  localeFolder: string;
  files: UploadFile[];
}

interface Plan {
  items: PlanItem[];
  skipped: string[];
  warnings: string[];
}

const DISPLAY_ALIASES: Record<string, string> = {
  appiphone67: "APP_IPHONE_67",
  appiphone69: "APP_IPHONE_69",
  appiphone65: "APP_IPHONE_65",
  appiphone61: "APP_IPHONE_61",
  appiphone58: "APP_IPHONE_58",
  appiphone55: "APP_IPHONE_55",
  iphone67: "APP_IPHONE_67",
  iphone69: "APP_IPHONE_69",
  iphone65: "APP_IPHONE_65",
  iphone61: "APP_IPHONE_61",
  iphone58: "APP_IPHONE_58",
  iphone55: "APP_IPHONE_55",
  ipad129: "APP_IPAD_PRO_3GEN_129",
  ipadpro129: "APP_IPAD_PRO_3GEN_129",
  ipad11: "APP_IPAD_PRO_3GEN_11",
  ipadpro11: "APP_IPAD_PRO_3GEN_11",
  mac: "APP_DESKTOP",
  desktop: "APP_DESKTOP",
  appletv: "APP_APPLE_TV",
  visionpro: "APP_APPLE_VISION_PRO",
};

const LOCALE_ALIASES: Record<string, string> = {
  english: "en-US",
  en: "en-US",
  turkish: "tr",
  turkce: "tr",
  german: "de-DE",
  french: "fr-FR",
  spanish: "es-ES",
  italian: "it",
  japanese: "ja",
  korean: "ko",
  chinese: "zh-Hans",
  portuguese: "pt-BR",
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function normalize(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function resolveDisplayType(folder: string): string | null {
  const trimmed = folder.trim();
  if (/^APP_[A-Z0-9_]+$/.test(trimmed)) return trimmed;
  return DISPLAY_ALIASES[normalize(trimmed)] ?? null;
}

function resolveLocale(folder: string, locales: Array<{ id: string; locale: string }>) {
  const lowered = folder.trim().toLowerCase();
  const aliased = LOCALE_ALIASES[normalize(folder)];
  return locales.find((loc) => loc.locale.toLowerCase() === lowered)
    ?? (aliased ? locales.find((loc) => loc.locale.toLowerCase() === aliased.toLowerCase()) : undefined);
}

function isImage(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg");
}

function relativeParts(file: UploadFile): string[] {
  return (file.webkitRelativePath || file.name).split("/").filter(Boolean);
}

function buildPlan(files: UploadFile[], localizations: AppStoreVersionLocalization[], layout: Layout): Plan {
  const locales = localizations
    .map((loc) => ({ id: loc.id, locale: loc.attributes?.locale ?? "" }))
    .filter((loc) => loc.locale);
  const byKey = new Map<string, PlanItem>();
  const skipped: string[] = [];
  const warnings: string[] = [];

  for (const file of files) {
    if (!isImage(file)) {
      skipped.push(`${file.name}: not a PNG/JPG`);
      continue;
    }
    const parts = relativeParts(file);
    const offset = parts.length >= 4 ? 1 : 0;
    if (parts.length - offset < 3) {
      skipped.push(`${file.name}: expected <display>/<locale>/<file>`);
      continue;
    }
    const first = parts[offset];
    const second = parts[offset + 1];
    const displayFolder = layout === "display-locale" ? first : second;
    const localeFolder = layout === "display-locale" ? second : first;
    const displayType = resolveDisplayType(displayFolder);
    const locale = resolveLocale(localeFolder, locales);
    if (!displayType) {
      skipped.push(`${file.name}: unknown display folder "${displayFolder}"`);
      continue;
    }
    if (!locale) {
      skipped.push(`${file.name}: no localization matches "${localeFolder}"`);
      continue;
    }

    const key = `${locale.id}:${displayType}`;
    const item = byKey.get(key) ?? {
      key,
      localizationId: locale.id,
      locale: locale.locale,
      displayType,
      displayFolder,
      localeFolder,
      files: [],
    };
    item.files.push(file);
    byKey.set(key, item);
  }

  const items = [...byKey.values()].map((item) => ({
    ...item,
    files: item.files.sort((a, b) => collator.compare(a.name, b.name)),
  }));
  for (const item of items) {
    if (item.files.length > 10) {
      warnings.push(`${item.locale} / ${item.displayType}: ${item.files.length} files selected; App Store sets allow at most 10.`);
    }
  }
  return { items, skipped, warnings };
}

function screenshotIds(set: ScreenshotSet): string[] {
  return (set.relationships?.appScreenshots?.data ?? []).map((shot) => shot.id);
}

export function ScreenshotDirectoryUpload({ accountId, localizations, onUploaded }: Props) {
  const qc = useQueryClient();
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [layout, setLayout] = useState<Layout>("display-locale");
  const [clearExisting, setClearExisting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [failures, setFailures] = useState<string[]>([]);

  const plan = useMemo(() => buildPlan(files, localizations, layout), [files, localizations, layout]);
  const totalFiles = plan.items.reduce((sum, item) => sum + item.files.length, 0);

  async function uploadPlan() {
    setUploading(true);
    setFailures([]);
    setStatus("Preparing upload...");
    const nextFailures: string[] = [];

    for (const item of plan.items) {
      setStatus(`${item.locale} / ${item.displayType}`);
      try {
        const setsResp = await ascFetch<AscListResponse<ScreenshotSet>>(
          `v1/appStoreVersionLocalizations/${item.localizationId}/appScreenshotSets?limit=50&include=appScreenshots`,
          { accountId },
        );
        let set = setsResp.data.find((candidate) => candidate.attributes?.screenshotDisplayType === item.displayType);
        if (!set) {
          const created = await ascFetch<{ data: ScreenshotSet }>("v1/appScreenshotSets", {
            accountId,
            method: "POST",
            body: {
              data: {
                type: "appScreenshotSets",
                attributes: { screenshotDisplayType: item.displayType },
                relationships: {
                  appStoreVersionLocalization: {
                    data: { type: "appStoreVersionLocalizations", id: item.localizationId },
                  },
                },
              },
            },
          });
          set = created.data;
        }

        let existingIds = screenshotIds(set);
        const targetCount = (clearExisting ? 0 : existingIds.length) + item.files.length;
        if (targetCount > 10) {
          nextFailures.push(`${item.locale} / ${item.displayType}: would contain ${targetCount} screenshots.`);
          continue;
        }
        if (clearExisting) {
          for (const id of existingIds) {
            await ascFetch(`v1/appScreenshots/${id}`, { accountId, method: "DELETE" });
          }
          existingIds = [];
        }

        const uploadedIds: string[] = [];
        for (const file of item.files) {
          const form = new FormData();
          form.append("screenshotSetId", set.id);
          form.append("file", file);
          const res = await fetch("/api/asc/screenshots/upload", {
            method: "POST",
            headers: { "x-easyapp-account": accountId },
            body: form,
          });
          if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            nextFailures.push(`${item.locale} / ${file.name}: ${e?.body?.errors?.[0]?.detail || e?.message || e?.error || res.status}`);
            continue;
          }
          const body = await res.json() as { id?: string };
          if (body.id) uploadedIds.push(body.id);
        }

        if (uploadedIds.length > 0) {
          await ascFetch(`v1/appScreenshotSets/${set.id}/relationships/appScreenshots`, {
            accountId,
            method: "PATCH",
            body: {
              data: [...existingIds, ...uploadedIds].map((id) => ({ type: "appScreenshots", id })),
            },
          });
        }
        qc.invalidateQueries({ queryKey: ["asc", accountId, "loc", item.localizationId, "screenshotSets"] });
      } catch (e) {
        nextFailures.push(`${item.locale} / ${item.displayType}: ${(e as Error).message}`);
      }
    }

    setFailures(nextFailures);
    setStatus(nextFailures.length
      ? interpolate(t.screenshots.bulkIssues, { n: nextFailures.length })
      : interpolate(t.screenshots.bulkUploadedOk, { n: totalFiles }));
    setUploading(false);
    if (nextFailures.length === 0) onUploaded?.();
  }

  return (
    <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-[var(--muted-foreground)] flex-1 min-w-[200px]">
            {t.screenshots.bulkFolderHint}
          </p>
          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
            <UploadCloud className="h-4 w-4" /> {t.screenshots.bulkChooseFolder}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
            {...{ webkitdirectory: "", directory: "" }}
            onChange={(event) => {
              setFiles(Array.from(event.target.files ?? []) as UploadFile[]);
              setFailures([]);
              setStatus(null);
              event.currentTarget.value = "";
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <select
            value={layout}
            onChange={(e) => setLayout(e.target.value as Layout)}
            className="h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
            disabled={uploading}
          >
            <option value="display-locale">display / locale</option>
            <option value="locale-display">locale / display</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={clearExisting} onChange={(e) => setClearExisting(e.target.checked)} disabled={uploading} />
            {t.screenshots.bulkReplace}
          </label>
          <Badge variant="outline">{interpolate(t.screenshots.bulkSetsCount, { n: plan.items.length })}</Badge>
          <Badge variant="outline">{interpolate(t.screenshots.bulkFilesCount, { n: totalFiles })}</Badge>
          {status && <span className="text-xs text-[var(--muted-foreground)]">{status}</span>}
        </div>

        {plan.items.length > 0 && (
          <div className="max-h-48 overflow-auto rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
            {plan.items.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="truncate">{item.locale} / {item.displayType}</span>
                <span className="text-xs text-[var(--muted-foreground)]">{interpolate(t.screenshots.bulkFilesCount, { n: item.files.length })}</span>
              </div>
            ))}
          </div>
        )}

        {(plan.skipped.length > 0 || plan.warnings.length > 0 || failures.length > 0) && (
          <div className="space-y-1 text-xs text-[var(--muted-foreground)]">
            {[...plan.warnings, ...plan.skipped.slice(0, 6), ...failures.slice(0, 6)].map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={uploadPlan} disabled={uploading || totalFiles === 0 || plan.warnings.length > 0}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {uploading ? t.screenshots.bulkUploading : t.screenshots.bulkUploadBtn}
          </Button>
        </div>
    </div>
  );
}
