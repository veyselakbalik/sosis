import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const LOCAL_WRITE_TOOLS = new Set([
  "add_account",
  "remove_account",
]);

export const EXTERNAL_WRITE_TOOLS = new Set([
  "apply_localization_plan",
  "apply_localization_batch",
  "apply_protected_change_plan",
  "restore_localization_snapshot",
  "restore_change_snapshot",
  "restore_backup",
  "reply_review",
  "create_version",
  "attach_build_to_version",
  "submit_version_for_review",
  "release_version_now",
  "manage_phased_release",
  "add_localization",
  "delete_localization",
  "update_build_compliance",
  "create_beta_group",
  "add_beta_tester",
  "add_build_to_beta_group",
  "create_subscription_group",
  "create_subscription",
  "delete_subscription",
  "add_subscription_localization",
  "delete_subscription_localization",
  "upload_screenshots_from_directory",
  "delete_screenshot",
  "reorder_screenshots",
  "create_preview_set",
  "upload_app_preview",
]);

const CONDITIONALLY_READ_ONLY = new Set([
  "manage_phased_release",
]);

const WRITE_TOOLS = new Set([...EXTERNAL_WRITE_TOOLS, ...LOCAL_WRITE_TOOLS]);

const DESTRUCTIVE_TOOLS = new Set([
  "remove_account",
  "restore_localization_snapshot",
  "restore_change_snapshot",
  "submit_version_for_review",
  "release_version_now",
  "manage_phased_release",
  "delete_localization",
  "delete_subscription",
  "delete_subscription_localization",
  "upload_screenshots_from_directory",
  "delete_screenshot",
]);

const CONFIRMATION_HINTS: Record<string, string> = {
  remove_account: "REMOVE ACCOUNT <accountId>",
  reply_review: "REPLY <reviewId>",
  submit_version_for_review: "SUBMIT <versionId>",
  release_version_now: "RELEASE <versionId>",
  delete_localization: "DELETE LOCALIZATION <localizationId>",
  delete_subscription: "DELETE SUBSCRIPTION <subscriptionId>",
  delete_subscription_localization: "DELETE SUBSCRIPTION LOCALIZATION <localizationId>",
  delete_screenshot: "DELETE SCREENSHOT <screenshotId>",
};

interface MutableInputSchema {
  properties?: Record<string, unknown>;
  required?: string[];
}

function hasSafeConditionalMode(name: string, args: Record<string, unknown>): boolean {
  return name === "manage_phased_release" && args.action === "get";
}

export function expectedHighImpactConfirmation(
  name: string,
  args: Record<string, unknown>,
): string | null {
  switch (name) {
    case "remove_account": return `REMOVE ACCOUNT ${String(args.accountId)}`;
    case "reply_review": return `REPLY ${String(args.reviewId)}`;
    case "submit_version_for_review": return `SUBMIT ${String(args.versionId)}`;
    case "release_version_now": return `RELEASE ${String(args.versionId)}`;
    case "delete_localization": return `DELETE LOCALIZATION ${String(args.localizationId)}`;
    case "delete_subscription": return `DELETE SUBSCRIPTION ${String(args.subscriptionId)}`;
    case "delete_subscription_localization": return `DELETE SUBSCRIPTION LOCALIZATION ${String(args.localizationId)}`;
    case "delete_screenshot": return `DELETE SCREENSHOT ${String(args.screenshotId)}`;
    case "restore_localization_snapshot":
    case "restore_change_snapshot":
      return args.force === true ? `FORCE RESTORE ${String(args.snapshotId)}` : null;
    case "manage_phased_release":
      return args.action === "complete" || args.action === "delete"
        ? `PHASED ${String(args.action).toUpperCase()} ${String(args.versionId)}`
        : null;
    case "upload_screenshots_from_directory":
      return args.clearExisting === true
        ? `REPLACE SCREENSHOTS ${String(args.versionId)}`
        : null;
    default:
      return null;
  }
}

export function assertToolConfirmation(name: string, args: Record<string, unknown>): void {
  if (!WRITE_TOOLS.has(name) || hasSafeConditionalMode(name, args)) return;
  if (args.confirmed !== true) {
    throw new Error(
      `CONFIRMATION_REQUIRED:${name}: Set confirmed=true only after the user reviews the exact account, resources, and effect.`,
    );
  }

  const expected = expectedHighImpactConfirmation(name, args);
  if (expected && args.confirmation !== expected) {
    throw new Error(`EXACT_CONFIRMATION_REQUIRED:${name}: confirmation must equal ${JSON.stringify(expected)}`);
  }
}

export function configureMcpToolSafety(tools: Tool[]): void {
  for (const tool of tools) {
    const isLocalAsoSkillRead = tool.name === "list_aso_skills"
      || tool.name === "search_aso_skills"
      || tool.name === "get_aso_skill";
    const isReadOnly = /^(list|get|validate)_/.test(tool.name)
      || isLocalAsoSkillRead
      || tool.name === "plan_screenshot_upload";
    const isWrite = WRITE_TOOLS.has(tool.name);
    const isLocalWrite = LOCAL_WRITE_TOOLS.has(tool.name);
    tool.annotations = {
      ...tool.annotations,
      title: tool.annotations?.title ?? tool.name.replaceAll("_", " "),
      readOnlyHint: isReadOnly,
      destructiveHint: DESTRUCTIVE_TOOLS.has(tool.name),
      idempotentHint: tool.annotations?.idempotentHint ?? isReadOnly,
      openWorldHint: !isLocalAsoSkillRead
        && !isLocalWrite
        && tool.name !== "list_accounts"
        && tool.name !== "list_change_snapshots"
        && tool.name !== "validate_localization_payload",
    };

    if (!isWrite) continue;
    const schema = tool.inputSchema as MutableInputSchema;
    schema.properties ??= {};
    schema.properties.confirmed = {
      type: "boolean",
      const: true,
      description: isLocalWrite
        ? "Set true only after the user has reviewed this local credential change. Never paste .p8 contents into chat."
        : "Set true only after the user has reviewed the exact target and effect of this ASC write.",
    };
    if (!CONDITIONALLY_READ_ONLY.has(tool.name)) {
      schema.required = [...new Set([...(schema.required ?? []), "confirmed"])];
    }

    const hint = CONFIRMATION_HINTS[tool.name];
    if (hint) {
      schema.properties.confirmation = {
        type: "string",
        description: `Exact confirmation phrase required: ${hint}`,
      };
      schema.required = [...new Set([...(schema.required ?? []), "confirmation"])];
    } else if (DESTRUCTIVE_TOOLS.has(tool.name)) {
      schema.properties.confirmation = {
        type: "string",
        description: "Some high-impact modes require an exact phrase; the tool error returns the required value.",
      };
    }
  }
}
