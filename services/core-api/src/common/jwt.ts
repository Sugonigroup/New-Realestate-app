import { SignJWT, jwtVerify } from "jose";

/**
 * Verified JWT layer (WP-0D-lite). HMAC-SHA256 with APP_SECRET for Phase 0;
 * RS256 + JWKS rotation is the WP-0D completion step (03 §1) — the interface
 * (signToken/verifyToken) stays identical when the key type changes.
 */

export interface TokenClaims {
  sub: string; // user id
  tenant: string; // tenant id — the ONLY tenant source (03 §1)
  roles: string[];
  sid?: string; // session id
  typ: "access" | "refresh";
}

const encoder = new TextEncoder();

function secret(): Uint8Array {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 16) throw new Error("APP_SECRET must be set (>=16 chars)");
  return encoder.encode(s);
}

export async function signToken(
  claims: Omit<TokenClaims, "typ">,
  opts: { type: "access" | "refresh"; ttlSec: number },
): Promise<string> {
  return new SignJWT({ ...claims, typ: opts.type })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("buildos")
    .setExpirationTime(`${opts.ttlSec}s`)
    .sign(secret());
}

export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_SEC = 7 * 24 * 60 * 60;

export class TokenError extends Error {
  constructor(
    message: string,
    readonly reason: "invalid" | "expired" | "wrong-type",
  ) {
    super(message);
  }
}

export async function verifyToken(token: string, expectedType: "access" | "refresh"): Promise<TokenClaims> {
  let result;
  try {
    result = await jwtVerify(token, secret(), { issuer: "buildos" });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "ERR_JWT_EXPIRED") throw new TokenError("token expired", "expired");
    throw new TokenError("invalid token", "invalid");
  }
  const payload = result.payload as unknown as TokenClaims;
  if (payload.typ !== expectedType) {
    throw new TokenError(`expected ${expectedType} token`, "wrong-type");
  }
  if (!payload.sub || !payload.tenant) throw new TokenError("missing sub/tenant claims", "invalid");
  return payload;
}
