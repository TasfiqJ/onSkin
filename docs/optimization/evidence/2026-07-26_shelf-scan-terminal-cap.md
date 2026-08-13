# Shelf-Scan Terminal Capacity Reclamation

Date: 2026-07-26

## Finding

Shelf-scan telemetry is an immutable, best-effort outbox event. The client
bounded those events at 128 retained rows, but terminal `dead` rows still
counted toward that limit and had no automatic reclamation path. After 128
permanent failures, every later valid scan was silently dropped by the visible
best-effort intake path.

The same starvation remained possible below the scan-specific limit when the
complete outbox reached its 512-row or 1,024-revision bounds.

## Change

Shelf-scan admission now reclaims capacity under pressure before appending the
new immutable event. Reclamation:

- considers only `dead` Shelf scans owned by the enqueueing account;
- never evicts another owner's data, live or leased work, or a non-scan row;
- selects the oldest eligible row deterministically by the existing immutable
  row ordering;
- continues until the new event fits the 128-scan, 512-row, and 1,024-revision
  bounds;
- removes a victim's revision only when no surviving row still references it,
  including migrated legacy revisions;
- fails without changing the input envelope when eligible terminal rows cannot
  make admission safe.

This is bounded pressure reclamation, not time-based retention. The server's
late-arrival handling remains independent.

The feature-level scan logger continues to be best effort. A terminally
saturated persisted envelope now admits and schedules the fresh valid scan,
while live saturation preserves the exact stored bytes and schedules nothing.

## Verification

```text
npm.cmd --workspace apps/mobile exec vitest run src/lib/offline/outbox.pure.test.ts src/features/shelf/scanLog.test.ts src/lib/offline/outbox.test.ts
npm.cmd --workspace apps/mobile run typecheck
npm.cmd --workspace apps/mobile exec eslint -- --max-warnings=0 src/lib/offline/outbox.pure.ts src/lib/offline/outbox.pure.test.ts src/features/shelf/scanLog.test.ts
npm.cmd exec prettier -- --check apps/mobile/src/lib/offline/outbox.pure.ts apps/mobile/src/lib/offline/outbox.pure.test.ts apps/mobile/src/features/shelf/scanLog.test.ts
npm.cmd --workspace apps/mobile test
git diff --check
```

Results:

- Focused pure/runtime/integration matrix: 3 files / 127 tests passed.
- Mobile type-check: passed.
- Exact changed-file lint with zero warnings: passed.
- Prettier and patch whitespace checks: passed.
- Full mobile run: 359 of 361 files and 4,351 of 4,355 tests passed. The same
  four unrelated dirty-worktree failures remain in Shelf provenance and the
  notification behavioural snapshot; the failure set is unchanged.
- Independent final adversarial review: no remaining P0/P1 finding.

The focused matrix covers terminal and live saturation, owner isolation,
deterministic equal-time selection, immutable identity/replay behavior, exact
global row and revision boundaries, shared legacy revisions, atomic
fail-closed behavior, persisted storage bytes, and flush scheduling.

Human-simulated E2E is not applicable because this changes encrypted
background telemetry capacity handling without changing a visible user flow.

## Remaining Evidence

Hosted replay and physical-device process-kill/offline/reconnect evidence
remain required for the broader transactional-outbox launch gate.
