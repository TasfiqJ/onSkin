# E2E Bug Report: Settings Privacy Text Overflow Under Text Pressure

Severity: Medium
Surface: Expo web
Environment: Local Expo web launched by `npm run e2e:text-pressure`
Feature: You tab privacy and policy rows
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Run `npm run e2e:text-pressure`.
2. Let the audit open `/settings/privacy` at 320 x 568 with 120% text pressure.
3. Inspect the text-overflow report for compact privacy and policy rows.

## Expected Result

Compact privacy and policy row subtitles wrap or are intentionally omitted
without producing hidden horizontal text overflow.

## Actual Result

The first run failed one route, `/settings/privacy`. Compact row hints were
forced to one line, and web rendered several privacy/policy subtitles with
`white-space: nowrap`, including withdrawal, privacy, consumer health privacy,
terms, support, account deletion, and data export descriptions.

## Evidence

- UI snapshot: `test-results/human-e2e/2026-07-08/text-pressure-120-route-audit-current/settings-privacy.png`
- Terminal transcript: first `npm run e2e:text-pressure` run failed with `1 text-pressure route(s) failed`.

## Frequency

- Always on the affected route before the fix.

## Scope

- Affected route/screen: `/settings/privacy`
- Affected account or fixture: local route-audit fixture
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The shared You-tab row component set `numberOfLines={compact ? 1 : undefined}`
on every compact hint. React Native Web translated that into single-line,
no-wrap text, which made long policy descriptions overflow under text pressure.

## Minimal Fix Recommendation

Remove the compact one-line clamp from row hints and keep compact hint typography
wrapped with a readable 16 px line height. Update the settings route contract so
the old one-line clamp cannot return unnoticed.

## Verification Flow After Fix

1. Run `npm --workspace apps/mobile run test -- settingsRoutes paywallMobileContracts`.
2. Run `npm run e2e:text-pressure`.
3. Confirm the route audit reports zero failed routes.

## Post-Fix Evidence

- UI snapshot: `test-results/human-e2e/2026-07-08/text-pressure-120-route-audit-current/settings-privacy.png`
- Summary: `test-results/human-e2e/2026-07-08/text-pressure-120-route-audit-current/summary.json`
- Report: `test-results/human-e2e/2026-07-08/text-pressure-120-route-audit-current/report.md`

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard, and hardware
  safe-area behavior still require device QA.
