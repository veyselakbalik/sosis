export interface AscFetchOpts {
  accountId: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export async function ascFetch<T>(path: string, opts: AscFetchOpts): Promise<T> {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const res = await fetch("/api/asc/" + cleanPath, {
    method: opts.method ?? "GET",
    headers: {
      "x-easyapp-account": opts.accountId,
      ...(opts.body ? { "content-type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: string;
      status?: number;
      message?: string;
      body?: { errors?: Array<{ title?: string; detail?: string; code?: string }> } | string | null;
    };
    let message = err.error || "ASC_ERROR";
    if (typeof err.body === "object" && err.body && "errors" in err.body) {
      const apple = (err.body as { errors?: Array<{ title?: string; detail?: string }> }).errors?.[0];
      const detail = [apple?.title, apple?.detail].filter(Boolean).join(" — ");
      if (detail) message = detail;
    } else if (err.message) {
      message = err.message;
    } else if (err.error === "ACCOUNT_NOT_FOUND") {
      message = "Selected account not found — pick another one from the top bar.";
    }
    const e = new Error(message) as Error & { status?: number; body?: unknown };
    e.status = err.status ?? res.status;
    e.body = err.body;
    throw e;
  }
  return res.json() as Promise<T>;
}
