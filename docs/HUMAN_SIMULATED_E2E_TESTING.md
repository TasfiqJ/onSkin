# Human-Simulated E2E Testing

## Purpose

This repo uses human-simulated end-to-end testing to verify that OnSkin works through the same surface a real person uses: iOS Simulator, Android emulator/device, Expo web, or another explicit target surface.

Unit and integration tests still matter. They verify smaller code behavior and prevent regressions. They do not prove that a real user can complete onboarding, routine, shelf, progress, privacy, commerce, or account flows through the app UI.

## Core Rule

Do not mark UI-facing work as complete until Codex has:

1. Identified the real app surface for the task.
2. Started the app locally or opened the target build.
3. Mapped the relevant user-flow tree in `docs/USER_FLOW_TREE.md`.
4. Driven the app like a user through the happy path and the critical branch paths.
5. Captured evidence: screenshots, videos, traces, logs, UI snapshots, or terminal transcripts.
6. Re-run the same surface flow after any fix.
7. Converted stable critical flows into repeatable E2E tests when the repo supports the needed harness.

## Current Repo Surface

- Primary app: Expo React Native mobile app in `apps/mobile`.
- Primary target surfaces: iOS Simulator/device and Android emulator/device.
- Secondary target surface: Expo web for flows that render correctly through `npm --workspace apps/mobile run web`.
- Current unit/integration test runner: Vitest in `apps/mobile`.
- Current durable local evidence gate: `npm run e2e:human:manifest`.
  This no-new-dependency Node verifier reads committed
  `test-results/human-e2e/YYYY-MM-DD/` Expo web-compatible evidence folders,
  checks the current compact route sweeps and first-session activation summary,
  and writes `docs/e2e/generated/human-e2e-manifest.{json,md}`. It is not a UI
  runner and does not replace the human-simulated browser/simulator/device pass;
  it prevents known-good local evidence from becoming ambiguous or hidden.
- Native durable harness decision: Open Question. No Detox, Maestro, Appium,
  XCTest/XCUIAutomation, or Android UI Automator config is committed yet.
- Package manager: npm workspaces.

## Existing Commands

Start the app:

```bash
npm --workspace apps/mobile run start
npm --workspace apps/mobile run ios
npm --workspace apps/mobile run android
npm --workspace apps/mobile run web
```

Run checks:

```bash
npm run typecheck
npm run lint
npm test
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run lint
npm --workspace apps/mobile run test
```

## Tool Selection

### Expo iOS or Android App

Use this for native-only flows, device permissions, camera/photo behavior, notifications, secure storage, subscriptions, and native navigation issues.

Default exploratory tools:

- Expo CLI and the target simulator/emulator/device.
- Codex Computer Use when visual desktop control is required.
- Simulator/emulator screenshots, video, logs, UI hierarchy snapshots, and terminal transcripts as evidence.

Durable automation options to evaluate before installing anything:

- Detox for React Native flows that need repeatable simulator E2E.
- Maestro for high-value black-box mobile journeys.
- Native XCTest/XCUIAutomation for iOS-specific flows if an iOS project and scheme are available.

Prefer accessibility labels and identifiers over coordinates. If a step requires coordinates because no stable label exists, log that as a testability and accessibility issue.

### Expo Web

Use this only for flows that faithfully render through Expo web and do not depend on native-only APIs.

Default exploratory tools:

- Codex in-app browser or Playwright MCP, if available.
- Browser screenshots, console logs, network logs, and terminal transcripts.

Durable automation option:

- Playwright Test, after confirming the flow is web-compatible and after adding a deliberate Playwright setup task.

Prefer user-facing locators such as role, label, text, placeholder, and accessible name. Use test IDs only when user-facing locators are unstable or unavailable. Avoid brittle CSS and XPath selectors unless there is no better option.

### CLI or Scripted Workflows

Use terminal transcripts for scripts, importers, Supabase checks, release gates, and other non-visual flows. These are not substitutes for app-surface testing when the change affects UI.

## Before Testing

Before each human-simulated E2E pass, record:

- Feature or bug under test.
- App surface: iOS, Android, Expo web, CLI/script, or mixed.
- Start/build command.
- Test account, fixture, seed data, or local state used.
- Required environment variables.
- External services involved.
- Destructive actions and whether they are explicitly approved.
- Evidence folder path.

