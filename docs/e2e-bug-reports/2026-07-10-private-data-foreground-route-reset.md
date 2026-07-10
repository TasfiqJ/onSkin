# E2E Bug Report: Private-data retry reset the active route

Severity: High
Surface: Expo web; architecture also affected native navigator remounts
Environment: Windows, Chrome 150.0.7871.101, Playwright 1.61.1, Expo development build, 390 x 844
Feature: App-wide private-data availability gate
Date: 2026-07-10
Tester: Codex

## Reproduction Steps

1. Open `/shelf` with a valid encrypted private-KV envelope and the `foreground_once` storage fixture.
2. Simulate background then foreground so the shared readability audit fails.
3. Tap `Try again` after key access is restored.

## Expected Result

The gate re-audits encrypted storage, then reveals the same `/shelf` route and selected Shelf tab.

## Actual Result

The decrypt audit succeeded, but remounting the root navigator displayed the index onboarding screen instead of Shelf. The Playwright locator for `Shelf` timed out after 20 seconds; diagnostic body text began `Healthier skin in eight weeks`.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-10/private-data-availability-current/foreground-blocked-modern-390x844.png`
- Logs: pre-fix Playwright terminal assertion and diagnostic body snapshot; post-fix browser logs in `foreground-browser-logs.json`
- UI snapshot: post-fix `foreground-result.json` and `foreground-retry-outcome.json`
- Terminal transcript: pre-fix `locator.waitFor` timeout at `run-foreground.mjs:65`

## Frequency

- Always with the deterministic foreground fixture before the fix

## Scope

- Affected route/screen: any active route unmounted by the app-wide gate after a foreground failure
- Affected account or fixture: local seeded private envelope with `foreground_once`
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The gate correctly unmounted Offline Sync and navigation while private storage was unreadable, but a successful retry remounted the root `Stack` without restoring Expo Router's previous global href. The navigator therefore resolved its index route.

## Minimal Fix Recommendation

Capture Expo Router's normalized global href before background/lock. After a successful readability audit, remount navigation behind an inaccessible loading shield, replace the saved href, then reveal content. Keep persistent failures unmounted and non-destructive.

## Verification Flow After Fix

1. Reopen `/shelf` with the same valid encrypted seed and `foreground_once` fixture.
2. Background/foreground, confirm private recovery replaces Shelf and tabs, then tap `Try again`.
3. Confirm URL `/shelf`, Shelf content/tab restoration, zero overflow/vendor requests, and identical ciphertext/key hashes.

## Post-Fix Evidence

- Screenshot: `foreground-before-modern-390x844.png`, `foreground-blocked-modern-390x844.png`, `foreground-recovered-modern-390x844.png`
- Logs: `foreground-browser-logs.json`, `foreground-page-errors.json`, `foreground-vendor-requests.json`
- UI snapshot: `foreground-result.json`, `foreground-retry-outcome.json`
- Source commit: `4ca67a8e9f4ff30043fa44ea77a3eb631fd71d14`

## Remaining Risk

- Untested branches: exact-route restoration after real iOS Keychain and Android Keystore faults, including dynamic deep links and query parameters
- Missing fixtures: physical supported iOS and Android staging builds
- Follow-up needed: Tas native fault injection, VoiceOver/TalkBack, and named device/build signoff
