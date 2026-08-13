# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-13
- Codex task: OPT-007/008 conflict-quota atomicity and fail-closed recovery
- App surface: Expo web
- Build/start commands:
  - `EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT=no_match EXPO_PUBLIC_E2E_CATALOG_SEARCH_DELAY_MS=1500 npm --workspace apps/mobile run web -- --port 8255`
  - Same command plus `EXPO_PUBLIC_E2E_CONFLICT_QUOTA_STATE=unavailable` for the failure branch
- Browser/device/simulator/OS: Codex in-app browser on Windows, 390 x 844 viewport override (reported CSS viewport 390 x 845)
- Fixture/state: Local-only Shelf created through the real UI with Retinol 0.3% and Lactic Acid 5%; no live Supabase or RevenueCat
- Overall verdict: Pass for the Expo web-compatible quota flow

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Shelf conflict | First free quota claim | Pass | `free-conflict-first-claim.png` | Added both products through manual intake, opened Review conflict, and saw exact-pair guidance only after the quota claim resolved. |
| Shelf conflict | Previously claimed rule | Pass | `free-conflict-first-claim.png`, `browser-observations.json` | Browser Back returned to Shelf and the same exact pair reopened normally; a fresh DOM/geometry observation confirmed both resolution controls remained visible and 48 px+. |
| Shelf conflict | Quota storage unavailable | Pass | `quota-unavailable-fail-closed.png` | Dev-only storage fixture hid all private conflict detail and showed the Pro gate; zero horizontal overflow. |
| Shelf conflict | Failure-branch exit | Pass | `quota-unavailable-exit.png` | `Maybe later` returned to `/shelf` without revealing detail or trapping navigation. |

## Bugs Found

None in the exercised Expo web flow.

## Tests Added Or Updated

- `src/features/subscription/conflictQuota.test.ts`: strict codec states, 100-way atomic claim, no read repair, future/corrupt preservation, unavailable state, and dev-only unavailable fixture.
- `src/features/subscription/proGatedRoutes.test.ts`: claim-pending shield and fail-closed route contract.
- Focused quota/cycle route tests and the full mobile suite were rerun.

## Browser Observations

- Exact conflict: Retinoid × AHA, Lactic Acid 5% + Retinol 0.3%
- First/reopen route: `/conflict/00000000-0000-4000-8000-000000000001` with exact product IDs
- Resolution controls on reopen: 55.99 px and 48 px tall
- Unavailable fixture: conflict heading absent; paywall recovery visible
- Failure-branch controls: 48-61.94 px tall
- Horizontal overflow: 0 px
- Unexpected browser errors: none

## Remaining Risk

- Expo web cannot prove native encrypted-storage failure behavior, VoiceOver/TalkBack, or device restart persistence.
- The human pass observes the route shield and end states; the 100-way single-winner invariant is proven by the focused store test rather than visual timing.
- Live entitlement/store checkout and native device evidence remain external QA gates.
