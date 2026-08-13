# Immutable Telemetry Capacity Reclamation

Date: 2026-07-26

## Finding

The outbox already limited retained Shelf-scan events to 128 rows and could
reclaim the enqueueing owner's dead scans when a new scan needed capacity.
Notification-delivery events had no equivalent entity ceiling or reclamation
path. In addition, scan-only reclamation did not protect unrelated mutable
Shelf or preference writes after terminal immutable telemetry filled the
shared 512-row or 1,024-revision bounds.

This meant permanent best-effort telemetry failures could eventually prevent a
post-OS notification confirmation from committing or starve user-authored
mutable work even though reclaimable, same-owner terminal events existed.

## Change

Outbox admission now calculates the complete projected row and revision counts
before every write. Notification delivery has an explicit 128-row ceiling,
matching the existing Shelf-scan ceiling.

When an immutable entity ceiling is pressured, admission removes only the
enqueueing owner's oldest `dead` event of that same entity type. When a shared
row or revision ceiling is pressured, any domain may reclaim the enqueueing
owner's oldest `dead` immutable event across `notification_delivery` and
`shelf_scan`.

The centralized policy:

- never evicts live or leased work;
- never evicts another owner's data;
- never evicts mutable Shelf, notification-preference, recommendation-
  preference, or conflict-choice rows;
- selects victims deterministically by enqueue time and operation ID;
- accounts for mutable same-identity coalescing and revision replacement in the
  projected write;
- removes a victim's revision only after no surviving row references it,
  including version-1 shared legacy revision fences;
- migrates a version-1 shared fence into one strictly owner-scoped fence per
  evidenced row owner, while dropping an ownership-less orphan that cannot be
  assigned safely;
- continues deterministic reclamation until both projected global bounds fit;
- fails closed with the original input envelope byte-identical when eligible
  terminal events cannot make admission safe.

The notification sent-ledger integration proves that, after native delivery is
accepted, an exact-cap transaction can reclaim the oldest eligible event and
atomically commit both the delivered ledger state and the new authenticated
notification-delivery operation. Live, leased, foreign-owner, or mutable-only
saturation leaves both encrypted values unchanged and retains the reserved
ledger record for safe reconciliation.

## Verification

```text
npm.cmd --workspace apps/mobile exec vitest run src/lib/offline/outbox.pure.test.ts src/lib/offline/outbox.test.ts src/features/notifications/sentStore.test.ts src/features/notifications/deliver.test.ts
npm.cmd --workspace apps/mobile run typecheck
npm.cmd --workspace apps/mobile exec eslint -- --max-warnings=0 src/lib/offline/outbox.pure.ts src/lib/offline/outbox.pure.test.ts src/features/notifications/sentStore.test.ts
npm.cmd --workspace apps/mobile exec -- prettier --check src/lib/offline/outbox.pure.ts src/lib/offline/outbox.pure.test.ts src/features/notifications/sentStore.test.ts
npm.cmd --workspace apps/mobile test
git diff --check
```

Results:

- Focused pure/runtime/notification transaction matrix: 4 files / 212 tests
  passed.
- Mobile type-check: passed.
- Exact changed-file lint with zero warnings: passed.
- Prettier and patch whitespace checks: passed.
- Full mobile run: 361 of 363 files and 4,430 of 4,434 tests passed. The same
  four unrelated dirty-worktree failures remain in the notification
  behavioural snapshot and Shelf provenance assertions; the failure set is
  unchanged.
- Independent final adversarial review found one current-version reload hazard
  in the first legacy-fence implementation. The fix keeps version 5
  owner-string-only, expands shared version-1 fences only to evidenced owners,
  drops unknowable orphans, and adds mutation/restart and reclamation/restart
  coverage. Re-review found no remaining P0/P1 issue.

The focused matrix covers both exact immutable entity ceilings, current-owner
versus foreign-owner reclamation, deterministic same-time and cross-domain
victim ordering, live and leased preservation, mutable-admission recovery,
exact global row and revision boundaries, legacy shared revision fences,
byte-identical atomic failure, and the notification post-delivery two-key
transaction.

Human-simulated E2E is not applicable because this changes encrypted background
telemetry capacity handling and no visible user flow.

## Remaining Evidence

Hosted replay and physical-device process-kill/offline/reconnect evidence remain
required for the broader transactional-outbox launch gate.
