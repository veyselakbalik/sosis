import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { appDir, dataPath } from "./paths";
import { ascCredentialStore, type CredentialStore } from "./credential-store";

export interface StoredAccount {
  id: string;
  label: string;
  issuerId: string;
  keyId: string;
  createdAt: number;
  credentialVersion: string;
}

export interface Account extends StoredAccount {
  p8: string;
}

export interface PublicAccount {
  id: string;
  label: string;
  issuerId: string;
  keyId: string;
  createdAt: number;
}

export interface DataPayload {
  accounts: StoredAccount[];
}

interface LegacyStoredAccount extends Omit<StoredAccount, "credentialVersion"> {
  credentialVersion?: string;
  p8?: string;
}

interface LegacyDataPayload {
  accounts?: LegacyStoredAccount[];
}

async function ensureAppDir(): Promise<void> {
  await mkdir(appDir(), { recursive: true, mode: 0o700 });
}

export async function migrateLegacyPayload(
  raw: LegacyDataPayload,
  credentials: CredentialStore = ascCredentialStore,
): Promise<{ payload: DataPayload; migrated: boolean }> {
  let migrated = false;
  const accounts: StoredAccount[] = [];

  for (const legacy of raw.accounts ?? []) {
    const credentialVersion = legacy.credentialVersion || randomUUID();
    if (!legacy.credentialVersion) migrated = true;
    if (typeof legacy.p8 === "string" && legacy.p8.length > 0) {
      ensureValidP8(legacy.p8);
      await credentials.set(legacy.id, legacy.p8);
      await credentials.cleanupLegacy?.(legacy.id);
      migrated = true;
    }
    accounts.push({
      id: legacy.id,
      label: legacy.label,
      issuerId: legacy.issuerId,
      keyId: legacy.keyId,
      createdAt: legacy.createdAt,
      credentialVersion,
    });
  }

  return { payload: { accounts }, migrated };
}

export async function loadDataPayload(
  credentials: CredentialStore = ascCredentialStore,
): Promise<DataPayload> {
  try {
    const raw = await readFile(dataPath(), "utf8");
    const parsed = JSON.parse(raw) as LegacyDataPayload;
    const result = await migrateLegacyPayload(parsed, credentials);
    if (result.migrated) await savePayload(result.payload);
    return result.payload;
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return { accounts: [] };
    }
    throw e;
  }
}

export async function savePayload(payload: DataPayload): Promise<void> {
  await ensureAppDir();
  const tmp = `${dataPath()}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(payload, null, 2), { mode: 0o600 });
  await rename(tmp, dataPath());
}

export function newAccountId(): string {
  return randomUUID();
}

export function newCredentialVersion(): string {
  return randomUUID();
}

export function publicView(a: StoredAccount | Account): PublicAccount {
  return {
    id: a.id,
    label: a.label,
    issuerId: a.issuerId,
    keyId: a.keyId,
    createdAt: a.createdAt,
  };
}

export function ensureValidP8(p8: string): void {
  const trimmed = p8.trim();
  if (!trimmed.startsWith("-----BEGIN PRIVATE KEY-----")) {
    throw new Error("INVALID_P8");
  }
  if (!trimmed.includes("-----END PRIVATE KEY-----")) {
    throw new Error("INVALID_P8");
  }
}
