# E2E Testing Checklist

Use this checklist before marking UI-facing work done.

## Setup

- [ ] Read `AGENTS.md`.
- [ ] Read `docs/HUMAN_SIMULATED_E2E_TESTING.md`.
- [ ] Read or update the relevant branch in `docs/USER_FLOW_TREE.md`.
- [ ] Read the feature's source-of-truth product docs from `CLAUDE.md`.
- [ ] Identify the target surface: iOS, Android, Expo web, CLI/script, or mixed.
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
