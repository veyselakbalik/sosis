import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readP8File, validateAccountMetadata } from "./account-setup";

const VALID = {
  label: "Main",
  issuerId: "12345678-1234-4234-8234-1234567890ab",
  keyId: "ABCD1234",
};

test("accepts App Store Connect issuer, key, and label values", () => {
  assert.deepEqual(validateAccountMetadata(VALID), {
    label: "Main",
    issuerId: VALID.issuerId,
    keyId: "ABCD1234",
  });
});

test("rejects empty labels, non-UUID issuers, and short key IDs", () => {
  assert.throws(() => validateAccountMetadata({ ...VALID, label: "  " }), /INVALID_LABEL/);
  assert.throws(() => validateAccountMetadata({ ...VALID, issuerId: "not-a-uuid" }), /INVALID_ISSUER_ID/);
  assert.throws(() => validateAccountMetadata({ ...VALID, keyId: "short" }), /INVALID_KEY_ID/);
});

test("reads a PEM file and rejects missing or non-PEM contents without echoing the key", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sosis-p8-"));
  try {
    const p8Path = join(directory, "AuthKey.p8");
    const pem = "-----BEGIN PRIVATE KEY-----\ntest-key-material\n-----END PRIVATE KEY-----\n";
    await writeFile(p8Path, pem);
    assert.equal(await readP8File(p8Path), pem.trim());

    const junkPath = join(directory, "not-a-key.txt");
    await writeFile(junkPath, "hello");
    await assert.rejects(() => readP8File(junkPath), (error: Error) => {
      assert.match(error.message, /INVALID_P8/);
      assert.equal(error.message.includes("test-key-material"), false);
      assert.equal(error.message.includes("hello"), false);
      return true;
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
