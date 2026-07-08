# E2E Bug Report: Settings privacy choice failure was not touch-recoverable

Severity: High
Surface: Expo web
Environment: Codex in-app browser, Expo web at 320 x 568, local Supabase placeholders unavailable
Feature: You tab privacy and security choices
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web and open `http://localhost:19175/settings/privacy`.
2. Confirm the route resolves to `/you?section=privacy` and the Marketing emails switch is visible.
3. Tap the Marketing emails switch with a pointer/touch action while local consent persistence is unavailable.
4. Repeat the same activation with keyboard Enter.

## Expected Result

The switch is reachable by pointer/touch and keyboard. A failed save keeps the switch state honest, shows nearby inline recovery copy, does not open a blocking native or JavaScript dialog, and does not expose backend/provider error text.

## Actual Result

Before the fix, the You-tab privacy save-failure path still used a native `Alert.alert('Choice not saved', ...)` recovery path in source. During the first human-simulated web pass after moving the failure text inline, pointer/touch activation only focused the shared switch and did not fire the change handler because `ToggleSwitch` disabled `onPress` on web and relied on an `onClick` prop that React Native Web did not activate in this surface. Keyboard activation did trigger the inline failure copy.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/settings-privacy-choice-inline-feedback/03-after-real-pointer-tap.png`
- Screenshot: `test-results/human-e2e/2026-07-08/settings-privacy-choice-inline-feedback/04-after-keyboard-activation.png`
- UI snapshot: Marketing switch 52 x 48 px, unchecked, no JS dialog after pointer tap, no feedback before the shared switch fix.
- Terminal transcript: focused settings/component tests run through Vitest.

## Frequency

- Always on the observed Expo web surface.

## Scope

- Affected route/screen: `/settings/privacy` -> `/you?section=privacy`
- Affected account or fixture: local signed-in/placeholder backend state
- External service involved: Supabase consent persistence unavailable locally
- Destructive action involved: No

## Suspected Cause

`apps/mobile/src/app/(tabs)/you.tsx` delegated privacy-choice failures to a native alert instead of route-owned inline feedback. Separately, `apps/mobile/src/components/ui/ToggleSwitch.tsx` set `onPress` to `undefined` on web and attempted to activate through an `onClick` prop, which did not fire for the rendered React Native Web `Pressable` in the phone-sized browser surface.

## Minimal Fix Recommendation

Move privacy/security choice failures to inline `accessibilityRole="alert"` feedback at the affected row, and make `ToggleSwitch` use `onPress={activate}` across platforms while retaining explicit web keyboard handling and tab order.

## Verification Flow After Fix

1. Reload `/settings/privacy` at 320 x 568.
2. Tap Marketing emails with a pointer/touch action.
3. Verify inline `Choice not saved` recovery copy appears, the switch remains unchecked, no JS dialog exists, no raw backend text leaks, and horizontal overflow is zero.
4. Reload and repeat with keyboard Enter.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/settings-privacy-choice-inline-feedback/06-after-component-fix-pointer-inline-feedback.png`
- Screenshot: `test-results/human-e2e/2026-07-08/settings-privacy-choice-inline-feedback/07-after-component-fix-keyboard-inline-feedback.png`
- UI snapshot: pointer and keyboard activation both render a visible `role="alert"` region, 232 x 68 px, between Marketing emails and Photos & the no-AI-score promise.
- UI snapshot: switch remains `aria-checked="false"`, touch target is 52 x 48 px, no JS dialog appears, raw backend text is absent, and horizontal overflow is zero.

## Remaining Risk

- Untested branches: native iOS and Android switch activation with live consent persistence.
- Missing fixtures: live Supabase consent-service failure fixture.
- Follow-up needed: run the same privacy/security choice failure branch on iOS Simulator and Android emulator before store submission.
