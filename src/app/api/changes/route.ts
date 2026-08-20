import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { AscError } from "@/lib/asc/client";
import { createLocalizationChangePlan } from "@/lib/core/localization-changes";
import { listSnapshots, loadChangePlan, loadSnapshot } from "@/lib/core/change-store";
import { applyProtectedChangePlan, restoreProtectedSnapshot } from "@/lib/core/protected-changes";
import { requireUnlocked } from "@/lib/server/guard";
import { redactSensitive } from "@/lib/server/redact";

export const runtime = "nodejs";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("plan"),
    localizationId: z.string().min(1),
    attributes: z.record(z.string(), z.unknown()),
  }),
  z.object({
    action: z.literal("apply"),
    planId: z.string().min(1),
  }),
  z.object({
    action: z.literal("restore"),
    snapshotId: z.string().min(1),
    force: z.boolean().optional(),
  }),
]);

function accountIdFrom(req: Request): string | null {
  return req.headers.get("x-easyapp-account");
}

function assertSameAccount(expected: string, actual: string): void {
  if (expected !== actual) throw new Error("CHANGE_ACCOUNT_MISMATCH");
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "INVALID_CHANGE", issues: error.issues }, { status: 400 });
  }
  if (error instanceof AscError) {
    return NextResponse.json({ error: "ASC_ERROR", status: error.status, body: redactSensitive(error.body) }, { status: error.status });
  }
  const message = (error as Error).message ?? "Unknown error";
  if (message === "CHANGE_NOT_FOUND") {
    return NextResponse.json({ error: message }, { status: 404 });
  }
  if (message.includes("CONFLICT") || message === "CHANGE_ACCOUNT_MISMATCH") {
    return NextResponse.json({ error: "CHANGE_CONFLICT", message }, { status: 409 });
  }
  return NextResponse.json({ error: "INTERNAL", message }, { status: 500 });
}

export async function GET(req: Request) {
  const blocked = await requireUnlocked(req);
  if (blocked) return blocked;
  const accountId = accountIdFrom(req);
  if (!accountId) return NextResponse.json({ error: "MISSING_ACCOUNT" }, { status: 400 });

  const url = new URL(req.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 50;
  try {
    const resourceId = url.searchParams.get("resourceId")
      ?? url.searchParams.get("localizationId")
      ?? undefined;
    return NextResponse.json({
      snapshots: await listSnapshots({
        accountId,
        resourceId,
        limit,
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  const blocked = await requireUnlocked(req);
  if (blocked) return blocked;
  const accountId = accountIdFrom(req);
  if (!accountId) return NextResponse.json({ error: "MISSING_ACCOUNT" }, { status: 400 });

  try {
    const input = requestSchema.parse(await req.json());
    if (input.action === "plan") {
      const plan = await createLocalizationChangePlan({
        accountId,
        localizationId: input.localizationId,
        attributes: input.attributes,
      });
      return NextResponse.json({ plan });
    }
    if (input.action === "apply") {
      const plan = await loadChangePlan(input.planId);
      assertSameAccount(accountId, plan.accountId);
      return NextResponse.json(await applyProtectedChangePlan(input.planId));
    }

    const snapshot = await loadSnapshot(input.snapshotId);
    assertSameAccount(accountId, snapshot.accountId);
    return NextResponse.json(await restoreProtectedSnapshot({
      snapshotId: input.snapshotId,
      force: input.force,
    }));
  } catch (error) {
    return errorResponse(error);
  }
}
