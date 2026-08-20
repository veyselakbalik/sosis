import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { ascRequest } from "@/lib/asc/client";
import {
  listSnapshots,
  listChangePlans,
  loadChangePlan,
  loadSnapshot,
  saveChangePlan,
  saveSnapshot,
  type StoredChangePlan,
  type StoredSnapshot,
} from "./change-store";

export const LOCALIZATION_FIELDS = [
  "description",
  "keywords",
  "whatsNew",
  "promotionalText",
  "marketingUrl",
  "supportUrl",
] as const;

export type LocalizationField = (typeof LOCALIZATION_FIELDS)[number];
export type LocalizationPatch = Partial<Record<LocalizationField, string | null>>;

const nullableLimitedString = (max: number) => z.string().max(max).nullable().optional();
const localizationPatchSchema = z.object({
  description: nullableLimitedString(4000),
  keywords: nullableLimitedString(100),
  whatsNew: nullableLimitedString(4000),
  promotionalText: nullableLimitedString(170),
  marketingUrl: z.string().max(2048).nullable().optional(),
  supportUrl: z.string().max(2048).nullable().optional(),
}).strict().superRefine((value, context) => {
  if (Object.keys(value).length === 0) {
    context.addIssue({ code: "custom", message: "At least one localization field is required." });
  }
  for (const field of ["marketingUrl", "supportUrl"] as const) {
    const candidate = value[field];
    if (candidate == null || candidate === "") continue;
    try {
      const url = new URL(candidate);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("protocol");
    } catch {
      context.addIssue({ code: "custom", path: [field], message: `${field} must be an HTTP(S) URL.` });
    }
  }
});

interface LocalizationResponse {
  data: {
    id: string;
    type: string;
    attributes?: Record<string, unknown>;
  };
}

export interface LocalizationChangeResult {
  plan: StoredChangePlan;
  snapshot?: StoredSnapshot;
  resource?: LocalizationResponse;
}

export interface LocalizationChangeServices {
  request: typeof ascRequest;
  savePlan: typeof saveChangePlan;
  loadPlan: typeof loadChangePlan;
  listPlans: typeof listChangePlans;
  saveSnapshot: typeof saveSnapshot;
  loadSnapshot: typeof loadSnapshot;
}

const defaultServices: LocalizationChangeServices = {
  request: ascRequest,
  savePlan: saveChangePlan,
  loadPlan: loadChangePlan,
  listPlans: listChangePlans,
  saveSnapshot,
  loadSnapshot,
};

function normalizePatch(input: unknown): LocalizationPatch {
  const parsed = localizationPatchSchema.parse(input);
  const normalized: LocalizationPatch = {};
  for (const field of LOCALIZATION_FIELDS) {
    if (!(field in parsed)) continue;
    const value = parsed[field];
    normalized[field] = value === "" ? null : value;
  }
  return normalized;
}

export function validateLocalizationPatch(input: unknown): LocalizationPatch {
  return normalizePatch(input);
}

function pickValues(attributes: Record<string, unknown> | undefined, fields: readonly LocalizationField[]) {
  const picked: Record<string, string | null> = {};
  for (const field of fields) {
    const value = attributes?.[field];
    picked[field] = typeof value === "string" ? value : null;
  }
  return picked;
}

