# E2E Bug Report: Routine order phone and copy contract gaps

Severity: Medium
Surface: Expo web
Environment: Expo development web, Pro fixture, 360 x 640 and 390 x 844
Feature: Persistent Morning/Evening routine order
Date: 2026-07-10
Tester: Codex

## Reproduction Steps

1. Build a real multi-step Shelf and open Plan plus `/routine/reorder`.
2. Inspect Plan action geometry, save a PM order while retinol is safety-excluded, and inspect Today PM.
3. Read the Morning/Evening tab accessibility state.

## Expected Result

Plan actions remain at least 44 px, Today names only instructions relevant to scheduled steps, and the active phase is exposed to assistive technology.

## Actual Result

The nominal 44 px Plan controls rendered as 43.99 px; the cleanser still said `Dry skin fully before the retinoid` with retinol excluded; and the tab roles had no `aria-selected` attribute.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-10/routine-order-persistence-current/`
- Logs: `browser-warn-error-logs.json`
- UI snapshot: `03-save-failure-360x640.txt`, `07-today-pm-corrected-390x844.txt`, `phase-tab-accessibility.json`

## Frequency

- Always

## Scope

- Affected route/screen: `/routine/plan`, `/routine/reorder`, `/today?routine=PM`
- Affected account or fixture: Any real multi-step routine; copy issue requires no scheduled retinoid
- External service involved: None
- Destructive action involved: None

## Suspected Cause

Expo web's fractional layout made an exact 44 px floor undershoot; PM display copy was unconditional by role; and React Native web did not map the phase `accessibilityState` to `aria-selected` in this control.

## Minimal Fix Recommendation

Raise Plan actions to 48 px, condition retinoid-specific display copy on the actual cycled step, and expose explicit tablist/selected semantics.

## Verification Flow After Fix

1. Reopen the same real fixture at both supported viewports.
2. Re-run Plan/editor/Today geometry and PM copy checks.
3. Read `aria-selected` before and after switching phases.

## Post-Fix Evidence

- Screenshot and UI snapshots: `test-results/human-e2e/2026-07-10/routine-order-persistence-current/`
- Geometry: zero sub-44 or clipped visible controls at 360 x 640 and 390 x 844
- Accessibility: Morning and Evening alternate exact `aria-selected=true/false`

## Remaining Risk

- Untested branches: Physical-device Dynamic Type and native biometric/storage lifecycle
- Missing fixtures: VoiceOver/TalkBack and keychain/keystore fault injection
- Follow-up needed: Phase 5 native-device pass in `docs/FOR_TAS_TO_DO.md`
