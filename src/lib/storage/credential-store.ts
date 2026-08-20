import { spawn } from "node:child_process";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { credentialsDir } from "./paths";

export const MASTER_KEYCHAIN_SERVICE = "com.sosis.master-key.v1";
export const MASTER_KEYCHAIN_ACCOUNT = "local-installation";
const LEGACY_ASC_KEYCHAIN_SERVICE = "com.sosis.asc.private-key.v1";

export interface CredentialStore {
  get(accountId: string): Promise<string | null>;
  set(accountId: string, privateKey: string): Promise<void>;
  delete(accountId: string): Promise<void>;
  cleanupLegacy?(accountId: string): Promise<void>;
}

export interface SecurityCommandResult {
  stdout: string;
  stderr: string;
}

export type SecurityCommandRunner = (
  args: readonly string[],
  secretInput?: string,
) => Promise<SecurityCommandResult>;

export class KeychainCommandError extends Error {
  readonly exitCode: number | null;

  constructor(exitCode: number | null, operation: string) {
    super(`KEYCHAIN_COMMAND_FAILED:${operation}:${exitCode ?? "unknown"}`);
    this.name = "KeychainCommandError";
    this.exitCode = exitCode;
  }
}

interface EncryptedCredentialEnvelope {
  version: 1;
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  ciphertext: string;
}

async function runSecurityCommand(
  args: readonly string[],
  secretInput?: string,
): Promise<SecurityCommandResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/security", [...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", () => reject(new KeychainCommandError(null, args[0] ?? "unknown")));
    child.once("close", (code) => {
      if (code === 0) {
        resolve({
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
        });
      } else {
        // Never include stderr in errors returned to MCP or the web API.
        reject(new KeychainCommandError(code, args[0] ?? "unknown"));
      }
    });

    if (secretInput === undefined) child.stdin.end();
    // `security add-generic-password -w` asks for the value twice. The master
    // key is short enough for the prompt and never appears in process argv.
    else child.stdin.end(`${secretInput}\n${secretInput}\n`);
  });
}

function decodeMasterKey(encoded: string): Buffer {
  const key = Buffer.from(encoded.trim(), "base64");
  if (key.length !== 32) throw new Error("KEYCHAIN_MASTER_KEY_INVALID");
  return key;
}

export function createMacOsMasterKeyProvider(options: {
  runner?: SecurityCommandRunner;
  platform?: NodeJS.Platform;
} = {}): () => Promise<Buffer> {
  const runner = options.runner ?? runSecurityCommand;
  const platform = options.platform ?? process.platform;
  let resolved: Promise<Buffer> | null = null;

  async function find(): Promise<Buffer | null> {
    try {
      const result = await runner([
        "find-generic-password",
        "-a", MASTER_KEYCHAIN_ACCOUNT,
        "-s", MASTER_KEYCHAIN_SERVICE,
        "-w",
      ]);
      return decodeMasterKey(result.stdout);
    } catch (error) {
      if (error instanceof KeychainCommandError && error.exitCode === 44) return null;
      throw error;
    }
  }

  async function loadOrCreate(): Promise<Buffer> {
    if (platform !== "darwin") throw new Error("KEYCHAIN_UNAVAILABLE: macOS is required.");
    const existing = await find();
    if (existing) return existing;

    const generated = randomBytes(32);
    const encoded = generated.toString("base64");
    try {
      await runner([
        "add-generic-password",
        "-a", MASTER_KEYCHAIN_ACCOUNT,
        "-s", MASTER_KEYCHAIN_SERVICE,
        "-l", "Sosis local credential encryption key",
        "-w",
      ], encoded);
    } catch (error) {
      // Another Sosis process may have created the installation key between
      // our lookup and add. Reuse that key instead of ever overwriting it.
      if (!(error instanceof KeychainCommandError && error.exitCode === 45)) throw error;
    }

    const verified = await find();
    if (!verified) throw new Error("KEYCHAIN_MASTER_KEY_VERIFICATION_FAILED");
    return verified;
  }

  return () => {
    resolved ??= loadOrCreate().catch((error) => {
      resolved = null;
      throw error;
    });
    return resolved;
  };
}

function assertSafeAccountId(accountId: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(accountId)) throw new Error("INVALID_ACCOUNT_ID");
}

function encryptCredential(accountId: string, privateKey: string, masterKey: Buffer): EncryptedCredentialEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey, iv);
  cipher.setAAD(Buffer.from(`sosis:${accountId}:v1`, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(privateKey, "utf8"),
    cipher.final(),
  ]);
  return {
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decryptCredential(accountId: string, envelope: EncryptedCredentialEnvelope, masterKey: Buffer): string {
  try {
    if (envelope.version !== 1 || envelope.algorithm !== "aes-256-gcm") throw new Error("format");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      masterKey,
      Buffer.from(envelope.iv, "base64"),
    );
    decipher.setAAD(Buffer.from(`sosis:${accountId}:v1`, "utf8"));
    decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
    if (!plaintext.includes("-----BEGIN PRIVATE KEY-----")) throw new Error("format");
    return plaintext;
  } catch {
    throw new Error("CREDENTIAL_DECRYPTION_FAILED");
  }
}

export function createEncryptedCredentialStore(options: {
  directory?: string;
  getMasterKey?: () => Promise<Buffer>;
  runner?: SecurityCommandRunner;
  platform?: NodeJS.Platform;
} = {}): CredentialStore {
  const directory = options.directory ?? credentialsDir();
  const getMasterKey = options.getMasterKey ?? createMacOsMasterKeyProvider({
    runner: options.runner,
    platform: options.platform,
  });
  const runner = options.runner ?? runSecurityCommand;

  function credentialPath(accountId: string): string {
    assertSafeAccountId(accountId);
    return join(directory, `${accountId}.json`);
  }

  const store: CredentialStore = {
    async get(accountId) {
      let encoded: string;
      try {
        encoded = await readFile(credentialPath(accountId), "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
      const envelope = JSON.parse(encoded) as EncryptedCredentialEnvelope;
      return decryptCredential(accountId, envelope, await getMasterKey());
    },

    async set(accountId, privateKey) {
      const target = credentialPath(accountId);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const envelope = encryptCredential(accountId, privateKey, await getMasterKey());
      const temporary = join(directory, `.${accountId}.${randomUUID()}.tmp`);
      await writeFile(temporary, JSON.stringify(envelope), { mode: 0o600 });
      try {
        const written = JSON.parse(await readFile(temporary, "utf8")) as EncryptedCredentialEnvelope;
        if (decryptCredential(accountId, written, await getMasterKey()) !== privateKey) {
          throw new Error("CREDENTIAL_WRITE_VERIFICATION_FAILED");
        }
        await rename(temporary, target);
      } catch (error) {
        await unlink(temporary).catch(() => undefined);
        throw error;
      }
    },

    async delete(accountId) {
      try {
        await unlink(credentialPath(accountId));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }
    },

    async cleanupLegacy(accountId) {
      try {
        await runner([
          "delete-generic-password",
          "-a", accountId,
          "-s", LEGACY_ASC_KEYCHAIN_SERVICE,
        ]);
      } catch (error) {
        if (error instanceof KeychainCommandError && error.exitCode === 44) return;
        throw error;
      }
    },
  };
  return store;
}

export const ascCredentialStore = createEncryptedCredentialStore();
