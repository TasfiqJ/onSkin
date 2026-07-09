# E2E Bug Report: Skipped direct routes failed support-floor text pressure

Severity: High
Surface: Expo web
Environment: 320 x 480 viewport, 170% text-pressure skipped-route audit
Feature: Onboarding age gate, lifecycle reoffer paywall, stale conflict recovery
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run `npm run e2e:text-pressure` with `TEXT_PRESSURE_SCALE=1.7`, `TEXT_PRESSURE_VIEWPORT_WIDTH=320`, `TEXT_PRESSURE_VIEWPORT_HEIGHT=480`, and `TEXT_PRESSURE_ROUTES` set to the omitted direct-entry route set.
2. Include `/onboarding/age`, `/paywall/reoffer`, and `/conflict/00000000-0000-4000-8000-000000000001`.

## Expected Result

All visible controls are complete, at least 44 px where applicable, center-hit-testable, and free of horizontal or one-line text overflow.

## Actual Result

`/onboarding/age` placed the day, month, and year inputs under the fixed Continue footer. `/paywall/reoffer` overflowed the compact `$49.99/year` price text. The stale conflict recovery sheet clipped `Back to Shelf` at the bottom edge.

## Evidence

- Summary: `test-results/human-e2e/2026-07-09/text-pressure-170-skipped-routes-320-480-current/summary.json`
- Failures: `test-results/human-e2e/2026-07-09/text-pressure-170-skipped-routes-320-480-current/failures.json`
- Screenshots: `test-results/human-e2e/2026-07-09/text-pressure-170-skipped-routes-320-480-current/onboarding-age.png`, `paywall-reoffer.png`, and `conflict-00000000-0000-4000-8000-000000000001.png`

## Frequency

- Always in the skipped-route 320 x 480 / 170% text-pressure sweep before the fix.

## Scope

- Affected route/screen: `/onboarding/age`, `/paywall/reoffer`, `/conflict/[ruleId]` missing-state recovery.
- Affected account or fixture: local Expo web fixtures used by `scripts/e2e/text-pressure-route-audit.mjs`.
- External service involved: None.
- Destructive action involved: None.

## Suspected Cause

The default route audit did not cover these direct-entry routes. Their compact layouts had older assumptions: the age screen was not scroll-buffered above a fixed footer, the reoffer price used a single nowrap text group, and the missing-conflict explanation sat before the primary recovery action on a very short sheet.

## Minimal Fix Recommendation

Allow focused route overrides in the text-pressure audit, then keep the age gate scrollable above its footer, split compact reoffer price text into fitted pieces, and prioritize missing-conflict recovery actions ahead of explanatory copy on short sheets.

## Verification Flow After Fix

1. Re-run the same skipped-route audit at 320 x 480 / 170%.
2. Confirm all 21 routes pass with zero failed routes.

## Post-Fix Evidence

- Summary: `test-results/human-e2e/2026-07-09/text-pressure-170-skipped-routes-320-480-postfix/summary.json`
- Report: `test-results/human-e2e/2026-07-09/text-pressure-170-skipped-routes-320-480-postfix/report.md`
- Screenshots: `test-results/human-e2e/2026-07-09/text-pressure-170-skipped-routes-320-480-postfix/onboarding-age.png`, `paywall-reoffer.png`, and `conflict-00000000-0000-4000-8000-000000000001.png`

The post-fix skipped-route audit passed 21 / 21 routes with zero clipped controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs.

## Remaining Risk

- Native iOS/Android Dynamic Type, screen-reader order, keyboard, and safe-area behavior remain device QA gates.
