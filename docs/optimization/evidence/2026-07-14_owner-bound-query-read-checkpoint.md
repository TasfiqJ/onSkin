# Owner-Bound Query-Read Checkpoint

Date: 2026-07-14 (America/Toronto)
Branch: `optimization`
Implementation SHA: `0c90fbb4eba70aa6a4fc78d23df9daa6ea4af1f5`
Evidence class: `command` and `decision`

This checkpoint migrates the next account-scoped read group onto one owner/account-generation lease from query entry through publication. Pure reads can no longer hold an account boundary forever when a private-storage or server promise ignores cancellation, and late account-A results cannot become account-B cache or derived state. Writes that may have committed remain drain-held and fail closed.

## Implemented Contract

- Recommendation input loading remains offline-capable and owner-keyed. Its strict private snapshot is detached through the caller lease, so a hung or delayed account-A read rejects at the boundary and cannot populate the fresh account-B query.
- Routine-order loading uses the same owner-query operation and detachable read contract. Same-owner refresh remains valid.
- Cycle-anchor direct and hook APIs now have lease-aware implementations plus compatibility wrappers. Cycle-config current/legacy reads, missing/legacy anchor fallback, and the `useCycle` query reuse one lease.
- The cycle-config reader asserts the lease before classifying an error. Account cancellation therefore cannot be translated into `CYCLE_CONFIG_UNAVAILABLE`, including missing state and a legacy config without an embedded anchor.
- Ramp snapshot reads detach, but lazy seeding and step-up writes remain inside the account drain. Cache invalidation may detach only after the write settles and targets the captured owner-A prefix, leaving owner-B cache state untouched.
- Trend consent reads use an owner lease for the authoritative latest-row query and encrypted local fallback. The Supabase request receives the abort signal and is also detached, covering transports that ignore abort.
- Monk-band reads use the same dual abort-and-detach contract. Ordinary offline failure retains the existing `null` fallback; an owner change rejects and cannot be cached as an absent band.
- Trend derivation requires successful true consent, a successful photo snapshot, and a successful Monk query. Pending fairness data and retained data from a failed refresh cannot publish a provisional classification.
- Ambiguous consent-ledger grants/withdrawals were intentionally not detached. They remain mutation-drained; an indefinitely ambiguous write may hold the fail-closed account gate rather than permit a new owner while the prior write outcome is unknown.

## Commands And Results

| Command or action | Result |
| --- | --- |
| Ten-file recommendation/routine/cycle/Trend/query/account-generation Vitest matrix | Pass, 10 files / 120 tests |
| `npm test` | Pass, 251 files / 3,201 tests |
| `npm --workspace @layerwell/mobile run typecheck` | Pass |
| `npm run typecheck` | Pass, 2 workspaces |
| `npm --workspace @layerwell/mobile run lint` | Pass, zero warnings |
| `npm run lint` | Pass, 2 workspaces, zero warnings |
| Scoped and staged `git diff --check` | Pass |

The first independent adversarial review found a P1 nested cycle-anchor operation whose cancellation could be normalized by the cycle-config reader. It also found order-dependent cycle-anchor test setup and missing direct Ramp step-up/invalidation proof. A second review found that Trend could derive with pending Monk data and that one hung-read test overclaimed cache coverage. The lease threading, classification guard, shared test setup, mutation/invalidation tests, Trend readiness gate, and test wording were corrected before the final matrix and full-suite reruns. Two final independent re-reviews found no remaining P0/P1 in the stabilized production diff.

## Verification Boundary And Follow-Up

The tests use delayed and never-resolving private and server promises. They prove boundary-drain liveness, rejection dominance, late-result suppression, owner-key separation, same-owner refresh, strict failure propagation, mutation draining, exact cache-prefix invalidation, and readiness-gated Trend derivation in the deterministic test runtime.

No physical-device account switch, protected-storage fault, or native transport trace is claimed. The Trend component still needs an explicit query-error/retry presentation before that surface is called recovery-complete; no new human-simulated UI pass is claimed by this data-layer checkpoint. Shelf still needs executable delayed account-A to account-B coverage. The remaining account-scoped inventory includes app-index/onboarding effects, photo query composition, subscription, notification, grounded-turn, and other store/query call sites. The transactional owner-bound outbox remains a separate open P0 workstream.
