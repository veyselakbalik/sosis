import assert from "node:assert/strict";
import test from "node:test";
import { migrateLegacyPayload } from "./accounts-file";
import type { CredentialStore } from "./credential-store";

const PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nlegacy-key\n-----END PRIVATE KEY-----\n";

function memoryCredentials() {
  const values = new Map<string, string>();
  const store: CredentialStore = {
    async get(id) { return values.get(id) ?? null; },
    async set(id, value) { values.set(id, value); },
    async delete(id) { values.delete(id); },
  };
  return { store, values };
}

test("migrates legacy plaintext p8 values and strips them from JSON metadata", async () => {
  const credentials = memoryCredentials();
  const result = await migrateLegacyPayload({
    accounts: [{
      id: "account-1",
      label: "Main",
      issuerId: "issuer",
      keyId: "KEY12345",
      createdAt: 1,
      p8: PRIVATE_KEY,
    }],
  }, credentials.store);

  assert.equal(result.migrated, true);
  assert.equal(credentials.values.get("account-1"), PRIVATE_KEY);
  assert.equal("p8" in result.payload.accounts[0], false);
  assert.ok(result.payload.accounts[0].credentialVersion);

  const secondPass = await migrateLegacyPayload(result.payload, credentials.store);
  assert.equal(secondPass.migrated, false);
});

test("does not return sanitized metadata when Keychain migration fails", async () => {
  const failing: CredentialStore = {
    async get() { return null; },
    async set() { throw new Error("KEYCHAIN_DENIED"); },
    async delete() {},
  };
  await assert.rejects(() => migrateLegacyPayload({
    accounts: [{
      id: "account-1",
      label: "Main",
      issuerId: "issuer",
      keyId: "KEY12345",
      createdAt: 1,
      p8: PRIVATE_KEY,
    }],
  }, failing), /KEYCHAIN_DENIED/);
});
