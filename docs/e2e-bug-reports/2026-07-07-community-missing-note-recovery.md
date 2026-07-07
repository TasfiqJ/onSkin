# E2E Bug Report: Missing Skin Note detail looked like a dead end

Severity: Medium
Surface: Expo web
Environment: Compact direct-entry route at 320 x 568; local source audit
Feature: Community Skin Note detail
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open a stale Skin Note detail URL such as `/community/note/missing-note-e2e`.
2. Inspect the missing-note state.
3. Try to recover without relying on browser or native navigation history.

## Expected Result

The user sees clear note-unavailable copy, understands the note may have been updated or removed during expert review, and can return to the Skin Notes library with an explicit action.

## Actual Result

The route rendered `This note isn’t available right now.` as a centered muted sentence with only the top Back icon. That was technically recoverable, but it read like a broken direct-entry page.

## Evidence

- Source route: `apps/mobile/src/app/community/note/[id].tsx`
- User-flow branch: `docs/USER_FLOW_TREE.md` Community missing note detail

## Frequency

- Always when the requested note ID is not present in the shippable Skin Notes corpus.

## Scope

- Affected route/screen: `/community/note/[id]`
- Affected account or fixture: Users opening stale, removed, or no-longer-reviewed Skin Note links
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The route treated missing expert content as a minimal internal empty state instead of a full direct-entry recovery state.

## Minimal Fix Recommendation

Use a polished note-unavailable state with expert-review context, keep the state scrollable on short phones, and provide a visible `Back to Skin Notes` action that routes to `/community`.

## Verification Flow After Fix

1. Open `/community/note/missing-note-e2e`.
2. Confirm the screen says `Note unavailable` and explains the note may have been updated or removed during expert review.
3. Confirm `Back to Skin Notes` routes to `/community`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/community-missing-note-recovery/community-missing-note-320x568.png`
- Geometry audit: `test-results/human-e2e/2026-07-07/community-missing-note-recovery/community-missing-note-audit.json`
- Click evidence: `test-results/human-e2e/2026-07-07/community-missing-note-recovery/community-missing-note-clicks.json`
- Focused route contract: `npm.cmd --workspace apps/mobile run test -- src/features/community/communityRoutes.test.ts`

## Remaining Risk

- Native iOS and Android device rendering still need the final release-device pass.
