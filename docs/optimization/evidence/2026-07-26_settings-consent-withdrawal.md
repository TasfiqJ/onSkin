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
- an exact development-web/data-sharing-only fixture fails twice and then
  returns the exact valid cleanup acknowledgement through the production hash,
  account-generation, and response-validation path. Its content-free same-tab
  attempt counter survives reload; a separate held mode proves late response
  detachment. Unknown, production, native, and other-consent paths retain the
  normal backend contract;
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
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
git diff --check
```

Results:

- Focused matrix: 12 files / 177 tests passed.
- Fresh fixture/recovery matrix: 9 files / 129 tests passed. It includes
  production/native/type/mode isolation, exact third acknowledgement,
  content-free reload counting, restricted-session-storage normalization,
  never-resolving hash detachment, held-response owner detachment, and
  success-only pending-marker clearing.
- Mobile type-check: passed.
- Exact changed-file lint: passed.
- Prettier and patch whitespace checks: passed.
- Final root run: 370 of 372 files and 4,561 of 4,565 tests passed. The dev-only
  fixture key remains outside the production private-storage registry and its
  inventory test passes. The same four unrelated dirty-worktree failures
  remain in Shelf expiry provenance and the notification behavioural snapshot;
  the failure set is unchanged.
- Root type-check and zero-warning lint: passed across both workspaces.
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

Fresh installed-Chrome Playwright drove the actual Expo web `/you` surface at
390 x 844 with the synthetic authenticated account fixture and commerce flag.
The deterministic attempt series was exactly:

`0 -> 1 -> 2 -> 2 after reload -> 3 -> 3 after final reload`

- The initial 52 x 48 px switch granted locally without a withdrawal call.
- The first withdrawal saved encrypted local `false`, unchecked the switch,
  produced attempt one, and exposed one `Choice not saved` alert plus one
  113.91 x 56 px same-choice retry.
- A pending regrant remained blocked without another workflow or attempt.
- Two same-frame retry activations produced only attempt two and one additional
  consent start.
- Same-tab reload retained the encrypted pending marker and content-free
  counter at two without an automatic request.
- One retry accepted the exact validated third acknowledgement, removed the
  alert/retry, and left the switch off and changeable.
- Final reload made no fourth request; a new local grant then succeeded and
  left the withdrawal counter at three.

A separate held run started sign-out after local revocation but before cleanup
resolved. The account-generation boundary removed You immediately and entered
the real protected-data recovery screen. Releasing the account-A response
after that boundary did not restore You, publish account-A feedback, clear the
gate, or increment the counter. Retrying the deliberately failed first local
clear completed sign-out and rendered Welcome. The release hook deleted
itself.

All target controls were at least 44 px and fully visible. Every sampled state
had zero horizontal overflow, dialogs, page errors, unexpected warnings/errors,
or raw fixture/backend/storage text. Screenshots, exact counts, accessibility
snapshots, logs, and the command transcript are in
`test-results/human-e2e/2026-07-26/settings-data-sharing-withdrawal-recovery-current/`.

Authenticated staging must still prove that the deployed endpoint appends the
caller-scoped false ledger row, deletes commerce click events, detaches order
attributions, and returns the exact acknowledgement. Native VoiceOver and
physical-device process-kill recovery remain release gates.
