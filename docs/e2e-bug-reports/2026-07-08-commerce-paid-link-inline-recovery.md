# E2E Bug Report: Commerce paid-link taps lacked inline recovery

Severity: Medium
Surface: Mixed: Expo web verification, iOS/Android native risk
Environment: Expo web at 320 x 568, `EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=true`, `EXPO_PUBLIC_FINAL_BRAND_DOMAIN=https://layerwell.app`
Feature: Commerce where-to-buy and shoppable stack paid links
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with commerce enabled and a valid final brand domain.
2. Open `/recommendations/routine_completion:mineral_spf`, tap `Allow where-to-buy`, then tap `Allow where-to-buy links`.
3. Open `/commerce/stack/sensitive-skin-starter-set`.
4. Tap `Gentle gel cleanser, Cleanse - fragrance-free, paid link`.

## Expected Result

Paid-link stub or failure recovery stays in the route with clear, accessible copy, no blocking native/system dialog, no raw provider text, and no loss of recommendation or stack context.

## Actual Result

The stack tap had no in-context feedback on Expo web, making the row appear inert. Source inspection showed the paid-link stub and unavailable-link paths used `Alert.alert`, which would create a blocking native dialog on iOS/Android instead of polished route-owned recovery.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/commerce-link-recovery-alert-prefix/04-stack-detail-before-alert.png`
- Screenshot: `test-results/human-e2e/2026-07-08/commerce-link-recovery-alert-prefix/05-stack-native-alert-current.png`
- UI snapshot: browser evaluation confirmed the tapped stack route stayed on `/commerce/stack/sensitive-skin-starter-set`, had `scrollWidth=320`, and exposed no route-owned recovery copy before the fix.
- Source: `apps/mobile/src/features/commerce/WhereToBuy.tsx` and `apps/mobile/src/app/commerce/stack/[slug].tsx` called `Alert.alert` for paid-link recovery before the fix.

## Frequency

- Always for stack paid-link stub taps.
- Expected for where-to-buy unavailable/stub paths once approved retailer rows are available.

## Scope

- Affected route/screen: `/commerce/stack/[slug]`, recommendation detail `WhereToBuy`
- Affected account or fixture: Commerce-enabled local/dev state
- External service involved: None in the reproduced stack stub path
- Destructive action involved: None

## Suspected Cause

The commerce implementation kept temporary paid-link recovery in platform alerts while the rest of the app had moved failure handling into durable route-owned alert regions.

## Minimal Fix Recommendation

Replace native alerts with a shared commerce inline notice rendered by the owning route. Place the notice before the paid-link rows so a first-row tap is visible on small phones, and add source contracts that reject native alerts in paid-link recovery paths.

## Verification Flow After Fix

1. Open `/commerce/stack/sensitive-skin-starter-set` at 320 x 568 with commerce enabled.
2. Tap `Gentle gel cleanser, Cleanse - fragrance-free, paid link`.
3. Confirm the route remains on the stack detail, no dialog appears, the inline `Where to buy` message is visible before the rows, and horizontal overflow remains zero.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/commerce-link-recovery-alert-prefix/07-stack-inline-recovery-visible-patched.png`
- UI snapshot: `role="alert"` text is present, alert rect is y=242-408 inside a 569 px viewport, `tab.getJsDialog()` is `null`, and `scrollWidth=320`.
- Tests: `npm --workspace apps/mobile run test -- src/features/commerce/commerceRoutes.test.ts src/features/commerce/commerce.test.ts`

## Remaining Risk

- Untested branches: Native iOS/Android external URL OS-refusal dialog behavior.
- Missing fixtures: Approved real HTTPS retailer rows are not available yet, so the true external-link failure branch remains partially open.
- Follow-up needed: Re-run on iOS and Android once the approved affiliate/catalog rail is seeded.
