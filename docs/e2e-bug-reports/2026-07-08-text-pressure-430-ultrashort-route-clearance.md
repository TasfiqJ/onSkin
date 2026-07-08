# E2E Bug Report: 320 x 430 text-pressure route clearance

Severity: Medium
Surface: Expo web
Environment: Headless Chrome, Expo web, 320 x 430 viewport, 120% scripted text pressure
Feature: Compact route layout, settings privacy direct entry, Shelf scan fallback, paywall and intake recovery
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Run `npm run e2e:text-pressure` with `TEXT_PRESSURE_VIEWPORT_HEIGHT=430`.
2. Inspect the 49 direct-entry routes under 120% text pressure.

## Expected Result

Visible controls remain complete, at least 44 px, center-hit-testable, and free of horizontal overflow or unexpected browser logs.

## Actual Result

The shortest text-pressure sweep exposed ultra-short layout pressure. `/settings/privacy` could place privacy/direct-entry controls too close to the tab bar or clip compact policy/marketing text, and `/shelf/scan` let the fallback sheet cover the `Close` and `torch` header hit targets.

## Evidence

- Post-fix report: `test-results/human-e2e/2026-07-08/text-pressure-120-route-audit-430-current/report.md`
- Post-fix summary: `test-results/human-e2e/2026-07-08/text-pressure-120-route-audit-430-current/summary.json`
- Screenshots and per-route UI snapshots: `test-results/human-e2e/2026-07-08/text-pressure-120-route-audit-430-current/`

## Frequency

Always at 320 x 430 with 120% text pressure before the fix.

## Scope

- Affected route/screen: `/settings/privacy`, `/settings/notifications`, `/shelf/no-match`, `/shelf/scan`, `/ask`, and compact ProGate paywalls under ultra-short text pressure.
- Affected account or fixture: Local Expo web fixtures only.
- External service involved: None.
- Destructive action involved: None.

## Suspected Cause

Several compact layouts were tuned for 320 x 568 or 320 x 480 but not the shorter 430 px viewport under increased text metrics. The Shelf scan route also allowed the bottom fallback sheet to start over the top header strip when the preview area collapsed.

## Minimal Fix Recommendation

Use explicit sub-460 px density bands for affected surfaces: shorten nonessential explanatory copy, keep primary controls at 48 px+, reserve the Shelf scan header strip, compact fallback rows, and omit dead web camera preview content when no scan preview is available.

## Verification Flow After Fix

1. Re-run the 320 x 430 / 120% route sweep.
2. Confirm every route has zero clipped controls, blocked center hit-tests, sub-44 targets, horizontal overflow, and disallowed browser logs.

## Post-Fix Evidence

- `test-results/human-e2e/2026-07-08/text-pressure-120-route-audit-430-current/report.md` records `Status: pass` and `Failed routes: 0 / 49`.
- `test-results/human-e2e/2026-07-08/text-pressure-120-route-audit-430-current/failures.json` records an empty failure list.

## Remaining Risk

- Native iOS/Android Dynamic Type, keyboard, VoiceOver, TalkBack, and hardware safe-area behavior still require device QA.