Do not invent missing credentials, services, seeded data, or tool availability. Mark unknowns as Open Questions.

## User-Flow Branch Mapping

Update `docs/USER_FLOW_TREE.md` before testing a feature. Each flow should include:

- User goal and persona.
- Entry state and start screen.
- Success state.
- Happy path.
- Invalid input branch.
- Empty state branch.
- Loading or slow-network branch.
- Back, refresh, relaunch, or navigation branch.
- Permission, privacy, auth, or account-state branch.
- Mobile responsive branch if using Expo web.
- Keyboard and accessibility branch when relevant.
- Priority: Critical, Important, or Nice.
- Whether the branch should become automated E2E.

Do not invent unsupported flows. If the route or behavior is unclear, mark it as an Open Question.

## Evidence Standard

Every important result needs evidence. Use the most appropriate evidence for the surface:

- Screenshot or video of the visible app state.
- Playwright trace, screenshot, and browser console/network logs for Expo web.
- Simulator/emulator logs and UI snapshots for native mobile.
- Terminal transcript for commands and scripted flows.
- Minimal reproduction report for bugs.

Store exploratory evidence under:

```text
test-results/human-e2e/YYYY-MM-DD/
```

If another project-specific evidence folder is more appropriate for a release phase, use it and report the path.

After a local Expo web-compatible evidence pass has been captured and committed,
run:

```bash
npm run e2e:human:manifest
```

The manifest gate must pass before using local human-E2E evidence in a launch
readiness packet. If it fails, inspect the named evidence folder instead of
assuming older screenshots still prove the current route set.

## Exploratory Run Report Template

Create a report at `test-results/human-e2e/YYYY-MM-DD/report.md`.

````markdown
# Human-Simulated E2E Run Report

## Summary

- Date:
- Codex task:
- App surface:
- Build/start command:
- Browser/device/simulator/OS:
- Feature or PR tested:
- Overall verdict: Pass / Pass with issues / Fail

## Tool Inventory

- Expo CLI:
- iOS Simulator:
- Android emulator:
- Expo web:
- Playwright:
- Playwright MCP:
- Codex Computer Use:
- Other:

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |

## Bugs Found

| ID  | Severity | Reproduction | Expected | Actual | Evidence |
| --- | -------- | ------------ | -------- | ------ | -------- |

## Tests Added or Updated

- Test file:
- What it covers:
- Why this should be automated:

## Commands Run

```bash
# paste commands and exit status
```

## Remaining Risk

- Untested flows:
- Missing fixtures:
- Flaky areas:
- Manual follow-up needed:
````

## Automated E2E Rules

When converting exploratory flows into tests:

- Automate critical user journeys first.
- Keep tests isolated with controlled state or fixtures.
- Test user-visible behavior, not implementation details.
- Prefer role, label, placeholder, text, and accessible-name locators where the surface supports them.
- Use accessibility identifiers or labels for native mobile automation.
- Avoid third-party services in E2E tests; mock or use safe local fixtures where possible.
- Capture traces, screenshots, or videos on failure.
- Keep E2E tests small enough to debug.
- Do not write durable E2E tests until the actual UI flow has been explored and the branch tree is known.

## Done Criteria For UI-Facing Work

A UI-facing task is done only when:

- The app was launched on the target surface.
- Codex performed at least one real user-like pass through the changed flow.
- Critical branches were tested or explicitly marked out of scope.
- Evidence was captured and paths were reported.
- Repeatable E2E tests were added for stable critical flows when the project supports them.
- Relevant unit/integration tests still pass.
- The final report lists commands run, results, bugs found, and remaining risks.

## Open Questions

- Which native E2E harness should OnSkin standardize on: Detox, Maestro, native XCTest/XCUIAutomation, Android UI Automator, or another tool?
- Which flows are safe to test against local fixtures without live Supabase, RevenueCat, Sentry, PostHog, Apple, or Google services?
- What test accounts, seed data, and local reset scripts should be used for onboarding, subscription, photo, recommendation, and account-deletion flows?
- Which Expo web routes should graduate from human-simulated evidence plus `e2e:human:manifest` into a committed Playwright suite after dependency approval?
