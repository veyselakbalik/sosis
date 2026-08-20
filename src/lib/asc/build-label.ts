import type { Build, AscResource } from "./types";

/**
 * Format a build label as "1.0.0 (5)" — pre-release/app version + build number.
 * Falls back to just the build number, or "—".
 */
export function buildLabel(versionString: string | undefined | null, buildVersion: string | undefined | null): string {
  if (versionString && buildVersion) return `${versionString} (${buildVersion})`;
  if (buildVersion) return `Build ${buildVersion}`;
  if (versionString) return versionString;
  return "—";
}

/**
 * Resolve the pre-release version (app version like "1.0.0") that a build belongs to,
 * given the build's `preReleaseVersion` relationship and a lookup of included resources.
 */
export function preReleaseVersionForBuild(
  build: Build,
  included: Array<AscResource<Record<string, unknown>>> | undefined,
): string | null {
  const relId = (build.relationships as { preReleaseVersion?: { data?: { id?: string } } })?.preReleaseVersion?.data?.id;
  if (!relId || !included) return null;
  const match = included.find((r) => r.type === "preReleaseVersions" && r.id === relId);
  return (match?.attributes as { version?: string } | undefined)?.version ?? null;
}

export type ComplianceState = "set-false" | "set-true" | "missing";

export function complianceState(build: Build): ComplianceState {
  const v = build.attributes?.usesNonExemptEncryption;
  if (v === false) return "set-false";
  if (v === true) return "set-true";
  return "missing";
}
