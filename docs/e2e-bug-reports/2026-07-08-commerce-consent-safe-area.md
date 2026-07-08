# E2E Bug Report: Commerce Consent Sheet Safe Area

Severity: Medium
Surface: Expo web verified; iOS / Android risk
Environment: Codex in-app browser, Expo web at `/commerce/consent`, 320 x 568 compact viewport, `EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=true`
Feature: Commerce where-to-buy consent gate
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with `EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=true`.
2. Open `/commerce/consent` at a 320 x 568 phone viewport.
3. Inspect the sheet height, dismiss target, primary/secondary actions, and web modal semantics.

## Expected Result

The MHMDA commerce consent gate opens as a named modal bottom sheet, keeps a 44 px outside dismiss reserve, keeps Dismiss / Allow / Not now touch targets at least 48 px tall on compact phones, adds extra bottom padding when a real native bottom inset exists, and hides the scrim from accessibility traversal because the visible Dismiss button is the named exit.

## Actual Result

The route-local consent sheet used `Math.max(280, height - 48)` and a fixed `pb-8` footer. That kept the compact web baseline, but it did not account for native home-indicator insets and did not expose `role="dialog"` / `aria-modal` on web. The full-screen scrim was also not explicitly hidden from web/native accessibility traversal.

## Evidence

- UI snapshot: `test-results/human-e2e/2026-07-08/commerce-consent-safe-area/01-commerce-consent-320x568-state.json`
- Terminal transcript: focused commerce route test, mobile typecheck, mobile lint, and Expo web run in Codex terminal
- Screenshot limitation: browser screenshot capture returned `Unable to capture screenshot`, so the run uses a DOM/UI geometry snapshot.

## Frequency

- Always in source before the fix for native bottom-inset devices.

## Scope

- Affected route/screen: `/commerce/consent`
- Affected account or fixture: commerce-enabled local preview
- External service involved: No live retailer or ShopMy service; local preview only
- Destructive action involved: No

## Suspected Cause

`CommerceConsentSheet` is a route-local bottom-sheet implementation and had not inherited the shared `Sheet` safe-area and dialog-semantics hardening.

## Minimal Fix Recommendation

Move the viewport and safe-area contract into the consent sheet: use `useWindowDimensions()` and `useSafeAreaInsets()`, cap the sheet at `viewportHeight - 44`, preserve the 32 px compact web footer padding when there is no bottom inset, add `insets.bottom + 24` for native bottom insets, expose the sheet as a modal dialog, and remove the backdrop from accessibility traversal.

## Verification Flow After Fix

1. Start Expo web with `EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=true`.
2. Open `/commerce/consent` at 320 x 568.
3. Verify the sheet renders as one `role="dialog"` with `aria-modal="true"`.
4. Verify the sheet top starts at 44 px, max height is viewport minus 44, horizontal overflow is zero, Dismiss is 48 x 48, Allow is 264 x 54, and Not now is 264 x 48.

## Post-Fix Evidence

- UI snapshot: `test-results/human-e2e/2026-07-08/commerce-consent-safe-area/01-commerce-consent-320x568-state.json`
- Focused regression: `npm --workspace apps/mobile run test -- commerceRoutes.test.ts`
- Typecheck: `npm --workspace apps/mobile run typecheck`
- Lint: `npm --workspace apps/mobile run lint`

## Remaining Risk

- Native iOS/Android home-indicator, Dynamic Type, VoiceOver, TalkBack, and real outbound-link handoff still require device QA.
- Screenshot capture was unavailable in the Codex in-app browser for this route.
