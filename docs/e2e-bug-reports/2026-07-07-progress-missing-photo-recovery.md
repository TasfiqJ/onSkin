# E2E Bug Report: Missing progress photo detail looked dead

Severity: Medium
Surface: Expo web
Environment: Compact direct-entry route sweep and app-surface verification at 320 x 568; local source audit
Feature: Progress single-photo detail
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open a stale direct photo detail URL such as `/progress/missing-photo`.
2. Inspect the missing-photo state.
3. Try to recover without relying on browser or native navigation history.

## Expected Result

The user sees clear photo-unavailable copy and visible recovery actions such as `Take a new photo` and `Back to Progress`, with phone-sized touch targets.

## Actual Result

The route rendered a sparse `Photo not found.` message with only the top icon exit. On a paid, privacy-sensitive Progress surface, that reads like a broken dead end.

## Evidence

- Pre-fix route sweep: `test-results/human-e2e/2026-07-07/direct-entry-compact-sweep-8099/summary.json`
- Source route: `apps/mobile/src/app/progress/[id].tsx`
- User-flow branch: `docs/USER_FLOW_TREE.md` Photo Progress direct-entry back, close, and permission escape

## Frequency

- Always when the local photo timeline does not contain the requested `id`.

## Scope

- Affected route/screen: `/progress/[id]`
- Affected account or fixture: Pro users or reverse-trial users opening stale/local-only progress photo links
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The route treated the missing photo as an internal fallback instead of a full direct-entry recovery state. The implementation returned only a centered status string after the top route icon.

## Minimal Fix Recommendation

Use the central photo copy module for a polished missing-detail state, keep a direct Back to Progress route, add a Take a new photo path, and make both visible actions at least 56 px tall.

## Verification Flow After Fix

1. Open `/progress/missing-photo`.
2. Confirm the screen says `Photo unavailable` and explains that the photo is no longer on this phone.
3. Confirm `Take a new photo` routes to `/progress/capture`.
4. Confirm `Back to Progress` routes to the Progress tab.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/progress-missing-photo-recovery-320x568.png`
- UI snapshot: Browser-visible text showed `Photo unavailable`, `This photo is no longer on this phone.`, `Take a new photo`, and `Back to Progress`.
- Route action: `Take a new photo` routed to `/progress/capture`.
- Route action: `Back to Progress` routed to `/progress`.
- Focused route contract: `npm.cmd --workspace apps/mobile run test -- src/features/photos/progressRoutes.test.ts`

## Remaining Risk

- Native iOS and Android device rendering still need the final release-device pass.
