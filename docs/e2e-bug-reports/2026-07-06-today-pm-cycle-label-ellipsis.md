# E2E Bug Report: PM cycle phase labels ellipsize on compact phones

Severity: Medium
Surface: Expo web phone-width proxy for iOS and Android
Environment: Local Expo web at `http://localhost:8140`, 320 x 568 phone viewport
Feature: Today PM routine and skin-cycling strip
Date: 2026-07-06
Tester: Codex

## Reproduction Steps

1. Start Expo web with `npm --workspace apps/mobile run web -- --port 8140`.
2. Set the browser viewport to 320 x 568.
3. Open `/today` while the PM Today routine is active.
4. Inspect the skin-cycling strip phase labels.

## Expected Result

The phase labels `Exfoliate`, `Retinoid`, and `Recover` should remain readable on the compact phone surface without visual ellipses or clipped glyphs.

## Actual Result

The phase labels rendered as truncated strings such as `Exfoli...`, `Retin...`, and `Reco...`, making a core Today status control look unfinished on the smallest phone viewport.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/navigation-continuation/today-320-initial.png`
- UI snapshot: `test-results/human-e2e/2026-07-06/navigation-continuation/tab-switch-320-results.json`
- UI measurement: initial label nodes rendered at the default 16 px body size despite the intended `text-[10.5px]` class, leaving 6-10 px overflow per phase label.

## Frequency

- Always on the tested 320 x 568 PM Today surface before the fix

## Scope

- Affected route/screen: `/today`, PM routine state
- Affected account or fixture: Local seeded routine/cycle state
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The cycle-strip label used a NativeWind arbitrary font-size class on the shared `Text` wrapper, but the rendered React Native Web element kept the default body text size. The four equal columns were too narrow for 16 px phase labels, so `numberOfLines={1}` produced ellipses.

## Minimal Fix Recommendation

Use explicit compact label styles for the cycle phase labels, tighten the row gap to preserve width, and keep font-scale bounds so the labels can fit under pressure without disabling accessibility scaling.

## Verification Flow After Fix

1. Reopen `/today` at 320 x 568.
2. Confirm all four phase labels render as full words.
3. Confirm label overflow is 0 and the floating tab bar remains readable and tappable.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/navigation-continuation/today-cycle-labels-readable-after-320.png`
- UI snapshot: `test-results/human-e2e/2026-07-06/navigation-continuation/today-cycle-labels-readable-after-320.json`
- Measurement: all four label elements render at 12 px, line height 15 px, with `overflowX: 0` at 320 x 568.

## Remaining Risk

- Native iOS and Android Dynamic Type still need device QA.
- Expo web cannot fully prove platform font rendering under every OS text-scale setting.
