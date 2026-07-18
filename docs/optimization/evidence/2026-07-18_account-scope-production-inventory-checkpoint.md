# Account-Scope Production Inventory Checkpoint

Date: 2026-07-18 (America/Toronto)

Parent SHA: `75aacefc293a8ae160cc21624c8096ca365518db`

Scope: PERF-P0-006 and OPT-009 local implementation completeness.

## Outcome

The account-generation work now has an executable, repository-wide gateway
inventory instead of a prose-only follow-up. The inventory recursively scans
every non-test mobile source and fails when a new direct account-sensitive
network, vendor, durable-storage, or filesystem gateway appears outside the
reviewed set.

## Frozen Gateways

| Boundary | Exact production inventory | Enforced contract |
| --- | ---: | --- |
| Direct Supabase client owners | 19 files | exact source list |
| Direct account-operation owners | 18 files | account-generation or owner-query operation plus current-generation assertion |
| Abortable account-data PostgREST owners | 17 files | lease-linked `.abortSignal(...)` |
| Central Edge invocation adapter | 1 file | request policy, authenticated owner lease, pinned session, linked signal |
| PostHog runtime adapter | 1 file | account-generation lease plus deletion freeze |
| RevenueCat runtime adapter | 1 file | owner coordinator plus deletion operation barrier |
| Raw durable-storage gateways | 10 files | exact reviewed primitive/control-owner list |
| Raw filesystem gateways | 9 files | exact reviewed staging/photo/export/cleanup/diagnostic list |

The existing native-notification inventory separately enforces that every Expo
notification write is owned by `NotificationNativeMutationCoordinator`.

## Shelf Delayed A-to-B Proof

The status packet previously listed executable Shelf delayed account-A to
account-B coverage as open. Revalidation found complete focused proof already
present in the production mutation suites:

- delayed mirror owner lookup cannot issue an account-A upsert or delete after
  the boundary begins;
- add cannot publish analytics, mirror work, or cache invalidation;
- edit cannot publish a mirror or cache invalidation;
- delete cannot start its server mirror;
- replenish cannot publish follow-up mirrors, analytics, cache invalidation, or
  a settled owner-A result;
- add acknowledgement cannot clear a refreshed owner's receipt; and
- scan logging cannot publish its delayed account-A server row.

The normal suite also retains same-user refresh behavior, exact owner capture,
ordered per-owner/per-product mirror chains, and abort-signal assertions.

## Trend Scope

The Trend engine is hard-disabled by the accepted launch contract. Progress
mounts no Trend consent or Monk observer while the flag is disabled, and direct
Trend routes remain deferred with no consent control. A Trend query-error
recovery UI is therefore not an active account-scope implementation gap for
this release. Reactivation must add a visible retry surface and rerun the full
UI/device evidence matrix before enabling the observer.

## Verification

- Focused inventory/Shelf/account-boundary matrix: 5 files / 35 tests PASS.
- Full root test suite: 334 files / 3,993 tests PASS.
- Root typecheck: PASS.
- Root lint with zero warnings: PASS.

## Status

PERF-P0-006 and OPT-009 advance to `implemented`: the local source inventory
and known executable delayed-publication gaps are complete. They are not
`verified`; supported-iOS physical account switching, native provider prompts,
protected-storage interruption, notifications, and delayed native transport
evidence remain required.
