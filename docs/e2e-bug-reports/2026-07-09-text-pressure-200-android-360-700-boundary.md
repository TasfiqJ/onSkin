# E2E Bug Report: 360 x 700 text-pressure boundary clipped Community and Shelf Scan controls

Severity: High
Surface: Expo web
Environment: Headless Chrome Expo web, 360 x 700 viewport, 200% text pressure
Feature: Skin Notes Community Trust Layer; Shelf barcode scan fallback
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Start the Expo web app through `npm run e2e:text-pressure` with `TEXT_PRESSURE_VIEWPORT_WIDTH=360`, `TEXT_PRESSURE_VIEWPORT_HEIGHT=700`, and `TEXT_PRESSURE_SCALE=2`.
2. Let the route audit open the 49 direct-entry routes.
3. Inspect `/community` and `/shelf/scan`.

## Expected Result

Visible controls in the first viewport are complete, hit-testable, and at least 44 px tall. Lower-priority note cards and scan fallback rows should start fully below the first viewport rather than peeking into the floating-tab or bottom-edge zone.

## Actual Result

`/community` exposed the second Sensitive Skin note as a 22 px partial target at the viewport bottom. `/shelf/scan` exposed `Add it by hand` as a 24 px partial target at the viewport bottom.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-700-current/community.png`
- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-700-current/shelf-scan.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-700-current/failures.json`
- Terminal transcript: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-700-current/report.md`

## Frequency

- Always with the 360 x 700 / 200% text-pressure route audit before the fix.

## Scope

- Affected route/screen: `/community`, `/shelf/scan`
- Affected account or fixture: local Expo web E2E fixture
- External service involved: no
- Destructive action involved: no

## Suspected Cause

Both routes already had compact support-floor text-pressure layouts, but the height guard stopped at `< 700`. A supported 360 x 700 Android-class viewport therefore used the roomier layout at exactly 700 px, leaving lower-priority cards and fallback rows partially visible at the first-viewport bottom edge.

## Minimal Fix Recommendation

Include the exact 700 px height boundary in the existing compact support-floor guards for the Community hub and Shelf Scan fallback.

## Verification Flow After Fix

1. Run focused route contract tests for Community and Shelf Scan.
2. Re-run the same 360 x 700 / 200% route audit.
3. Visually spot-check `/community` and `/shelf/scan` screenshots.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-700-postfix/community.png`
- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-700-postfix/shelf-scan.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-700-postfix/summary.json`
- Terminal transcript: `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-700-postfix/report.md`

## Remaining Risk

- Untested branches: native iOS/Android Dynamic Type, VoiceOver, TalkBack, hardware safe-area, and real camera/torch behavior.
- Missing fixtures: physical iOS and Android device runs.
- Follow-up needed: keep this viewport in the supported-phone text-pressure rotation while Phase 5 device QA remains open.
