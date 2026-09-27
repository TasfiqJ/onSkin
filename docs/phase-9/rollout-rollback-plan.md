# Phase 9 Rollout And Rollback Plan

Status: BLOCKED until a real staging rollback drill and production owner
evidence are retained.

## Freeze Rules

Once an RC is under QA, do not add SDKs, permissions, migrations, store claims,
catalog imports, cryptography, native targets, or unrelated refactors without a
new candidate and release-manager approval.

## Rollout

1. Build the production-profile iOS artifact from the frozen SHA and retained
   runtime fingerprint.
2. Install the exact TestFlight candidate and retain its build, toolchain,
   entitlement, privacy-manifest, export-compliance, and source evidence.
3. Run smoke, data rights, payments, RLS, Edge auth, observability,
   accessibility, and physical-iPhone QA.
4. Use Apple manual release for the first US-only production version. Do not
   treat update-style phased release as a first-version throttle.
5. Keep launch traffic off during Ring 0, then expand invite-led traffic only
   after production smoke passes.
6. Monitor the first 24, 48, and 72 hours before scaling creator or paid growth.

## Halt Criteria

Stop release expansion and marketing if deletion/export fails, restore/purchase
fails, entitlement mirrors drift, sensitive data appears in logs, analytics, or
crash reports, RLS/Edge auth fails, crash-free metrics fall below the approved
threshold, App Review flags privacy/health/subscription claims, or support is
dominated by billing, deletion, or privacy confusion.

## EAS Update Eligibility

An EAS Update may contain reviewed JavaScript/assets only when all of these are
true:

- its runtime fingerprint exactly matches the target installed binary;
- the update was first published to `staging`, installed on a matching native
  build, and passed the affected smoke, privacy, payment, accessibility, and
  owner-isolation tests;
- no native module, plugin, entitlement, permission, Info.plist value, privacy
  manifest, SDK signature, export declaration, WidgetKit/ActivityKit target,
  bundle identity, cryptography, or native data-protection behavior changes;
- it does not make an unavailable feature appear available or change a
  professionally reviewed health, privacy, subscription, legal, or store claim
  without the same approval required for a binary release; and
- server/database changes remain backward-compatible with every supported
  binary and retained rollback target.

Use a new App Store binary for every native, signing, entitlement, privacy,
export, SDK, capability, or runtime-contract change. EAS Update cannot repair a
bad binary or cross a runtime boundary.

## Recovery Paths

- OTA rollback: update-caused JavaScript/content regressions within the exact
  same runtime fingerprint, using `eas update:rollback` to a reviewed prior
  update or embedded build.
- New binary: native/plugin/permission/runtimeVersion/config changes.
- Server flag disable: risky backend or feature-gated surfaces.
- RevenueCat pause: stop processing webhook grants only with finance/engineering approval and a reconciliation plan.
- Store halt: hold manual release, pause an Apple phased **version update**, or
  remove marketing/availability as directed by the release and legal owners.

Never roll back a destructive database migration independently of clients.
Schema changes must be expand/migrate/contract, and rollback must preserve
account deletion, export, payment truth, owner-scoped data, and consent state.

## Required Drill Evidence

Retain the incident ID, frozen and rollback SHAs, EAS update IDs, channel,
branch, runtime fingerprint, commands, authorized publisher, timestamps,
monitoring screenshots/exports, privacy/payment smoke, support decision, and
recovery signoff. A typed command in this document is not drill evidence.

Every RC packet must name the release manager, hotfix owner, support owner,
privacy owner, and the people allowed to publish EAS Update or App Store builds.
No single unavailable person may be the only rollback authority.

Primary references:

- https://docs.expo.dev/eas-update/deployment/
- https://docs.expo.dev/eas-update/runtime-versions/
- https://docs.expo.dev/eas-update/rollbacks/
- https://docs.expo.dev/eas-update/rollouts/
