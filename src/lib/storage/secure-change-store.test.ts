import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSecureChangeStore } from "./secure-change-store";

test("encrypts secret change payloads and binds them to their record ID", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sosis-secure-changes-"));
  try {
    const store = createSecureChangeStore({
      directory,
      getMasterKey: async () => Buffer.alloc(32, 9),
    });
    const payload = { demoAccountPassword: "review-secret", notes: "private review notes" };
    await store.set("plan_1", payload);
    const encoded = await readFile(join(directory, "plan_1.json"), "utf8");
    assert.equal(encoded.includes("review-secret"), false);
    assert.deepEqual(await store.get("plan_1"), payload);

    await writeFile(join(directory, "plan_2.json"), encoded, { mode: 0o600 });
    await assert.rejects(store.get("plan_2"), /SECURE_CHANGE_DECRYPTION_FAILED/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
