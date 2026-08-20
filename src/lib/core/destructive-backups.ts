import { createHash, randomUUID } from "node:crypto";
import { extname } from "node:path";
import { ascRequest, AscError } from "@/lib/asc/client";
import { uploadAppScreenshot } from "@/lib/asc/upload";
import {
  listBackupRecords,
  loadBackupAsset,
  loadBackupRecord,
  saveBackupAsset,
  saveBackupRecord,
  type BackupKind,
  type StoredBackupRecord,
} from "./backup-store";

const MAX_SCREENSHOT_BYTES = 50 * 1024 * 1024;

interface AscResource {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data?: Array<{ id: string; type: string }> | { id: string; type: string } | null }>;
}

interface AscSingle {
  data: AscResource;
}

interface AscList {
  data: AscResource[];
  included?: AscResource[];
}

interface ImageAsset {
  templateUrl: string;
  width: number;
  height: number;
}

interface ScreenshotDetails {
  screenshotSetId: string;
  screenshotDisplayType?: string;
  orderIndex: number;
  fileName: string;
  mediaType: "image/png" | "image/jpeg";
  byteLength: number;
  sha256: string;
  sourceFileChecksum?: string;
}

interface LocalizationDetails {
  parentId: string;
  attributes: Record<string, string | null>;
}

export interface BackupServices {
  request: typeof ascRequest;
  uploadScreenshot: typeof uploadAppScreenshot;
  saveRecord: typeof saveBackupRecord;
  loadRecord: typeof loadBackupRecord;
  listRecords: typeof listBackupRecords;
  saveAsset: typeof saveBackupAsset;
  loadAsset: typeof loadBackupAsset;
  downloadImage: (url: string) => Promise<{ data: Buffer; mediaType: "image/png" | "image/jpeg" }>;
}

function isAllowedAppleAssetUrl(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return host === "mzstatic.com" || host.endsWith(".mzstatic.com")
    || host === "apple.com" || host.endsWith(".apple.com")
    || host === "cdn-apple.com" || host.endsWith(".cdn-apple.com");
}

async function downloadAppleImage(initialUrl: string): Promise<{ data: Buffer; mediaType: "image/png" | "image/jpeg" }> {
  let current = new URL(initialUrl);
  for (let redirect = 0; redirect <= 3; redirect++) {
    if (!isAllowedAppleAssetUrl(current)) throw new Error("UNSAFE_BACKUP_ASSET_URL");
    const response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(30_000) });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === 3) throw new Error("BACKUP_ASSET_REDIRECT_FAILED");
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) throw new Error(`BACKUP_ASSET_DOWNLOAD_FAILED:${response.status}`);
    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_SCREENSHOT_BYTES) throw new Error("BACKUP_ASSET_TOO_LARGE");
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length === 0 || data.length > MAX_SCREENSHOT_BYTES) throw new Error("BACKUP_ASSET_INVALID_SIZE");
    const isPng = data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
    if (!isPng && !isJpeg) throw new Error("BACKUP_ASSET_INVALID_IMAGE");
    return { data, mediaType: isPng ? "image/png" : "image/jpeg" };
  }
  throw new Error("BACKUP_ASSET_DOWNLOAD_FAILED");
}

const defaultServices: BackupServices = {
  request: ascRequest,
  uploadScreenshot: uploadAppScreenshot,
  saveRecord: saveBackupRecord,
  loadRecord: loadBackupRecord,
  listRecords: listBackupRecords,
  saveAsset: saveBackupAsset,
  loadAsset: loadBackupAsset,
  downloadImage: downloadAppleImage,
};

function isNotFound(error: unknown): boolean {
  return error instanceof AscError && error.status === 404;
}

function imageUrl(asset: ImageAsset, fileName: string): string {
  const extension = extname(fileName).toLowerCase();
  const format = extension === ".jpg" || extension === ".jpeg" ? "jpg" : "png";
  const resolved = asset.templateUrl
    .replaceAll("{w}", String(asset.width))
    .replaceAll("{h}", String(asset.height))
    .replaceAll("{f}", format);
  if (resolved.includes("{")) throw new Error("SCREENSHOT_BACKUP_TEMPLATE_UNSUPPORTED");
  const url = new URL(resolved);
  if (!isAllowedAppleAssetUrl(url)) throw new Error("UNSAFE_BACKUP_ASSET_URL");
  return url.toString();
}

