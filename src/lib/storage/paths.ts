import { homedir } from "node:os";
import { join } from "node:path";

export const APP_DIR_NAME = ".sosis";

export function appDir(): string {
  return join(homedir(), APP_DIR_NAME);
}

/** Public account metadata only; private keys live in macOS Keychain. */
export function dataPath(): string {
  return join(appDir(), "accounts.json");
}

export function configPath(): string {
  return join(appDir(), "config.json");
}

export function logsDir(): string {
  return join(appDir(), "logs");
}

/** AES-256-GCM envelopes; the encryption key lives in macOS Keychain. */
export function credentialsDir(): string {
  return join(appDir(), "credentials");
}

/**
 * Immutable-before-write snapshots and pending change plans.
 *
 * This directory never contains App Store Connect credentials. It is safe to
 * include in an encrypted Sosis data backup independently from the key store.
 */
export function changesDir(): string {
  return join(appDir(), "changes");
}

export function changePlansDir(): string {
  return join(changesDir(), "plans");
}

export function snapshotsDir(): string {
  return join(changesDir(), "snapshots");
}

/** Encrypted plan/snapshot payloads that may contain review demo credentials. */
export function secureChangesDir(): string {
  return join(changesDir(), "secure");
}

/** Recoverable copies of remote records and media saved before destructive writes. */
export function backupsDir(): string {
  return join(appDir(), "backups");
}

export function backupRecordsDir(): string {
  return join(backupsDir(), "records");
}

export function backupAssetsDir(): string {
  return join(backupsDir(), "assets");
}
