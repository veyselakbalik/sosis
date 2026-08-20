import assert from "node:assert/strict";
import test from "node:test";
import type { ascRequest } from "@/lib/asc/client";
import type { StoredChangePlan, StoredSnapshot } from "./change-store";
import {
  applyTextResourceChangePlan,
  createTextResourceChangePlan,
  restoreTextResourceSnapshot,
  type TextResourceChangeServices,
} from "./text-resource-changes";

function testServices(options: { failAfterPatch?: boolean } = {}) {
  const resources = new Map<string, { type: string; attributes: Record<string, unknown> }>([
    ["info_1", {
      type: "appInfoLocalizations",
      attributes: {
        locale: "en-US",
        name: "Original App",
        subtitle: "Original subtitle",
        privacyPolicyUrl: "https://example.com/privacy",
      },
    }],
    ["sub_1", {
      type: "subscriptionLocalizations",
      attributes: { locale: "en-US", name: "Monthly", description: "Original benefit" },
    }],
    ["beta_1", {
      type: "betaBuildLocalizations",
      attributes: { locale: "en-US", whatsNew: "Original testing notes" },
    }],
  ]);
  const plans = new Map<string, StoredChangePlan>();
  const snapshots = new Map<string, StoredSnapshot>();

  const request: typeof ascRequest = async (_accountId, req) => {
    const resourceId = req.path.split("/").filter(Boolean).at(-1) ?? "";
    const resource = resources.get(resourceId);
    if (!resource) throw new Error(`Unknown resource ${resourceId}`);
    if ((req.method ?? "GET") === "GET") {
      return { data: { id: resourceId, type: resource.type, attributes: { ...resource.attributes } } };
    }
    if (req.method === "PATCH") {
      const body = req.body as { data?: { attributes?: Record<string, unknown> } };
      Object.assign(resource.attributes, body.data?.attributes ?? {});
      if (options.failAfterPatch) throw new Error("simulated connection drop");
      return { data: { id: resourceId, type: resource.type, attributes: { ...resource.attributes } } };
    }
    throw new Error(`Unexpected method ${req.method}`);
  };

  const services: TextResourceChangeServices = {
    request,
    savePlan: async (plan) => { plans.set(plan.id, structuredClone(plan)); },
    loadPlan: async (id) => {
      const plan = plans.get(id);
      if (!plan) throw new Error("CHANGE_NOT_FOUND");
      return structuredClone(plan);
    },
    saveSnapshot: async (snapshot) => { snapshots.set(snapshot.id, structuredClone(snapshot)); },
    loadSnapshot: async (id) => {
      const snapshot = snapshots.get(id);
      if (!snapshot) throw new Error("CHANGE_NOT_FOUND");
      return structuredClone(snapshot);
    },
  };

  return { resources, plans, snapshots, services };
}

test("plans, applies, verifies and restores an App Info localization", async () => {
  const state = testServices();
  const info = state.resources.get("info_1")!;
  const plan = await createTextResourceChangePlan({
    kind: "app-info-localization",
    accountId: "account_1",
    resourceId: "info_1",
    attributes: { name: "Safer App", subtitle: "New subtitle" },
  }, state.services);

  assert.deepEqual(plan.before, { name: "Original App", subtitle: "Original subtitle" });
  assert.equal(info.attributes.name, "Original App");

  const applied = await applyTextResourceChangePlan(plan.id, state.services);
  assert.equal(info.attributes.name, "Safer App");
  assert.equal(applied.snapshot?.kind, "app-info-localization");
  assert.equal(applied.snapshot?.status, "applied");

  const restored = await restoreTextResourceSnapshot({ snapshotId: applied.snapshot!.id }, state.services);
  assert.equal(info.attributes.name, "Original App");
  assert.ok(restored.snapshot?.id, "restore must create a new safety snapshot");
});

test("rejects stale subscription plans before creating a snapshot", async () => {
  const state = testServices();
  const subscription = state.resources.get("sub_1")!;
  const plan = await createTextResourceChangePlan({
    kind: "subscription-localization",
    accountId: "account_1",
    resourceId: "sub_1",
    attributes: { description: "Planned benefit" },
  }, state.services);

  subscription.attributes.description = "Changed outside Sosis";
  await assert.rejects(applyTextResourceChangePlan(plan.id, state.services), /PLAN_CONFLICT/);
  assert.equal(state.snapshots.size, 0);
});

test("enforces App Info and subscription field constraints before ASC reads", async () => {
  const state = testServices();
  await assert.rejects(createTextResourceChangePlan({
    kind: "app-info-localization",
    accountId: "account_1",
    resourceId: "info_1",
    attributes: { privacyPolicyUrl: "javascript:alert(1)" },
  }, state.services), /HTTP\(S\)/);
  await assert.rejects(createTextResourceChangePlan({
    kind: "subscription-localization",
    accountId: "account_1",
    resourceId: "sub_1",
    attributes: { description: "x".repeat(46) },
  }, state.services), /Too big|45/);
  assert.equal(state.plans.size, 0);
});

test("recognizes a dropped response after ASC accepted the text patch", async () => {
  const state = testServices({ failAfterPatch: true });
  const plan = await createTextResourceChangePlan({
    kind: "subscription-localization",
    accountId: "account_1",
    resourceId: "sub_1",
    attributes: { name: "Premium" },
  }, state.services);

  const result = await applyTextResourceChangePlan(plan.id, state.services);
  assert.equal(result.plan.status, "applied");
  assert.equal(result.snapshot?.actualAfter?.name, "Premium");
});

test("protects TestFlight What to Test text with the same plan and restore flow", async () => {
  const state = testServices();
  const beta = state.resources.get("beta_1")!;
  const plan = await createTextResourceChangePlan({
    kind: "beta-build-localization",
    accountId: "account_1",
    resourceId: "beta_1",
    attributes: { whatsNew: "Test the redesigned onboarding." },
  }, state.services);

  const applied = await applyTextResourceChangePlan(plan.id, state.services);
  assert.equal(beta.attributes.whatsNew, "Test the redesigned onboarding.");
  await restoreTextResourceSnapshot({ snapshotId: applied.snapshot!.id }, state.services);
  assert.equal(beta.attributes.whatsNew, "Original testing notes");
});
