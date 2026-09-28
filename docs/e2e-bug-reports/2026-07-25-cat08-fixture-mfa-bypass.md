# E2E Bug Report: CAT08 Fixture Bypassed Authenticator Challenge

Severity: High evidence-integrity risk

Surface: internal Vite web console

Environment: local production preview plus synthetic Supabase/Auth/Edge fixture

Feature: CAT08 operator admission

Date: 2026-07-25

Tester: Codex

## Reproduction Steps

1. Start the pre-fix local fixture and production-built operator console.
2. Request the synthetic email OTP.
3. Enter the valid synthetic email code.

## Expected Result

Email verification returns an `aal1` session. The console requires the verified
TOTP factor challenge and does not request operator authority until TOTP
verification returns an `aal2` session.

## Actual Result

The fixture returned a JWT with `aal=aal2` and OTP plus TOTP authentication
method references immediately after email verification. The console correctly
trusted that session and therefore skipped its authenticator screen. The
production console was not bypassing MFA; the synthetic evidence fixture was
overstating the completed authentication steps.

## Evidence

- Pre-fix observation: browser DOM moved directly from email verification to
  the protected workspace.
- Relevant source:
  `scripts/e2e/catalog-operator-console-fixture-server.mjs`.

## Frequency

Always with the pre-fix fixture.

## Scope

- Affected route/screen: operator email-code admission.
- Affected account or fixture: synthetic local account only.
- External service involved: none.
- Destructive action involved: no.

## Suspected Cause

The fixture used one hard-coded access-token function that always emitted
`aal2` and both OTP/TOTP method references. It did not implement the Supabase
factor challenge or factor verification endpoints.

## Minimal Fix Recommendation

Issue `aal1` after email verification, implement the factor challenge endpoint,
validate the challenge identifier/code/expiry on the factor verify endpoint,
and issue `aal2` only after successful TOTP verification. Keep the fixture
local-only and preserve the console's normal Supabase Auth calls.

## Verification Flow After Fix

1. Request and verify the synthetic email OTP.
2. Confirm the `Verify authenticator` screen is visible.
3. Submit `654321`; confirm a generic invalid/expired error and no workspace.
4. Submit `123456`; confirm the protected workspace opens.
5. Exercise queue, claim, transition, release, source recommendation, and
   sign-out to confirm the new staged auth model did not break later calls.

## Post-Fix Evidence

- `test-results/human-e2e/2026-07-25/cat08-catalog-operator-console-current/03-totp-375x667.jpg`
- `test-results/human-e2e/2026-07-25/cat08-catalog-operator-console-current/04-totp-error-375x667.jpg`
- `test-results/human-e2e/2026-07-25/cat08-catalog-operator-console-current/05-workspace-375x667.jpg`
- `test-results/human-e2e/2026-07-25/cat08-catalog-operator-console-current/fixture-request-transcript.txt`

## Remaining Risk

This proves the local fixture-driven UI state machine only. It does not prove
real email delivery, TOTP enrollment/recovery/revocation, hosted Auth session
rows, named operator identity, or production MFA policy.
