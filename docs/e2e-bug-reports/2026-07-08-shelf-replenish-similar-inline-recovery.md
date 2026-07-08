# E2E Bug Report: Shelf replenish similar options lacked route-owned recovery

Severity: Medium
Surface: Mixed: Expo web verification, iOS/Android native risk
Environment: Expo web at 320 x 568, `EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=true`, `EXPO_PUBLIC_FINAL_BRAND_DOMAIN=https://routinekind.app`
Feature: Shelf replenishment similar-options recovery
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with commerce enabled and a valid final brand domain.
2. Add a Shelf product with `3 months ago` opened date and `3 mo` PAO so it reaches `0 days left`.
3. Open the Shelf `Replace` prompt, tap `See similar options`, grant `Allow where-to-buy links`, and tap `See similar options` again.

## Expected Result

The consented similar-options branch stays inside `/shelf/replenish`, explains that reviewed/catalogue options are not live yet, exposes accessible feedback near the tapped row, opens no native or JavaScript dialog, and preserves zero horizontal overflow on a 320 px phone.

## Actual Result

The Expo web route stayed visually unchanged after the consented tap, making the row appear inert. Source inspection showed the same branch called `Alert.alert('Similar options', ...)`, which would create a blocking native system dialog on iOS and Android instead of polished route-owned recovery.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/shelf-replenish-similar-inline-recovery-current/01-replenish-before-similar.png`
- Screenshot: `test-results/human-e2e/2026-07-08/shelf-replenish-similar-inline-recovery-current/04-replenish-after-consent.png`
- Screenshot: `test-results/human-e2e/2026-07-08/shelf-replenish-similar-inline-recovery-current/05-native-alert-current.png`
- UI snapshot: pre-fix consented tap stayed on `/shelf/replenish?id=f3780929-4899-4df8-9788-63c4e5f647fd`, exposed no route-owned recovery copy, and had no active JavaScript dialog on Expo web.
- Source: `apps/mobile/src/app/shelf/replenish.tsx` called `Alert.alert` for the consented similar-options empty state before the fix.

## Frequency

- Always for the consented similar-options branch while the catalogue/partner rail is unavailable.

## Scope

- Affected route/screen: `/shelf/replenish`
- Affected account or fixture: Local Shelf product at a PAO boundary with commerce consent granted
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The replenishment route kept temporary unavailable-catalogue feedback in a platform alert while the commerce and community recovery patterns had moved to durable route-owned alert regions.

## Minimal Fix Recommendation

Replace the native alert with the existing `CommerceLinkNotice` inline component and add a Shelf route contract that rejects `Alert.alert` in the similar-options branch.

## Verification Flow After Fix

1. Open the same `/shelf/replenish?id=...` route at 320 x 568 with commerce consent granted.
2. Tap `See similar options`.
3. Confirm one visible `role="alert"` notice appears in the sheet, no dialog opens, and horizontal overflow remains zero.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/shelf-replenish-similar-inline-recovery-current/06-inline-recovery-patched.png`
- Logs: `test-results/human-e2e/2026-07-08/shelf-replenish-similar-inline-recovery-current/browser-warn-error-logs.json`
- UI snapshot: one `role="alert"` at x=27.99, y=427.09, w=264.41, h=117.95 inside the 320 x 568 viewport; `scrollWidth=320`; `tab.getJsDialog()` returned `null`.
- Tests: `npm --workspace apps/mobile run test -- src/features/shelf/shelfRoutes.test.ts`

## Remaining Risk

- Untested branches: Native iOS/Android visual rendering, Dynamic Type, and screen-reader announcement of the inline notice.
- Missing fixtures: Approved live similar products and affiliate/catalog partner rail are still launch-gated.
- Follow-up needed: Re-run on iOS and Android when the commerce catalogue rail is intentionally seeded.
