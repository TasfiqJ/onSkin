# E2E Bug Report: Compact photo re-consent action clipping

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser, 320 x 568 stress viewport, Expo dev server
Feature: Progress photo-capture re-consent
Date: 2026-07-14
Tester: Codex

## Reproduction Steps

1. Start Expo web with `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`, app lock disabled, and `EXPO_PUBLIC_E2E_PHOTO_CONSENT_STATE=legacy_true`.
2. Open `/progress/capture` at 320 x 568.

## Expected Result

The re-consent disclosure and both actions remain fully visible or safely scrollable without a partially exposed touch target.

## Actual Result

The 48 px `Not now` action began at 533.87 px and ended at 581.87 px in the 569 px measured viewport. Its center remained hit-testable, but 13 px of the target was clipped below the viewport.

## Evidence

- UI snapshot and geometry: `test-results/human-e2e/2026-07-14/photo-consent-typed-read-current/summary.json`
- Post-fix screenshot: `test-results/human-e2e/2026-07-14/photo-consent-typed-read-current/legacy-reconsent-fixed-320x568.png`
- Terminal transcript: Expo server session for port 8201 in the Codex task transcript.

## Frequency

- Always

## Scope

- Affected route/screen: `/progress/capture` re-consent overlay
- Affected account or fixture: legacy true, stale-version, or wrong-hash proof at compact height
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The optional skin-preparation reminder remained rendered on compact re-consent even though the additional re-consent alert consumed the vertical safety margin.

## Minimal Fix Recommendation

Hide only the optional prep reminder when the screen is compact and re-consent is required, preserving the complete consent disclosure and both actions.

## Verification Flow After Fix

1. Reload the same `legacy_true` fixture at 320 x 568.
2. Measure and center-hit-test both actions.
3. Tap `Not now` and verify navigation to `/progress`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-14/photo-consent-typed-read-current/legacy-reconsent-fixed-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-14/photo-consent-typed-read-current/summary.json`
- Result: Grant ended at 483.89 px; `Not now` ended at 535.88 px; both were fully inside the 569 px measured viewport and center-hit-testable.

## Remaining Risk

- Untested branches: Native Dynamic Type and VoiceOver on iOS 17+.
- Missing fixtures: None for this web-compatible state.
- Follow-up needed: Repeat re-consent with native safe areas and supported Dynamic Type sizes.
