# E2E Bug Report: Today SPF Gap Prompt Compact Layout

Severity: Low
Surface: Expo web
Environment: Codex in-app browser, Expo web, 320 x 568 viewport
Feature: Today recommendation teaser and SPF gap prompt
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Add a cleanser and moisturizer through the manual shelf flow without adding SPF.
2. Open `/today?routine=AM` at a 320 px phone viewport.
3. Inspect the compact SPF gap prompt and its dismissal control.

## Expected Result

The prompt remains advisory, exposes visible `See why` and `Not now` controls, keeps both controls at least 44 px, and keeps the full `No SPF this morning` headline readable without horizontal overflow.

## Actual Result

The compact prompt source used an icon-only `x` dismiss affordance instead of visible `Not now`. During the first visual pass after exposing `Not now`, the one-line headline clamp ellipsized `No SPF this morning` at 320 px.

## Evidence

- Post-fix screenshot: `test-results/human-e2e/2026-07-08/today-spf-gap-prompt-current/01-today-spf-prompt-initial.png`
- Post-fix UI snapshot: `test-results/human-e2e/2026-07-08/today-spf-gap-prompt-current/01-today-spf-prompt-initial.json`
- Summary: `test-results/human-e2e/2026-07-08/today-spf-gap-prompt-current/summary.json`

## Frequency

- Always at the compact 320 px prompt state before the fix.

## Scope

- Affected route/screen: `/today?routine=AM`
- Affected account or fixture: local shelf state with cleanser and moisturizer, no SPF
- External service involved: none
- Destructive action involved: no

## Suspected Cause

The compact prompt dedicated enough horizontal space to a visible dismiss label, but the SPF headline was still hard-clamped to one line.

## Minimal Fix Recommendation

Use a visible `Not now` dismissal label and allow the compact SPF headline to wrap to two lines while retaining 48 px+ control targets.

## Verification Flow After Fix

1. Rebuild the local shelf through manual add on a clean local origin.
2. Open `/today?routine=AM` at 320 x 568.
3. Verify full prompt copy, detail routing, dismissal, and reload persistence.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/today-spf-gap-prompt-current/01-today-spf-prompt-initial.png`
- Screenshot: `test-results/human-e2e/2026-07-08/today-spf-gap-prompt-current/02-after-see-why-detail.png`
- Screenshot: `test-results/human-e2e/2026-07-08/today-spf-gap-prompt-current/05-today-after-dismiss-reload.png`
- Logs: `test-results/human-e2e/2026-07-08/today-spf-gap-prompt-current/browser-warn-error-logs.json`
- UI snapshot: `test-results/human-e2e/2026-07-08/today-spf-gap-prompt-current/summary.json`

## Remaining Risk

- Untested branches: native iOS/Android Dynamic Type and screen-reader behavior.
- Missing fixtures: none for this local Expo-web branch.
- Follow-up needed: device QA for native text scaling.
