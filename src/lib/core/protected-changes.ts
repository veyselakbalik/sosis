import { loadChangePlan, loadSnapshot } from "./change-store";
import {
  applyLocalizationChangePlan,
  restoreLocalizationSnapshot,
  type LocalizationChangeResult,
} from "./localization-changes";
import {
  applyTextResourceChangePlan,
  restoreTextResourceSnapshot,
  type TextResourceChangeResult,
} from "./text-resource-changes";
import {
  applyReviewDetailsChangePlan,
  restoreReviewDetailsSnapshot,
  type ReviewDetailsChangeResult,
} from "./review-details-changes";

export type ProtectedChangeResult = LocalizationChangeResult | TextResourceChangeResult | ReviewDetailsChangeResult;

export async function applyProtectedChangePlan(planId: string): Promise<ProtectedChangeResult> {
  const plan = await loadChangePlan(planId);
  if (plan.kind === "app-store-version-localization") return applyLocalizationChangePlan(planId);
  if (plan.kind === "app-store-review-details") return applyReviewDetailsChangePlan(planId);
  return applyTextResourceChangePlan(planId);
}

export async function restoreProtectedSnapshot(input: {
  snapshotId: string;
  force?: boolean;
}): Promise<ProtectedChangeResult> {
  const snapshot = await loadSnapshot(input.snapshotId);
  if (snapshot.kind === "app-store-version-localization") return restoreLocalizationSnapshot(input);
  if (snapshot.kind === "app-store-review-details") return restoreReviewDetailsSnapshot(input);
  return restoreTextResourceSnapshot(input);
}
