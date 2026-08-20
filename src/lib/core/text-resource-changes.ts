import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { ascRequest } from "@/lib/asc/client";
import {
  loadChangePlan,
  loadSnapshot,
  saveChangePlan,
  saveSnapshot,
  type ProtectedTextChangeKind,
  type StoredChangePlan,
  type StoredSnapshot,
} from "./change-store";

export type TextResourceChangeKind = Exclude<
  ProtectedTextChangeKind,
  "app-store-version-localization" | "app-store-review-details"
>;

const nullableString = (max: number) => z.string().max(max).nullable().optional();

function requireAtLeastOneField(value: object, context: z.RefinementCtx): void {
  if (Object.keys(value).length === 0) {
    context.addIssue({ code: "custom", message: "At least one localization field is required." });
  }
}

function validateOptionalHttpUrl(
  value: string | null | undefined,
  context: z.RefinementCtx,
  field: string,
): void {
  if (value == null || value === "") return;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("protocol");
  } catch {
    context.addIssue({ code: "custom", path: [field], message: `${field} must be an HTTP(S) URL.` });
  }
}

const appInfoSchema = z.object({
  name: nullableString(30),
  subtitle: nullableString(30),
  privacyPolicyUrl: nullableString(2048),
}).strict().superRefine((value, context) => {
  requireAtLeastOneField(value, context);
  validateOptionalHttpUrl(value.privacyPolicyUrl, context, "privacyPolicyUrl");
});

const subscriptionSchema = z.object({
  name: nullableString(30),
  description: nullableString(45),
}).strict().superRefine(requireAtLeastOneField);

const betaBuildSchema = z.object({
  whatsNew: nullableString(4000),
}).strict().superRefine(requireAtLeastOneField);

interface TextResourcePolicy {
  path: string;
  ascType: string;
  fields: readonly string[];
  schema: z.ZodType<Record<string, string | null | undefined>>;
}

const policies: Record<TextResourceChangeKind, TextResourcePolicy> = {
  "app-info-localization": {
    path: "appInfoLocalizations",
    ascType: "appInfoLocalizations",
    fields: ["name", "subtitle", "privacyPolicyUrl"],
    schema: appInfoSchema,
  },
  "subscription-localization": {
    path: "subscriptionLocalizations",
    ascType: "subscriptionLocalizations",
    fields: ["name", "description"],
    schema: subscriptionSchema,
  },
  "beta-build-localization": {
    path: "betaBuildLocalizations",
    ascType: "betaBuildLocalizations",
    fields: ["whatsNew"],
    schema: betaBuildSchema,
  },
};

interface TextResourceResponse {
  data: {
    id: string;
    type: string;
    attributes?: Record<string, unknown>;
  };
}

export interface TextResourceChangeResult {
  plan: StoredChangePlan;
  snapshot?: StoredSnapshot;
  resource?: TextResourceResponse;
}

export interface TextResourceChangeServices {
  request: typeof ascRequest;
  savePlan: typeof saveChangePlan;
  loadPlan: typeof loadChangePlan;
  saveSnapshot: typeof saveSnapshot;
  loadSnapshot: typeof loadSnapshot;
}

const defaultServices: TextResourceChangeServices = {
  request: ascRequest,
  savePlan: saveChangePlan,
  loadPlan: loadChangePlan,
  saveSnapshot,
  loadSnapshot,
};

function policyFor(kind: ProtectedTextChangeKind): TextResourcePolicy {
  if (kind === "app-store-version-localization" || kind === "app-store-review-details") {
    throw new Error("UNSUPPORTED_CHANGE_KIND");
  }
  const policy = policies[kind];
  if (!policy) throw new Error("UNSUPPORTED_CHANGE_KIND");
  return policy;
}

