# Private-Registry Contract Closure Checkpoint

Date: 2026-07-14 (America/Toronto)
Branch: `optimization`
Implementation SHA: `82259bb5bab994e32e7fcfee6850415759cb983c`
Evidence class: `command`, `decision`, and blocked `e2e`/`native`

This sanitized checkpoint closes every declared codec and typed-read gap in the frozen 44-key local-private-data registry. It also hardens photo metadata, native review prompt, routine activation, and subscription lifecycle state against malformed bytes, unsupported versions, response-loss ambiguity, concurrent callers, and account-generation changes. It does not claim physical-device StoreReview, protected-storage, notification-delivery, or photo process-death verification.

## Implemented Contract

- The registry declares exact codec, read, mutation, owner, export, cleanup, reset, and recovery behavior for all 44 keys, with zero remaining declared gaps.
- Private-KV distinguishes unavailable storage from corrupt/decryption state. The exact five read-only keys reject set/update operations before encryption or storage side effects, while explicit removal remains available.
- Photo metadata uses bounded, strictly validated versioned envelopes and typed absent/available/unavailable/corrupt/unsupported/recovery-required results. Ordinary and rejected reads preserve bytes and avoid key creation, repair, cleanup, or note-encryption side effects.
- Current photo records enforce exact field, timestamp, URI, encryption, capture, note, and record-count invariants. The historical June v1 encrypted placeholder remains explicitly migratable without inventing plaintext or storage authority.
- Native review and routine-activation journals use bounded canonical codecs, one owner-generation lease, atomic reservation, and exact readback reconciliation. Only the same committed reservation may recover from a lost commit response.
- Subscription prompt state consumes the typed entitlement cache, reserves and reads back under the account-generation lease, replays durable prepared routes after restart, and fails closed on unavailable, corrupt, future, or account-boundary state.
- The mounted tabs layout navigates only from the typed subscription lifecycle route result.

## Commands And Results

| Command or action | Result |
| --- | --- |
| Focused private-registry Vitest matrix | Pass, 12 files / 299 tests |
| Final focused photo/subscription matrix | Pass, 5 files / 167 tests |
| Final native-review prompt suite | Pass, 24 tests |
| `npm run typecheck` | Pass, 2 workspaces |
| `npm run lint` | Pass, 2 workspaces, zero warnings |
| `npm test` | Pass, 249 files / 3,092 tests |
| `git diff --check` | Pass |
| `npm run e2e:human:manifest:check` | Fail: existing generated manifest predates a broad set of unrelated committed source/evidence changes |

Independent adversarial reviews of photo/private-KV, native review, and subscription lifecycle reported no remaining P0/P1 findings after the identified subscription route-replay race and review/photo side-effect/readback gaps were corrected and retested.

## Human-Simulated And Native Verification Boundary

The native StoreReview branch cannot be exercised truthfully on Expo web. This Windows host has no `xcrun`, `simctl`, or `adb`, and no supported physical native target was connected. The required final user-driven StoreReview timing, photo force-quit/process-death, protected-storage interruption, and native permission/delivery flows are therefore `blocked-external`, not passed.

The repository-wide human-E2E manifest freshness check also remains red because its generated manifest predates many unrelated committed source and evidence changes. Those already-dirty generated files were preserved and excluded from this checkpoint rather than mixed into the optimization commit.

Required follow-up on supported signed physical targets:

1. Exercise review eligibility, cancellation, exact lost-response replay, relaunch, and account-switch timing around the native prompt.
2. Exercise photo add/delete/clear across force-quit, process death, locked-device startup, missing/corrupt key material, and low-storage conditions; inspect ciphertext and protected-file attributes without exposing private content.
3. Exercise private-store unavailable/corrupt/future recovery surfaces through retry, Back, relaunch, and account changes while confirming byte preservation.
4. Capture sanitized screenshots/video, device logs, filesystem/backup inspection summaries, and the completed human-E2E acceptance checklist.

OPT-008 is locally `implemented` because the frozen inventory now has store-by-store typed contracts and tests. It is not `verified`; native fault and lifecycle evidence remains required. PERF-P0-005 stays `investigating` until the remaining compact-store atomic migrations and native failure matrix are complete.
