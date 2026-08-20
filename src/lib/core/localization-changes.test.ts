import assert from "node:assert/strict";
import test from "node:test";
import type { ascRequest } from "@/lib/asc/client";
import {
  applyLocalizationChangePlan,
  applyLocalizationBatchPlan,
  createLocalizationBatchPlan,
  createLocalizationChangePlan,
  restoreLocalizationSnapshot,
  type LocalizationChangeServices,
} from "./localization-changes";
import type { StoredChangePlan, StoredSnapshot } from "./change-store";

function testServices(options: { failAfterPatch?: boolean } = {}) {
  const attributes: Record<string, unknown> = {
    locale: "en-US",
    description: "Original description",
    keywords: "original,keywords",
    whatsNew: null,
    promotionalText: null,
    marketingUrl: null,
    supportUrl: "https://example.com/support",
  };
  const plans = new Map<string, StoredChangePlan>();
  const snapshots = new Map<string, StoredSnapshot>();
  const resources = new Map<string, Record<string, unknown>>([["loc_1", attributes]]);

  const request: typeof ascRequest = async (_accountId, req) => {
    const resourceId = req.path.split("/").filter(Boolean).at(-1) ?? "loc_1";
    const resourceAttributes = resources.get(resourceId);
    if (!resourceAttributes) throw new Error(`Unknown localization ${resourceId}`);
    if ((req.method ?? "GET") === "GET") {
      return {
        data: {
          id: resourceId,
          type: "appStoreVersionLocalizations",
          attributes: { ...resourceAttributes },
        },
      };
    }
    if (req.method === "PATCH") {
      const body = req.body as { data?: { attributes?: Record<string, unknown> } };
      Object.assign(resourceAttributes, body.data?.attributes ?? {});
      if (options.failAfterPatch) throw new Error("simulated connection drop");
      return { data: { id: resourceId, type: "appStoreVersionLocalizations", attributes: { ...resourceAttributes } } };
    }
    throw new Error(`Unexpected method ${req.method}`);
  };

  const services: LocalizationChangeServices = {
    request,
    savePlan: async (plan) => { plans.set(plan.id, structuredClone(plan)); },
    loadPlan: async (id) => {
      const plan = plans.get(id);
      if (!plan) throw new Error("CHANGE_NOT_FOUND");
      return structuredClone(plan);
    },
    listPlans: async (filters = {}) => [...plans.values()]
      .filter((plan) => !filters.accountId || plan.accountId === filters.accountId)
      .filter((plan) => !filters.batchId || plan.batchId === filters.batchId)
      .filter((plan) => !filters.resourceId || plan.resourceId === filters.resourceId)
      .map((plan) => structuredClone(plan)),
    saveSnapshot: async (snapshot) => { snapshots.set(snapshot.id, structuredClone(snapshot)); },
    loadSnapshot: async (id) => {
      const snapshot = snapshots.get(id);
      if (!snapshot) throw new Error("CHANGE_NOT_FOUND");
      return structuredClone(snapshot);
    },
  };

  return {
    attributes,
    plans,
    snapshots,
    services,
    resources,
    addLocalization(id: string, locale: string) {
      const value: Record<string, unknown> = { ...attributes, locale };
      resources.set(id, value);
      return value;
    },
  };
}

test("plans, snapshots, applies and restores a localization update", async () => {
  const state = testServices();
  const plan = await createLocalizationChangePlan({
    accountId: "account_1",
    localizationId: "loc_1",
    attributes: { keywords: "better,keywords" },
  }, state.services);

  assert.deepEqual(plan.before, { keywords: "original,keywords" });
  assert.deepEqual(plan.after, { keywords: "better,keywords" });
  assert.equal(state.attributes.keywords, "original,keywords");

  const applied = await applyLocalizationChangePlan(plan.id, state.services);
  assert.equal(state.attributes.keywords, "better,keywords");
  assert.equal(applied.snapshot?.status, "applied");
  assert.ok(applied.snapshot?.id);

  const restored = await restoreLocalizationSnapshot({
    snapshotId: applied.snapshot!.id,
  }, state.services);
  assert.equal(state.attributes.keywords, "original,keywords");
  assert.ok(restored.snapshot?.id, "the restore must create its own safety snapshot");
});

test("refuses to apply a stale plan", async () => {
  const state = testServices();
  const plan = await createLocalizationChangePlan({
    accountId: "account_1",
    localizationId: "loc_1",
    attributes: { keywords: "planned,keywords" },
  }, state.services);

  state.attributes.keywords = "changed,outside,sosis";
  await assert.rejects(
    applyLocalizationChangePlan(plan.id, state.services),
    /PLAN_CONFLICT/,
  );
  assert.equal(state.snapshots.size, 0);
});

test("recovers as applied when the connection drops after ASC accepted the patch", async () => {
  const state = testServices({ failAfterPatch: true });
  const plan = await createLocalizationChangePlan({
    accountId: "account_1",
    localizationId: "loc_1",
    attributes: { promotionalText: "New promotion" },
  }, state.services);

  const result = await applyLocalizationChangePlan(plan.id, state.services);
  assert.equal(result.plan.status, "applied");
  assert.equal(result.snapshot?.actualAfter?.promotionalText, "New promotion");
});

test("validates App Store metadata limits before reading or writing ASC", async () => {
  const state = testServices();
  await assert.rejects(
    createLocalizationChangePlan({
      accountId: "account_1",
      localizationId: "loc_1",
      attributes: { keywords: "x".repeat(101) },
    }, state.services),
    /Too big|100/,
  );
  assert.equal(state.plans.size, 0);
});

test("preflights and applies an agent-produced localization batch", async () => {
  const state = testServices();
  const second = state.addLocalization("loc_2", "tr");
  const batch = await createLocalizationBatchPlan({
    accountId: "account_1",
    updates: [
      { localizationId: "loc_1", locale: "en-US", attributes: { keywords: "english,keywords" } },
      { localizationId: "loc_2", locale: "tr", attributes: { keywords: "türkçe,anahtarlar" } },
    ],
  }, state.services);

  const result = await applyLocalizationBatchPlan(batch.batchId, state.services);
  assert.equal(result.status, "applied");
  assert.equal(result.results.length, 2);
  assert.equal(state.attributes.keywords, "english,keywords");
  assert.equal(second.keywords, "türkçe,anahtarlar");
  assert.equal(state.snapshots.size, 2);
});
