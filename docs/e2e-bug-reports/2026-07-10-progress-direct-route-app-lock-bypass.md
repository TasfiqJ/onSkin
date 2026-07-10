# E2E Bug Report: Direct Progress routes bypassed the photo-timeline lock

Severity: Critical
Surface: Mixed
Environment: Expo web route verification plus native-source privacy audit
Feature: Progress app lock
Date: 2026-07-10
Tester: Codex

## Reproduction Steps

1. Enable app lock and complete the app-wide unlock.
2. Do not complete the separate photo-timeline unlock on the Progress tab.
3. Open `/progress/capture`, `/progress/review?capturedUri=...`, or `/progress/[id]` directly.

## Expected Result

Every route that can expose a saved photo, note, reference ghost, camera surface, or captured review image requires the same photo-timeline unlock.

## Actual Result

The timeline gate and its in-memory unlocked state lived only inside `(tabs)/progress.tsx`. Direct capture, review, and detail routes mounted behind the Pro gate without the second photo-timeline authentication.

## Evidence

- Screenshot: Post-fix direct-route lock screenshots in `test-results/human-e2e/2026-07-10/progress-direct-route-lock-current/`.
- Video: Not recorded.
- Trace: Deterministic Playwright route/session scripts are stored with the evidence.
- Logs: `browser-logs.json` and `session-browser-logs.json`.
- UI snapshot: Eight route/viewport JSON snapshots plus four active-session snapshots.
- Terminal transcript: Locked direct-route E2E passed 8/8; shared unlock/background relock passed.

## Frequency

- Always before the fix when entering the nested Progress routes directly after the app-wide unlock.

## Scope

- Affected route/screen: `/progress/capture`, `/progress/review`, `/progress/[id]`; the tab gate itself was isolated.
- Affected account or fixture: Any user who enabled app lock.
- External service involved: OS LocalAuthentication for the native prompt.
- Destructive action involved: No; privacy exposure risk.

## Suspected Cause

Photo-timeline authentication state was component-local instead of provider-owned, and nested Progress screens did not share a route-level gate.

## Minimal Fix Recommendation

Move timeline unlock state into `AppLockProvider`, reset it when the app leaves the foreground, gate all sensitive Progress screen bodies inside their Pro gates, and do not mount the app tree until the encrypted lock preference resolves.

## Verification Flow After Fix

1. Cold-open each sensitive route with global auth success and timeline auth canceled.
2. Verify only the common timeline lock renders and sensitive route markers remain absent.
3. Authenticate once, navigate Progress to detail and capture without another timeline prompt, then background/foreground and verify the lock returns.

## Post-Fix Evidence

- Screenshot: 12 PNGs in `test-results/human-e2e/2026-07-10/progress-direct-route-lock-current/`.
- Video: Not recorded.
- Trace: `run-locked.mjs` and `run-session.mjs`.
- Logs: Zero disallowed browser errors, dialogs, page errors, analytics requests, or photo-backend requests.
- UI snapshot: Unlock target is 52 px; all checked routes have zero horizontal overflow.
- Terminal transcript: Focused tests, typecheck, lint, and both browser harnesses pass.

## Remaining Risk

- Untested branches: Physical iOS/Android biometric prompt ordering and true OS background/foreground transitions.
- Missing fixtures: VoiceOver/TalkBack focus restoration after authentication.
- Follow-up needed: Tas must execute the physical-device matrix in `docs/FOR_TAS_TO_DO.md`.
