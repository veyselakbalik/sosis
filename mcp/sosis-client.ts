import { readFile } from "node:fs/promises";
import path from "node:path";
import { ascRequest } from "../src/lib/asc/client.js";
import { uploadAppPreview, uploadAppScreenshot } from "../src/lib/asc/upload.js";
import { loadDataPayload, publicView } from "../src/lib/storage/accounts-file.js";

/**
 * Local Sosis core adapter for the MCP server.
 *
 * ASC requests, account reads and uploads go directly through shared local
 * modules, so the MCP server does not require the optional Next.js app.
 */

export async function sosisListAccounts() {
  const { accounts } = await loadDataPayload();
  return accounts.map(publicView);
}

export async function sosisAscGet<T>(accountId: string, ascPath: string): Promise<T> {
  const cleanPath = ascPath.startsWith("/") ? ascPath.slice(1) : ascPath;
  return await ascRequest(accountId, { method: "GET", path: `/${cleanPath}` }) as T;
}

export async function sosisAscPatch(accountId: string, ascPath: string, body: unknown): Promise<unknown> {
  const cleanPath = ascPath.startsWith("/") ? ascPath.slice(1) : ascPath;
  return ascRequest(accountId, { method: "PATCH", path: `/${cleanPath}`, body });
}

export async function sosisAscDelete(accountId: string, ascPath: string): Promise<unknown> {
  const cleanPath = ascPath.startsWith("/") ? ascPath.slice(1) : ascPath;
  return ascRequest(accountId, { method: "DELETE", path: `/${cleanPath}` });
}

export async function sosisAscPost(accountId: string, ascPath: string, body: unknown): Promise<unknown> {
  const cleanPath = ascPath.startsWith("/") ? ascPath.slice(1) : ascPath;
  return ascRequest(accountId, { method: "POST", path: `/${cleanPath}`, body });
}

export async function sosisUploadAppScreenshot(
  accountId: string,
  screenshotSetId: string,
  filePath: string,
): Promise<{ id: string }> {
  const fileBuffer = await readFile(filePath);
  return uploadAppScreenshot({
    accountId,
    screenshotSetId,
    fileName: path.basename(filePath),
    fileBuffer,
  });
}

export async function sosisUploadAppPreview(
  accountId: string,
  previewSetId: string,
  filePath: string,
): Promise<{ id: string }> {
  const fileBuffer = await readFile(filePath);
  return uploadAppPreview({
    accountId,
    previewSetId,
    fileName: path.basename(filePath),
    fileBuffer,
  });
}

/** Look up an account by label, productive ID, or first match. */
export async function resolveAccountId(hint?: string): Promise<string> {
  const accounts = await sosisListAccounts();
  if (accounts.length === 0) throw new Error("No App Store Connect accounts are configured in Sosis.");
  if (!hint) return accounts[0].id;
  const lower = hint.toLowerCase();
  const match = accounts.find(
    (a) => a.id === hint || a.label.toLowerCase() === lower || a.label.toLowerCase().includes(lower),
  );
  if (!match) throw new Error(`No account matches "${hint}". Available: ${accounts.map((a) => a.label).join(", ")}`);
  return match.id;
}
