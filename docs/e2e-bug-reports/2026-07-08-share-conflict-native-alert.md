# E2E Bug Report: Share-card export failure used native alerts

Severity: Low
Surface: Expo web
Environment: Local Expo web at 320 x 568 with dev-only reviewed-conflict and share-unavailable fixtures
Feature: Reviewed conflict share-card export
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Open a seeded Shelf conflict with the reviewed conflict share-card fixture enabled.
2. Open the conflict share-card route.
3. Tap `Share to Stories` while the native share path is unavailable.

## Expected Result

The route keeps the branded share card visible, explains that sharing is unavailable in-screen, and does not open a blocking native or browser alert.

## Actual Result

The export failure path used `Alert.alert`, which hands a recoverable share availability state to platform chrome instead of the premium route surface.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/share-conflict-progress-inline-recovery-current/01-shelf-conflict-seeded.png`
- Screenshot: `test-results/human-e2e/2026-07-08/share-conflict-progress-inline-recovery-current/02-share-card-before-export.png`
- Screenshot: `test-results/human-e2e/2026-07-08/share-conflict-progress-inline-recovery-current/03-share-card-inline-feedback.png`

## Frequency

- Always when native sharing is unavailable or the public share link is not configured.

## Scope

- Affected route/screen: `/share/conflict/[ruleId]`
- Affected account or fixture: reviewed conflict share-card fixture
- External service involved: OS/native share sheet availability
- Destructive action involved: No

## Suspected Cause

The share route handled expected export failures with route-level state for loading, but still delegated recovery copy to `Alert.alert`.

## Minimal Fix Recommendation

Replace native alerts with route-owned feedback, keep the export button retryable, and add dev-only E2E fixtures that can exercise unavailable sharing without opening the OS share sheet.

## Verification Flow After Fix

1. Open the seeded reviewed conflict share card.
2. Tap `Share to Stories` with the share-unavailable fixture enabled.
3. Confirm inline feedback appears above the action and no native/browser dialog opens.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/share-conflict-progress-inline-recovery-current/03-share-card-inline-feedback.png`

## Remaining Risk

- Untested branches: physical iOS and Android native share-sheet rejection paths.
- Missing fixtures: none for Expo web route recovery.
- Follow-up needed: device QA for successful native sharing before public launch.
