# E2E Bug Report: Skin Note share failure opened a native alert before route feedback

Severity: Medium
Surface: `/community/note/[id]`
Environment: Expo web, 320px phone viewport, `EXPO_PUBLIC_E2E_SHARE_NOTE_FAILURE=1`
Feature: Skin Notes Community Trust Layer
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with `EXPO_PUBLIC_E2E_SHARE_NOTE_FAILURE=1`.
2. Open `/community/note/note-niacinamide-vitc`.
3. Tap `Share note`.

## Expected Result

The user stays on the Skin Note route and sees one clear route-owned recovery message. The failed share must not also open a blocking native or JavaScript alert, because the route already owns persistent accessible feedback.

## Actual Result

The route rendered durable `accessibilityRole="alert"` feedback, but `shareSkinNote` still called `Alert.alert` in its catch path before returning `false`. On web-compatible E2E surfaces this can create a duplicate or blocking recovery layer on top of the polished app surface.

## Suspected Cause

The share helper mixed transport behavior with UI recovery. Earlier route work consumed the helper's boolean result, but the helper retained its legacy platform alert.

## Fix

Remove `Alert.alert` from `shareSkinNote`. The helper now returns `false` on native-share failure, and `/community/note/[id]` remains responsible for route-local accessible feedback.

## Post-Fix Evidence

- Unit/contract test: `apps/mobile/src/features/community/shareNote.test.ts`
- Route contract test: `apps/mobile/src/features/community/communityRoutes.test.ts`
- E2E rerun: `test-results/human-e2e/2026-07-08/community-note-native-alert-current/`
- Result: The failed-share recovery copy renders as the only alert, no JS dialog is active, both action controls remain 48 px tall and fully visible, and horizontal overflow is zero at 320 px.

## Remaining Risk

- Native iOS/Android OS share-sheet cancellation and rejected target errors still need device QA before launch.
