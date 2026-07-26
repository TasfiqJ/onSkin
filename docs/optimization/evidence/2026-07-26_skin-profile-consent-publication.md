# Skin-Profile Consent Publication Gate

Date: 2026-07-26

## Finding

Onboarding correctly required a device-local health-data consent choice before
creating a skin profile, but its direct cloud mirror did not independently
prove that the current authenticated owner had an authoritative server grant
for the exact consent copy. An offline-only grant, a stale version or hash, a
forged future timestamp, or a consent/profile race could therefore publish
special-category health-inference data without the required current ledger
proof.

The local consent check and encrypted profile write also ran outside the shared
consent workflow used by Settings and commerce. A later decline could
interleave between the check and local commit.

## Change

The onboarding path now has one fail-closed, owner-fenced contract:

- health grant/decline, Settings/commerce consent work, and profile persistence
  share one account-generation-scoped workflow queue;
- the local consent check, quiz scoring, encrypted profile commit, cache
  publication, authoritative proof, and best-effort mirror execute within one
  non-reentrant workflow;
- the device remains authoritative and onboarding completes locally when auth,
  proof, or mirror transport is unavailable;
- cloud publication first requires the latest server row to grant the exact
  consent type, rendered version, and SHA-256 text hash;
- the proof query and insert have explicit response bounds and deadlines, while
  the non-idempotent profile insert is attempted only once;
- every async boundary asserts the captured account-generation lease;
- the direct-client inventory now names the extracted mirror and requires its
  shared consent workflow plus explicit lease assertions.

The forward database migration independently enforces the same boundary:

- a restrictive authenticated `skin_profiles` INSERT policy requires the
  caller-owned row and the exact current health-data grant;
- authenticated clients cannot choose consent-ledger timestamps;
- any future-dated ordering horizon fails closed;
- equal-time grant/revoke rows resolve to revocation;
- consent insert and profile authorization share a per-owner advisory
  transaction lock, so a concurrent revocation cannot be bypassed;
- the unused authenticated `skin_profiles` UPDATE capability is removed;
- function grants, empty search paths, policy replacement, and trigger
  replacement are safe under migration reapplication.

This does not move consent or profile publication into the encrypted
transactional outbox. Durable offline replay and cross-device intent ordering
remain separate protocol work.

## Verification

```text
npm.cmd --workspace apps/mobile exec vitest run src/lib/consent/consent.test.ts src/features/onboarding/healthConsent.test.ts src/features/commerce/consentWorkflowIntegration.test.ts src/features/onboarding/skinProfileMirror.test.ts src/features/onboarding/skinProfilePersistence.test.ts src/features/onboarding/skinProfileConsentPolicy.test.ts src/features/onboarding/onboardingRoutes.test.ts src/lib/network/requestPolicyInventory.test.ts
npm.cmd --workspace apps/mobile exec vitest run src/lib/auth/accountScopeInventory.test.ts src/lib/network/requestPolicyInventory.test.ts
npm.cmd --workspace apps/mobile run typecheck
npm.cmd --workspace apps/mobile exec -- eslint <exact changed mobile files> --max-warnings=0
node scripts/optimization/skin-profile-consent-postgres-replay.mjs
npm.cmd --workspace apps/mobile test -- --run
npm.cmd exec -- prettier --check <all parser-supported changed files and docs>
git diff --check
```

Results:

- Focused consent/profile matrix: 8 files / 63 tests passed.
- Account-scope and request-policy inventory: 2 files / 7 tests passed.
- Mobile type-check and exact changed-file lint: passed.
- Disposable PostgreSQL 15.18 replay: passed after applying the migration
  twice. Exact grant was allowed; missing, false, stale version/hash,
  future-dated, equal-time revocation, foreign-owner, authenticated update, and
  concurrent revoke/profile cases were denied. Authenticated timestamps were
  server-controlled, and the concurrent revocation won.
- Full mobile run: 364 of 366 files and 4,454 of 4,458 tests passed. The same
  four unrelated dirty-worktree failures remain in Shelf expiry provenance and
  the notification behavioural snapshot.
- Prettier and patch whitespace checks: passed.
- Independent adversarial review found no remaining locally fixable P0/P1 in
  the slice after examining offline/stale/future/equal-time proofs, local and
  database ordering, account deletion and owner switching, RLS bypass,
  publication bounds, and test coverage.

## Human-Simulated E2E

Not applicable to this slice. It does not change onboarding navigation, copy,
controls, or visible outcomes; it changes the ordering and authorization of the
existing local commit and best-effort server mirror. The real database
authorization and concurrency behavior is exercised by the disposable
PostgreSQL replay. Authenticated hosted-staging RLS replay and physical-device
account-switch/process-kill proof remain release gates.
