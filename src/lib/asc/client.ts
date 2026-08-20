import { gunzipSync } from "node:zlib";
import { getAccount } from "@/lib/server/session";
import { signAscToken } from "./jwt";
import { queueFor, sleep } from "./rate-limit";

const BASE = "https://api.appstoreconnect.apple.com";

export class AscError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message || `ASC ${status}`);
    this.status = status;
    this.body = body;
  }
}

export interface AscRequest {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | string[] | undefined>;
  body?: unknown;
  signal?: AbortSignal;
}

function buildQuery(q?: AscRequest["query"]): string {
  if (!q) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) sp.append(k, v.join(","));
    else sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? "?" + s : "";
}

export async function ascRequest(accountId: string, req: AscRequest): Promise<unknown> {
  const account = await getAccount(accountId);
  if (!account) throw new AscError(404, null, "ACCOUNT_NOT_FOUND");

  const path = req.path.startsWith("/") ? req.path : "/" + req.path;
  const url = BASE + path + buildQuery(req.query);

  return queueFor(accountId).add(async () => {
    let attempt = 0;
    while (true) {
      const token = signAscToken({
        accountId: account.id,
        keyId: account.keyId,
        issuerId: account.issuerId,
        p8: account.p8,
      });
      const res = await fetch(url, {
        method: req.method ?? "GET",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: req.body ? JSON.stringify(req.body) : undefined,
        signal: req.signal,
      });

      if (res.status === 429 && attempt < 3) {
        const retry = parseInt(res.headers.get("retry-after") || "5", 10);
        await sleep(Math.max(1, retry) * 1000);
        attempt++;
        continue;
      }
      if (res.status === 204) return null;

      const text = await res.text();
      const json = text ? safeJson(text) : null;

      if (!res.ok) throw new AscError(res.status, json ?? text);
      return json;
    }
  }) as Promise<unknown>;
}

export async function ascDownloadText(accountId: string, req: AscRequest): Promise<string> {
  const account = await getAccount(accountId);
  if (!account) throw new AscError(404, null, "ACCOUNT_NOT_FOUND");

  const path = req.path.startsWith("/") ? req.path : "/" + req.path;
  const url = BASE + path + buildQuery(req.query);

  return queueFor(accountId).add(async () => {
    let attempt = 0;
    while (true) {
      const token = signAscToken({
        accountId: account.id,
        keyId: account.keyId,
        issuerId: account.issuerId,
        p8: account.p8,
      });
      const res = await fetch(url, {
        method: req.method ?? "GET",
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/a-gzip, text/tab-separated-values, text/plain, application/json",
        },
        signal: req.signal,
      });

      if (res.status === 429 && attempt < 3) {
        const retry = parseInt(res.headers.get("retry-after") || "5", 10);
        await sleep(Math.max(1, retry) * 1000);
        attempt++;
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      const text = maybeGunzip(buffer).toString("utf8");
      if (!res.ok) throw new AscError(res.status, safeJson(text) ?? text);
      return text;
    }
  }) as Promise<string>;
}

export function maybeGunzip(buffer: Buffer): Buffer {
  if (buffer.length < 2) return buffer;
  const hasGzipMagic = buffer[0] === 0x1f && buffer[1] === 0x8b;
  return hasGzipMagic ? gunzipSync(buffer) : buffer;
}

/**
 * Fetch a pre-signed URL (e.g. Apple Analytics segment download URL) and
 * gunzip if necessary. No JWT — the URL itself carries auth. Used by the
 * Analytics Reports API segment download step.
 */
export async function downloadFromUrl(url: string, signal?: AbortSignal): Promise<Buffer> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new AscError(res.status, null, `Segment download ${res.status}`);
  return maybeGunzip(Buffer.from(await res.arrayBuffer()));
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}

export async function ascPaginate<T>(
  accountId: string,
  req: AscRequest,
  opts: { maxPages?: number } = {},
): Promise<T[]> {
  const max = opts.maxPages ?? 10;
  const all: T[] = [];
  let path = req.path;
  let query: AscRequest["query"] | undefined = req.query;
  for (let i = 0; i < max; i++) {
    const data = (await ascRequest(accountId, { ...req, path, query })) as { data?: T[]; links?: { next?: string } };
    if (data?.data) all.push(...data.data);
    const next = data?.links?.next;
    if (!next) break;
    const u = new URL(next);
    path = u.pathname;
    const q: Record<string, string> = {};
    u.searchParams.forEach((v, k) => { q[k] = v; });
    query = q;
  }
  return all;
}
