import assert from "node:assert/strict";
import test from "node:test";
import { AscError, type ascRequest } from "@/lib/asc/client";
import type { ScreenshotUploadInput } from "@/lib/asc/upload";
import type { StoredBackupRecord } from "./backup-store";
import {
  deleteLocalizationWithBackup,
  deleteScreenshotWithBackup,
  restoreLocalizationBackup,
  restoreScreenshotBackup,
  type BackupServices,
} from "./destructive-backups";

function testServices(options: { hasPreview?: boolean } = {}) {
  const records = new Map<string, StoredBackupRecord>();
  const assets = new Map<string, Buffer>();
  const screenshots = new Map<string, Record<string, unknown>>([
    ["shot_a", { fileName: "a.png" }],
    ["shot_1", {
      fileName: "screen.png",
      sourceFileChecksum: "source-md5",
      imageAsset: {
        templateUrl: "https://is1-ssl.mzstatic.com/image/{w}x{h}.{f}",
        width: 1290,
        height: 2796,
      },
    }],
    ["shot_b", { fileName: "b.png" }],
  ]);
  let screenshotOrder = ["shot_a", "shot_1", "shot_b"];
  let localization: { id: string; attributes: Record<string, unknown> } | null = {
    id: "loc_1",
    attributes: {
      locale: "en-US",
      description: "Original",
      keywords: "safe,keywords",
      whatsNew: null,
      promotionalText: null,
      marketingUrl: null,
      supportUrl: "https://example.com/support",
    },
  };
  let uploadIndex = 0;

  const request: typeof ascRequest = async (_accountId, req) => {
    if (req.path === "/v1/appScreenshots/shot_1" && req.method === "DELETE") {
      screenshots.delete("shot_1");
      screenshotOrder = screenshotOrder.filter((id) => id !== "shot_1");
      return null;
    }
    if (req.path.startsWith("/v1/appScreenshots/") && !req.path.endsWith("/appScreenshotSet")) {
      const id = req.path.split("/").at(-1)!;
      const attributes = screenshots.get(id);
      if (!attributes) throw new AscError(404, null);
      return { data: { id, type: "appScreenshots", attributes } };
    }
    if (req.path.endsWith("/appScreenshotSet")) {
      return { data: { id: "set_1", type: "appScreenshotSets", attributes: { screenshotDisplayType: "APP_IPHONE_67" } } };
    }
    if (req.path === "/v1/appScreenshotSets/set_1/appScreenshots") {
      return { data: screenshotOrder.map((id) => ({ id, type: "appScreenshots", attributes: screenshots.get(id) })) };
    }
    if (req.path === "/v1/appScreenshotSets/set_1/relationships/appScreenshots" && req.method === "PATCH") {
      const body = req.body as { data?: Array<{ id: string }> };
      screenshotOrder = (body.data ?? []).map((entry) => entry.id);
      return null;
    }
    if (req.path === "/v1/appStoreVersionLocalizations/loc_1/appScreenshotSets") {
      return { data: [], included: [] };
    }
    if (req.path === "/v1/appStoreVersionLocalizations/loc_1/appPreviewSets") {
      return options.hasPreview
        ? { data: [{ id: "preview_set", type: "appPreviewSets", relationships: { appPreviews: { data: [{ id: "preview_1", type: "appPreviews" }] } } }], included: [] }
        : { data: [], included: [] };
    }
    if (req.path === "/v1/appStoreVersionLocalizations/loc_1/appStoreVersion") {
      return { data: { id: "version_1", type: "appStoreVersions" } };
    }
    if (req.path === "/v1/appStoreVersionLocalizations/loc_1" && req.method === "DELETE") {
      localization = null;
      return null;
    }
    if (req.path === "/v1/appStoreVersionLocalizations/loc_1") {
      if (!localization) throw new AscError(404, null);
      return { data: { id: localization.id, type: "appStoreVersionLocalizations", attributes: { ...localization.attributes } } };
    }
    if (req.path === "/v1/appStoreVersionLocalizations" && req.method === "POST") {
      const body = req.body as { data?: { attributes?: Record<string, unknown> } };
      localization = { id: "loc_restored", attributes: { ...(body.data?.attributes ?? {}) } };
      return { data: { id: localization.id, type: "appStoreVersionLocalizations", attributes: localization.attributes } };
    }
    if (req.path === "/v1/appStoreVersionLocalizations/loc_restored") {
      if (!localization) throw new AscError(404, null);
      return { data: { id: localization.id, type: "appStoreVersionLocalizations", attributes: { ...localization.attributes } } };
    }
    throw new Error(`Unexpected request ${req.method} ${req.path}`);
  };

  const services: BackupServices = {
    request,
    uploadScreenshot: async (input: ScreenshotUploadInput) => {
      const id = `shot_restored_${++uploadIndex}`;
      screenshots.set(id, { fileName: input.fileName });
      screenshotOrder.push(id);
      return { id };
    },
    saveRecord: async (record) => { records.set(record.id, structuredClone(record)); },
    loadRecord: async (id) => {
      const record = records.get(id);
      if (!record) throw new Error("BACKUP_NOT_FOUND");
      return structuredClone(record);
    },
    listRecords: async () => [...records.values()].map((record) => structuredClone(record)),
    saveAsset: async (id, data) => { assets.set(id, Buffer.from(data)); },
    loadAsset: async (id) => {
      const data = assets.get(id);
      if (!data) throw new Error("BACKUP_ASSET_NOT_FOUND");
      return Buffer.from(data);
    },
    downloadImage: async () => ({
      data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]),
      mediaType: "image/png",
    }),
  };
  return {
    services,
    records,
    screenshots,
    screenshotOrder: () => screenshotOrder,
    localization: () => localization,
  };
}

test("downloads and checksums a screenshot before deletion, then restores its order", async () => {
  const state = testServices();
  const backup = await deleteScreenshotWithBackup({
    accountId: "account_1",
    screenshotId: "shot_1",
  }, state.services);
  assert.ok(backup.sourceDeletedAt);
  assert.equal(state.screenshots.has("shot_1"), false);
  assert.deepEqual(state.screenshotOrder(), ["shot_a", "shot_b"]);

  const restored = await restoreScreenshotBackup({ backupId: backup.id }, state.services);
  assert.equal(restored.record.status, "restored");
  assert.deepEqual(state.screenshotOrder(), ["shot_a", restored.screenshotId, "shot_b"]);

  const repeated = await restoreScreenshotBackup({ backupId: backup.id }, state.services);
  assert.equal(repeated.screenshotId, restored.screenshotId);
  assert.equal(state.screenshotOrder().filter((id) => id === restored.screenshotId).length, 1);
});

test("backs up and recreates version localization metadata", async () => {
  const state = testServices();
  const backup = await deleteLocalizationWithBackup({
    kind: "app-store-version-localization",
    accountId: "account_1",
    localizationId: "loc_1",
  }, state.services);
  assert.equal(state.localization(), null);
  const restored = await restoreLocalizationBackup(backup.id, state.services);
  assert.equal(restored.localizationId, "loc_restored");
  assert.equal(state.localization()?.attributes.keywords, "safe,keywords");
});

test("refuses localization deletion when an App Preview cannot be backed up", async () => {
  const state = testServices({ hasPreview: true });
  await assert.rejects(deleteLocalizationWithBackup({
    kind: "app-store-version-localization",
    accountId: "account_1",
    localizationId: "loc_1",
  }, state.services), /LOCALIZATION_HAS_APP_PREVIEWS/);
  assert.ok(state.localization());
  assert.equal(state.records.size, 0);
});
