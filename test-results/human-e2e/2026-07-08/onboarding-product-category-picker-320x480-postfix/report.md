# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Onboarding compact product category picker hardening
- App surface: Expo web
- Start command: `npm --workspace apps/mobile run web -- --port 8248 --clear`
- Browser/device/simulator/OS: Codex in-app browser at 320 x 480 viewport
- Feature tested: First-run onboarding products intake category sheet
- Overall verdict: Pass with native-device follow-up

## Flow Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Goals -> consent -> quiz -> products | Product category metadata | Pass | `11-goals-start-overlay.png`, `12-products-start-overlay.png` | Completed the real first-run path on a clean localhost origin. |
| Product name -> category sheet | Compact bottom sheet | Pass | `13-product-name-entered-overlay.png`, `14-category-sheet-open-overlay.png`, `audit.json` | One named `Choose product category` dialog, top=52, width=320, background route marked `aria-hidden`, zero horizontal overflow. |
| Select SPF -> add product | Added shelf item | Pass | `15-category-selected-overlay.png`, `16-product-added-overlay.png`, `audit.json` | `Category, SPF` was exposed before add; the added product row has a 48 x 48 remove control. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| ONB-CAT-SAFEAREA | Medium | Open compact onboarding product category picker | Safe-area-aware, scrollable, one named dialog | Previous source used nested React Native `Modal` semantics and lacked final overlay/a11y hardening | `docs/e2e-bug-reports/2026-07-08-onboarding-product-category-picker-safe-area.md` |

## Tests Added Or Updated

- `apps/mobile/src/features/onboarding/onboardingRoutes.test.ts`
- Covers: route-local overlay, no React Native `Modal`, 52 px sheet reserve, named web dialog, background accessibility hiding, padded scrollable chip list, and keyboard tap handling.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/onboarding/onboardingRoutes.test.ts
npm --workspace apps/mobile run web -- --port 8248 --clear
# Codex in-app browser human E2E at 320 x 480
```

## Remaining Risk

- Native iOS/Android home-indicator behavior, Dynamic Type, VoiceOver, and TalkBack traversal still need device QA.
- Expo terminal logs include the existing expected local Supabase placeholder and expo-notifications web warnings; the browser audit recorded no current warn/error logs.
