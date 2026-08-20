import assert from "node:assert/strict";
import test from "node:test";
import { AscError, type ascRequest } from "@/lib/asc/client";
import type { SecureChangeStore } from "@/lib/storage/secure-change-store";
import type { StoredChangePlan, StoredSnapshot } from "./change-store";
import {
  applyReviewDetailsChangePlan,
  createReviewDetailsChangePlan,
  restoreReviewDetailsSnapshot,
  type ReviewDetailsChangeServices,
} from "./review-details-changes";

function testServices(options: { existing?: boolean } = { existing: true }) {
  let reviewDetailId: string | null = options.existing === false ? null : "review_1";
  const attributes: Record<string, unknown> = {
    contactFirstName: "Ada",
    contactLastName: "Lovelace",
    contactPhone: "+1 555 0100",
    contactEmail: "ada@example.com",
    demoAccountRequired: true,
    demoAccountName: "reviewer",
    demoAccountPassword: "old-secret",
    notes: "Original notes",
  };
  const plans = new Map<string, StoredChangePlan>();
  const snapshots = new Map<string, StoredSnapshot>();
  const secure = new Map<string, unknown>();

  const request: typeof ascRequest = async (_accountId, req) => {
    if (req.path.includes("/appStoreVersions/") && req.path.endsWith("/appStoreReviewDetail")) {
      if (!reviewDetailId) throw new AscError(404, null);
      return { data: { id: reviewDetailId, type: "appStoreReviewDetails", attributes: { ...attributes } } };
    }
    if (req.method === "PATCH" && req.path.includes("/appStoreReviewDetails/")) {
      const body = req.body as { data?: { attributes?: Record<string, unknown> } };
      Object.assign(attributes, body.data?.attributes ?? {});
      return { data: { id: reviewDetailId, type: "appStoreReviewDetails", attributes: { ...attributes } } };
    }
    if (req.method === "POST" && req.path === "/v1/appStoreReviewDetails") {
      reviewDetailId = "review_created";
      const body = req.body as { data?: { attributes?: Record<string, unknown> } };
      Object.assign(attributes, body.data?.attributes ?? {});
      return { data: { id: reviewDetailId, type: "appStoreReviewDetails", attributes: { ...attributes } } };
    }
    throw new Error(`Unexpected request ${req.method} ${req.path}`);
  };

  const secureStore: SecureChangeStore = {
    set: async (id, value) => { secure.set(id, structuredClone(value)); },
    get: async <T>(id: string) => {
      if (!secure.has(id)) throw new Error("SECURE_CHANGE_NOT_FOUND");
      return structuredClone(secure.get(id)) as T;
    },
    delete: async (id) => { secure.delete(id); },
  };
  const services: ReviewDetailsChangeServices = {
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
    secureStore,
  };
  return { attributes, plans, snapshots, secure, services, reviewDetailId: () => reviewDetailId };
}

test("keeps App Review passwords out of public plans and restores encrypted values", async () => {
  const state = testServices();
  const plan = await createReviewDetailsChangePlan({
    accountId: "account_1",
    versionId: "version_1",
    attributes: { demoAccountPassword: "new-secret", notes: "New notes" },
  }, state.services);

  assert.equal(plan.after.demoAccountPassword, "<redacted>");
  assert.equal(JSON.stringify(plan).includes("new-secret"), false);
  assert.equal(JSON.stringify(plan).includes("old-secret"), false);
  assert.equal(JSON.stringify(state.secure.get(plan.id)).includes("new-secret"), true);

  const applied = await applyReviewDetailsChangePlan(plan.id, state.services);
  assert.equal(state.attributes.demoAccountPassword, "new-secret");
  assert.equal(applied.snapshot?.actualAfter?.demoAccountPassword, "<redacted>");
  assert.equal(JSON.stringify(applied.snapshot).includes("new-secret"), false);

  await restoreReviewDetailsSnapshot({ snapshotId: applied.snapshot!.id }, state.services);
  assert.equal(state.attributes.demoAccountPassword, "old-secret");
  assert.equal(state.attributes.notes, "Original notes");
});

test("marks newly-created review details non-restorable because Apple has no delete endpoint", async () => {
  const state = testServices({ existing: false });
  const plan = await createReviewDetailsChangePlan({
    accountId: "account_1",
    versionId: "version_1",
    attributes: {
      contactFirstName: "Ada",
      contactLastName: "Lovelace",
      contactPhone: "+1 555 0100",
      contactEmail: "ada@example.com",
      demoAccountRequired: false,
      notes: "First details",
    },
  }, state.services);
  const result = await applyReviewDetailsChangePlan(plan.id, state.services);
  assert.equal(state.reviewDetailId(), "review_created");
  assert.equal(result.snapshot?.restorable, false);
  await assert.rejects(
    restoreReviewDetailsSnapshot({ snapshotId: result.snapshot!.id }, state.services),
    /SNAPSHOT_NOT_RESTORABLE/,
  );
});

test("requires complete fields before creating the first review-details resource", async () => {
  const state = testServices({ existing: false });
  await assert.rejects(createReviewDetailsChangePlan({
    accountId: "account_1",
    versionId: "version_1",
    attributes: { notes: "Not enough for create" },
  }, state.services), /REVIEW_DETAILS_CREATE_FIELDS_REQUIRED/);
  assert.equal(state.plans.size, 0);
  assert.equal(state.secure.size, 0);
});
