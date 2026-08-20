import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createMacOsMasterKeyProvider } from "./credential-store";
import { secureChangesDir } from "./paths";

interface SecureEnvelope {
  version: 1;
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  ciphertext: string;
}

export interface SecureChangeStore {
  set(id: string, value: unknown): Promise<void>;
  get<T>(id: string): Promise<T>;
  delete(id: string): Promise<void>;
}

function assertSafeId(id: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("INVALID_CHANGE_ID");
}

function encrypt(id: string, value: unknown, key: Buffer): SecureEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`sosis:secure-change:${id}:v1`, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
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

function decrypt<T>(id: string, envelope: SecureEnvelope, key: Buffer): T {
  try {
    if (envelope.version !== 1 || envelope.algorithm !== "aes-256-gcm") throw new Error("format");
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
    decipher.setAAD(Buffer.from(`sosis:secure-change:${id}:v1`, "utf8"));
    decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext) as T;
  } catch {
    throw new Error("SECURE_CHANGE_DECRYPTION_FAILED");
  }
}

export function createSecureChangeStore(options: {
  directory?: string;
  getMasterKey?: () => Promise<Buffer>;
} = {}): SecureChangeStore {
  const directory = options.directory ?? secureChangesDir();
  const getMasterKey = options.getMasterKey ?? createMacOsMasterKeyProvider();

  function recordPath(id: string): string {
    assertSafeId(id);
    return join(directory, `${id}.json`);
  }

  return {
    async set(id, value) {
      const key = await getMasterKey();
      const envelope = encrypt(id, value, key);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const target = recordPath(id);
      const temporary = join(directory, `.${id}.${randomUUID()}.tmp`);
      await writeFile(temporary, JSON.stringify(envelope), { mode: 0o600 });
      await rename(temporary, target);
    },

    async get<T>(id: string): Promise<T> {
      let encoded: string;
      try {
        encoded = await readFile(recordPath(id), "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error("SECURE_CHANGE_NOT_FOUND");
        throw error;
      }
      const envelope = JSON.parse(encoded) as SecureEnvelope;
      return decrypt<T>(id, envelope, await getMasterKey());
    },

    async delete(id) {
      try {
        await unlink(recordPath(id));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    },
  };
}

export const secureChangeStore = createSecureChangeStore();
