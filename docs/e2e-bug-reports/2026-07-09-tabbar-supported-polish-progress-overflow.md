# E2E Bug Report: Floating tab bar label and active-state polish

Severity: Medium
Surface: Expo web
Environment: Headless Chrome via `npm run e2e:tabbar-geometry` and `npm run e2e:text-pressure`
Feature: Bottom tab navigation
Date: 2026-07-09
Tester: Codex human-simulated E2E

## Reproduction Steps

1. Open the app on a phone-width Expo web viewport.
2. Inspect the floating bottom tab bar on Today, Progress, Shelf, and You.
3. Compare supported-phone widths from 360 x 640 through 430 x 932, then run a focused 412 x 915 / 200 percent text-pressure route audit.

## Expected Result

The floating tab bar feels like a premium native control: destination labels render directly, the active state is clear without overpowering the bar, all tab centers are hit-testable, `Progress tab` remains the accessibility label, and compact phone widths avoid visible tab-label overflow.

## Actual Result

The prior selected state filled a full tab slot and felt visually heavy. When the active-pill polish narrowed the bar, the full visible `Progress` label overflowed at 412 x 915 under 200 percent route-audit pressure.

## Evidence

- Failing snapshot/report: `test-results/human-e2e/2026-07-09/tabbar-polish-412-pressure-current/`
- Terminal transcript: `npm run e2e:text-pressure`

## Frequency

- Always before the compact supported-phone label fix.

## Scope

- Affected route/screen: Floating bottom tab bar across `(tabs)` routes.
- Affected account or fixture: Local Expo web with placeholder Supabase and Pro fixture state.
- External service involved: None.
- Destructive action involved: None.

## Suspected Cause

The tab item applied the active background to the full pressable slot. The active-pill polish correctly moved that background inward, but the narrower polished bar left insufficient room for the full visible `Progress` string on compact phones.

## Minimal Fix Recommendation

Move the active background into an inset inner frame, use compact visible `Prog.` through the 430 px compact-phone band, preserve the full `Progress tab` accessibility label, and leave role=`tab` text to the dedicated tab-bar geometry harness instead of the generic route-wide synthetic text-pressure scaler.

## Verification Flow After Fix

1. Run the focused navigation contract test.
2. Run the tab-bar geometry harness across 320 x 568, 360 x 640, 375 x 667, 390 x 844, 412 x 915, and 430 x 932.
3. Re-run `/settings/privacy` at 412 x 915 with 200 percent synthetic text pressure.

## Post-Fix Evidence

- Screenshots/UI snapshots: `test-results/human-e2e/2026-07-09/navigation-tabbar-supported-polish-postfix2/`
- UI snapshot/report: `test-results/human-e2e/2026-07-09/tabbar-polish-412-pressure-postfix2/`
- Terminal transcript: `npm --workspace apps/mobile run test -- src/features/navigation/tabBar.test.ts`
- Terminal transcript: `npm run e2e:tabbar-geometry`
- Terminal transcript: `npm run e2e:text-pressure`

## Remaining Risk

- Untested branches: Native iOS/Android rendering with platform Dynamic Type, VoiceOver, TalkBack, and hardware safe areas.
- Missing fixtures: Physical devices and native builds.
- Follow-up needed: Keep Phase 5 native device QA as the final proof for platform-specific tab-bar rendering.
