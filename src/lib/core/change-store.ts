import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { changePlansDir, snapshotsDir } from "@/lib/storage/paths";

export type ProtectedTextChangeKind =
  | "app-store-version-localization"
  | "app-info-localization"
  | "subscription-localization"
  | "beta-build-localization"
  | "app-store-review-details";

export interface StoredChangePlan {
  id: string;
  kind: ProtectedTextChangeKind;
  accountId: string;
  resourceId: string;
  createdAt: string;
  expiresAt: string;
  status: "planned" | "applied" | "failed";
  changedFields: string[];
  before: Record<string, string | null>;
  after: Record<string, string | null>;
  beforeHash: string;
  snapshotId?: string;
  appliedAt?: string;
  failure?: string;
  restoresSnapshotId?: string;
  batchId?: string;
  locale?: string;
}

export interface StoredSnapshot {
  id: string;
  kind: ProtectedTextChangeKind;
  accountId: string;
  resourceId: string;
  planId: string;
  createdAt: string;
  status: "pending" | "applied" | "uncertain" | "failed";
  changedFields: string[];
  before: Record<string, string | null>;
  expectedAfter: Record<string, string | null>;
  actualAfter?: Record<string, string | null>;
  appliedAt?: string;
  restoredAt?: string;
  failure?: string;
  restorable?: boolean;
  nonRestorableReason?: string;
}

function assertSafeId(id: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("INVALID_CHANGE_ID");
}

async function writeJsonAtomic(directory: string, id: string, value: unknown): Promise<void> {
  assertSafeId(id);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const target = join(directory, `${id}.json`);
  const temporary = join(directory, `.${id}.${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temporary, target);
}

async function readJson<T>(directory: string, id: string): Promise<T> {
  assertSafeId(id);
  try {
    return JSON.parse(await readFile(join(directory, `${id}.json`), "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error("CHANGE_NOT_FOUND");
    throw error;
  }
}

async function listJson<T>(directory: string): Promise<T[]> {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const records = await Promise.all(
    names
      .filter((name) => name.endsWith(".json") && !name.startsWith("."))
      .map(async (name) => JSON.parse(await readFile(join(directory, name), "utf8")) as T),
  );
  return records;
}

export function saveChangePlan(plan: StoredChangePlan): Promise<void> {
  return writeJsonAtomic(changePlansDir(), plan.id, plan);
}

export function loadChangePlan(id: string): Promise<StoredChangePlan> {
  return readJson<StoredChangePlan>(changePlansDir(), id);
}

export async function listChangePlans(filters: {
  accountId?: string;
  batchId?: string;
  resourceId?: string;
} = {}): Promise<StoredChangePlan[]> {
  return (await listJson<StoredChangePlan>(changePlansDir()))
    .filter((plan) => !filters.accountId || plan.accountId === filters.accountId)
    .filter((plan) => !filters.batchId || plan.batchId === filters.batchId)
    .filter((plan) => !filters.resourceId || plan.resourceId === filters.resourceId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function saveSnapshot(snapshot: StoredSnapshot): Promise<void> {
  return writeJsonAtomic(snapshotsDir(), snapshot.id, snapshot);
}

export function loadSnapshot(id: string): Promise<StoredSnapshot> {
  return readJson<StoredSnapshot>(snapshotsDir(), id);
}

export async function listSnapshots(filters: {
  accountId?: string;
  resourceId?: string;
  limit?: number;
} = {}): Promise<StoredSnapshot[]> {
  const limit = Math.max(1, Math.min(filters.limit ?? 50, 200));
  return (await listJson<StoredSnapshot>(snapshotsDir()))
    .filter((snapshot) => !filters.accountId || snapshot.accountId === filters.accountId)
    .filter((snapshot) => !filters.resourceId || snapshot.resourceId === filters.resourceId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
