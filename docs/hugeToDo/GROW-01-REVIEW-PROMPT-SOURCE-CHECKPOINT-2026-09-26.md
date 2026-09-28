# GROW-01 Review Prompt Source Checkpoint

Date: 2026-09-26 (America/Toronto)  
Evidence class: source, focused automated tests, and external native verification gap  
Status: source-ready candidate; not App Store or physical-device accepted

## Scope And Decision

Layerwell may ask StoreKit for the system review prompt only after one of two
durable product-value outcomes:

1. the seventh completed routine day is durably inserted; or
2. an exact-hash, reviewed conflict choice is durably saved and its sheet is
   dismissed.

Data export and payment completion remain explicitly ineligible. There is no
custom sentiment question, star selector, reward, discount, feature unlock,
positive-review filter, blocking gate, or user-facing pressure copy.

The request is best-effort and never controls completion, navigation, product
access, or saved health state. StoreKit decides whether to display anything.

## Fail-Safe Controls

- The launch flag must be enabled.
- The value moment must be one of the two allowlisted outcomes above.
- The installed native application version must be present, printable, and
  bounded.
- A version is requested at most once locally.
- Calls remain capped at three attempts in a rolling 365-day window, with at
  least 30 days between attempts.
- Attempt history is reserved atomically before native handoff, so simultaneous
  callers and a crash after handoff cannot duplicate a request.
- Version-2 state is exact-key and canonical. Malformed, future-dated,
  duplicate, unsupported-future-version, unreadable, or unavailable state is
  preserved and suppresses prompting instead of clearing evidence.
- Canonical legacy version-1 timestamps retain their cooldown/cap effect; the
  next eligible attempt starts exact per-version history.
- The service checks StoreReview availability, waits two seconds for a natural
  post-task pause, then rechecks the account/health-data lease and requires the
  app to remain active before reserving or invoking StoreKit.
- Callers are fire-and-forget only after the success boundary and absorb a
  later withdrawal/account-boundary rejection. A review failure cannot turn a
  saved check-off or conflict choice into a failed product action.

## Findings Corrected

1. The prior state had cooldown and annual-cap timestamps but no per-version
   suppression, so the same app version could be requested again after 30 days.
2. The Today route awaited StoreKit inside the completion operation, leaving
   the completed action pending and allowing the native surface to interrupt
   the user-action stack.
3. `first_reviewed_conflict` was an allowlisted policy value with no production
   call site.
4. A successful data export called the review service even though policy later
   rejected that privacy-rights moment. The unnecessary call was removed.
5. Legacy decoding silently normalized corrupt, duplicate, or future history,
   which could erase suppression evidence. Migration is now strict and
   fail-closed.

## Apple Basis Checked On 2026-09-26

- Apple says to ask at a noninterrupting natural break after successful
  completion, avoid prompting immediately on launch, avoid calling directly as
  the result of a user action, delay briefly on the completed state, and avoid
  asking the same app version more than once:
  <https://developer.apple.com/documentation/storekit/requesting-app-store-reviews>
- Apple documents that the system may display at most three prompts in 365 days,
  may display nothing, and that TestFlight-distributed builds do not display the
  prompt:
  <https://developer.apple.com/documentation/storekit/appstore/requestreview(in:)>
- Apple's ratings guidance recommends asking only after demonstrated engagement
  at a natural stopping point and using the system prompt:
  <https://developer.apple.com/design/human-interface-guidelines/ratings-and-reviews>
- App Review Guideline 3.2.2(x) prohibits forcing a rating, review, download, or
  other store action to access functionality or content:
  <https://developer.apple.com/app-store/review/guidelines/>

These sources inform the source contract; they do not guarantee App Review
acceptance.

## Focused Evidence

The focused suite covers eligibility, disabled state, privacy/payment denial,
30-day cooldown, rolling cap, missing version, same-version suppression,
version-1 migration, version-2 canonical validation, malformed/future state,
unavailable native action, native rejection, storage rejection, simultaneous
callers, withdrawal during availability, backgrounding during the settled
delay, nonblocking Today ordering, reviewed-conflict ordering, and source-level
absence of custom rating pressure or incentives.

Commands required for this checkpoint:

```text
npm --workspace apps/mobile test -- --run src/features/review/policy.test.ts src/features/review/prompt.test.ts src/features/review/sourceContract.test.ts src/features/today/todayRoute.test.ts src/features/intelligence/conflictChoiceIntegration.test.ts
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run lint -- --quiet
```

Observed results in this checkout:

| Check | Result |
| --- | --- |
| Focused review, Today, conflict, and export source-contract suite | Pass: 6 files / 107 tests |
| Mobile TypeScript check | Pass |
| Mobile lint, zero-warning policy | Pass |
| Full mobile suite | Pass: 409 files / 4,735 tests |
| Scoped `git diff --check` | Pass |

## Human-Simulated E2E Boundary

No custom review UI exists, and Expo web cannot render or prove the native
StoreKit review sheet. Apple also documents that TestFlight does not display
the review prompt. This Windows checkout has no iOS Simulator or connected
physical iPhone evidence in this checkpoint, so human-simulated native QA is
open rather than passed.

The shared `docs/USER_FLOW_TREE.md` is concurrently owned by the NATIVE-03 lane.
Root integration should add a distinct GROW-01 branch with these paths:

- seven-day completion and reviewed-conflict success each return to a settled,
  usable app surface before any prompt can appear;
- partial/unconfirmed completion, failed conflict save, export, payment,
  disabled flag, malformed history, same version, cooldown, cap, background,
  withdrawal, and account switch produce no prompt;
- repeated taps and simultaneous qualifying outcomes reserve at most one attempt;
- dismissal or nondisplay never blocks or alters the saved action;
- VoiceOver focus returns safely after the system sheet dismisses.

## Remaining Acceptance Evidence

1. Use an iOS development build on a supported physical iPhone or Simulator to
   verify the system sheet after each eligible outcome, the two-second natural
   pause, dismissal, VoiceOver focus, background/foreground, relaunch, and
   account-switch behavior.
2. Capture exact build/version, video or screenshots, sanitized device logs,
   attempt-state snapshots, and accessibility notes under
   `test-results/human-e2e/YYYY-MM-DD/grow01-review-prompt/`.
3. Verify a signed release candidate makes the same request at the two governed
   boundaries without custom prompt UI. StoreKit nondisplay is an expected
   outcome and must not be misreported as a failed app flow.
4. Complete independent release QA and Apple App Review. Neither source tests
   nor device testing can guarantee approval.
