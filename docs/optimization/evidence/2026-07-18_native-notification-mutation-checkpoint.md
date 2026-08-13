# Native Notification Mutation Checkpoint

Date: 2026-07-18 (America/Toronto)

Parent SHA: `fe2c478d14be7e7528958591deba58c56015358a`

Scope: PERF-P0-006 and OPT-009 native notification mutation/account-cleanup boundary.

## Outcome

Every production Expo notification write remains behind
`NotificationNativeMutationCoordinator`. A schedule owns its exact identifier
before native code is invoked, and ordinary native writes remain globally
fenced until the prior outcome is terminal. This checkpoint closes the final
locally reproducible commit-ambiguity hole: a synchronous adapter or bridge
throw is now reconciled as a possible native commit instead of being treated as
proof that no notification was scheduled.

## Commit-Ambiguous Synchronous Throw

`scheduleNotificationAsync` normally returns a promise, but the coordinator's
backend boundary also permits a synchronous throw. Native work can side-effect
before a JavaScript wrapper throws, so releasing the mutation record at that
point could allow a later owner to proceed while an untracked notification
remained scheduled.

The synchronous-throw path now:

1. retains the active mutation record and ordinary-work fence;
2. cancels and dismisses the predeclared exact identifier;
3. returns the original error only after both compensations succeed;
4. records an unsafe compensation and returns a typed compensation failure if
   either exact cleanup fails; and
5. permits later work only after a successful full global cleanup clears that
   terminal quarantine.

This matches the existing asynchronous rejection, stale-owner success, and
identifier-mismatch reconciliation model.

## Frozen Production Inventory

`nativeMutationInventory.test.ts` recursively inventories non-test mobile
sources and asserts:

- all five Expo notification write symbols appear only in
  `features/notifications/nativeMutation.ts`;
- ordinary schedule/cancel wrappers are called only by the coordinator and the
  account-generation-fenced delivery module;
- global native cleanup is called only by the coordinator and the exhaustive
  account-isolation cleanup boundary; and
- the delivery and cleanup owners retain their account-generation and
  all-settled contracts.

This makes a future direct native scheduling, cancellation, dismissal, or
global cleanup bypass fail the normal test suite.

## Verification

- Focused notification/account-cleanup matrix: 4 files / 54 tests PASS.
- Full root test suite: 333 files / 3,990 tests PASS.
- Root typecheck: PASS.
- Root lint with zero warnings: PASS.

## Remaining Evidence

This is local implementation proof, not physical-device verification. Retain:

- supported-iOS account-A schedule versus account-B cleanup and reschedule;
- actual permission, presentation, tap, dismissal, and fixed-ID replacement;
- background, force-quit, reboot, update, DST, time-zone, and clock-change
  behavior;
- deliberately delayed or interrupted native bridge calls; and
- native diagnostics showing no stale owner notification after cleanup.

PERF-P0-006 and OPT-009 remain `investigating` because their broader
repository-wide owner inventory and physical account-switch/provider/storage
proof are not complete. The native notification mutation design itself is now
locally implemented and guarded against production-source drift.
