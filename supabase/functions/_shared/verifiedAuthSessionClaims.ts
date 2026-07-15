const AUTH_SESSION_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const JWT_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;
const JWT_MAX_CHARS = 16_384;
const JWT_PAYLOAD_SEGMENT_MAX_CHARS = 8_192;

export type VerifiedAuthSessionClaims = {
  subject: string;
  sessionId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Supabase Auth has already verified the bearer before this decoder runs. Read
 * only the two claims needed to bind a publication lease to that verified
 * result. Any non-canonical JWT or claim is an authoritative session rejection,
 * never a reason to trust the mutable client session object.
 */
export function verifiedAuthSessionClaimsFromJwt(
  token: unknown,
  authenticatedUserId: unknown,
): VerifiedAuthSessionClaims | null {
  if (
    typeof token !== 'string' ||
    token.length === 0 ||
    token.length > JWT_MAX_CHARS ||
    typeof authenticatedUserId !== 'string' ||
    !AUTH_SESSION_UUID_PATTERN.test(authenticatedUserId)
  ) {
    return null;
  }
  const segments = token.split('.');
  const payloadSegment = segments.length === 3 ? segments[1] : undefined;
  if (
    typeof payloadSegment !== 'string' ||
    payloadSegment.length === 0 ||
    payloadSegment.length > JWT_PAYLOAD_SEGMENT_MAX_CHARS ||
    payloadSegment.length % 4 === 1 ||
    !JWT_SEGMENT_PATTERN.test(payloadSegment)
  ) {
    return null;
  }

  try {
    const base64 = payloadSegment.replaceAll('-', '+').replaceAll('_', '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const payload = JSON.parse(decoded) as unknown;
    if (
      !isRecord(payload) ||
      typeof payload.sub !== 'string' ||
      payload.sub !== authenticatedUserId ||
      !AUTH_SESSION_UUID_PATTERN.test(payload.sub) ||
      typeof payload.session_id !== 'string' ||
      !AUTH_SESSION_UUID_PATTERN.test(payload.session_id)
    ) {
      return null;
    }
    return { subject: payload.sub, sessionId: payload.session_id };
  } catch {
    return null;
  }
}
