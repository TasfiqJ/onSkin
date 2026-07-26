# E2E Testing Checklist

Use this checklist before marking UI-facing work done.

## Setup

- [ ] Read `AGENTS.md`.
- [ ] Read `docs/HUMAN_SIMULATED_E2E_TESTING.md`.
- [ ] Read `docs/DEVICE_SUPPORT_POLICY.md` for device and viewport support floors.
- [ ] Read or update the relevant branch in `docs/USER_FLOW_TREE.md`.
- [ ] Read the feature's source-of-truth product docs from `CLAUDE.md`.
- [ ] Identify the target surface and contract applicability: physical iPhone,
      iOS Simulator, Expo web, CLI/script, or non-release Android resilience.
- [ ] Identify whether the target viewport/device is launch-supported or stress-only.
- [ ] Identify the exact start/build command.
- [ ] Identify account state, local fixture, seed data, and required environment variables.
- [ ] Identify external services involved.
- [ ] Confirm destructive actions are either not involved or explicitly approved.

## App-Surface Verification

- [ ] Start or open the actual target surface.
- [ ] Confirm the expected starting screen is visible before interacting.
- [ ] Execute the happy path like a user.
- [ ] Execute Critical branch paths from `docs/USER_FLOW_TREE.md`.
- [ ] Exercise invalid input where relevant.
- [ ] Exercise empty state where relevant.
- [ ] Exercise loading, offline, or slow state where feasible.
- [ ] Exercise back, refresh, relaunch, or navigation recovery where relevant.
- [ ] Exercise permission, privacy, auth, or account-state branches where relevant.
- [ ] Check accessibility labels, keyboard behavior, or screen-reader-relevant names where relevant.

## Evidence

- [ ] Capture screenshots or video for important UI states.
- [ ] Capture traces for Playwright/web runs when available.
- [ ] Capture simulator/emulator logs or UI snapshots for native mobile runs when useful.
- [ ] Capture terminal transcript for commands.
- [ ] Store evidence under `test-results/human-e2e/YYYY-MM-DD/` or a documented phase-specific evidence folder.
- [ ] Record uncovered branches and the reason they were not covered.

## CORE-05 Today/Shelf Replay Addendum

Use these gates when the accepted revision touches Today completion, Shelf
mutation, adherence/streak projection, offline replay, health-data export, or
withdrawal:

Current retained local evidence, 2026-07-26: headless-Chrome Expo web with a
deterministic anonymous-owner fixture passes the complete onboarding,
three-product Shelf intake, truthful pending-review reveal/plan, `Start today`, AM and PM
1-of-1 check-off, age re-verification, direct-Today denial, and reload-denial
path at 375 x 667, 390 x 844, and 430 x 932. The harness requires exactly one
reviewed insight or truthful pending-review state. A 375 x 667 fixed-footer
overlap was fixed with post-add non-animated scrolling; its focused route
regression passed 20 of 20, mobile typecheck passed, and the rerun plus the
390 x 844 compact-category-sheet and 430 x 932 inline-category paths report
zero visible-control issues. This is local web/fixture evidence only, not
native, hosted, real-account, two-device, or signed-archive evidence; the
unchecked matrix below remains authoritative.

- [ ] Capture the exact local Shelf and completion schema versions before the
      run; do not migrate/seed historical replay work that the source does not
      create.
- [ ] Prove the visible Today check-off persists before success publication and
      survives navigation/relaunch.
- [ ] Prove partial AM/PM work creates no routine day; the exact final projected
      PM/recovery step creates one marker and no duplicate.
- [ ] Drive network loss, thrown RPC, malformed response, response loss, exact
      accepted/idempotent, retryable, and every bounded terminal result.
- [ ] Retain an ordered trace proving Shelf drains before completion.
- [ ] Exercise terminal Shelf plus missing completion identity, verify
      reversible same-routine/date tail deferral through the marker, drain
      unrelated work, then repair Shelf and replay the exact original event.
- [ ] Exercise a remote-terminal scheduled step both before and after its
      marker exists; verify the marker receives a dependency-terminal receipt
      and is never dispatched.
- [ ] On hosted non-production fixtures, prove deletion-wins for a missing
      upsert, response-loss retry, no resurrection, pre/post-cutoff completion,
      cross-owner UUID denial, and direct-DML denial.
- [ ] Exercise legacy/incompatible UUID, missing/invalid/recovered timezone,
      offline relaunch, account switch, health-epoch change, withdrawal, and
      account deletion without inventing replay evidence.
- [ ] Verify server schema-v4 export includes the three exact stable-identity/
      receipt sources, excludes raw payloads and `request_sha256`, binds every
      health-fenced read to the initial lifecycle-derived epoch, and aborts on
      lifecycle change.
- [ ] Verify the requesting-device export labels pending/terminal local v3 state
      as `shelf_and_sync_state` and `completion_and_sync_state`.
- [ ] Capture exact pre/post local, Postgres, and Storage zero counts for
      withdrawal/account erasure while preserving the account/billing state
      appropriate to health withdrawal.
- [ ] Record separately what Expo web, local Postgres, hosted staging, iOS
      Simulator, physical iPhone, two-device, signed archive, and professional
      review each did and did not prove.

## Bugs And Fixes

- [ ] Record each bug with `docs/E2E_BUG_REPORT_TEMPLATE.md`.
- [ ] Explain the suspected cause before changing code.
- [ ] Make the smallest correct fix.
- [ ] Add or update unit, integration, or E2E tests appropriate to the bug.
- [ ] Re-run the exact reproduction path through the same surface.
- [ ] Capture post-fix evidence.

## Automated Test Follow-Up

- [ ] Decide whether the flow is stable and valuable enough to automate.
- [ ] Prefer Playwright only for Expo web-compatible flows.
- [ ] Prefer the selected native mobile harness for simulator/device-only flows.
- [ ] Use user-facing locators, accessibility labels, or accessibility identifiers.
- [ ] Avoid brittle CSS/XPath/coordinate selectors unless no better option exists.
- [ ] Avoid third-party service dependency in durable E2E tests.
- [ ] Configure failure evidence such as screenshot, video, trace, or logs.

## Final Acceptance

- [ ] Relevant unit/integration tests passed or failures are documented.
- [ ] Human-simulated E2E pass completed on the actual surface.
- [ ] Critical branches passed or are explicitly out of scope.
- [ ] Evidence paths are listed in the final response.
- [ ] Bugs found and fixed are listed.
- [ ] Remaining risks are listed.
- [ ] Recommended next E2E setup or QA task is listed.

## Open Questions

- What fixture/reset command should be standard for each core app state?
- Which native mobile E2E harness should be installed first?
- Which Expo web flows should be promoted to Playwright tests?
- Which service-backed flows need local mocks before durable E2E can run safely?
