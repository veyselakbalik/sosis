import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { ascRequest, AscError } from "@/lib/asc/client";
import {
  loadChangePlan,
  loadSnapshot,
  saveChangePlan,
  saveSnapshot,
  type StoredChangePlan,
  type StoredSnapshot,
} from "./change-store";
import { secureChangeStore, type SecureChangeStore } from "@/lib/storage/secure-change-store";

export const REVIEW_DETAIL_FIELDS = [
  "contactFirstName",
  "contactLastName",
  "contactPhone",
  "contactEmail",
  "demoAccountRequired",
  "demoAccountName",
  "demoAccountPassword",
  "notes",
] as const;

export type ReviewDetailField = (typeof REVIEW_DETAIL_FIELDS)[number];
type ReviewValue = string | boolean | null;
type ReviewValues = Partial<Record<ReviewDetailField, ReviewValue>>;

const nullableString = (max: number) => z.string().max(max).nullable().optional();
const reviewPatchSchema = z.object({
  contactFirstName: nullableString(255),
  contactLastName: nullableString(255),
  contactPhone: nullableString(100),
  contactEmail: z.string().email().max(254).nullable().optional(),
  demoAccountRequired: z.boolean().optional(),
  demoAccountName: nullableString(255),
  demoAccountPassword: nullableString(255),
  notes: nullableString(4000),
}).strict().superRefine((value, context) => {
  if (Object.keys(value).length === 0) {
    context.addIssue({ code: "custom", message: "At least one App Review field is required." });
  }
});

interface ReviewResponse {
  data: {
    id: string;
    type: "appStoreReviewDetails";
    attributes?: Record<string, unknown>;
  };
}

interface ReviewState {
  reviewDetailId: string | null;
  values: ReviewValues;
  resource?: ReviewResponse;
}

interface SecureReviewPlanPayload {
  versionId: string;
  reviewDetailId: string | null;
  existedBefore: boolean;
  before: ReviewValues;
  after: ReviewValues;
}

interface SecureReviewSnapshotPayload extends SecureReviewPlanPayload {
  actualAfter?: ReviewValues;
  appliedReviewDetailId?: string;
}

export interface ReviewDetailsChangeResult {
  plan: StoredChangePlan;
  snapshot?: StoredSnapshot;
  resource?: ReviewResponse;
}

export interface ReviewDetailsChangeServices {
  request: typeof ascRequest;
  savePlan: typeof saveChangePlan;
  loadPlan: typeof loadChangePlan;
  saveSnapshot: typeof saveSnapshot;
  loadSnapshot: typeof loadSnapshot;
  secureStore: SecureChangeStore;
}

const defaultServices: ReviewDetailsChangeServices = {
  request: ascRequest,
  savePlan: saveChangePlan,
  loadPlan: loadChangePlan,
  saveSnapshot,
  loadSnapshot,
  secureStore: secureChangeStore,
};

function normalizePatch(input: unknown): ReviewValues {
  const parsed = reviewPatchSchema.parse(input);
  const result: ReviewValues = {};
  for (const field of REVIEW_DETAIL_FIELDS) {
    if (!(field in parsed)) continue;
    const value = parsed[field];
    result[field] = typeof value === "string" && value === "" ? null : value ?? null;
  }
  return result;
}

export function validateReviewDetailsPatch(input: unknown): ReviewValues {
  return normalizePatch(input);
}

function pickValues(attributes: Record<string, unknown> | undefined, fields: readonly ReviewDetailField[]): ReviewValues {
  const values: ReviewValues = {};
  for (const field of fields) {
    const value = attributes?.[field];
    values[field] = typeof value === "string" || typeof value === "boolean" ? value : null;
  }
  return values;
}

function publicValues(values: ReviewValues): Record<string, string | null> {
  return Object.fromEntries(Object.entries(values).map(([field, value]) => {
    if (field === "demoAccountPassword") return [field, value ? "<redacted>" : null];
    if (typeof value === "boolean") return [field, String(value)];
    return [field, value];
  }));
}