function normalizePatch(kind: TextResourceChangeKind, input: unknown): Record<string, string | null> {
  const policy = policies[kind];
  const parsed = policy.schema.parse(input);
  const normalized: Record<string, string | null> = {};
  for (const field of policy.fields) {
    if (!(field in parsed)) continue;
    normalized[field] = parsed[field] === "" ? null : parsed[field] ?? null;
  }
  return normalized;
}

export function validateTextResourcePatch(
  kind: TextResourceChangeKind,
  input: unknown,
): Record<string, string | null> {
  return normalizePatch(kind, input);
}

function pickValues(
  attributes: Record<string, unknown> | undefined,
  fields: readonly string[],
): Record<string, string | null> {
  return Object.fromEntries(fields.map((field) => [
    field,
    typeof attributes?.[field] === "string" ? attributes[field] as string : null,
  ]));
}

function valuesHash(values: Record<string, string | null>): string {
  const canonical = Object.keys(values)
    .sort()
    .map((key) => [key, values[key]]);
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function sameValues(
  left: Record<string, string | null>,
  right: Record<string, string | null>,
): boolean {
  return valuesHash(left) === valuesHash(right);
}

async function readResource(
  kind: TextResourceChangeKind,
  accountId: string,
  resourceId: string,
  services: TextResourceChangeServices,
): Promise<TextResourceResponse> {
  const policy = policies[kind];
  return await services.request(accountId, {
    method: "GET",
    path: `/v1/${policy.path}/${resourceId}`,
  }) as TextResourceResponse;
}

export async function createTextResourceChangePlan(input: {
  kind: TextResourceChangeKind;
  accountId: string;
  resourceId: string;
  attributes: unknown;
  restoresSnapshotId?: string;
}, services: TextResourceChangeServices = defaultServices): Promise<StoredChangePlan> {
  const patch = normalizePatch(input.kind, input.attributes);
  const requestedFields = Object.keys(patch);
  const current = await readResource(input.kind, input.accountId, input.resourceId, services);
  const before = pickValues(current.data.attributes, requestedFields);
  const changedFields = requestedFields.filter((field) => before[field] !== patch[field]);
  const changedBefore = Object.fromEntries(changedFields.map((field) => [field, before[field]]));
  const changedAfter = Object.fromEntries(changedFields.map((field) => [field, patch[field]]));
  const now = Date.now();

  const plan: StoredChangePlan = {
    id: `plan_${randomUUID()}`,
    kind: input.kind,
    accountId: input.accountId,
    resourceId: input.resourceId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    status: "planned",
    changedFields,
    before: changedBefore,
    after: changedAfter,
    beforeHash: valuesHash(changedBefore),
    restoresSnapshotId: input.restoresSnapshotId,
  };
  await services.savePlan(plan);
  return plan;
}

export async function checkTextResourceChangePlan(
  planId: string,
  services: TextResourceChangeServices = defaultServices,
): Promise<StoredChangePlan> {
  const plan = await services.loadPlan(planId);
  const kind = plan.kind;
  policyFor(kind);
  if (plan.status === "applied") return plan;
  if (Date.now() > Date.parse(plan.expiresAt)) throw new Error("PLAN_EXPIRED");
  if (plan.changedFields.length === 0) return plan;

  const current = await readResource(kind as TextResourceChangeKind, plan.accountId, plan.resourceId, services);
  const currentValues = pickValues(current.data.attributes, plan.changedFields);
  if (valuesHash(currentValues) !== plan.beforeHash) {
    throw new Error(`PLAN_CONFLICT: ASC changed after this plan was created. Current=${JSON.stringify(currentValues)}`);
  }
  return plan;
}

export async function applyTextResourceChangePlan(
  planId: string,
  services: TextResourceChangeServices = defaultServices,
): Promise<TextResourceChangeResult> {
  const plan = await services.loadPlan(planId);
  const policy = policyFor(plan.kind);
  const kind = plan.kind as TextResourceChangeKind;
  if (plan.status === "applied") {
    return { plan, snapshot: plan.snapshotId ? await services.loadSnapshot(plan.snapshotId) : undefined };
  }
  await checkTextResourceChangePlan(planId, services);

  if (plan.changedFields.length === 0) {
    const applied = { ...plan, status: "applied" as const, appliedAt: new Date().toISOString() };
    await services.savePlan(applied);
    return { plan: applied };
  }

  const current = await readResource(kind, plan.accountId, plan.resourceId, services);
  const currentValues = pickValues(current.data.attributes, plan.changedFields);
  const snapshot: StoredSnapshot = {
    id: `snap_${randomUUID()}`,
    kind,
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
      path: `/v1/${policy.path}/${plan.resourceId}`,
      body: {
        data: {
          id: plan.resourceId,
          type: policy.ascType,
          attributes: plan.after,
        },
      },
    });

    const resource = await readResource(kind, plan.accountId, plan.resourceId, services);
    const actualAfter = pickValues(resource.data.attributes, plan.changedFields);
    if (!sameValues(actualAfter, plan.after)) {
      throw new Error(`APPLY_VERIFICATION_FAILED: Expected=${JSON.stringify(plan.after)} Actual=${JSON.stringify(actualAfter)}`);
    }

    const appliedAt = new Date().toISOString();
    const appliedSnapshot: StoredSnapshot = { ...snapshot, status: "applied", actualAfter, appliedAt };
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
      const currentAfterFailure = await readResource(kind, plan.accountId, plan.resourceId, services);
      actualAfter = pickValues(currentAfterFailure.data.attributes, plan.changedFields);
    } catch {
      // Preserve the immutable before-state even when ASC is temporarily unreachable.
    }

    if (actualAfter && sameValues(actualAfter, plan.after)) {
      const appliedAt = new Date().toISOString();
      const recoveredSnapshot: StoredSnapshot = { ...snapshot, status: "applied", actualAfter, appliedAt };
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

    await services.saveSnapshot({ ...snapshot, status: "uncertain", actualAfter, failure: message });
    await services.savePlan({ ...plan, status: "failed", snapshotId: snapshot.id, failure: message });
    throw error;
  }
}