function asImageAsset(value: unknown): ImageAsset {
  if (!value || typeof value !== "object") throw new Error("SCREENSHOT_BACKUP_IMAGE_UNAVAILABLE");
  const candidate = value as Partial<ImageAsset>;
  if (typeof candidate.templateUrl !== "string"
    || typeof candidate.width !== "number"
    || typeof candidate.height !== "number") {
    throw new Error("SCREENSHOT_BACKUP_IMAGE_UNAVAILABLE");
  }
  return candidate as ImageAsset;
}

function relationshipIds(response: AscList, type: string): string[] {
  const includedIds = (response.included ?? []).filter((item) => item.type === type).map((item) => item.id);
  const relatedIds = response.data.flatMap((item) => Object.values(item.relationships ?? {}).flatMap((relationship) => {
    const data = relationship.data;
    if (Array.isArray(data)) return data.filter((entry) => entry.type === type).map((entry) => entry.id);
    return data?.type === type ? [data.id] : [];
  }));
  return [...new Set([...includedIds, ...relatedIds])];
}

export async function prepareScreenshotBackup(input: {
  accountId: string;
  screenshotId: string;
  screenshotSetId?: string;
  screenshotDisplayType?: string;
  orderIndex?: number;
}, services: BackupServices = defaultServices): Promise<StoredBackupRecord> {
  const screenshot = await services.request(input.accountId, {
    method: "GET",
    path: `/v1/appScreenshots/${input.screenshotId}`,
  }) as AscSingle;
  const attributes = screenshot.data.attributes ?? {};
  let screenshotSetId = input.screenshotSetId;
  if (!screenshotSetId) {
    const set = await services.request(input.accountId, {
      method: "GET",
      path: `/v1/appScreenshots/${input.screenshotId}/appScreenshotSet`,
    }) as AscSingle;
    screenshotSetId = set.data.id;
  }

  let orderIndex = input.orderIndex;
  if (orderIndex === undefined) {
    const current = await services.request(input.accountId, {
      method: "GET",
      path: `/v1/appScreenshotSets/${screenshotSetId}/appScreenshots`,
      query: { limit: 50 },
    }) as AscList;
    orderIndex = Math.max(0, current.data.findIndex((item) => item.id === input.screenshotId));
  }
  const fileName = typeof attributes.fileName === "string" && attributes.fileName.trim()
    ? attributes.fileName
    : `${input.screenshotId}.png`;
  const asset = asImageAsset(attributes.imageAsset);
  const downloaded = await services.downloadImage(imageUrl(asset, fileName));
  const backupId = `backup_${randomUUID()}`;
  const details: ScreenshotDetails = {
    screenshotSetId,
    screenshotDisplayType: input.screenshotDisplayType,
    orderIndex,
    fileName,
    mediaType: downloaded.mediaType,
    byteLength: downloaded.data.length,
    sha256: createHash("sha256").update(downloaded.data).digest("hex"),
    sourceFileChecksum: typeof attributes.sourceFileChecksum === "string"
      ? attributes.sourceFileChecksum
      : undefined,
  };
  const record: StoredBackupRecord = {
    id: backupId,
    kind: "app-screenshot",
    accountId: input.accountId,
    resourceId: input.screenshotId,
    createdAt: new Date().toISOString(),
    status: "ready",
    details: details as unknown as Record<string, unknown>,
  };
  await services.saveAsset(backupId, downloaded.data);
  await services.saveRecord(record);
  return record;
}

export async function markBackupSourceDeleted(
  backupId: string,
  services: BackupServices = defaultServices,
): Promise<StoredBackupRecord> {
  const record = await services.loadRecord(backupId);
  const updated = { ...record, sourceDeletedAt: new Date().toISOString() };
  await services.saveRecord(updated);
  return updated;
}

export async function deleteScreenshotWithBackup(input: {
  accountId: string;
  screenshotId: string;
}, services: BackupServices = defaultServices): Promise<StoredBackupRecord> {
  const backup = await prepareScreenshotBackup(input, services);
  await services.request(input.accountId, {
    method: "DELETE",
    path: `/v1/appScreenshots/${input.screenshotId}`,
  });
  return markBackupSourceDeleted(backup.id, services);
}

function screenshotDetails(record: StoredBackupRecord): ScreenshotDetails {
  if (record.kind !== "app-screenshot") throw new Error("UNSUPPORTED_BACKUP_KIND");
  const details = record.details as unknown as Partial<ScreenshotDetails>;
  if (typeof details.screenshotSetId !== "string"
    || typeof details.orderIndex !== "number"
    || typeof details.fileName !== "string"
    || typeof details.sha256 !== "string") throw new Error("BACKUP_RECORD_INVALID");
  return details as ScreenshotDetails;
}

