import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { backupAssetsDir, backupRecordsDir } from "@/lib/storage/paths";

export type BackupKind =
  | "app-screenshot"
  | "app-store-version-localization"
  | "subscription-localization";

export interface StoredBackupRecord {
  id: string;
  kind: BackupKind;
  accountId: string;
  resourceId: string;
  createdAt: string;
  status: "ready" | "restored" | "failed";
  details: Record<string, unknown>;
  sourceDeletedAt?: string;
  restoredAt?: string;
  restoredResourceId?: string;
  failure?: string;
}

function assertSafeId(id: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("INVALID_BACKUP_ID");
}

async function writeJsonAtomic(id: string, value: unknown): Promise<void> {
  assertSafeId(id);
  const directory = backupRecordsDir();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const target = join(directory, `${id}.json`);
  const temporary = join(directory, `.${id}.${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temporary, target);
}

export function saveBackupRecord(record: StoredBackupRecord): Promise<void> {
  return writeJsonAtomic(record.id, record);
}

export async function loadBackupRecord(id: string): Promise<StoredBackupRecord> {
  assertSafeId(id);
  try {
    return JSON.parse(await readFile(join(backupRecordsDir(), `${id}.json`), "utf8")) as StoredBackupRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error("BACKUP_NOT_FOUND");
    throw error;
  }
}

export async function listBackupRecords(filters: {
  accountId?: string;
  kind?: BackupKind;
  limit?: number;
} = {}): Promise<StoredBackupRecord[]> {
  let names: string[];
  try {
    names = await readdir(backupRecordsDir());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const limit = Math.max(1, Math.min(filters.limit ?? 50, 200));
  const records = await Promise.all(names
    .filter((name) => name.endsWith(".json") && !name.startsWith("."))
    .map(async (name) => JSON.parse(await readFile(join(backupRecordsDir(), name), "utf8")) as StoredBackupRecord));
  return records
    .filter((record) => !filters.accountId || record.accountId === filters.accountId)
    .filter((record) => !filters.kind || record.kind === filters.kind)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

function assetPath(id: string): string {
  assertSafeId(id);
  return join(backupAssetsDir(), `${id}.bin`);
}

export async function saveBackupAsset(id: string, data: Buffer): Promise<void> {
  assertSafeId(id);
  const directory = backupAssetsDir();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const target = assetPath(id);
  const temporary = join(directory, `.${id}.${randomUUID()}.tmp`);
  await writeFile(temporary, data, { mode: 0o600 });
  await rename(temporary, target);
}

export async function loadBackupAsset(id: string): Promise<Buffer> {
  try {
    return await readFile(assetPath(id));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error("BACKUP_ASSET_NOT_FOUND");
    throw error;
  }
}
