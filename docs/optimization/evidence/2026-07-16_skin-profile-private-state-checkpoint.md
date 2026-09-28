# Skin-Profile Private-State Checkpoint

Date: 2026-07-16

Branch: `optimization`

Checkpoint parent: `0bcd182ae0c3fb2a37a4b81142d5cdb3dd9cdf8c`

Items: `PERF-P0-005`, `OPT-007`, `OPT-008`

## Invariant

The encrypted local skin profile is the V1 authority. Only a genuinely absent
record may behave as no profile. Private-storage unavailability, malformed or
tampered ciphertext, invalid application bytes, and unsupported future data
must remain distinct, preserve the original bytes, block server fallback, and
never become an ordinary nullable result. A same-key mutation must transform
the bytes observed inside the private-KV lock, preserve unrelated profile
fields, and avoid a durable write when the requested state is already present.

## Baseline Finding

`readStoredSkinProfile` called the throwing `getPrivateItem` adapter and mapped
every thrown private-store condition to a reasonless `unavailable` result.
`getStoredSkinProfile` then returned `null` for every non-available state,
including corrupt, future, and unavailable records. That compatibility surface
contradicted the accepted fail-closed pregnancy-profile decision and could let
a future caller treat retained private bytes as absence.

Full-profile and pregnancy-status transforms also always re-encoded the
application record. For a semantically identical current record with a
different valid JSON property order, the pre-change transform produced one
different payload and therefore one unnecessary encryption/storage write.
Coverage had only a two-operation concurrency case and no persisted-write
counter for semantic no-ops.

## Implementation

- `readStoredSkinProfile` now consumes `readPrivateItem` and retains the exact
  private-KV unavailable or corruption reason in the domain result.
- Genuine absence remains `missing`; application-invalid bytes remain
  `invalid_record`; future private or application envelopes remain
  `unsupported_version`.
- `getStoredSkinProfile` returns `null` only for genuine absence and throws the
  established typed skin-profile code for every unreadable state.
- A full-profile save compares normalized semantic content inside
  `updatePrivateItem` and returns the exact current payload for a no-op.
- A pregnancy-status save returns the exact current payload when the status is
  already selected; otherwise it patches only that field on the record decoded
  inside the atomic transform.
- The storage schema remains version 1. No read-time migration, destructive
  repair, key change, or data migration was introduced.

## Deterministic Evidence

Focused matrix:

```text
npm.cmd --workspace @layerwell/mobile test -- --run \
  src/features/onboarding/skinProfileStore.test.ts \
  src/features/scheduler/profile.test.ts \
  src/features/onboarding/onboardingStatusQuery.test.ts \
  src/lib/storage/privateKV.test.ts

4 files / 107 tests PASS
```

The focused tests prove:

- ciphertext corruption and future private envelopes retain exact bytes and do
  not become absence;
- invalid and future application records block reads and mutations without
  replacement;
- a reordered but semantically identical current payload incurs zero persisted
  writes and retains its exact bytes;
- 100 simultaneous alternating pregnancy-status transforms each observe their
  own committed result, preserve goals/completion time, and leave a valid final
  record;
- the production private-KV primitive still supplies same-key serialization,
  account-boundary fencing, ciphertext preservation, and exact no-op handling.

Repository verification:

```text
npm.cmd run typecheck
2 workspaces PASS

npm.cmd run lint
2 workspaces PASS, zero warnings

npm.cmd test
316 files / 3,899 tests PASS

git diff --check
PASS
```

## Result And Tradeoffs

For the deterministic reordered-current fixture, semantic no-op persistence
changed from one payload rewrite to zero. The 100-writer stress case performs
100 intentional writes because every adjacent desired status differs; the
final profile remains complete and valid. The change adds one semantic
comparison during explicit profile replacement, which is bounded by the small
profile record and avoids encryption plus AsyncStorage work on an identical
save.

No UI layout or interaction contract changed, so this checkpoint does not claim
new human-simulated E2E. The existing supported-phone pregnancy-safety flow in
`test-results/human-e2e/2026-07-10/pregnancy-safety-status-current/` already
covers persistent and one-shot profile/consent recovery through the real UI;
native protected-storage interruption remains external release evidence.

## Rollback Trigger

Rollback or repair this slice if a supported installed profile can no longer be
decoded, an identical save changes durable bytes, any non-absent failure reaches
server fallback or onboarding-as-missing behavior, or concurrent status writes
drop unrelated profile fields. A rollback must retain the strict rule that
unreadable private data never maps to `null` or ordinary absence.
