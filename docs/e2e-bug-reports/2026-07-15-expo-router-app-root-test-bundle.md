# E2E Bug Report: Component test inside Expo Router app root broke the web bundle

- Severity: High
- Surface: Expo web
- Environment: Development Metro/Expo Router
- Feature: Health-consent component regression test placement
- Date: 2026-07-15
- Tester: Codex in-app browser

## Reproduction Steps

1. Place the health-consent component test under `apps/mobile/src/app/onboarding/`.
2. Start Expo web and navigate through health consent.
3. Allow Expo Router to scan and bundle its `src/app` route tree.

## Expected Result

Only route modules are included in the file-based app tree and the consent UI remains usable.

## Actual Result

Expo Router treated the test as app-tree input. Metro failed while transforming Vitest/Vite internals with `vite/dist/node/module-runner.js: Invalid call import(filepath)`, replacing the app with a transform-error surface.

## Evidence

- Terminal transcript: Metro `TransformError` naming `vite/dist/node/module-runner.js` and `Invalid call at line 1009: import(filepath)`
- UI result: the consent/reconsent surface was replaced by the Expo error overlay until the server was rebuilt

## Frequency

- Always while the test file remained under `src/app`

## Scope

- Affected route/screen: the complete Expo Router web bundle
- Affected account or fixture: all development sessions
- External service involved: none
- Destructive action involved: none

## Suspected Cause

Expo Router's file-based route scan includes modules under `src/app`; importing Vitest and renderer dependencies from a colocated test pulled Node-oriented Vite runtime code into Metro's app transform.

## Minimal Fix Recommendation

Move the component test to `src/features/onboarding/` and import the route under test from there. Add a verification check that no `*.test.ts` or `*.test.tsx` remains below `src/app`.

## Verification Flow After Fix

1. Confirm `rg --files apps/mobile/src/app | rg '\.test\.(ts|tsx)$'` has no matches.
2. Restart Expo web from a clean Metro process.
3. Open consent and complete the target interaction.
4. Run the moved component regression with Vitest.

## Post-Fix Evidence

- Focused component and route suites pass with the test at `apps/mobile/src/features/onboarding/consentNavigation.test.ts`.
- Clean Expo web rebuild reaches the live consent surface without the transform overlay.

## Remaining Risk

- Keep all future test-only modules outside the file-based route root.
