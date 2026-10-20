# E2E Bug Report: valid age submission did not reach consent

Severity: High (blocks the observed first-session web flow)
Surface: actual Expo web, headless installed Chrome, 390 x 844
Environment: Windows; Node22.21.0/npm11.20.0; unchanged accepted installed dependencies; development anonymous_owner fixture, unconfigured Supabase, synthetic local data only.
Feature: M1-01 adult eligibility / guest startup
Date: 2026-10-20
Tester: Codex

## Reproduction Steps

1. Run the existing `scripts/e2e/onboarding-first-session.mjs` with port8317, debug9417, viewport390x844, and the checkpoint evidence directory (exact invocation in the execution receipt).
2. Confirm Welcome is visible. Direct-entry Today correctly redirects to the age form with no Today content; return to Welcome and choose Begin.
3. Enter synthetic01/01/1990 through the visible labelled fields. Confirm Continue is enabled. Click Continue.

## Expected Result

The durable minimized adult receipt and guest owner commit complete, then the separate consent screen appears. No DOB is retained.

## Actual Result

The harness timed out waiting for `/onboarding/consent`. This is a failed surface execution, not a completed onboarding or Shelf pass. The harness tears down on failure without a post-click screenshot, so the final visible state and app/fixture/harness root cause remain unknown.

## Evidence

- Last pre-submit screenshot: `evidence/surface-390/03-age-filled.png`; inspected visually, valid synthetic fields and enabled Continue.
- Visible starting screen and direct-entry denial: `01-welcome.*`, `01a-direct-protected-age-gate.*` in the same directory.
- Failure transcript and bound receipt: `evidence/surface-run.txt`, `evidence/surface-390.receipt.json`.
- Expo process output: `evidence/surface-390/expo-web.log`.
- Measured source:71f313ddce12b618ecae2ade5402358c53c6f378, tree75963b8d0c0a538ba46a594bd98d9304badc7db1.

## Frequency / Scope

Observed once in this session. No live provider/account mutation; only synthetic local state. 375x667 and430x932 were not run after this blocker. No native/device equivalence is claimed.

## Suspected Cause / Minimal Fix Recommendation

Not established. Trace the fixture guest-owner commit and age receipt publication through the actual navigator swap, including possible inherited behavior and the age-gate health lease closure added here. First capture body, URL, console and screenshot inside the harness failure handler before teardown; compare the exact accepted baseline under the same local environment before assigning regression causality. Do not weaken any age/owner/consent gate to make navigation advance.

## Verification Flow After Fix / Remaining Risk

No fix or successful rerun is claimed. Required fresh-chat rotation at high context ends this partial checkpoint. Continue the same issued M1-01 task: reproduce, make the smallest demonstrated fix, rerun this exact390x844 path, then compact375x667 and modern430x932, adult/invalid/legacy/storage branches and the required Shelf/owner/privacy recovery matrix. Native and live-provider axes remain unperformed.
