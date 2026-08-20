import jwt from "jsonwebtoken";
import { createHash } from "node:crypto";

interface TokenCacheEntry {
  token: string;
  expiresAt: number;
  credentialFingerprint: string;
}

const cache = new Map<string, TokenCacheEntry>();
const TTL_MS = 18 * 60 * 1000;
const EXPIRES_SEC = 20 * 60;

export function signAscToken(opts: { accountId: string; keyId: string; issuerId: string; p8: string }): string {
  const now = Date.now();
  const credentialFingerprint = createHash("sha256")
    .update(opts.keyId)
    .update("\0")
    .update(opts.issuerId)
    .update("\0")
    .update(opts.p8)
    .digest("hex");
  const hit = cache.get(opts.accountId);
  if (
    hit
    && hit.credentialFingerprint === credentialFingerprint
    && hit.expiresAt > now + 30_000
  ) return hit.token;

  const token = jwt.sign({}, opts.p8, {
    algorithm: "ES256",
    expiresIn: EXPIRES_SEC,
    audience: "appstoreconnect-v1",
    issuer: opts.issuerId,
    header: { alg: "ES256", kid: opts.keyId, typ: "JWT" },
  });

  cache.set(opts.accountId, { token, expiresAt: now + TTL_MS, credentialFingerprint });
  return token;
}

export function clearTokenCache(accountId?: string): void {
  if (accountId) cache.delete(accountId);
  else cache.clear();
}
