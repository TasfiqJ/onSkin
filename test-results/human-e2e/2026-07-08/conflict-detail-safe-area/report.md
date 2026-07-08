# Conflict Detail Safe-Area E2E Report

Date: 2026-07-08
Surface: Expo web
Viewport: 320 x 568
Route: `/conflict/missing-rule-e2e`

## Result

Pass after fix, with a pre-fix regression captured.

The pre-fix compact pass rendered the stale conflict copy but collapsed the dialog to `maxHeight: 0px`, pushing `Back to Shelf` and `Add a product` below the viewport. The fallback was updated so a transient 44 px `useWindowDimensions()` height does not count as a usable viewport.

The post-fix pass rendered a 524 px dialog starting near the top dismiss reserve, with `aria-modal="true"`, `Timing note unavailable` accessibility label, zero horizontal overflow, no mojibake, and both actions visible at 56 px and 48 px heights.

## Evidence

- Pre-fix UI snapshot: `01-conflict-missing-320x568-state.json`
- Post-fix UI snapshot: `02-conflict-missing-320x568-after-fallback.json`

## Commands

- `npm --workspace apps/mobile run web -- --port 19141 --host localhost`
- Browser route verification through the Codex in-app browser

## Remaining Risk

This web pass does not replace native iOS/Android home-indicator, Dynamic Type, VoiceOver, TalkBack, or real-device scroll physics QA.
