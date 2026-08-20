import { NextResponse } from "next/server";
import { requireUnlocked } from "@/lib/server/guard";
import { uploadAppPreview } from "@/lib/asc/upload";
import { AscError } from "@/lib/asc/client";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(req: Request) {
  const blocked = await requireUnlocked(req);
  if (blocked) return blocked;

  const accountId = req.headers.get("x-easyapp-account");
  if (!accountId) return NextResponse.json({ error: "MISSING_ACCOUNT" }, { status: 400 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "INVALID_FORM" }, { status: 400 });

  const previewSetId = form.get("previewSetId");
  const file = form.get("file");

  if (typeof previewSetId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  if (file.size === 0) return NextResponse.json({ error: "EMPTY_FILE" }, { status: 400 });
  if (file.size > 500 * 1024 * 1024) return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await uploadAppPreview({
      accountId,
      previewSetId,
      fileName: file.name || "preview.mov",
      fileBuffer: buffer,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AscError) {
      return NextResponse.json({ error: "ASC_ERROR", status: e.status, body: e.body }, { status: e.status });
    }
    return NextResponse.json({ error: "INTERNAL", message: (e as Error).message }, { status: 500 });
  }
}
