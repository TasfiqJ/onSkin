# E2E Bug Report: handoff integration regressions

Severity: Medium (free-path dead end: High)
Surface: Expo web
Environment: Windows, local synthetic fixture, Chrome; 375x667, 390x844, 430x932
Feature: Onboarding, Today, tab navigation
Date: 2026-09-27
Tester: Codex

## Reproduction Steps

1. Complete goals and the longer quiz choices at 375x667.
2. Add owned products and choose Continue free on the onboarding paywall.
3. Navigate the four tabs and inspect tab hit targets.
4. Open the PM routine and inspect the cycle header at 430x932.

## Expected Result

All controls fit or scroll fully into view; free continuation reaches Today; tabs expose full accessible targets; cycle heading and link do not collide.

## Actual Result

Initial integration clipped lower goals/quiz choices; free exit entered a paid routine editor; Expo NativeTabs web fallback produced 30px targets and overflow at narrow widths; the cycle heading crowded Week ahead.

## Evidence

Evidence root: `test-results/human-e2e/2026-09-27/handoff-integration/`. Initial failures are retained in `onboarding-375`, `onboarding-375-final`, `onboarding-375-rerun`, `onboarding-375-accepted`, and `native-tabs`. The 430x932 pre-fix cycle screenshot is `onboarding-430-verified/24-today-pm-after-checkoff.png`.

## Frequency

Always at the stated size/path.

## Scope

Only local synthetic data was used. No external account, purchase or destructive action.

## Cause and Minimal Fix

Compact option density and margins now fit the short screen; quiz ScrollView resets per question. Continue free routes directly to Today. Web uses accessible router bottom tabs while devices retain native system tabs. The cycle heading/link row wraps with an explicit gap.

## Verification Flow After Fix

Repeat the same onboarding path, AM and PM checkoffs, repeated touch and reload persistence; click all tabs at six widths; revisit deferred deep links. The harness also now supports both compact category picker and larger-screen inline categories, and excludes wholly clipped scroll descendants from visible-control audits while continuing to reject partially clipped controls.

## Post-Fix Evidence

`onboarding-375-final2`, `onboarding-390`, `onboarding-430-verified`, `onboarding-430-final-layout`, and `navigation-verified` under the evidence root. Native Apple verification remains pending and is not claimed by these web results.
