# Notification Schedule Lifecycle

Date: 2026-07-26

## Finding

The root fixed-notification reconciler started native schedule work, retry
timers, and trial-reminder reconciliation without observing React Native
`AppState`. A retry could fire in the background, and an async native result
could cross a background or unmount boundary and continue into entitlement
trial work or publish a successful generation marker.

## Change

`NotificationPreferenceScheduleReconciler` now owns an active-only lifecycle
coordinator:

- initial background/inactive mount defers work;
- leaving the foreground invalidates the current async epoch and synchronously
  clears retry timers;
- exactly one pending pass is retained for the next foreground;
- duplicate active signals and a foreground signal during an in-flight stale
  pass coalesce;
- currentness is checked after native reconciliation, lazy entitlement import,
  and trial-reminder reconciliation;
- the lifecycle abort signal is composed with the account lease inside the real
  delivery path, so an in-flight schedule is compensated by exact identifier
  and no later stale schedule starts;
- an already-entered native cancellation cannot be undone, but the guarded
  sequence stops before the next identifier and retains one foreground
  convergence pass;
- stale work cannot update blocked/audited generation markers;
- unmount disposes the coordinator before removing the AppState listener and
  clears all pending work.

The Expo native API itself is not cancellable. The mutation coordinator
therefore compensates a schedule whose bridge call resolves after invalidation,
while guarded cancellation sequences stop before any later identifier.

## Verification

```text
npm.cmd --workspace apps/mobile exec vitest run src/features/notifications/NotificationPreferenceScheduleReconciler.test.ts src/features/notifications/deliver.test.ts src/features/subscription/entitlementReminder.test.ts src/features/subscription/paywallMobileContracts.test.ts
npm.cmd --workspace apps/mobile run typecheck
npm.cmd --workspace apps/mobile exec -- eslint src/features/notifications/NotificationPreferenceScheduleReconciler.tsx src/features/notifications/NotificationPreferenceScheduleReconciler.test.ts src/features/notifications/deliver.ts src/features/notifications/deliver.test.ts src/features/subscription/paywallMobileContracts.test.ts --max-warnings=0
npm.cmd exec -- prettier --check apps/mobile/src/features/notifications/NotificationPreferenceScheduleReconciler.tsx apps/mobile/src/features/notifications/NotificationPreferenceScheduleReconciler.test.ts apps/mobile/src/features/notifications/deliver.ts apps/mobile/src/features/notifications/deliver.test.ts apps/mobile/src/features/subscription/paywallMobileContracts.test.ts
npm.cmd --workspace apps/mobile test -- --run
git diff --check
```

Results:

- Focused lifecycle/delivery/entitlement matrix: 3 files / 94 tests passed.
- Final combined consent, notification, entitlement, and source-contract
  matrix: 8 files / 164 tests passed.
- Mobile type-check, exact changed-file lint, Prettier, and patch whitespace
  checks passed.
- Full mobile run: 364 of 366 files and 4,475 of 4,479 tests passed. The same
  four unrelated dirty-worktree failures remain in Shelf expiry provenance and
  the notification behavioural snapshot.

Deferred-promise tests cover one-read startup state, background mount
suppression, retry cancellation, one fresh foreground pass, a native result
crossing background, duplicate active signals, unmount cleanup, and a
same-generation remount proving that no stale success marker was published.
Real delivery tests additionally prove an already-invalid lifecycle performs
zero permission/native work, invalidation during permission read performs no
native mutation, a cancellation sequence stops after its current identifier,
and an in-flight schedule is exactly compensated without publishing a healthy
signature. Trial-specific tests prove the same zero-work, stopped-cancellation,
and exact cancel/dismiss compensation contract for
`layerwell-trial-reminder`, and wait until the native mutation fence is terminal.

Independent adversarial review initially found the native fixed-schedule
boundary, startup double-pass, and trial-reminder seam. After correction and
real native-backend tests, its final review found no remaining P0/P1: one
lifecycle object reaches fixed and trial work, ordinary non-root callers retain
their prior behavior, stale markers cannot publish, and foreground convergence
remains single-pass.

## Human-Simulated E2E

Not applicable to the local slice because the reconciler has no visible UI
surface. Signed native foreground/background testing must still inspect actual
scheduled notification identifiers, trial reminders, permission states, and
battery/background behavior.
