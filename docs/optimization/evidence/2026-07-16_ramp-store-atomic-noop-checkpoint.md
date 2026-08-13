# Ramp-Store Atomic No-Op Checkpoint

Date: 2026-07-16

Branch: `optimization`

Checkpoint parent: `baaca90678ba1569094cbf36440cc5b8d40d9446`

Items: `PERF-P0-005`, `OPT-007`, `OPT-008`

## Invariant

The local active-ramp record must decode a strict, bounded current envelope or
the exact installed pre-envelope row format, compose all changes inside the
same private-KV transform, and preserve exact bytes on failure or semantic
no-op. Missing alone means empty. A stale step-up must never clear an irritation
pause, including through the older call shape that omits a desired frequency.

## Baseline Finding

Ramp state already had a versioned current envelope, typed read failures,
same-key atomic mutation, strict current rows, and desired-frequency stale-write
protection. Its installed legacy decoder still invented missing dates and
ignored extra row fields. The store had no encoded-record, collection, or
product-ID bounds. Invalid seed data entered private storage before rejection,
`ensureRamp` rewrote an already-present legacy row, unchanged tolerance answers
could migrate legacy bytes, and the concurrency test stopped at 30 writers.
The no-desired-frequency step-up path could also raise and clear a paused ramp.

## Implementation

- Added pure pre-I/O validation for product IDs, initial ramp state, desired
  frequency, and tolerance answers.
- Added non-evicting defensive ceilings of 524,288 encoded characters, 1,024
  ramp rows, and 256 characters per product ID.
- Both current and pre-envelope rows now require the exact complete five-field
  `StoredRamp` shape; reads no longer invent a date for malformed legacy data.
- Decoded logs use a null-prototype object so arbitrary stored keys cannot alter
  the result object's prototype.
- `ensureRamp` returns exact current/legacy bytes when the product already has a
  ramp, regardless of a newly generated initial suggestion.
- Unchanged tolerance answers and completed desired step-up retries return the
  exact payload. A full log refuses a seed without evicting an existing ramp.
- Every paused ramp now rejects every step-up API shape with
  `RAMP_STATE_STALE`.
- The schema version and encrypted private-KV format are unchanged. Legacy
  migration occurs only when a genuine semantic mutation succeeds.

## Deterministic Evidence

Focused matrix:

```text
npm.cmd --workspace @layerwell/mobile test -- --run \
  src/features/routine/rampStore.test.ts \
  src/features/routine/useRamp.test.ts \
  src/lib/storage/privateKV.test.ts

3 files / 96 tests PASS
```

The focused tests prove:

- all 100 simultaneous distinct ramp seeds survive with 100 intentional writes;
- existing current and legacy ramps perform zero writes through `ensureRamp`;
- unchanged current and legacy tolerance answers perform zero writes;
- desired step-up retry after commit-response loss performs no second write;
- malformed, noncanonical legacy, future, oversized, and over-limit bytes remain
  exact and are never interpreted as empty;
- full valid logs reject additions without eviction;
- invalid inputs stop before private storage I/O;
- both step-up API shapes preserve irritation pauses; and
- owner-bound Ramp queries plus production private-KV serialization and account
  fencing remain green.

Repository verification:

```text
npm.cmd run typecheck
2 workspaces PASS

npm.cmd run lint
2 workspaces PASS, zero warnings

npm.cmd test
316 files / 3,921 tests PASS

git diff --check
PASS
```

## Result And Tradeoffs

The concurrency proof increased from 30 to 100 simultaneous seed writers.
Identical ensure/tolerance/desired-step-up paths now have deterministic
zero-write evidence, including legacy bytes. Legacy rows missing dates or
carrying unknown fields now classify as corrupt rather than being normalized
with current-day data; the original pre-envelope writer always emitted the
complete five-field row, so this preserves the real prior schema while removing
silent fabrication.

No component, copy, navigation, or current UI interaction changed: the live UI
already calls the desired-frequency step-up path. This checkpoint therefore
does not claim new human-simulated E2E. The existing Ramp read-failure/relaunch
E2E remains the interaction evidence for restoring the exact 2-of-3 cadence.

## Rollback Trigger

Rollback or repair if the original five-field legacy writer's bytes are
rejected, a semantic no-op changes bytes, any of 100 distinct seeds disappears,
a full log evicts a ramp, a paused ramp can be raised, malformed/future data is
rewritten, or unavailable state reaches a consumer as empty. Any repair must
retain atomic same-key mutation and the irritation-pause safety fence.
