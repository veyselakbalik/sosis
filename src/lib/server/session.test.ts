import assert from "node:assert/strict";
import test from "node:test";
import { createAccountService } from "./session";
import type { Account, DataPayload } from "../storage/accounts-file";
import type { CredentialStore } from "../storage/credential-store";

const PRIVATE_KEY_1 = "-----BEGIN PRIVATE KEY-----\nkey-one\n-----END PRIVATE KEY-----\n";
const PRIVATE_KEY_2 = "-----BEGIN PRIVATE KEY-----\nkey-two\n-----END PRIVATE KEY-----\n";

function harness(initial: DataPayload = { accounts: [] }) {
  let payload = structuredClone(initial);
  const secrets = new Map<string, string>();
  const credentials: CredentialStore = {
    async get(id) { return secrets.get(id) ?? null; },
    async set(id, value) { secrets.set(id, value); },
    async delete(id) { secrets.delete(id); },
  };
  let version = 1;
  const service = createAccountService({
    async load() { return structuredClone(payload); },
    async save(next) { payload = structuredClone(next); },
    credentials,
    createCredentialVersion: () => `version-${version++}`,
  });
  return {
    service,
    secrets,
    get payload() { return payload; },
    set payload(next: DataPayload) { payload = structuredClone(next); },
  };
}

test("keeps account metadata separate and refreshes a key after rotation", async () => {
  const state = harness();
  const account: Account = {
    id: "account-1",
    label: "Main",
    issuerId: "issuer",
    keyId: "KEY12345",
    createdAt: 1,
    credentialVersion: "version-0",
    p8: PRIVATE_KEY_1,
  };

  await state.service.addAccount(account);
  assert.equal("p8" in state.payload.accounts[0], false);
  assert.equal((await state.service.getAccount(account.id))?.p8, PRIVATE_KEY_1);

  await state.service.updateAccount(account.id, { p8: PRIVATE_KEY_2, keyId: "KEY67890" });
  assert.equal(state.payload.accounts[0].credentialVersion, "version-1");
  assert.equal("p8" in state.payload.accounts[0], false);
  assert.equal((await state.service.getAccount(account.id))?.p8, PRIVATE_KEY_2);

  state.secrets.set(account.id, PRIVATE_KEY_1);
  state.payload = {
    accounts: [{ ...state.payload.accounts[0], credentialVersion: "external-version" }],
  };
  assert.equal((await state.service.getAccount(account.id))?.p8, PRIVATE_KEY_1);

  await state.service.removeAccount(account.id);
  assert.equal(state.payload.accounts.length, 0);
  assert.equal(state.secrets.has(account.id), false);
});

test("rolls a rotated Keychain value back when metadata persistence fails", async () => {
  const stored: DataPayload = {
    accounts: [{
      id: "account-1",
      label: "Main",
      issuerId: "issuer",
      keyId: "KEY12345",
      createdAt: 1,
      credentialVersion: "version-0",
    }],
  };
  const payload = structuredClone(stored);
  const secrets = new Map([["account-1", PRIVATE_KEY_1]]);
  const service = createAccountService({
    async load() { return structuredClone(payload); },
    async save() { throw new Error("DISK_WRITE_FAILED"); },
    credentials: {
      async get(id) { return secrets.get(id) ?? null; },
      async set(id, value) { secrets.set(id, value); },
      async delete(id) { secrets.delete(id); },
    },
    createCredentialVersion: () => "version-1",
  });

  await assert.rejects(
    () => service.updateAccount("account-1", { p8: PRIVATE_KEY_2 }),
    /DISK_WRITE_FAILED/,
  );
  assert.equal(secrets.get("account-1"), PRIVATE_KEY_1);
  assert.deepEqual(payload, stored);
});
