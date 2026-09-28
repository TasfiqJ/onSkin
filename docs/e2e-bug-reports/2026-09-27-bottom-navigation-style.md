# E2E Bug Report: bottom navigation did not match the app

Severity: Medium
Surface: Expo web; native styling updated, device verification pending
Environment: Windows, Chrome, isolated local fixture
Feature: Today / Progress / Shelf / You navigation
Date: 2026-09-27
Tester: Codex

## Reproduction Steps

1. Open the evening Today screen.
2. Inspect the bottom navigation, then tap Shelf.

## Expected Result

An icon-and-label dock that uses the app's palette and typography, shows a clear selected state, and respects touch targets and safe areas.

## Actual Result

The web fallback was a white text-only strip, visually disconnected from the dark evening surface and missing navigation icons.

## Cause and Fix

The previous web fallback explicitly hid icons and used the router's default background. It now renders 23px outline/filled SVG icons above full labels, with a subtle clay selected capsule, Hanken Grotesk labels, a fine divider and balanced 72px geometry plus the safe-area inset. Paper/night colors follow the same shared routine-phase observer as Today. Native system tabs receive the same palette and typography and remain visible when scrolling.

During verification, a platform-specific font export caused a web error and SVG image loading left blank icons. Importing the existing shared font tokens directly and rendering inline SVG resolved both. The final browser log must contain neither error. A deprecated web shadow property was also removed.

## Frequency / Scope

Always in the former web fallback. No persistence, account or payment behavior changed; no dependencies added. Existing lifecycle ownership/cancellation remains intact.

## Verification Flow After Fix

Click all four tabs at 320x568, 360x640, 375x667, 390x844, 412x915 and 430x932. Verify full labels, one selected tab, at least 44px targets, visible icons and zero horizontal overflow. Inspect light and dark screenshots and browser logs. Recheck deferred-route return navigation and manual-intake fallbacks with the existing harness.

## Evidence

`test-results/human-e2e/2026-09-27/navigation-style/accepted/` contains the final screenshots, geometry and logs. Earlier `browser` and `verified` folders retain failed iterations; `final` is the visually inspected passing run before adding the explicit icon-size assertion. Typecheck/lint and navigation/subscription contract output is retained alongside the browser folders.

Native iPhone appearance, VoiceOver and physical safe-area behavior remain unverified on this Windows host.

## Follow-up: floating dock requested

The user requested a floating shape after the attached dock. The navigator now uses an inset rounded 72px dock on web and native iOS, with a restrained shadow and reserved scene space to keep controls reachable. Native SF symbols use the already-installed Expo Symbols module, now declared directly in the mobile workspace and lockfile. The older system-tab geometry is superseded by this explicit request. No second navigation bar is mounted.

The first floating screenshot exposed vertically compressed labels because the stock tab button adds its own padding. Reducing the dock's internal vertical padding preserves a full label line. The geometry harness now checks label height, icon size, and inset edges in addition to navigation and touch targets. Evidence: `test-results/human-e2e/2026-09-27/floating-navigation/accepted/`. Native iPhone rendering remains unverified on this Windows host.

## Follow-up: hover and scroll polish

Added hover lift, press compression, keyboard focus feedback and a small settling response to actual tab-screen scrolling. The existing list restoration handlers are composed rather than replaced. Reduced/unknown motion preferences disable transforms. Native animations use the native driver, while web explicitly uses its supported JS driver; the first browser warning from requesting a native driver on web was fixed and rerun without filtering it out. Mouse activation clears the keyboard-only ring, while keyboard activation preserves focus feedback.

Verification: all 374 test files / 4,554 tests pass. Navigation geometry and pointer/wheel motion passed across six viewport sizes, both with motion enabled and disabled. Evidence is under `test-results/human-e2e/2026-09-27/navigation-motion/`.

Final motion reruns: `navigation-motion/verified/` and `navigation-motion/reduced-verified/`. Both platforms initialize stable Animated values once through state; this avoids the React Compiler ref rule and the unavailable web `useAnimatedValue` export. Failed iterations remain separate from acceptance evidence.
