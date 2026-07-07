# E2E Bug Report: Reverse Trial Subscription Status Implies Generic Trial

Severity: Medium
Surface: Expo web phone viewport
Environment: Expo web at `http://localhost:8096`, 320x568 viewport
Feature: Settings subscription management
Date: July 7, 2026
Tester: Codex

## Reproduction Steps

1. Seed or use an active app-granted reverse-trial entitlement.
2. Open `/settings/subscription` at a compact phone viewport.
3. Inspect the status pill in the `RoutineKind Pro` plan card.

## Expected Result

The subscription card should make the app-granted reverse trial clear at first glance. It should not use generic store-trial language or imply a card is on file.

## Actual Result

The plan row correctly displayed `Reverse trial` and the support note correctly said no card was on file, but the card status pill still displayed `Trial`.

## Evidence

- Screenshot before fix: `test-results/human-e2e/2026-07-07/current-post-push-sweep/settings-subscription-320x568.png`
- UI snapshot before fix: `test-results/human-e2e/2026-07-07/current-post-push-sweep/settings-subscription-320x568-text.json`
- Terminal transcript: Expo web session on port `8096`

## Frequency

- Always for active app-granted reverse-trial entitlement state before the fix.

## Scope

- Affected route/screen: `/settings/subscription`
- Affected account or fixture: Active app-granted reverse-trial entitlement
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The status pill grouped both carded store trials and app-granted reverse trials under the same `Trial` label.

## Minimal Fix Recommendation

Split the status pill copy so reverse trials display a compact no-card label, carded trials display a store-trial label, and paid subscriptions continue to display the active subscription label.

## Verification Flow After Fix

1. Reopen `/settings/subscription` at 320x568.
2. Confirm the status pill displays `No card` while the plan row still displays `Reverse trial`.
3. Tap `Keep Pro after your week`.
4. Confirm the app opens the active keep-options surface at `/paywall/reoffer`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/current-post-push-sweep/settings-subscription-no-card-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/current-post-push-sweep/settings-subscription-no-card-320x568-text.json`
- Keep-options screenshot: `test-results/human-e2e/2026-07-07/current-post-push-sweep/settings-subscription-keep-options-320x568.png`
- Keep-options UI snapshot: `test-results/human-e2e/2026-07-07/current-post-push-sweep/settings-subscription-keep-options-320x568-text.json`
- Browser logs: `test-results/human-e2e/2026-07-07/current-post-push-sweep/browser-console-warn-error.json`
- Focused test: `npm --workspace apps/mobile run test -- settingsRoutes.test.ts`

## Remaining Risk

- Native iOS and Android rendering still need device or simulator QA with the final subscription fixtures.