async function resourceExists(
  accountId: string,
  path: string,
  services: BackupServices,
): Promise<boolean> {
  try {
    await services.request(accountId, { method: "GET", path });
    return true;
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
}

export async function restoreScreenshotBackup(input: {
  backupId: string;
  screenshotSetId?: string;
}, services: BackupServices = defaultServices): Promise<{
  record: StoredBackupRecord;
  screenshotId: string;
}> {
  let record = await services.loadRecord(input.backupId);
  const details = screenshotDetails(record);
  const targetSetId = input.screenshotSetId ?? details.screenshotSetId;
  const data = await services.loadAsset(record.id);
  if (createHash("sha256").update(data).digest("hex") !== details.sha256) {
    throw new Error("BACKUP_ASSET_CHECKSUM_MISMATCH");
  }

  let screenshotId = record.restoredResourceId;
  if (screenshotId && !await resourceExists(record.accountId, `/v1/appScreenshots/${screenshotId}`, services)) {
    screenshotId = undefined;
  }
  if (!screenshotId) {
    const upload = await services.uploadScreenshot({
      accountId: record.accountId,
      screenshotSetId: targetSetId,
      fileName: details.fileName,
      fileBuffer: data,
    });
    screenshotId = upload.id;
    record = {
      ...record,
      restoredResourceId: screenshotId,
      details: { ...record.details, restoredToScreenshotSetId: targetSetId },
    };
    await services.saveRecord(record);
  }

  const current = await services.request(record.accountId, {
    method: "GET",
    path: `/v1/appScreenshotSets/${targetSetId}/appScreenshots`,
    query: { limit: 50 },
  }) as AscList;
  const order = current.data.map((item) => item.id).filter((id) => id !== screenshotId);
  order.splice(Math.min(details.orderIndex, order.length), 0, screenshotId);
  await services.request(record.accountId, {
    method: "PATCH",
    path: `/v1/appScreenshotSets/${targetSetId}/relationships/appScreenshots`,
    body: { data: order.map((id) => ({ type: "appScreenshots", id })) },
  });
  if (!await resourceExists(record.accountId, `/v1/appScreenshots/${screenshotId}`, services)) {
    throw new Error("BACKUP_RESTORE_VERIFICATION_FAILED");
  }
  const restored: StoredBackupRecord = {
    ...record,
    status: "restored",
    restoredAt: new Date().toISOString(),
    restoredResourceId: screenshotId,
  };
  await services.saveRecord(restored);
  return { record: restored, screenshotId };
}

const localizationPolicies = {
  "app-store-version-localization": {
    path: "appStoreVersionLocalizations",
    parentPath: "appStoreVersion",
    parentType: "appStoreVersions",
    fields: ["locale", "description", "keywords", "whatsNew", "promotionalText", "marketingUrl", "supportUrl"],
  },
  "subscription-localization": {
    path: "subscriptionLocalizations",
    parentPath: "subscription",
    parentType: "subscriptions",
    fields: ["locale", "name", "description"],
  },
} as const;

type DeletableLocalizationKind = keyof typeof localizationPolicies;

async function assertVersionLocalizationHasNoMedia(
  accountId: string,
  localizationId: string,
  services: BackupServices,
): Promise<void> {
  const screenshotSets = await services.request(accountId, {
    method: "GET",
    path: `/v1/appStoreVersionLocalizations/${localizationId}/appScreenshotSets`,
    query: { limit: 50, include: "appScreenshots" },
  }) as AscList;
  if (relationshipIds(screenshotSets, "appScreenshots").length > 0) {
    throw new Error("LOCALIZATION_HAS_SCREENSHOTS: Delete them with backed-up screenshot tools first.");
  }
  const previewSets = await services.request(accountId, {
    method: "GET",
    path: `/v1/appStoreVersionLocalizations/${localizationId}/appPreviewSets`,
    query: { limit: 50, include: "appPreviews" },
  }) as AscList;
  if (relationshipIds(previewSets, "appPreviews").length > 0) {
    throw new Error("LOCALIZATION_HAS_APP_PREVIEWS: Automatic video backup is unavailable; keep the localization.");
  }
}

export async function prepareLocalizationBackup(input: {
  kind: DeletableLocalizationKind;
  accountId: string;
  localizationId: string;
}, services: BackupServices = defaultServices): Promise<StoredBackupRecord> {
  const policy = localizationPolicies[input.kind];
  if (input.kind === "app-store-version-localization") {
    await assertVersionLocalizationHasNoMedia(input.accountId, input.localizationId, services);
  }
  const [resource, parent] = await Promise.all([
    services.request(input.accountId, {
      method: "GET",
      path: `/v1/${policy.path}/${input.localizationId}`,
    }) as Promise<AscSingle>,
    services.request(input.accountId, {
      method: "GET",
      path: `/v1/${policy.path}/${input.localizationId}/${policy.parentPath}`,
    }) as Promise<AscSingle>,
  ]);
  const attributes = Object.fromEntries(policy.fields.map((field) => {
    const value = resource.data.attributes?.[field];
    return [field, typeof value === "string" ? value : null];
  }));
  const backupKind: BackupKind = input.kind;
  const details: LocalizationDetails = { parentId: parent.data.id, attributes };
  const record: StoredBackupRecord = {
    id: `backup_${randomUUID()}`,
    kind: backupKind,
    accountId: input.accountId,
    resourceId: input.localizationId,
    createdAt: new Date().toISOString(),
    status: "ready",
    details: details as unknown as Record<string, unknown>,
  };
  await services.saveRecord(record);
  return record;
}

export async function deleteLocalizationWithBackup(input: {
  kind: DeletableLocalizationKind;
  accountId: string;
  localizationId: string;
}, services: BackupServices = defaultServices): Promise<StoredBackupRecord> {
  const record = await prepareLocalizationBackup(input, services);
  const policy = localizationPolicies[input.kind];
  await services.request(input.accountId, {
    method: "DELETE",
    path: `/v1/${policy.path}/${input.localizationId}`,
  });
  return markBackupSourceDeleted(record.id, services);
}

function localizationDetails(record: StoredBackupRecord): LocalizationDetails {
  const details = record.details as unknown as Partial<LocalizationDetails>;
  if (typeof details.parentId !== "string" || !details.attributes || typeof details.attributes !== "object") {
    throw new Error("BACKUP_RECORD_INVALID");
  }
  return details as LocalizationDetails;
}

export async function restoreLocalizationBackup(
  backupId: string,
  services: BackupServices = defaultServices,
): Promise<{ record: StoredBackupRecord; localizationId: string }> {
  let record = await services.loadRecord(backupId);
  if (record.kind !== "app-store-version-localization" && record.kind !== "subscription-localization") {
    throw new Error("UNSUPPORTED_BACKUP_KIND");
  }
  const policy = localizationPolicies[record.kind];
  const details = localizationDetails(record);
  let localizationId = record.restoredResourceId;
  if (localizationId && !await resourceExists(record.accountId, `/v1/${policy.path}/${localizationId}`, services)) {
    localizationId = undefined;
  }
  if (!localizationId) {
    const created = await services.request(record.accountId, {
      method: "POST",
      path: `/v1/${policy.path}`,
      body: {
        data: {
          type: policy.path,
          attributes: details.attributes,
          relationships: {
            [policy.parentPath]: { data: { type: policy.parentType, id: details.parentId } },
          },
        },
      },
    }) as AscSingle;
    localizationId = created.data.id;
    record = { ...record, restoredResourceId: localizationId };
    await services.saveRecord(record);
  }
  const verified = await services.request(record.accountId, {
    method: "GET",
    path: `/v1/${policy.path}/${localizationId}`,
  }) as AscSingle;
  for (const [field, expected] of Object.entries(details.attributes)) {
    const actual = typeof verified.data.attributes?.[field] === "string" ? verified.data.attributes[field] : null;
    if (actual !== expected) throw new Error(`BACKUP_RESTORE_VERIFICATION_FAILED:${field}`);
  }
  const restored: StoredBackupRecord = {
    ...record,
    status: "restored",
    restoredAt: new Date().toISOString(),
    restoredResourceId: localizationId,
  };
  await services.saveRecord(restored);
  return { record: restored, localizationId };
}

export async function restoreBackup(
  backupId: string,
  services: BackupServices = defaultServices,
): Promise<unknown> {
  const record = await services.loadRecord(backupId);
  return record.kind === "app-screenshot"
    ? restoreScreenshotBackup({ backupId }, services)
    : restoreLocalizationBackup(backupId, services);
}

export { listBackupRecords };
