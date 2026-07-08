# E2E Bug Report: Skin Note share failure lacks durable route feedback

Severity: Medium
Surface: Expo web
Environment: In-app browser, 320 x 568, `EXPO_PUBLIC_E2E_SHARE_NOTE_FAILURE=1`, local Expo web on port 19149
Feature: Skin Notes Community Trust Layer
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with `EXPO_PUBLIC_E2E_SHARE_NOTE_FAILURE=1`.
2. Open `/community/note/note-niacinamide-vitc`.
3. Tap `Share note`.

## Expected Result

The user remains on the Skin Note route and gets clear failed-share recovery feedback on the app surface, while the share helper keeps claim-safe outbound copy and source/reviewer context.

## Actual Result

Before the fix, the route fired `shareSkinNote(note)` without awaiting its result, so a failed native share could only rely on transient platform alert behavior and did not leave durable route-local recovery feedback.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/community-note-share-failure-current/01-before-share.png`
- Screenshot: `test-results/human-e2e/2026-07-08/community-note-share-failure-current/02-after-share-failure.png`
- Logs: `test-results/human-e2e/2026-07-08/community-note-share-failure-current/browser-logs.json`
- UI snapshot: `test-results/human-e2e/2026-07-08/community-note-share-failure-current/starting-state.json`

## Frequency

- Always when the share sheet is unavailable or rejected.

## Scope

- Affected route/screen: `/community/note/[id]`
- Affected account or fixture: Local dev fixture `EXPO_PUBLIC_E2E_SHARE_NOTE_FAILURE=1`
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The route treated note sharing as fire-and-forget and did not consume the boolean result returned by `shareSkinNote`, so the screen could not render persistent failure state.

## Minimal Fix Recommendation

Await `shareSkinNote(note)`, clear stale share feedback before each attempt, and render route-local accessible feedback when the helper returns `false`.

## Verification Flow After Fix

1. Start Expo web with `EXPO_PUBLIC_E2E_SHARE_NOTE_FAILURE=1`.
2. Open `/community/note/note-niacinamide-vitc`.
3. Tap `Share note` and confirm the route stays on the note with visible failed-share feedback.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/community-note-share-failure-current/02-after-share-failure.png`
- Logs: `test-results/human-e2e/2026-07-08/community-note-share-failure-current/browser-logs.json`
- UI snapshot: `test-results/human-e2e/2026-07-08/community-note-share-failure-current/after-state.json`

## Remaining Risk

- Untested branches: Native iOS/Android OS share-sheet cancellation and share-target errors.
- Missing fixtures: Device-level native share sheet failure injection.
- Follow-up needed: Native simulator/device QA before launch.
