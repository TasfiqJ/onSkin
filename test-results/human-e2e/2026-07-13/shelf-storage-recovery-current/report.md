# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-13
- Codex task: make unreadable Shelf private state fail closed and recover without resetting saved products
- App surface: Expo web development build
- Build/start commands:
  - `$env:EXPO_PUBLIC_E2E_ENTITLEMENT='pro'; $env:EXPO_PUBLIC_E2E_SHELF_STORAGE_FAILURE='always'; npm --workspace apps/mobile run web -- --port 8347`
  - `$env:EXPO_PUBLIC_E2E_ENTITLEMENT='pro'; $env:EXPO_PUBLIC_E2E_SHELF_STORAGE_FAILURE='once'; npm --workspace apps/mobile run web -- --port 8347`
- Browser/device/OS: Codex in-app browser on Windows
- Requested phone viewports: 390 x 844 and 375 x 667; browser CSS sizing rounded the compact run to 376 x 668
- Feature tested: typed Shelf storage reads, route-wide fail-closed recovery, stable navigation, and real-query retry
- Overall verdict: Pass after fixing the navigator-layout bug found during this run

## Fixture

- Existing local web storage was seeded with exactly `Optimization Glycolic Toner` and `Optimization Retinol Serum` plus their conflict.
- `always` and `once` are development-only read interceptors. They do not delete, clear, repair, or rewrite Shelf bytes.
- No destructive user action was exercised.

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Baseline | Populated Shelf | Pass | `01-seeded-shelf-390x844.png` | Exactly two named products and their PM conflict were visible |
| Persistent failure | Shelf tab | Pass | `02-persistent-failure-shelf-390x844.png`, `route-results.json` | One accessible recovery alert; saved names and false-empty guidance hidden |
| Persistent failure | Twelve direct-entry Shelf consumers | Pass | `route-results.json` | Shelf detail/intake/archive/replenish, Today, Plan, Ask, recommendations, conflict, and share preserved their URLs and failed closed |
| Persistent retry | Retry while failure remains | Pass | `route-results.json` | Non-destructive retry feedback remained available; the retry control has a 56 px CSS minimum height |
| Compact layout | Shelf recovery at requested 375 x 667 | Pass | `07-persistent-failure-shelf-375x667.png`, `route-results.json` | Zero horizontal overflow; browser CSS viewport rounded to 376 x 668 |
| One-shot retry | Failure then user taps Try again | Pass | `08-once-before-retry-desktop.png`, `09-once-after-retry-desktop.png`, `route-results.json` | The exact two seeded products and conflict returned, with no reset or duplicate |
| Navigator regression | Direct `/routine/plan` entry | Pass after fix | `06-routine-gate-render-loop-before.png`, `10-routine-gate-after-fix-desktop.png` | Stable navigator now keeps the route and renders one recovery alert without an update-depth overlay |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| `shelf-data-gate-navigator-loop` | High | Open a Shelf-gated nested route while Shelf reads always fail | Keep the navigator mounted and gate only screen content | The conditional gate replaced the nested `Stack`; `/routine/plan` entered a maximum-update-depth loop and static Shelf routes could resolve as `/shelf/undefined` | `docs/e2e-bug-reports/2026-07-13-shelf-data-gate-navigator-loop.md` |

## Tests Added Or Updated

- Shelf store tests cover typed absent/available/unavailable/corrupt/future reads, exact byte preservation, atomic concurrent mutations, no-ops, deterministic replenishment identity, commit/retry convergence, and consumed descendants.
- Mutation tests cover owner-scoped serialization, in-flight deduplication, mirror ordering, and cache fail-closed behavior after mutation failure.
- Source contracts pin `screenLayout`, deliberate retry behavior, every gated consumer, and fresh owner-bound notification reads.
- Routine-order tests prevent unreadable ordering state from becoming an empty override map.

## Browser And Terminal Observations

- No post-fix maximum-update-depth overlay, JavaScript dialog, raw fixture error, saved product name, false-empty message, all-clear claim, or set-for-today claim appeared while Shelf state was unavailable.
- Persistent-failure route checks had zero horizontal overflow.
- Expected development warnings were limited to placeholder Supabase configuration, Expo web notification-listener support, and multiple local GoTrue clients opened by the test tabs.

## Remaining Risk

- Expo web proves UI gating, exact route retention, geometry, and retry state transition; it does not prove native Keychain/Keystore/SecureStore interruption behavior.
- A supported iOS build still needs real secure-store fault injection, app background/relaunch, notification-delivery, VoiceOver focus/announcement, and byte-level non-mutation proof.
- OPT-007 remains broader than this Shelf slice: stable add-operation identity, a transactional outbox, and remaining registry-declared store gaps are not claimed complete.
