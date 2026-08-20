import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { AscError } from "@/lib/asc/client";
import { listBackupRecords, restoreBackup } from "@/lib/core/destructive-backups";
import { loadBackupRecord } from "@/lib/core/backup-store";
import { requireUnlocked } from "@/lib/server/guard";
import { redactSensitive } from "@/lib/server/redact";

export const runtime = "nodejs";

const restoreSchema = z.object({
  action: z.literal("restore"),
  backupId: z.string().min(1),
});

function accountIdFrom(req: Request): string | null {
  return req.headers.get("x-easyapp-account");
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "INVALID_BACKUP", issues: error.issues }, { status: 400 });
  }
  if (error instanceof AscError) {
    return NextResponse.json({ error: "ASC_ERROR", status: error.status, body: redactSensitive(error.body) }, { status: error.status });
  }
  const message = (error as Error).message ?? "Unknown error";
  if (message === "BACKUP_NOT_FOUND") return NextResponse.json({ error: message }, { status: 404 });
  if (message.includes("MISMATCH") || message.includes("CONFLICT")) {
    return NextResponse.json({ error: "BACKUP_CONFLICT", message }, { status: 409 });
  }
  return NextResponse.json({ error: "INTERNAL", message }, { status: 500 });
}

export async function GET(req: Request) {
  const blocked = await requireUnlocked(req);
  if (blocked) return blocked;
  const accountId = accountIdFrom(req);
  if (!accountId) return NextResponse.json({ error: "MISSING_ACCOUNT" }, { status: 400 });
  const url = new URL(req.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? "20");
  try {
    return NextResponse.json({
      backups: await listBackupRecords({
        accountId,
        limit: Number.isFinite(requestedLimit) ? requestedLimit : 20,
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
    const input = restoreSchema.parse(await req.json());
    const backup = await loadBackupRecord(input.backupId);
    if (backup.accountId !== accountId) throw new Error("BACKUP_ACCOUNT_MISMATCH");
    return NextResponse.json(await restoreBackup(input.backupId));
  } catch (error) {
    return errorResponse(error);
  }
}
