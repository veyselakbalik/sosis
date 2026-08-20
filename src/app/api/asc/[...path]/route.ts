import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUnlocked } from "@/lib/server/guard";
import { ascRequest, AscError } from "@/lib/asc/client";
import { updateLocalizationWithSnapshot } from "@/lib/core/localization-changes";
import {
  updateTextResourceWithSnapshot,
  type TextResourceChangeKind,
} from "@/lib/core/text-resource-changes";
import { updateReviewDetailsWithSnapshot } from "@/lib/core/review-details-changes";
import {
  deleteLocalizationWithBackup,
  deleteScreenshotWithBackup,
} from "@/lib/core/destructive-backups";
import { redactSensitive } from "@/lib/server/redact";

export const runtime = "nodejs";

async function handle(req: Request, method: "GET" | "POST" | "PATCH" | "DELETE", ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const blocked = await requireUnlocked(req);
  if (blocked) return blocked;

  const accountId = req.headers.get("x-easyapp-account");
  if (!accountId) return NextResponse.json({ error: "MISSING_ACCOUNT" }, { status: 400 });

  const { path: segments } = await ctx.params;
  const url = new URL(req.url);
  const query: Record<string, string | string[]> = {};
  url.searchParams.forEach((v, k) => {
    if (k in query) {
      const cur = query[k];
      query[k] = Array.isArray(cur) ? [...cur, v] : [cur as string, v];
    } else query[k] = v;
  });

  let body: unknown = undefined;
  if (method !== "GET" && method !== "DELETE") {
    body = await req.json().catch(() => null);
  }

  try {
    // The web UI keeps its existing ASC-shaped endpoints while protected text
    // PATCHes receive a before-write snapshot and post-write verification.
    if (
      method === "PATCH"
      && segments.length === 3
      && segments[0] === "v1"
      && segments[1] === "appStoreVersionLocalizations"
    ) {
      const attributes = (body as { data?: { attributes?: unknown } } | null)?.data?.attributes;
      const change = await updateLocalizationWithSnapshot({
        accountId,
        localizationId: segments[2],
        attributes: attributes ?? {},
      });
      const resource = change.resource ?? {};
      return NextResponse.json({
        ...resource,
        sosis: {
          planId: change.plan.id,
          snapshotId: change.snapshot?.id ?? null,
          changedFields: change.plan.changedFields,
        },
      });
    }

    const textResourceKinds: Record<string, TextResourceChangeKind> = {
      appInfoLocalizations: "app-info-localization",
      subscriptionLocalizations: "subscription-localization",
      betaBuildLocalizations: "beta-build-localization",
    };
    const textResourceKind = segments.length === 3 ? textResourceKinds[segments[1]] : undefined;
    if (method === "PATCH" && segments[0] === "v1" && textResourceKind) {
      const attributes = (body as { data?: { attributes?: unknown } } | null)?.data?.attributes;
      const change = await updateTextResourceWithSnapshot({
        kind: textResourceKind,
        accountId,
        resourceId: segments[2],
        attributes: attributes ?? {},
      });
      const resource = change.resource ?? {};
      return NextResponse.json({
        ...resource,
        sosis: {
          planId: change.plan.id,
          snapshotId: change.snapshot?.id ?? null,
          changedFields: change.plan.changedFields,
        },
      });
    }

    if (
      (method === "POST" && segments.length === 2 && segments[0] === "v1" && segments[1] === "appStoreReviewDetails")
      || (method === "PATCH" && segments.length === 3 && segments[0] === "v1" && segments[1] === "appStoreReviewDetails")
    ) {
      const data = (body as {
        data?: {
          attributes?: unknown;
          relationships?: { appStoreVersion?: { data?: { id?: string } } };
        };
      } | null)?.data;
      let versionId = data?.relationships?.appStoreVersion?.data?.id;
      if (!versionId && method === "PATCH") {
        const version = await ascRequest(accountId, {
          method: "GET",
          path: `/v1/appStoreReviewDetails/${segments[2]}/appStoreVersion`,
        }) as { data?: { id?: string } };
        versionId = version.data?.id;
      }
      if (!versionId) throw new Error("APP_REVIEW_VERSION_NOT_FOUND");
      const change = await updateReviewDetailsWithSnapshot({
        accountId,
        versionId,
        attributes: data?.attributes ?? {},
      });
      return NextResponse.json({
        ...(change.resource ?? {}),
        sosis: {
          planId: change.plan.id,
          snapshotId: change.snapshot?.id ?? null,
          changedFields: change.plan.changedFields,
        },
      });
    }

    if (method === "DELETE" && segments.length === 3 && segments[0] === "v1") {
      if (segments[1] === "appScreenshots") {
        const backup = await deleteScreenshotWithBackup({ accountId, screenshotId: segments[2] });
        return NextResponse.json({ ok: true, sosis: { backupId: backup.id, reversible: true } });
      }
      if (segments[1] === "appStoreVersionLocalizations") {
        const backup = await deleteLocalizationWithBackup({
          kind: "app-store-version-localization",
          accountId,
          localizationId: segments[2],
        });
        return NextResponse.json({ ok: true, sosis: { backupId: backup.id, reversible: true } });
      }
      if (segments[1] === "subscriptionLocalizations") {
        const backup = await deleteLocalizationWithBackup({
          kind: "subscription-localization",
          accountId,
          localizationId: segments[2],
        });
        return NextResponse.json({ ok: true, sosis: { backupId: backup.id, reversible: true } });
      }
      if (segments[1] === "appPreviews") {
        return NextResponse.json({
          error: "UNBACKED_ASSET_DELETE_BLOCKED",
          message: "Sosis cannot reliably back up App Preview video assets. Keep the local source and delete it in App Store Connect if intentional.",
        }, { status: 409 });
      }
      if (segments[1] === "subscriptions") {
        return NextResponse.json({
          error: "IRREVERSIBLE_DELETE_REQUIRES_AGENT",
          message: `A full subscription cannot be backed up faithfully. Use the MCP delete_subscription tool and confirm DELETE SUBSCRIPTION ${segments[2]} if this is intentional.`,
        }, { status: 409 });
      }
    }

    const result = await ascRequest(accountId, {
      method,
      path: "/" + segments.join("/"),
      query,
      body,
    });
    return NextResponse.json(result ?? {});
  } catch (e) {
    if (e instanceof AscError) {
      return NextResponse.json({
        error: "ASC_ERROR",
        status: e.status,
        message: e.message,
        body: redactSensitive(e.body),
      }, { status: e.status });
    }
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "INVALID_CHANGE", issues: e.issues }, { status: 400 });
    }
    if ((e as Error).message.includes("CONFLICT")) {
      return NextResponse.json({ error: "CHANGE_CONFLICT", message: (e as Error).message }, { status: 409 });
    }
    return NextResponse.json({ error: "INTERNAL", message: (e as Error).message }, { status: 500 });
  }
}

export function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, "GET", ctx);
}
export function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, "POST", ctx);
}
export function PATCH(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, "PATCH", ctx);
}
export function DELETE(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, "DELETE", ctx);
}
