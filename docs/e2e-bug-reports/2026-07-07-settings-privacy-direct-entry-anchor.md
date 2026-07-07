# E2E Bug Report: Settings privacy direct entry misses privacy controls

Severity: Medium
Surface: Expo web
Environment: `npm --workspace apps/mobile run web -- --port 8104`, 320 x 568 browser viewport
Feature: Settings Account Controls
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start Expo web.
2. Open `http://localhost:8104/settings/privacy` at a compact phone viewport.
3. Observe the first visible settings content after the redirect settles.

## Expected Result

The direct privacy settings entry lands inside the You tab with `PRIVACY & CONSENT` visible at the top of the phone viewport, and privacy/security rows remain readable and tappable above the floating tab bar.

## Actual Result

The route reached the You tab but the first visible area was above the privacy controls, so a user following a privacy deep link had to scroll to find Marketing emails, photo/privacy promises, or consent withdrawal.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/settings-privacy-direct-entry/01-settings-privacy-direct-entry-320.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/settings-privacy-direct-entry/01-settings-privacy-direct-entry-320.json`
- Logs: `test-results/human-e2e/2026-07-07/settings-privacy-direct-entry/04-browser-console-warnings.json`

## Frequency

- Always

## Scope

- Affected route/screen: `/settings/privacy`, `/(tabs)/you`
- Affected account or fixture: local Expo web placeholder session
- External service involved: none
- Destructive action involved: no

## Suspected Cause

`/settings/privacy` only redirected to the You tab and did not carry a privacy-section target. The first attempted anchor also proved why the contract needed to be stricter: a scroll marker can exist but be attached to the wrong card unless the test pins it to the `PRIVACY & CONSENT` section.

## Minimal Fix Recommendation

Redirect `/settings/privacy` to `/(tabs)/you` with `section=privacy`, measure the `PRIVACY & CONSENT` card, and scroll the You tab to that measured position once layout is ready.

## Verification Flow After Fix

1. Open `http://localhost:8104/settings/privacy` at 320 x 568.
2. Confirm the URL resolves to `/you?section=privacy`.
3. Confirm `PRIVACY & CONSENT`, Marketing emails, photo privacy, and consent withdrawal controls are visible and tappable.
4. Tap `Photos & the no-AI-score promise`, then navigate back.
5. Confirm the You tab returns with the privacy card still visible.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/settings-privacy-direct-entry/02-settings-privacy-direct-entry-fixed-320.png`
- Screenshot: `test-results/human-e2e/2026-07-07/settings-privacy-direct-entry/03-settings-privacy-after-row-back-320.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/settings-privacy-direct-entry/02-settings-privacy-direct-entry-fixed-320.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/settings-privacy-direct-entry/03-settings-privacy-row-navigation.json`
- Logs: `test-results/human-e2e/2026-07-07/settings-privacy-direct-entry/05-browser-console-warnings-8104.json`
- Terminal transcript: focused Vitest route-contract run passed.

## Remaining Risk

- Untested branches: native iOS and Android simulator visual passes for this direct entry.
- Missing fixtures: no authenticated real Supabase account; Expo web used placeholder local state.
- Follow-up needed: promote this deep-link behavior into the eventual native mobile E2E harness.
