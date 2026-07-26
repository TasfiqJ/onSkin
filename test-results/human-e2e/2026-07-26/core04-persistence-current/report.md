# CORE-04 persistence development E2E report

## Binding

- Source revision: `b4560797b52e6910c17b03d8f66c6ef53c20900d`
- Remote branch verified before this run: `main`
- Surface: Expo development web at `http://localhost:8161`
- Browser viewports: requested `390 x 844` and `360 x 640`; reported CSS
  viewports were `390 x 845` and `360 x 641`
- Runtime fixtures:
  - `EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH=anonymous_owner`
  - `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`
  - `EXPO_PUBLIC_E2E_ROUTINE_ORDER_SAVE_FAILURE=once`
- Starting data: the same browser origin retained the anonymous-owner age,
  consent, profile, shelf, and routine data created during the earlier
  same-day development onboarding run. This was not a clean-install test.

## Human-simulated flows

1. Opened the real `/routine/plan` route at the compact phone viewport and
   confirmed the expected current morning order was visible.
2. Opened the Morning order editor, selected Hydrating Toner, moved it later,
   and pressed Save.
3. Confirmed the injected first write failure kept the editor open and showed:
   `We could not confirm the save. Reload to check your saved routine, then try
   again.` The UI did not claim that prior bytes were certainly unchanged.
4. Pressed Save again. The route returned to Plan and showed Gentle Cleanser,
   Barrier Moisturizer, then Hydrating Toner.
5. Reloaded Plan and confirmed the new AM order remained.
6. Opened Cycle settings, selected Custom, increased the cycle from seven to
   eight nights, and saved.
7. Confirmed the route returned to Today and projected `Cycling night 8`.
8. Reopened Cycle settings, reloaded it, and confirmed `Custom. 8 nights`,
   Night 8 Recovery, and the `3 active nights · 5 recovery · 8 total` preview.
9. At the 360-wide viewport, temporarily reduced the Custom cycle to seven
   nights, canceled, reopened settings, and confirmed the saved eight-night
   definition remained.
10. At the 360-wide viewport, temporarily moved the AM toner earlier, canceled,
    and confirmed the saved AM order remained.
11. Edited the PM order independently, moving Barrier Moisturizer from step 5
    to step 4. The injected development failure was presented safely; retry
    succeeded.
12. Reloaded Plan and the PM editor. The AM order remained unchanged, while PM
    retained Barrier Moisturizer at step 4 and Calm Face Oil at step 5.

## Geometry and logs

- At the reported `360 x 641` viewport, both the Plan and Custom-cycle routes
  reported document width `360` and no horizontal overflow.
- Screens were vertically scrollable where expected; the captured compact
  Custom-cycle image intentionally shows only the visible viewport.
- No browser console errors were observed.
- Expected development warnings were present for placeholder Supabase
  configuration, limited web notification support, and deprecated web
  `pointerEvents` usage. These warnings remain outside this bounded
  persistence-flow result.

## Result and boundary

The exercised Expo-web flows passed for the exact source revision above. This
is development evidence for routing, interaction, failure copy, retry,
same-origin browser persistence, AM/PM independence, Custom-cycle round-trip,
cancel behavior, and downstream projection. It is not evidence of native
SecureStore/Keychain or AsyncStorage behavior, physical-device relaunch,
process death, storage pressure, backup/restore, offline failure recovery,
Hermes timezone behavior, accessibility, archive identity, privacy labels,
export compliance, App Review acceptance, legal approval, or revenue.