export async function updateTextResourceWithSnapshot(input: {
  kind: TextResourceChangeKind;
  accountId: string;
  resourceId: string;
  attributes: unknown;
}, services: TextResourceChangeServices = defaultServices): Promise<TextResourceChangeResult> {
  const plan = await createTextResourceChangePlan(input, services);
  return applyTextResourceChangePlan(plan.id, services);
}

export async function restoreTextResourceSnapshot(input: {
  snapshotId: string;
  force?: boolean;
}, services: TextResourceChangeServices = defaultServices): Promise<TextResourceChangeResult> {
  const snapshot = await services.loadSnapshot(input.snapshotId);
  policyFor(snapshot.kind);
  const kind = snapshot.kind as TextResourceChangeKind;
  if (snapshot.status !== "applied" && snapshot.status !== "uncertain") throw new Error("SNAPSHOT_NOT_RESTORABLE");
  if (!snapshot.actualAfter && !input.force) {
    throw new Error("SNAPSHOT_STATE_UNCERTAIN: Retry with force=true after reviewing ASC state.");
  }

  const current = await readResource(kind, snapshot.accountId, snapshot.resourceId, services);
  const currentValues = pickValues(current.data.attributes, snapshot.changedFields);
  if (!input.force && snapshot.actualAfter && !sameValues(currentValues, snapshot.actualAfter)) {
    throw new Error(`RESTORE_CONFLICT: ASC changed after this snapshot. Current=${JSON.stringify(currentValues)}`);
  }

  const plan = await createTextResourceChangePlan({
    kind,
    accountId: snapshot.accountId,
    resourceId: snapshot.resourceId,
    attributes: snapshot.before,
    restoresSnapshotId: snapshot.id,
  }, services);
  const result = await applyTextResourceChangePlan(plan.id, services);
  await services.saveSnapshot({ ...snapshot, restoredAt: new Date().toISOString() });
  return result;
}
