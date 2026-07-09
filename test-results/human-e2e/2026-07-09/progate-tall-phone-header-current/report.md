# Human-Simulated E2E Report: Contextual ProGate Tall Phone Header

Date: 2026-07-09
Surface: Expo web in Codex in-app browser
Route: /progress
Viewport: 430 x 932
Result: Pass

## Branches Covered

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Contextual Progress paywall | 430 x 932 tall phone | Pass | `430x932-progress-paywall.png`, `geometry-summary.json` | Terms, Privacy, Restore, and Maybe later rendered as complete 48 px header controls; the dismiss control is an icon button with the accessible name Maybe later. Start free trial was complete above the tab bar; Explore-first visible copy stayed compact as `No card needed.` while the full copy stayed in the accessibility label. |
| Contextual paywall dismiss | Maybe later | Pass | `430x932-after-maybe-later.png`, `geometry-summary.json` | Tapping Maybe later returned to `/today`, removed the paywall, kept horizontal overflow at zero, and opened no dialog. |

## Bugs Found

None.

## Tests Added or Updated

- `apps/mobile/src/features/subscription/paywallMobileContracts.test.ts`: guards tall-phone dense text-pressure layout, compact header dismiss, and compact Explore-first copy.

## Commands Run

- `npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts`

## Remaining Risk

Native iOS/Android Dynamic Type, VoiceOver/TalkBack, StoreKit/Play Billing, and RevenueCat store-sheet behavior remain release QA.
