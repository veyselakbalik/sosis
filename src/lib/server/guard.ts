import { NextResponse } from "next/server";

/**
 * Reject browser requests that did not originate from the local Sosis UI.
 *
 * The service still binds to 127.0.0.1, but explicit Host/Origin checks also
 * protect state-changing endpoints from DNS rebinding and cross-site requests
 * targeting localhost. MCP does not use these HTTP routes.
 */
export async function requireUnlocked(req: Request): Promise<NextResponse | null> {
  const url = new URL(req.url);
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (!localHosts.has(url.hostname)) {
    return NextResponse.json({ error: "LOCAL_ACCESS_ONLY" }, { status: 403 });
  }

  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return NextResponse.json({ error: "CROSS_SITE_REQUEST_BLOCKED" }, { status: 403 });
  }

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== url.origin) {
        return NextResponse.json({ error: "ORIGIN_MISMATCH" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
    }
  }
  return null;
}
