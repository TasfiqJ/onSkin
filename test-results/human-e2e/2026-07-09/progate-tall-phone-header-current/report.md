# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-09
- Codex task: Contextual ProGate tall-phone header verification
- App surface: Expo web in Codex in-app browser
- Build/start command: `npm --workspace apps/mobile run web -- --port 8264`
- Browser/device/simulator/OS: in-app browser, 430 x 932 modern phone viewport
- Feature tested: `/progress` contextual Pro paywall header compliance
- Overall verdict: Pass

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Contextual Progress paywall | 430 x 932 tall phone | Pass | `430x932-progress-paywall.png`, `geometry-summary.json` | Terms, Privacy, Restore, and Maybe later rendered in the compact header as 48 px controls; Start free trial was 382 x 54 px and complete above the tab bar; Explore-first visible copy compacted to `No card needed.` while the full copy stayed in the accessibility label. |
| Contextual paywall dismiss | Maybe later | Pass | `430x932-after-maybe-later.png`, `geometry-summary.json` | Tapping Maybe later returned to `/today`, removed the paywall, kept horizontal overflow at zero, and opened no dialog. |

## Bugs Found

None.

## Tests Added or Updated

- `apps/mobile/src/features/subscription/paywallMobileContracts.test.ts`: guards the tall-phone text-pressure header branch and compact Explore-first copy.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts
npm --workspace apps/mobile run web -- --port 8264
```

## Remaining Risk

- Native iOS/Android Dynamic Type, StoreKit/Play Billing sheets, and real RevenueCat restore/purchase states remain Phase 5/6 device QA.
