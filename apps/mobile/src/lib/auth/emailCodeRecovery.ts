// This is a client UX fence, not the server's OTP expiry or rate-limit authority.
// The hosted Auth settings and Supabase response remain authoritative.
export const EMAIL_CODE_CLIENT_VALIDITY_MS = 60 * 60 * 1000;
export const EMAIL_CODE_RESEND_COOLDOWN_MS = 60 * 1000;

export type EmailCodeChallenge = {
  issuedAtMs: number;
};

export function startEmailCodeChallenge(nowMs: number): EmailCodeChallenge {
  return { issuedAtMs: nowMs };
}

export function getEmailCodeChallengeState(challenge: EmailCodeChallenge, nowMs: number) {
  const elapsedMs = nowMs - challenge.issuedAtMs;
  // A backwards clock jump cannot extend the lifetime of a pending code.
  const expired =
    !Number.isFinite(nowMs) ||
    !Number.isFinite(challenge.issuedAtMs) ||
    elapsedMs < 0 ||
    elapsedMs >= EMAIL_CODE_CLIENT_VALIDITY_MS;

  return {
    expired,
    resendSeconds: expired
      ? 0
      : Math.ceil(Math.max(0, EMAIL_CODE_RESEND_COOLDOWN_MS - elapsedMs) / 1000),
  };
}
