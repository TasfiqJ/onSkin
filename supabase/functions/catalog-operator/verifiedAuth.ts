import type { VerifiedCatalogOperatorAuth } from "./httpHandler.ts";

const USER_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function authenticatedAudience(value: unknown): boolean {
  return value === "authenticated" ||
    (Array.isArray(value) &&
      value.length > 0 &&
      value.every((entry) => entry === "authenticated"));
}

/**
 * Accept only claims returned by Supabase Auth getClaims() for the exact
 * presented bearer. Signature verification happens before this shape check.
 */
export function verifiedCatalogOperatorAuth(
  claims: unknown,
  expectedIssuer: string,
  verifiedUserId: string | null,
  nowEpochSeconds = Math.floor(Date.now() / 1_000),
): VerifiedCatalogOperatorAuth | null {
  if (
    !isRecord(claims) ||
    typeof expectedIssuer !== "string" ||
    !expectedIssuer ||
    claims.iss !== expectedIssuer ||
    typeof verifiedUserId !== "string" ||
    !USER_UUID_PATTERN.test(verifiedUserId.toLowerCase()) ||
    typeof claims.sub !== "string" ||
    typeof claims.session_id !== "string" ||
    !USER_UUID_PATTERN.test(claims.sub.toLowerCase()) ||
    !USER_UUID_PATTERN.test(claims.session_id.toLowerCase()) ||
    claims.sub.toLowerCase() !== verifiedUserId.toLowerCase() ||
    claims.role !== "authenticated" ||
    claims.aal !== "aal2" ||
    claims.is_anonymous !== false ||
    !authenticatedAudience(claims.aud) ||
    !Number.isSafeInteger(claims.exp) ||
    (claims.exp as number) <= nowEpochSeconds
  ) {
    return null;
  }

  return {
    userId: verifiedUserId.toLowerCase(),
    authSessionId: claims.session_id.toLowerCase(),
  };
}
