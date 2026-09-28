# E2E Bug Report: CAT08 Fixture Did Not Enforce Operator Authority

Severity: High evidence-integrity risk

Surface: internal Vite web console plus synthetic HTTP fixture

Environment: local production preview plus synthetic Supabase/Auth/Edge fixture

Feature: CAT08 operator admission, claims, transitions, release, source review,
and sign-out

Date: 2026-07-25

Tester: Codex

## Reproduction Steps

1. Start the fixture revision used for the browser screenshot run.
2. Call the user or TOTP routes outside the complete email-OTP/TOTP order, or
   send a bearer value that is not the exact active token.
3. Call correction transition or product-hold release without a current matching
   claim, lease, and version.
4. Record a source recommendation, fetch the source queue again, then sign out
   and reuse the prior token.

## Expected Result

Every protected route requires the exact active token and ordered authentication
state. TOTP challenge is bound to that token and consumed on verification.
Operator transitions and release require a live item/version claim plus the
allowlisted decision or exact repair receipt/reason. Source decisions persist.
Sign-out invalidates tokens, work sessions, challenges, and claims.

## Actual Result

The capture-time fixture treated several of those checks as UI sequencing only:
bearer validation was lax, user/TOTP routes were not fully ordered and bound,
transitions and release could succeed without live claim authority, source
status did not persist, and sign-out did not invalidate the token. The
screenshots therefore showed intended UI states without proving the backend-like
authority semantics attributed to them.

## Evidence

- Browser packet:
  `test-results/human-e2e/2026-07-25/cat08-catalog-operator-console-current/`
- Capture-time redacted sequence:
  `test-results/human-e2e/2026-07-25/cat08-catalog-operator-console-current/fixture-request-transcript.txt`
- Hardened fixture:
  `scripts/e2e/catalog-operator-console-fixture-server.mjs`
- Post-capture adversarial contract:
  `scripts/e2e/catalog-operator-console-fixture-server.test.mjs`

## Frequency

Always for the affected capture-time fixture paths.

## Scope

- Affected route/screen: operator admission, correction, product hold, source
  review, and sign-out.
- Affected account or fixture: synthetic local account and fixture only.
- External service involved: none.
- Destructive action involved: no.

## Suspected Cause

The first fixture was designed to stage visible browser states and returned
synthetic happy-path responses without modeling the full authority lifecycle.
The evidence report then described some visible outcomes as if the fixture had
enforced the corresponding server invariants.

## Minimal Fix Recommendation

Track distinct active `aal1` and `aal2` tokens, require exact bearer equality,
bind and consume the TOTP challenge, require an active operator work session,
validate live item/version claims and transition allowlists, require the exact
repair receipt/reason for hold release, persist source status, and invalidate all
authority on sign-out. Add direct adversarial requests for every denial and
postcondition.

## Verification Flow After Fix

1. Run the direct fixture contract and verify malformed bearer, out-of-order
   auth, claimless transition/release, and post-sign-out reuse are denied.
2. Verify a correctly ordered email OTP -> `aal1` -> TOTP -> `aal2` flow works.
3. Verify live claims and versions gate correction, hold, and source mutations.
4. Verify source state persists and sign-out invalidates all prior authority.
5. Rerun the complete browser flow against the exact hardened source and capture
   a new transcript before attributing those semantics to browser evidence.

## Post-Fix Evidence

- Direct contract command:
  `node --test scripts/e2e/catalog-operator-console-fixture-server.test.mjs`
- Direct contract result: pass.
- Browser re-verification against the exact hardened fixture: not yet run.

## Remaining Risk

- The existing screenshots predate the deeper fixture hardening and remain
  visual UI evidence only.
- The hardened fixture is still synthetic and does not prove hosted Supabase
  Auth, Edge, database, RLS, concurrency, audit, or four-person operations.
- Exact-source browser rerun, hosted named-operator evidence, and independent
  privacy/security/legal review remain required.
