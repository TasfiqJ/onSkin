# E2E Bug Report: Direct Progress paywall dismissal falls back to Today

Severity: Medium
Surface: Expo web
Environment: `npm --workspace apps/mobile run web -- --port 8105`, 320 x 568 browser viewport
Feature: Progress direct-entry navigation and contextual paywall
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open a Progress Pro-only route directly as a free user, such as `/progress/capture`.
2. Observe the contextual `Unlock your private photo timeline` paywall.
3. Tap `Maybe later`.

## Expected Result

The user should land on the Progress tab, because they entered from a Progress photo surface and the mapped direct-entry recovery branch requires returning to Progress instead of trapping or disorienting the user.

## Actual Result

The generic paywall dismissal fallback was the Today tab for all direct-entry contextual paywalls. Direct photo-timeline paywalls could recover to the wrong main tab when there was no usable in-app navigation history.

## Evidence

- Source evidence: `apps/mobile/src/features/subscription/dismissPaywall.ts` previously called `backOrReplace(router)` without a feature fallback, so no-history paywalls used `APP_HOME_ROUTE`.
- Pre-fix route screenshot: `test-results/human-e2e/2026-07-07/navigation-next-audit/direct-progress-capture.png`
- Pre-fix route snapshot: `test-results/human-e2e/2026-07-07/navigation-next-audit/direct-progress-capture.json`

## Frequency

- Always for no-history direct-entry contextual paywalls.

## Scope

- Affected route/screen: direct Pro-gated photo timeline routes such as `/progress/capture`, `/progress/review`, and `/progress/[id]`.
- Affected account or fixture: local free-user Expo web fixture.
- External service involved: none.
- Destructive action involved: no.

## Suspected Cause

`dismissPaywall` used the generic safe-back helper with its default app-home fallback. That is acceptable for generic upsells, but it loses feature context for direct-entry photo timeline and conflict-check paywalls.

## Minimal Fix Recommendation

Allow contextual paywalls to pass a feature-aware fallback route. Use Progress for `photo_timeline`, Shelf for `conflict_checks`, and keep Today as the default for generic contextual paywalls.

## Verification Flow After Fix

1. Open `/progress/capture` at 320 x 568 as a free user.
2. Confirm `Maybe later`, `Start free trial`, `Explore first`, Terms, Privacy, and Restore are readable and 48+ px controls.
3. Tap `Maybe later`.
4. Confirm the URL is `/progress` and the Progress tab is selected.

## Post-Fix Evidence

- Screenshot before dismiss: `test-results/human-e2e/2026-07-07/navigation-next-audit/progress-capture-before-dismiss-320.png`
- Snapshot before dismiss: `test-results/human-e2e/2026-07-07/navigation-next-audit/progress-capture-before-dismiss-320.json`
- Screenshot after dismiss: `test-results/human-e2e/2026-07-07/navigation-next-audit/progress-capture-after-dismiss-320.png`
- Snapshot after dismiss: `test-results/human-e2e/2026-07-07/navigation-next-audit/progress-capture-after-dismiss-320.json`
- Logs: `test-results/human-e2e/2026-07-07/navigation-next-audit/browser-console-warnings-8105.json`
- Unit/contract tests: `npm --workspace apps/mobile run test -- src/features/subscription/dismissPaywall.test.ts src/features/subscription/paywallMobileContracts.test.ts src/features/photos/progressRoutes.test.ts`

## Remaining Risk

- Untested branches: native iOS and Android simulator direct-entry checks.
- Missing fixtures: no paid entitlement fixture in this web pass.
- Follow-up needed: cover direct-entry paywall fallback in the eventual native mobile E2E harness.
