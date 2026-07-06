# E2E Bug Report: Phase 8 support page exposes unresolved email placeholder

Severity: Medium
Surface: Static public launch site
Environment: Local static server at 390x844 phone viewport
Feature: Phase 8 public-site brand identity smoke
Date: July 6, 2026
Tester: Codex

## Reproduction Steps

1. Serve `docs/phase-8/public-site` locally.
2. Open `/support.html` at a 390x844 phone viewport.
3. Inspect the visible support contact paragraph.

## Expected Result

The support page should not expose raw template tokens in visible copy. If the final support email is not filled, the page should show a human-readable blocked-state fallback.

## Actual Result

The visible support contact rendered `__SUPPORT_EMAIL__`, which made the public-support template look unfinished.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/phase8-public-site-brand/support-390.png`
- Video: N/A
- Trace: N/A
- Logs: N/A
- UI snapshot: `test-results/human-e2e/2026-07-06/phase8-public-site-brand/support-390-state.json`
- Terminal transcript: `python -m http.server 8150`, `npm run brand:audit`

## Frequency

- Always before the fix when the support email placeholder had not been substituted.

## Scope

- Affected route/screen: `docs/phase-8/public-site/support.html`
- Affected account or fixture: Static Phase 8 public-site template with unresolved support email
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The template used the final support email token as both the mailto target and visible link text.

## Minimal Fix Recommendation

Render a human-readable fallback in visible copy while the placeholder is unresolved, and create the mailto link only when a real support email is substituted.

## Verification Flow After Fix

1. Reload `/support.html` at 390x844.
2. Confirm the raw `__SUPPORT_EMAIL__` token is absent from visible text.
3. Confirm the page still explains support and store-billing boundaries.
4. Confirm source still contains the placeholder for final build-time substitution.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/phase8-public-site-support-placeholder/support-fixed-390.png`
- Video: N/A
- Trace: N/A
- Logs: `test-results/human-e2e/2026-07-06/phase8-public-site-support-placeholder/browser-logs.json`
- UI snapshot: `test-results/human-e2e/2026-07-06/phase8-public-site-support-placeholder/support-fixed-state.json`
- Terminal transcript: `python -m http.server 8151`

## Remaining Risk

- Untested branches: Live final-domain deployment with the real support email substituted.
- Missing fixtures: Final public support email remains blocked in `docs/phase-8/source-of-truth.md`.
- Follow-up needed: Re-run this page on the production domain after Phase 8 identity and support-email clearance.
