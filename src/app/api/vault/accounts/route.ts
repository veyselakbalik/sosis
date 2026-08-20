import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccounts, addAccount, removeAccount, updateAccount } from "@/lib/server/session";
import {
  newAccountId,
  newCredentialVersion,
  publicView,
  ensureValidP8,
  type Account,
} from "@/lib/storage/accounts-file";
import { requireUnlocked } from "@/lib/server/guard";

export const runtime = "nodejs";

const AddBody = z.object({
  label: z.string().min(1).max(80),
  issuerId: z.string().uuid().or(z.string().regex(/^[a-f0-9-]{30,}$/i)),
  keyId: z.string().regex(/^[A-Z0-9]{8,}$/i),
  p8: z.string().min(100),
});

const PatchBody = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80).optional(),
  issuerId: z.string().min(10).optional(),
  keyId: z.string().min(4).optional(),
  p8: z.string().min(100).optional(),
});

function accountStorageError(error: unknown): NextResponse {
  const message = (error as Error).message ?? "";
  if (message.includes("KEYCHAIN") || message.includes("CREDENTIAL_")) {
    return NextResponse.json({
      error: "KEYCHAIN_ACCESS_FAILED",
      message: "macOS Keychain could not store or retrieve this App Store Connect key.",
    }, { status: 503 });
  }
  return NextResponse.json({ error: "ACCOUNT_STORAGE_FAILED" }, { status: 500 });
}

export async function GET(req: Request) {
  const blocked = await requireUnlocked(req);
  if (blocked) return blocked;
  try {
    const list = (await getAccounts()).map(publicView);
    return NextResponse.json({ accounts: list });
  } catch (error) {
    return accountStorageError(error);
  }
}

export async function POST(req: Request) {
  const blocked = await requireUnlocked(req);
  if (blocked) return blocked;
  const body = await req.json().catch(() => ({}));
  const parsed = AddBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    ensureValidP8(parsed.data.p8);
  } catch {
    return NextResponse.json({ error: "INVALID_P8" }, { status: 400 });
  }
  const account: Account = {
    id: newAccountId(),
    label: parsed.data.label,
    issuerId: parsed.data.issuerId,
    keyId: parsed.data.keyId,
    p8: parsed.data.p8,
    createdAt: Date.now(),
    credentialVersion: newCredentialVersion(),
  };
  try {
    await addAccount(account);
    return NextResponse.json({ account: publicView(account) }, { status: 201 });
  } catch (error) {
    return accountStorageError(error);
  }
}

export async function PATCH(req: Request) {
  const blocked = await requireUnlocked(req);
  if (blocked) return blocked;
  const body = await req.json().catch(() => ({}));
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }
  const { id, ...patch } = parsed.data;
  if (patch.p8) {
    try {
      ensureValidP8(patch.p8);
    } catch {
      return NextResponse.json({ error: "INVALID_P8" }, { status: 400 });
    }
  }
  try {
    const updated = await updateAccount(id, patch);
    if (!updated) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ account: publicView(updated) });
  } catch (error) {
    return accountStorageError(error);
  }
}

export async function DELETE(req: Request) {
  const blocked = await requireUnlocked(req);
  if (blocked) return blocked;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
  try {
    await removeAccount(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return accountStorageError(error);
  }
}