function valuesHash(values: Record<string, string | null>): string {
  const canonical = Object.keys(values)
    .sort()
    .map((key) => [key, values[key]]);
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function sameValues(a: Record<string, string | null>, b: Record<string, string | null>): boolean {
  return valuesHash(a) === valuesHash(b);
}

async function readLocalization(
  accountId: string,
  resourceId: string,
  services: LocalizationChangeServices,
): Promise<LocalizationResponse> {
  return await services.request(accountId, {
    method: "GET",
    path: `/v1/appStoreVersionLocalizations/${resourceId}`,
  }) as LocalizationResponse;
}

export async function createLocalizationChangePlan(input: {
  accountId: string;
  localizationId: string;
  attributes: unknown;
  restoresSnapshotId?: string;
  batchId?: string;
  locale?: string;
}, services: LocalizationChangeServices = defaultServices): Promise<StoredChangePlan> {
  const patch = normalizePatch(input.attributes);
  const requestedFields = Object.keys(patch) as LocalizationField[];
  const current = await readLocalization(input.accountId, input.localizationId, services);
  const before = pickValues(current.data.attributes, requestedFields);

  const after: Record<string, string | null> = { ...before };
  for (const field of requestedFields) after[field] = patch[field] ?? null;
  const changedFields = requestedFields.filter((field) => before[field] !== after[field]);
  const changedBefore = Object.fromEntries(changedFields.map((field) => [field, before[field]]));
  const changedAfter = Object.fromEntries(changedFields.map((field) => [field, after[field]]));
  const now = Date.now();

  const plan: StoredChangePlan = {
    id: `plan_${randomUUID()}`,
    kind: "app-store-version-localization",
    accountId: input.accountId,
    resourceId: input.localizationId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    status: "planned",
    changedFields,
    before: changedBefore,
    after: changedAfter,
    beforeHash: valuesHash(changedBefore),
    restoresSnapshotId: input.restoresSnapshotId,
    batchId: input.batchId,
    locale: input.locale,
  };
  await services.savePlan(plan);
  return plan;
}

export async function checkLocalizationChangePlan(
  planId: string,
  services: LocalizationChangeServices = defaultServices,
): Promise<StoredChangePlan> {
  const plan = await services.loadPlan(planId);
  if (plan.kind !== "app-store-version-localization") throw new Error("UNSUPPORTED_CHANGE_KIND");
  if (plan.status === "applied") return plan;
  if (Date.now() > Date.parse(plan.expiresAt)) throw new Error("PLAN_EXPIRED");
  if (plan.changedFields.length === 0) return plan;

  const fields = plan.changedFields as LocalizationField[];
  const current = await readLocalization(plan.accountId, plan.resourceId, services);
  const currentValues = pickValues(current.data.attributes, fields);
  if (valuesHash(currentValues) !== plan.beforeHash) {
    throw new Error(`PLAN_CONFLICT: ASC changed after this plan was created. Current=${JSON.stringify(currentValues)}`);
  }
  return plan;
}

export async function applyLocalizationChangePlan(
  planId: string,
  services: LocalizationChangeServices = defaultServices,
): Promise<LocalizationChangeResult> {
  const plan = await services.loadPlan(planId);
  if (plan.kind !== "app-store-version-localization") throw new Error("UNSUPPORTED_CHANGE_KIND");
  if (plan.status === "applied") {
    return { plan, snapshot: plan.snapshotId ? await services.loadSnapshot(plan.snapshotId) : undefined };
  }
  await checkLocalizationChangePlan(planId, services);

  if (plan.changedFields.length === 0) {
    const applied = { ...plan, status: "applied" as const, appliedAt: new Date().toISOString() };
    await services.savePlan(applied);
    return { plan: applied };
  }

  const fields = plan.changedFields as LocalizationField[];
  const current = await readLocalization(plan.accountId, plan.resourceId, services);
  const currentValues = pickValues(current.data.attributes, fields);

  const snapshot: StoredSnapshot = {
    id: `snap_${randomUUID()}`,
    kind: "app-store-version-localization",
    accountId: plan.accountId,
    resourceId: plan.resourceId,
    planId: plan.id,
    createdAt: new Date().toISOString(),
    status: "pending",
    changedFields: [...plan.changedFields],
    before: currentValues,
    expectedAfter: plan.after,
  };
  await services.saveSnapshot(snapshot);

  try {
    await services.request(plan.accountId, {
      method: "PATCH",
      path: `/v1/appStoreVersionLocalizations/${plan.resourceId}`,
      body: {
        data: {
          id: plan.resourceId,
          type: "appStoreVersionLocalizations",
          attributes: plan.after,
        },
      },
    });

    const resource = await readLocalization(plan.accountId, plan.resourceId, services);
    const actualAfter = pickValues(resource.data.attributes, fields);
    if (!sameValues(actualAfter, plan.after)) {
      throw new Error(`APPLY_VERIFICATION_FAILED: Expected=${JSON.stringify(plan.after)} Actual=${JSON.stringify(actualAfter)}`);
    }

    const appliedAt = new Date().toISOString();
    const appliedSnapshot: StoredSnapshot = {
      ...snapshot,
      status: "applied",
      actualAfter,
      appliedAt,
    };
    const appliedPlan: StoredChangePlan = {
      ...plan,
      status: "applied",
      snapshotId: snapshot.id,
      appliedAt,
    };
    await services.saveSnapshot(appliedSnapshot);
    await services.savePlan(appliedPlan);
    return { plan: appliedPlan, snapshot: appliedSnapshot, resource };
  } catch (error) {
    const message = (error as Error).message;
    let actualAfter: Record<string, string | null> | undefined;
    try {
      const currentAfterFailure = await readLocalization(plan.accountId, plan.resourceId, services);
      actualAfter = pickValues(currentAfterFailure.data.attributes, fields);
    } catch {
      // The network may be unavailable; preserve the before-state regardless.
    }

    if (actualAfter && sameValues(actualAfter, plan.after)) {
      const appliedAt = new Date().toISOString();
      const recoveredSnapshot: StoredSnapshot = {
        ...snapshot,
        status: "applied",
        actualAfter,
        appliedAt,
      };
      const recoveredPlan: StoredChangePlan = {
        ...plan,
        status: "applied",
        snapshotId: snapshot.id,
        appliedAt,
      };
      await services.saveSnapshot(recoveredSnapshot);
      await services.savePlan(recoveredPlan);
      return { plan: recoveredPlan, snapshot: recoveredSnapshot };
    }

    await services.saveSnapshot({
      ...snapshot,
      status: "uncertain",
      actualAfter,
      failure: message,
    });
    await services.savePlan({ ...plan, status: "failed", snapshotId: snapshot.id, failure: message });
    throw error;
  }
}

export async function updateLocalizationWithSnapshot(input: {
  accountId: string;
  localizationId: string;
  attributes: unknown;
}, services: LocalizationChangeServices = defaultServices): Promise<LocalizationChangeResult> {
  const plan = await createLocalizationChangePlan(input, services);
  return applyLocalizationChangePlan(plan.id, services);
}

export async function restoreLocalizationSnapshot(input: {
  snapshotId: string;
  force?: boolean;
}, services: LocalizationChangeServices = defaultServices): Promise<LocalizationChangeResult> {
  const snapshot = await services.loadSnapshot(input.snapshotId);
  if (snapshot.kind !== "app-store-version-localization") throw new Error("UNSUPPORTED_CHANGE_KIND");
  if (snapshot.status !== "applied" && snapshot.status !== "uncertain") throw new Error("SNAPSHOT_NOT_RESTORABLE");
  if (!snapshot.actualAfter && !input.force) throw new Error("SNAPSHOT_STATE_UNCERTAIN: Retry with force=true after reviewing ASC state.");

  const fields = snapshot.changedFields as LocalizationField[];
  const current = await readLocalization(snapshot.accountId, snapshot.resourceId, services);
  const currentValues = pickValues(current.data.attributes, fields);
  if (!input.force && snapshot.actualAfter && !sameValues(currentValues, snapshot.actualAfter)) {
    throw new Error(`RESTORE_CONFLICT: ASC changed after this snapshot. Current=${JSON.stringify(currentValues)}`);
  }

  const plan = await createLocalizationChangePlan({
    accountId: snapshot.accountId,
    localizationId: snapshot.resourceId,
    attributes: snapshot.before,
    restoresSnapshotId: snapshot.id,
  }, services);
  const result = await applyLocalizationChangePlan(plan.id, services);
  await services.saveSnapshot({ ...snapshot, restoredAt: new Date().toISOString() });
  return result;
}

export async function createLocalizationBatchPlan(input: {
  accountId: string;
  updates: Array<{ localizationId: string; locale?: string; attributes: unknown }>;
}, services: LocalizationChangeServices = defaultServices): Promise<{ batchId: string; plans: StoredChangePlan[] }> {
  if (input.updates.length === 0) throw new Error("EMPTY_LOCALIZATION_BATCH");
  if (input.updates.length > 50) throw new Error("LOCALIZATION_BATCH_TOO_LARGE");
  const ids = input.updates.map((update) => update.localizationId);
  if (new Set(ids).size !== ids.length) throw new Error("DUPLICATE_LOCALIZATION_IN_BATCH");

  // Validate every payload before performing the first ASC read or writing a
  // plan file, so malformed batches fail as a unit.
  for (const update of input.updates) normalizePatch(update.attributes);

  const batchId = `batch_${randomUUID()}`;
  const plans: StoredChangePlan[] = [];
  for (const update of input.updates) {
    plans.push(await createLocalizationChangePlan({
      accountId: input.accountId,
      localizationId: update.localizationId,
      locale: update.locale,
      attributes: update.attributes,
      batchId,
    }, services));
  }
  return { batchId, plans };
}

export interface LocalizationBatchApplyResult {
  batchId: string;
  status: "applied" | "partial" | "blocked";
  results: Array<{
    planId: string;
    localizationId: string;
    locale?: string;
    status: "applied" | "skipped" | "error";
    snapshotId?: string;
    error?: string;
  }>;
}

export async function applyLocalizationBatchPlan(
  batchId: string,
  services: LocalizationChangeServices = defaultServices,
): Promise<LocalizationBatchApplyResult> {
  const plans = (await services.listPlans({ batchId }))
    .filter((plan) => plan.kind === "app-store-version-localization");
  if (plans.length === 0) throw new Error("CHANGE_NOT_FOUND");

  const preflightErrors = new Map<string, string>();
  await Promise.all(plans.map(async (plan) => {
    try {
      await checkLocalizationChangePlan(plan.id, services);
    } catch (error) {
      preflightErrors.set(plan.id, (error as Error).message);
    }
  }));
  if (preflightErrors.size > 0) {
    return {
      batchId,
      status: "blocked",
      results: plans.map((plan) => ({
        planId: plan.id,
        localizationId: plan.resourceId,
        locale: plan.locale,
        status: preflightErrors.has(plan.id) ? "error" : "skipped",
        error: preflightErrors.get(plan.id),
      })),
    };
  }

  const results: LocalizationBatchApplyResult["results"] = [];
  for (const [index, plan] of plans.entries()) {
    try {
      const applied = await applyLocalizationChangePlan(plan.id, services);
      results.push({
        planId: plan.id,
        localizationId: plan.resourceId,
        locale: plan.locale,
        status: "applied",
        snapshotId: applied.snapshot?.id,
      });
    } catch (error) {
      results.push({
        planId: plan.id,
        localizationId: plan.resourceId,
        locale: plan.locale,
        status: "error",
        error: (error as Error).message,
      });
      for (const pending of plans.slice(index + 1)) {
        results.push({
          planId: pending.id,
          localizationId: pending.resourceId,
          locale: pending.locale,
          status: "skipped",
        });
      }
      return { batchId, status: "partial", results };
    }
  }
  return { batchId, status: "applied", results };
}

export { listSnapshots };
