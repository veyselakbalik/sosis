import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  MASTER_KEYCHAIN_ACCOUNT,
  MASTER_KEYCHAIN_SERVICE,
  KeychainCommandError,
  createEncryptedCredentialStore,
  createMacOsMasterKeyProvider,
  type SecurityCommandRunner,
} from "./credential-store";

const PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\ntest-key-material\n-----END PRIVATE KEY-----\n";

test("creates a short master key through stdin without placing it in process arguments", async () => {
  const calls: Array<{ args: readonly string[]; secretInput?: string }> = [];
  let stored: string | null = null;
  const runner: SecurityCommandRunner = async (args, secretInput) => {
    calls.push({ args, secretInput });
    if (args[0] === "find-generic-password") {
      if (stored === null) throw new KeychainCommandError(44, args[0]);
      return { stdout: stored, stderr: "" };
    }
    if (args[0] === "add-generic-password") stored = secretInput ?? null;
    return { stdout: "", stderr: "" };
  };
  const getMasterKey = createMacOsMasterKeyProvider({ runner, platform: "darwin" });

  const key = await getMasterKey();

  assert.equal(key.length, 32);
  const add = calls.find((call) => call.args[0] === "add-generic-password");
  assert.ok(add);
  assert.equal(add.args.at(-1), "-w");
  assert.equal(add.args.includes(add.secretInput ?? ""), false);
  assert.equal(add.args.includes(MASTER_KEYCHAIN_SERVICE), true);
  assert.equal(add.args.includes(MASTER_KEYCHAIN_ACCOUNT), true);
  assert.equal(Buffer.from(add.secretInput ?? "", "base64").length, 32);
});

test("encrypts private keys on disk with AES-GCM and round-trips them", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sosis-credentials-"));
  try {
    const store = createEncryptedCredentialStore({
      directory,
      getMasterKey: async () => Buffer.alloc(32, 7),
      runner: async () => { throw new KeychainCommandError(44, "delete"); },
      platform: "darwin",
    });
    await store.set("account-1", PRIVATE_KEY);
    const encrypted = await readFile(join(directory, "account-1.json"), "utf8");
    assert.equal(encrypted.includes(PRIVATE_KEY), false);
    assert.equal(encrypted.includes("test-key-material"), false);
    assert.equal(await store.get("account-1"), PRIVATE_KEY);

    await store.delete("account-1");
    assert.equal(await store.get("account-1"), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("binds encrypted credentials to their account ID", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sosis-credentials-"));
  try {
    const store = createEncryptedCredentialStore({
      directory,
      getMasterKey: async () => Buffer.alloc(32, 3),
      platform: "darwin",
    });
    await store.set("account-1", PRIVATE_KEY);
    const envelope = await readFile(join(directory, "account-1.json"));
    await import("node:fs/promises").then(({ writeFile }) => writeFile(
      join(directory, "account-2.json"),
      envelope,
      { mode: 0o600 },
    ));
    await assert.rejects(() => store.get("account-2"), /CREDENTIAL_DECRYPTION_FAILED/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("fails closed outside macOS when creating the master key", async () => {
  const getMasterKey = createMacOsMasterKeyProvider({
    platform: "linux",
    runner: async () => ({ stdout: "", stderr: "" }),
  });
  await assert.rejects(() => getMasterKey(), /KEYCHAIN_UNAVAILABLE/);
});
