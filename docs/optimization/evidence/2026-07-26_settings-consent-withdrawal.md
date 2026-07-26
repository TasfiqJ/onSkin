# Settings Consent Withdrawal Hardening

Date: 2026-07-26

## Finding

The You-tab settings switches wrote `granted: false` consent rows directly.
They did not call the terminal withdrawal endpoint, so turning partner data
sharing off skipped the endpoint's commerce-click deletion and
order-attribution detachment. A failed write could also be hidden while the UI
appeared to accept the choice.

The first pending-marker implementation exposed a second race: a concurrent
grant could read before a decline committed encrypted `false`, then overwrite
that pending withdrawal after the decline's cleanup failed.

## Change

Settings consent persistence now has one owner-fenced contract:

- grants still write the affirmative ledger row, with the existing local-first
  deferred behavior for partner-data sharing;
- marketing and partner-data revocations call `consent-withdrawal` rather than
  recording `false` directly;
- partner-data withdrawal commits encrypted local `false` before remote work
  and immediately locks the owner-scoped effective commerce query;
- encrypted `false` remains the durable pending marker after a failed cleanup
  and across relaunch;
- one account-generation-keyed queue serializes each complete local-plus-remote
  workflow across Settings and the commerce consent sheet, so a slow grant
  cannot publish after a later completed withdrawal;
- a grant performs "reject pending false or write true" inside the private-KV
  per-key transaction, so opposite operations cannot interleave around the
  guard;
- the marker clears only after an exact three-key response whose caller consent
  type matches and whose per-consent cleanup object has only the expected keys,
  nonnegative integer counts, and required boolean invariants;
- stale-owner responses, feedback, and retries cannot publish or execute for a
  later account generation;
- the You surface exposes one accessible same-choice `Try again` action and
  synchronously single-flights rapid activation;
- the commerce consent sheet shares one synchronous Allow/Decline guard and
  disables both actions and dismissal while either is running. A retained
  pending marker keeps the sheet open with an accessible cleanup retry; the
  atomic grant rejection occurs inside the shared workflow queue and maps to
  that same recovery without an out-of-queue preflight. Allow remains disabled
  while cleanup recovery is shown. Mounted/request fences prevent stale cache,
  navigation, or state effects.

This is terminal cleanup hardening for the existing direct consent path. It
does not claim that consent publication has migrated into the transactional
outbox.

## Verification

```text
npm.cmd --workspace apps/mobile exec vitest run src/features/settings/privacyConsentPersistence.test.ts src/features/settings/applyPrivacyChoice.test.ts src/features/settings/settingsRoutes.test.ts src/features/commerce/commerce.test.ts src/features/commerce/commerceRoutes.test.ts src/features/commerce/consent.test.ts src/features/commerce/consentQuery.test.ts src/features/commerce/store.test.ts src/lib/consent/withdrawal.test.ts src/lib/query/queryKeys.test.ts src/lib/storage/privateBoolean.test.ts
npm.cmd --workspace apps/mobile run typecheck
npm.cmd --workspace apps/mobile exec eslint <exact changed mobile files>
npm.cmd exec prettier -- --check <exact changed files and docs>
npm.cmd run phase9:consent-withdrawal
npm.cmd --workspace apps/mobile test -- --run
git diff --check
```

Results:

- Focused matrix: 12 files / 177 tests passed.
- Mobile type-check: passed.
- Exact changed-file lint: passed.
- Prettier and patch whitespace checks: passed.
- Full mobile run: 361 of 363 files and 4,415 of 4,419 tests passed. The same
  four unrelated dirty-worktree failures remain in Shelf expiry provenance and
  the notification behavioural snapshot; the failure set is unchanged.
- Independent final adversarial review: no remaining P0/P1 finding after
  rechecking cross-surface invocation order, exact acknowledgement schemas,
  pending-query truthfulness, retry accessibility, dismissal, and stale-owner
  effects.
- The Phase 9 consent checks reach the repository's unrelated existing
  unavailable-cloud-backup assertion because
  `clearUnavailableCloudBackupPreference` is absent from the unchanged photo
  consent module. Live endpoint evidence is also intentionally absent in this
  placeholder-backend workspace.

The focused matrix covers exact per-consent response validation, false deny-wins
resolution against stale server grants, durable relaunch recovery,
owner-generation fencing, false-before-cleanup ordering, success-only marker
clearing, rapid retry single-flight, atomic local-marker updates, complete
cross-surface workflow serialization in both invocation orders, pending-query
recovery, dismissal fencing, and shared consent-sheet action serialization.

## Human-Simulated E2E

The Codex in-app browser opened the actual Expo web You surface at 375 x 667
and confirmed the expected starting screen before the commerce flag was
enabled. The app was then restarted with both
`EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=true` and
`EXPO_PUBLIC_FINAL_BRAND_DOMAIN=https://routinekind.app`; the local route
returned HTTP 200. During that restart the browser entered its generated
connection-error document, and its URL safety policy then refused navigation
back to the local app even from a fresh controlled tab. The browser session was
cleaned up.

This is not recorded as a UI pass. A fresh in-app-browser run must still
exercise grant, failed withdrawal, rapid retry, and relaunch recovery at the
supported phone viewport. Authenticated staging must additionally prove the
deployed endpoint appends the caller-scoped false ledger row, deletes commerce
click events, detaches order attributions, and returns the exact
acknowledgement. Native VoiceOver and physical-device process-kill recovery
remain release gates.
