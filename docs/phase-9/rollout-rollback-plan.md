# Phase 9 Rollout And Rollback Plan

Status: BLOCKED. A real staging rollback drill and production owner evidence
remain required, and account-deletion user traffic cannot open until the
publication-fence Edge/mobile evidence, old/tampered-client provider control,
and live/provider/device/professional gates below are closed.

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

## Durable Account-Deletion Cutover

Use the exact sequence in
`docs/phase-9/account-deletion-operations-runbook.md`. Validate all mandatory
Edge secrets first, including a RevenueCat REST API v2 key; a legacy V1 key is
not a deletion credential. Predeploy the new fail-closed `account-deletion`
function from the frozen SHA, apply migrations `20260713000048` through
`20260713000052` in exact order, then immediately deploy every default function
from the same SHA so webhook and service writers honor the new barriers and
tombstones. Migration 0052 is a hard cutover: freeze deletion intake and every
legacy/unfenced Supabase-session or RevenueCat publication producer, wait the
reviewed old-request/SDK propagation bound plus provider settlement, prove zero
operations/barriers/in-flight bypasses, and keep the freeze through compatible
Edge/mobile deployment and canary verification. Create the two private Vault entries and apply
`supabase/ops/account-deletion-work-lane.sql` only after the function and schema
are coherent. Prove missing/wrong/correct worker-secret behavior, one-minute
Cron continuity, begin/status/receipt recovery, queue/lease/expiry monitoring,
and provider-negative paths before exercising authorized internal staging
fixtures. `EdgeRuntime.waitUntil` is only an accelerator and cannot satisfy the
scheduler gate.

This `0048`-`0052` sequence is a bounded staging/internal checkpoint; it does
not authorize release-candidate or user traffic. Migration 0052 supplies the
sealed two-phase publication lease, exact-session intake/preflight, atomic
worker drain, five-minute settling gate, and two claim-distinct absence rounds
in database source. Every mobile RevenueCat publication path must still prove
it fails closed without that lease. RevenueCat/provider owners must also approve
a blocking control, enforceable mandatory-version gate, or continuing
re-deletion control for old/tampered clients that can bypass the updated binary.
Only after those client/live controls and the runbook's hosted,
provider-recreation, physical-iPhone, privacy/security/legal, and App Review
gates pass may traffic opening be considered under the general rollout above.

This cutover is roll-forward only. If provider dispatch may be unsafe,
unschedule only the canonical work job and preserve operations, barriers,
encrypted step state, receipts, recovery audit, and RevenueCat tombstones.
Never reverse migrations `0048`-`0052`, deploy the old synchronous/user-only-session function,
drop barriers to unblock clients, or rotate away the only payload key while
live encrypted steps remain. Re-enable work after the repaired same-schema
function passes a reviewed canary and ambiguous operations are reconciled; that
worker recovery does not itself authorize user traffic.

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