function valuesHash(reviewDetailId: string | null, values: ReviewValues): string {
  const canonical = {
    reviewDetailId,
    values: Object.keys(values).sort().map((key) => [key, values[key as ReviewDetailField]]),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function sameValues(left: ReviewValues, right: ReviewValues): boolean {
  return valuesHash(null, left) === valuesHash(null, right);
}

function isNotFound(error: unknown): boolean {
  return error instanceof AscError && error.status === 404;
}

async function readReviewState(
  accountId: string,
  versionId: string,
  fields: readonly ReviewDetailField[],
  services: ReviewDetailsChangeServices,
): Promise<ReviewState> {
  try {
    const resource = await services.request(accountId, {
      method: "GET",
      path: `/v1/appStoreVersions/${versionId}/appStoreReviewDetail`,
    }) as ReviewResponse;
    return {
      reviewDetailId: resource.data.id,
      values: pickValues(resource.data.attributes, fields),
      resource,
    };
  } catch (error) {
    if (!isNotFound(error)) throw error;
    return {
      reviewDetailId: null,
      values: Object.fromEntries(fields.map((field) => [field, null])) as ReviewValues,
    };
  }
}

function assertCreateRequirements(after: ReviewValues): void {
  const required: ReviewDetailField[] = [
    "contactFirstName",
    "contactLastName",
    "contactPhone",
    "contactEmail",
    "demoAccountRequired",
  ];
  const missing = required.filter((field) => after[field] === null || after[field] === undefined || after[field] === "");
  if (after.demoAccountRequired === true) {
    for (const field of ["demoAccountName", "demoAccountPassword"] as const) {
      if (!after[field]) missing.push(field);
    }
  }
  if (missing.length > 0) throw new Error(`REVIEW_DETAILS_CREATE_FIELDS_REQUIRED:${[...new Set(missing)].join(",")}`);
}

export async function createReviewDetailsChangePlan(input: {
  accountId: string;
  versionId: string;
  attributes: unknown;
  restoresSnapshotId?: string;
}, services: ReviewDetailsChangeServices = defaultServices): Promise<StoredChangePlan> {
  const patch = normalizePatch(input.attributes);
  const requestedFields = Object.keys(patch) as ReviewDetailField[];
  const current = await readReviewState(input.accountId, input.versionId, requestedFields, services);
  if (!current.reviewDetailId) assertCreateRequirements(patch);

  const after: ReviewValues = { ...current.values, ...patch };
  const changedFields = requestedFields.filter((field) => current.values[field] !== after[field]);
  const changedBefore = Object.fromEntries(changedFields.map((field) => [field, current.values[field] ?? null])) as ReviewValues;
  const changedAfter = Object.fromEntries(changedFields.map((field) => [field, after[field] ?? null])) as ReviewValues;
  const now = Date.now();
  const plan: StoredChangePlan = {
    id: `plan_${randomUUID()}`,
    kind: "app-store-review-details",
    accountId: input.accountId,
    resourceId: input.versionId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    status: "planned",
    changedFields,
    before: publicValues(changedBefore),
    after: publicValues(changedAfter),
    beforeHash: valuesHash(current.reviewDetailId, changedBefore),
    restoresSnapshotId: input.restoresSnapshotId,
  };
  const secure: SecureReviewPlanPayload = {
    versionId: input.versionId,
    reviewDetailId: current.reviewDetailId,
    existedBefore: Boolean(current.reviewDetailId),
    before: changedBefore,
    after: changedAfter,
  };
  await services.secureStore.set(plan.id, secure);
  try {
    await services.savePlan(plan);
  } catch (error) {
    await services.secureStore.delete(plan.id);
    throw error;
  }
  return plan;
}

export async function checkReviewDetailsChangePlan(
  planId: string,
  services: ReviewDetailsChangeServices = defaultServices,
): Promise<StoredChangePlan> {
  const plan = await services.loadPlan(planId);
  if (plan.kind !== "app-store-review-details") throw new Error("UNSUPPORTED_CHANGE_KIND");
  if (plan.status === "applied") return plan;
  if (Date.now() > Date.parse(plan.expiresAt)) throw new Error("PLAN_EXPIRED");
  if (plan.changedFields.length === 0) return plan;
  const secure = await services.secureStore.get<SecureReviewPlanPayload>(plan.id);
  const current = await readReviewState(plan.accountId, secure.versionId, plan.changedFields as ReviewDetailField[], services);
  if (valuesHash(current.reviewDetailId, current.values) !== plan.beforeHash) {
    throw new Error("PLAN_CONFLICT: App Review details changed after this plan was created.");
  }
  return plan;
}

export async function applyReviewDetailsChangePlan(
  planId: string,
  services: ReviewDetailsChangeServices = defaultServices,
): Promise<ReviewDetailsChangeResult> {
  const plan = await services.loadPlan(planId);
  if (plan.kind !== "app-store-review-details") throw new Error("UNSUPPORTED_CHANGE_KIND");
  if (plan.status === "applied") {
    return { plan, snapshot: plan.snapshotId ? await services.loadSnapshot(plan.snapshotId) : undefined };
  }
  await checkReviewDetailsChangePlan(planId, services);
  if (plan.changedFields.length === 0) {
    const applied = { ...plan, status: "applied" as const, appliedAt: new Date().toISOString() };
    await services.savePlan(applied);
    return { plan: applied };
  }

  const securePlan = await services.secureStore.get<SecureReviewPlanPayload>(plan.id);
  const snapshot: StoredSnapshot = {
    id: `snap_${randomUUID()}`,
    kind: "app-store-review-details",
    accountId: plan.accountId,
    resourceId: securePlan.versionId,
    planId: plan.id,
    createdAt: new Date().toISOString(),
    status: "pending",
    changedFields: [...plan.changedFields],
    before: publicValues(securePlan.before),
    expectedAfter: publicValues(securePlan.after),
    restorable: securePlan.existedBefore,
    nonRestorableReason: securePlan.existedBefore
      ? undefined
      : "Apple does not expose an API to delete a newly created App Review details resource.",
  };
  const secureSnapshot: SecureReviewSnapshotPayload = { ...securePlan };
  await services.secureStore.set(snapshot.id, secureSnapshot);
  try {
    await services.saveSnapshot(snapshot);
  } catch (error) {
    await services.secureStore.delete(snapshot.id);
    throw error;
  }

  try {
    let writeResponse: ReviewResponse;
    if (securePlan.reviewDetailId) {
      writeResponse = await services.request(plan.accountId, {
        method: "PATCH",
        path: `/v1/appStoreReviewDetails/${securePlan.reviewDetailId}`,
        body: {
          data: {
            id: securePlan.reviewDetailId,
            type: "appStoreReviewDetails",
            attributes: securePlan.after,
          },
        },
      }) as ReviewResponse;
    } else {
      writeResponse = await services.request(plan.accountId, {
        method: "POST",
        path: "/v1/appStoreReviewDetails",
        body: {
          data: {
            type: "appStoreReviewDetails",
            attributes: securePlan.after,
            relationships: {
              appStoreVersion: { data: { type: "appStoreVersions", id: securePlan.versionId } },
            },
          },
        },
      }) as ReviewResponse;
    }

    const current = await readReviewState(
      plan.accountId,
      securePlan.versionId,
      plan.changedFields as ReviewDetailField[],
      services,
    );
    if (!sameValues(current.values, securePlan.after)) {
      throw new Error("APPLY_VERIFICATION_FAILED: App Review details do not match the approved plan.");
    }
    const appliedAt = new Date().toISOString();
    const publicActual = publicValues(current.values);
    const appliedSnapshot: StoredSnapshot = { ...snapshot, status: "applied", actualAfter: publicActual, appliedAt };
    const appliedPlan: StoredChangePlan = { ...plan, status: "applied", snapshotId: snapshot.id, appliedAt };
    await services.secureStore.set(snapshot.id, {
      ...secureSnapshot,
      actualAfter: current.values,
      appliedReviewDetailId: current.reviewDetailId ?? writeResponse.data.id,
    } satisfies SecureReviewSnapshotPayload);
    await services.saveSnapshot(appliedSnapshot);
    await services.savePlan(appliedPlan);
    return { plan: appliedPlan, snapshot: appliedSnapshot, resource: current.resource ?? writeResponse };
  } catch (error) {
    const message = (error as Error).message;
    let current: ReviewState | undefined;
    try {
      current = await readReviewState(
        plan.accountId,
        securePlan.versionId,
        plan.changedFields as ReviewDetailField[],
        services,
      );
    } catch {
      // Keep both encrypted and redacted before-state records for manual recovery.
    }
    if (current?.reviewDetailId && sameValues(current.values, securePlan.after)) {
      const appliedAt = new Date().toISOString();
      const recoveredSnapshot: StoredSnapshot = {
        ...snapshot,
        status: "applied",
        actualAfter: publicValues(current.values),
        appliedAt,
      };
      const recoveredPlan: StoredChangePlan = { ...plan, status: "applied", snapshotId: snapshot.id, appliedAt };
      await services.secureStore.set(snapshot.id, {
        ...secureSnapshot,
        actualAfter: current.values,
        appliedReviewDetailId: current.reviewDetailId,
      } satisfies SecureReviewSnapshotPayload);
      await services.saveSnapshot(recoveredSnapshot);
      await services.savePlan(recoveredPlan);
      return { plan: recoveredPlan, snapshot: recoveredSnapshot, resource: current.resource };
    }

    await services.saveSnapshot({
      ...snapshot,
      status: "uncertain",
      actualAfter: current ? publicValues(current.values) : undefined,
      failure: message,
    });
    if (current) {
      await services.secureStore.set(snapshot.id, {
        ...secureSnapshot,
        actualAfter: current.values,
        appliedReviewDetailId: current.reviewDetailId ?? undefined,
      } satisfies SecureReviewSnapshotPayload);
    }
    await services.savePlan({ ...plan, status: "failed", snapshotId: snapshot.id, failure: message });
    throw error;
  }
}

export async function updateReviewDetailsWithSnapshot(input: {
  accountId: string;
  versionId: string;
  attributes: unknown;
}, services: ReviewDetailsChangeServices = defaultServices): Promise<ReviewDetailsChangeResult> {
  const plan = await createReviewDetailsChangePlan(input, services);
  return applyReviewDetailsChangePlan(plan.id, services);
}

export async function restoreReviewDetailsSnapshot(input: {
  snapshotId: string;
  force?: boolean;
}, services: ReviewDetailsChangeServices = defaultServices): Promise<ReviewDetailsChangeResult> {
  const snapshot = await services.loadSnapshot(input.snapshotId);
  if (snapshot.kind !== "app-store-review-details") throw new Error("UNSUPPORTED_CHANGE_KIND");
  if (snapshot.restorable === false) throw new Error(`SNAPSHOT_NOT_RESTORABLE:${snapshot.nonRestorableReason ?? "unknown"}`);
  if (snapshot.status !== "applied" && snapshot.status !== "uncertain") throw new Error("SNAPSHOT_NOT_RESTORABLE");
  const secure = await services.secureStore.get<SecureReviewSnapshotPayload>(snapshot.id);
  if (!secure.actualAfter && !input.force) {
    throw new Error("SNAPSHOT_STATE_UNCERTAIN: Retry with force=true after reviewing ASC state.");
  }
  const current = await readReviewState(
    snapshot.accountId,
    secure.versionId,
    snapshot.changedFields as ReviewDetailField[],
    services,
  );
  if (!input.force && (
    current.reviewDetailId !== secure.appliedReviewDetailId
    || (secure.actualAfter && !sameValues(current.values, secure.actualAfter))
  )) {
    throw new Error("RESTORE_CONFLICT: App Review details changed after this snapshot.");
  }

  const plan = await createReviewDetailsChangePlan({
    accountId: snapshot.accountId,
    versionId: secure.versionId,
    attributes: secure.before,
    restoresSnapshotId: snapshot.id,
  }, services);
  const result = await applyReviewDetailsChangePlan(plan.id, services);
  await services.saveSnapshot({ ...snapshot, restoredAt: new Date().toISOString() });
  return result;
}
