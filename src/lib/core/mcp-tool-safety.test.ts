import assert from "node:assert/strict";
import test from "node:test";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  assertToolConfirmation,
  configureMcpToolSafety,
  expectedHighImpactConfirmation,
} from "./mcp-tool-safety";

test("requires reviewed confirmation for external writes", () => {
  assert.throws(
    () => assertToolConfirmation("create_version", { appId: "app-1" }),
    /CONFIRMATION_REQUIRED/,
  );
  assert.doesNotThrow(() => assertToolConfirmation("create_version", {
    appId: "app-1",
    confirmed: true,
  }));
  assert.doesNotThrow(() => assertToolConfirmation("list_apps", {}));
});

test("requires confirmation for local account changes and a phrase to delete one", () => {
  assert.throws(() => assertToolConfirmation("add_account", {
    label: "Main",
    issuerId: "12345678-1234-4234-8234-1234567890ab",
    keyId: "ABCD1234",
    p8Path: "/tmp/AuthKey.p8",
  }), /CONFIRMATION_REQUIRED/);
  assert.doesNotThrow(() => assertToolConfirmation("add_account", {
    label: "Main",
    issuerId: "12345678-1234-4234-8234-1234567890ab",
    keyId: "ABCD1234",
    p8Path: "/tmp/AuthKey.p8",
    confirmed: true,
  }));
  assert.equal(
    expectedHighImpactConfirmation("remove_account", { accountId: "account-1" }),
    "REMOVE ACCOUNT account-1",
  );
  assert.throws(() => assertToolConfirmation("remove_account", {
    accountId: "account-1",
    confirmed: true,
  }), /EXACT_CONFIRMATION_REQUIRED/);
  assert.doesNotThrow(() => assertToolConfirmation("remove_account", {
    accountId: "account-1",
    confirmed: true,
    confirmation: "REMOVE ACCOUNT account-1",
  }));
});

test("requires resource-bound phrases for high-impact writes", () => {
  const args = { reviewId: "review-1", confirmed: true };
  assert.equal(expectedHighImpactConfirmation("reply_review", args), "REPLY review-1");
  assert.throws(() => assertToolConfirmation("reply_review", args), /EXACT_CONFIRMATION_REQUIRED/);
  assert.doesNotThrow(() => assertToolConfirmation("reply_review", {
    ...args,
    confirmation: "REPLY review-1",
  }));
  assert.throws(() => assertToolConfirmation("reply_review", {
    ...args,
    confirmation: "REPLY review-2",
  }), /REPLY review-1/);
});

test("allows read-only modes but protects destructive conditional modes", () => {
  assert.doesNotThrow(() => assertToolConfirmation("manage_phased_release", { action: "get" }));
  assert.doesNotThrow(() => assertToolConfirmation("plan_screenshot_upload", {}));
  assert.throws(() => assertToolConfirmation("upload_screenshots_from_directory", {}), /CONFIRMATION_REQUIRED/);
  assert.throws(() => assertToolConfirmation("upload_screenshots_from_directory", {
    versionId: "version-1",
    clearExisting: true,
    confirmed: true,
  }), /REPLACE SCREENSHOTS version-1/);
  assert.throws(() => assertToolConfirmation("restore_change_snapshot", {
    snapshotId: "snap-1",
    force: true,
    confirmed: true,
  }), /FORCE RESTORE snap-1/);
  assert.doesNotThrow(() => assertToolConfirmation("restore_change_snapshot", {
    snapshotId: "snap-1",
    force: true,
    confirmed: true,
    confirmation: "FORCE RESTORE snap-1",
  }));
  assert.throws(() => assertToolConfirmation("restore_backup", { backupId: "backup-1" }), /CONFIRMATION_REQUIRED/);
  assert.doesNotThrow(() => assertToolConfirmation("restore_backup", {
    backupId: "backup-1",
    confirmed: true,
  }));
});

test("adds confirmation schemas and MCP safety annotations", () => {
  const tools: Tool[] = [
    { name: "list_apps", description: "", inputSchema: { type: "object" } },
    { name: "search_aso_skills", description: "", inputSchema: { type: "object" } },
    { name: "delete_screenshot", description: "", inputSchema: {
      type: "object",
      properties: { screenshotId: { type: "string" } },
      required: ["screenshotId"],
    } },
    { name: "apply_protected_change_plan", description: "", inputSchema: {
      type: "object",
      properties: { planId: { type: "string" } },
      required: ["planId"],
    }, annotations: { idempotentHint: true } },
  ];
  configureMcpToolSafety(tools);
  assert.equal(tools[0].annotations?.readOnlyHint, true);
  assert.equal(tools[1].annotations?.readOnlyHint, true);
  assert.equal(tools[1].annotations?.openWorldHint, false);
  assert.equal(tools[2].annotations?.destructiveHint, true);
  assert.deepEqual(tools[2].inputSchema.required, ["screenshotId", "confirmed", "confirmation"]);
  assert.equal(tools[3].annotations?.idempotentHint, true);
  assert.deepEqual(tools[3].inputSchema.required, ["planId", "confirmed"]);
});
