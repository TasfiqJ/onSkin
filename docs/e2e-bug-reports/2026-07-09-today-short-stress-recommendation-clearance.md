# E2E Bug Report: Today AM Recommendation Peeks Under Tab Bar On Ultra-Short Stress Viewport

Severity: Low
Surface: Expo web
Environment: Headless Chrome Expo web, 320 x 430 stress viewport, `EXPO_PUBLIC_E2E_LOCAL_RESET=1`
Feature: First-session onboarding activation into Today
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run `npm run e2e:onboarding-first-session` with `ONBOARDING_E2E_VIEWPORT_WIDTH=320` and `ONBOARDING_E2E_VIEWPORT_HEIGHT=430`.
2. Complete reset onboarding, choose the no-card `Explore first` path, open the generated routine plan, and tap `Start today`.
3. Force `/today?routine=AM` and inspect the first viewport after the generated SPF routine appears.

## Expected Result

The core AM check-off is visible and tappable, and lower-priority recommendation surfaces do not sit under the floating tab bar on the ultra-short stress viewport.

## Actual Result

The AM `Mineral SPF 50` row was visible and tappable, but the top of the recommendation teaser below it peeked into the floating tab bar zone and failed the center hit-test audit.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/onboarding-first-session-430-current/21-today-am-before-checkoff.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/onboarding-first-session-430-current/21-today-am-before-checkoff.json`
- Terminal transcript: failed `npm run e2e:onboarding-first-session` run before the fix reported `21-today-am-before-checkoff has 1 visible control issue(s)`.

## Frequency

- Always in the 320 x 430 stress viewport before the fix.

## Scope

- Affected route/screen: `/today?routine=AM`
- Affected account or fixture: local reset first-session routine with one AM SPF step
- External service involved: none
- Destructive action involved: local-only E2E reset fixture

## Suspected Cause

The real-routine AM Today screen rendered the recommendation teaser immediately after a compact routine card. At 320 x 430, the teaser began inside the floating tab bar zone. This viewport is below the launch web support floor, but the maintained stress harness still audits it.

## Minimal Fix Recommendation

Suppress the lower-priority recommendation teaser when `height < 500`, while keeping the core routine card and check-off available.

## Verification Flow After Fix

1. Re-run `npm run e2e:onboarding-first-session`.
2. Confirm the AM `Mineral SPF 50` checkbox is visible, at least 44 px tall/wide, center-hit-testable, and advances from `0 of 1` to `1 of 1`.
3. Confirm the full activation path still reaches `/today?routine=PM` and completes the PM `Glycolic 7%` check-off.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/onboarding-first-session-430-current/21-today-am-before-checkoff.png`
- Screenshot: `test-results/human-e2e/2026-07-09/onboarding-first-session-430-current/22-today-am-after-checkoff.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/onboarding-first-session-430-current/summary.json`
- Terminal transcript: final `npm run e2e:onboarding-first-session` pass completed successfully.

## Remaining Risk

- 320 x 430 is stress evidence below the accepted launch web support floor.
- Native iOS/Android safe-area behavior still needs simulator or physical-device QA.
