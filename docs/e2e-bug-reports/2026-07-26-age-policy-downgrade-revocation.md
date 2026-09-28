# E2E Bug Report: Fresh age downgrade left an old receipt authoritative

Severity: High
Surface: Mixed
Environment: Expo SDK 56 source/lifecycle tests and headless Chrome/Edge at 390 x 844
Feature: CORE-01 age-policy provider boundary
Date: 2026-07-26
Tester: Codex

## Reproduction Steps

1. Start with an exact current eligible age-policy receipt and open `/onboarding/age`.
2. Enter a valid DOB below the current draft minimum and tap `Continue`.
3. Attempt a direct protected route, foreground re-read, or relaunch after forcing the receipt removal to fail.

## Expected Result

The fresh non-affirmative result immediately unmounts every protected provider.
An older affirmative receipt is durably replaced without retaining DOB, age, or
an underage reason, and direct protected routes remain closed.

## Actual Result

The root gate accepted only `current` query publications, so the age screen's
fresh `missing` publication did not close an already-mounted protected tree.
The false path also used deletion only; a failed removal left the old
affirmative receipt readable on a later foreground or relaunch.

## Evidence

- UI snapshot: focused lifecycle tests reproduce the ignored fresh downgrade.
- Terminal transcript: the independent CORE-01 review identified both paths
  before the checkpoint commit.

## Frequency

- Always for the publication bug; storage-failure dependent for durable
  revocation.

## Scope

- Affected route/screen: `/onboarding/age` and every protected route.
- Affected account or fixture: any device with an older exact current receipt.
- External service involved: none.
- Destructive action involved: replacement of the prior minimized receipt.

## Suspected Cause

`AgePolicyGate` treated the age route as an opening-only publication lane and
ignored fresh fail-closed states. `setAgeVerified(false)` removed the receipt
instead of atomically replacing it, so removal failure preserved the old
affirmative bytes.

## Minimal Fix Recommendation

Accept fresh safe-route `missing` and `unavailable` publications as immediate
downgrades, invalidate pending reads, and replace the old receipt with an exact
minimized re-verification tombstone. Carry only one calm in-memory message
across the required protected-to-bootstrap navigator swap.

## Verification Flow After Fix

1. Complete onboarding and AM/PM check-offs with an eligible receipt.
2. Re-enter age verification, submit a valid below-threshold DOB, and confirm
   the inputs are cleared while the calm block message survives the tree swap.
3. Request Today directly, reload, request Today again, and confirm both recover
   to age without mounting Today content.

## Post-Fix Evidence

- Screenshots:
  `test-results/human-e2e/2026-07-26/core01-age-profile-provenance-current/25-age-reverification-before-submit.png`
  through `28-age-reverification-reload-today-blocked.png`.
- UI snapshots: matching `.json` files in the same evidence directory.
- Summary: `summary.json` records `verdict: pass` and all three age
  re-verification route checks as `true`.
- Tests: 319 mobile files / 3,800 tests pass, including the focused
  `AgePolicyGate`, store, route, stale-read, tree-swap, and storage-failure
  cases.

## Remaining Risk

- A total private-storage overwrite failure followed by process termination
  cannot truthfully prove durable revocation; the prior bytes remain unchanged.
  The live process now remains closed and exposes retry instead of claiming the
  write succeeded.
- Physical-iPhone secure-storage fault injection, kill/relaunch, AppState,
  VoiceOver, Dynamic Type, and Apple Declared Age Range rescission remain
  release evidence.
