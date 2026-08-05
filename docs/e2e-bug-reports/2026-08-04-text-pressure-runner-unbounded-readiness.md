# E2E Bug Report: Text-pressure runner could hang before route interaction

Severity: Medium
Surface: Expo web / CLI
Environment: Windows Codex worktree; Expo web; headless Chrome; 390 x 844 viewport at 120% text pressure
Feature: PAY-08 iOS win-back no-offer fallback
Date: 2026-08-04
Tester: Codex

## Reproduction Steps

1. Run `scripts/e2e/text-pressure-route-audit.mjs` for `/paywall/winback` with Expo web on port 8308.
2. Observe that Expo reaches `Web Bundled` and listens successfully.
3. Observe that the runner produces no Chrome route artifact, summary, or terminal completion.

## Expected Result

The runner should either open Chrome and complete the route audit or fail within a declared readiness/command deadline and clean up its child processes.

## Actual Result

The outer polling deadlines did not abort an in-flight `fetch`, so one Expo or DevTools HTTP request could outlive the entire timeout. CDP socket setup and commands also had no response deadline. Chrome output was discarded, and the Windows `cmd -> npm -> Expo` wrapper could leave Metro alive after the wrapper was no longer a reliable process-tree owner.

## Evidence

- Screenshot: Not produced before the hang.
- Video: Not captured.
- Trace: Not captured.
- Logs: `test-results/human-e2e/2026-08-04/pay08-winback-no-offer-390x844-current/expo-web.log`
- UI snapshot: PAY-08 phone-size interaction was completed separately through the Codex in-app browser viewport capability.
- Terminal transcript: The original runner remained pending after Expo logged `Web Bundled`; no Chrome debugging listener or `summary.json` appeared.

## Frequency

- Once, then deterministically reproduced as bounded readiness failures while hardening the runner.

## Scope

- Affected route/screen: Any route audited by `scripts/e2e/text-pressure-route-audit.mjs`; discovered on `/paywall/winback`.
- Affected account or fixture: Local Expo-web free-user fixture.
- External service involved: None.
- Destructive action involved: None.

## Suspected Cause

`waitForUrl` and `readJson` checked elapsed time only between `fetch` attempts, but the requests and JSON body read had no `AbortSignal`. `CdpClient.ready` and `CdpClient.send` likewise waited indefinitely. The browser used ignored stdio, and Expo was launched through nested Windows command wrappers that weakened deterministic cleanup.

## Minimal Fix Recommendation

Give each HTTP request/body read a bounded abort deadline constrained by the overall poll deadline; reject readiness when Expo or Chrome exits; give CDP socket setup and every command a bounded deadline and reject pending calls on socket close/error; retain a browser failure log; and launch Expo's CLI directly with Node so the tracked child is the long-lived server process.

## Verification Flow After Fix

1. Run Node syntax and Prettier checks on the harness.
2. Re-run the isolated 390 x 844 `/paywall/winback` audit on fresh Expo and DevTools ports.
3. Confirm success or an actionable bounded error, a written `summary.json`, captured Expo/browser diagnostics, and no surviving listeners on the audit ports.
4. Confirm the separate Codex in-app-browser phone interaction still reaches the PAY-08 neutral no-offer fallback and standard Pro action.

## Post-Fix Evidence

- Screenshot: PAY-08 phone screenshots are retained by the parent PAY-08 in-app-browser verification flow; the failed headless bootstrap correctly produced none.
- Video: Not captured.
- Trace: Not captured.
- Logs: `test-results/human-e2e/2026-08-04/pay08-winback-no-offer-390x844-bounded-recheck-2/browser.log` captured the previously hidden Chrome GPU failure. `test-results/human-e2e/2026-08-04/pay08-winback-no-offer-390x844-bounded-recheck-4/` retains the final bounded Expo log, browser log, and failure summary.
- UI snapshot: PAY-08 phone interaction completed through the Codex in-app browser viewport capability.
- Terminal transcript: The final controlled recheck failed in approximately 19 seconds with `Timed out waiting for browser CDP method Page.enable`, wrote `summary.json`, and left no listener on its Expo or DevTools port. This is an actionable bounded environment failure rather than a hanging runner.

## Remaining Risk

- Untested branches: A passing full text-pressure sweep still depends on a headless Chrome runtime that can render in the execution environment.
- Missing fixtures: Physical iPhone Dynamic Type, VoiceOver, safe-area, keyboard, and StoreKit behavior are not proven by Expo web or the in-app browser.
- Follow-up needed: Re-run the full route sweep when headless Chrome is available; retain native-device PAY-08 evidence before claiming native/App Store readiness.
