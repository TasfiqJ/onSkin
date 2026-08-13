# Entitlement Fast-Path And Paywall-Action Checkpoint

Date: 2026-07-15 (America/Toronto)
Branch: `optimization`
Implementation SHA: `91d1b9968eee67106db028644fc2c90ed8fd75cc`
Evidence class: `command`, `decision`, and blocked `e2e`

This sanitized checkpoint covers OPT-113's local entitlement fast path, RevenueCat and server reconciliation, owner/account boundaries, direct paywall routing, purchase attribution, restore and pending outcomes, and trial-reminder ordering. It does not claim a real StoreKit/Google Play transaction, signed-device startup measurement, notification delivery, or a completed human-simulated route pass.

## Implemented Contract

- Only owner-bound, trusted RevenueCat proof/marker pairs, verified RevenueCat-empty watermarks, authoritative server proof, or the exact app-granted reverse-trial shape can authorize a local result. Unknown, corrupt, unsupported, mismatched-owner, partially committed, or unmarked provider state is recovery state rather than Free or Pro.
- RevenueCat proof and revocation ordering is monotonic across volatile state, the primary proof, the rollback-compatible sidecar, delayed writes, equal timestamps, marker-only crash windows, rollback rewrites, and account changes. Equal active/revocation conflicts reduce access; expired markers and app grants cannot resurrect or mask provider authority.
- Store proof is fresh for five minutes and bounded by an exact 72-hour offline ceiling. Expiry and grace cutoffs are exact. Verification timestamps more than five minutes in the future fail closed. A backward wall-clock jump is carried as an explicit scheduler event, closes proof idempotently, preserves long-timer chunking, and cannot be suppressed by another observer throwing.
- `useEntitlement` returns the selected local winner before detached, cooldown-controlled server reconciliation. Passive reads never invalidate RevenueCat CustomerInfo and never fetch offerings. Explicit Retry is owner-generation single-flight and remains pending until local refetch, forced RevenueCat cache invalidation/CustomerInfo classification/publication, and forced server reconciliation settle.
- Auth startup, RevenueCat listener publication, query cache publication, explicit Retry, server reconciliation, paid actions, lifecycle prompts, and trial reminders are owner-generation fenced. Reminder effects serialize so an older schedule cannot finish after a newer cancellation.
- Active Pro gates and active direct-paywall routes do not load offerings. Missing or uncertain entitlement proof presents recovery without purchase actions. Every purchase/reverse-trial/win-back/downgrade action rechecks the exact evidence identity immediately before the native or server hazard.
- Native selected product, native result product, and classified active entitlement product must agree before an action can claim success. Ambiguous or pending native outcomes retain a verification hold. Success navigation requires a short-lived, one-use, owner-bound receipt for the exact published winner; direct navigation without that receipt cannot render purchase success.
- Trial eligibility and win-back terms come from the provider result. Restore, network, pending, inactive, grace, refund/revocation, app-granted, and account-switch states have explicit non-success outcomes and neutral, non-fabricated pricing copy.

## Commands And Results

| Command or review | Result |
| --- | --- |
| Store trust/rollback Vitest file | Pass, 1 file / 130 tests |
| Final trust-marker/rollback audit matrix | Pass, 286 / 286 relevant tests; no P0/P1 finding |
| Final explicit-Retry integration re-review | Pass, 4 files / 51 tests; no P0/P1/P2 finding |
| Settings/paywall/coordinator/RevenueCat focused rerun | Pass, 4 files / 62 tests |
| `npm test` | Pass, 294 files / 3,704 tests |
| `npm run typecheck` | Pass, 2 workspaces |
| `npm run lint` | Pass, 2 workspaces, zero warnings |
| Scoped staged `git diff --check` | Pass |
| Staged-scope audit | Pass, 78 implementation paths; no unrelated dirty-worktree path staged |

Independent reviews found and closed active-vs-revocation rollback barriers, marker-only and equal-time resurrection, owner mismatch, product-attribution mismatch, trial-reminder completion inversion, future-clock loops, backward-clock trust extension, detached Retry pending state, and repeated passive RevenueCat invalidation before the implementation commit. The final trust review reported no remaining P0/P1 findings; the final integration review reported no remaining P0/P1/P2 findings.

## Verification Boundary And Follow-Up

No native simulator, emulator, physical device, store sandbox account, or available in-app browser backend was used for this final code state. Automated and static contract evidence therefore leaves OPT-113 at `implemented`, not `verified`.

Required follow-up on approved targets:

1. Measure signed release startup and cached-Pro unlock on supported iOS hardware, including offline, foreground, exact five-minute, exact 72-hour, expiry, grace, and manual-clock-change cases.
2. Drive onboarding, ProGate, upsell, downgrade, reoffer, win-back, success, and subscription settings as a user through loading, verified Free, active Pro, uncertain, retry, close/back, relaunch, and account A-to-B states.
3. Exercise real StoreKit and Google Play purchase, cancellation, pending approval, restore, refund/revocation, billing retry/grace, product mismatch, and management URL behavior with approved sandbox accounts.
4. Verify trial-reminder schedule/cancel and real notification delivery after purchase, restore, expiry, owner change, and relaunch.
5. Capture sanitized screenshots/video, native logs, operation timings, and the exact build/device/network metadata required by the optimization evidence rules.

These are external verification gates, not claimed passes and not reasons to weaken the fail-closed local contract.
