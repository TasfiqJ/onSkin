# E2E Bug Report: Community missing note split-short clearance

Severity: Medium
Surface: Expo web
Environment: Headless Chrome, 320 x 390 viewport, 120% scripted text pressure
Feature: Skin Notes stale note recovery
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Open `/community/note/missing-note-e2e` at 320 x 390 with 120% text pressure.
2. Inspect Back, stale-note copy, and `Back to Skin Notes`.

## Expected Result

The route explains the note is unavailable, keeps both navigation controls complete and hit-testable, and has no horizontal overflow.

## Actual Result

The compact stale-note layout needed a sub-410 px density band so the illustration and copy did not crowd the recovery action under text pressure.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/text-pressure-120-split-short-390-current/community-note-missing-note-e2e.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/text-pressure-120-split-short-390-current/community-note-missing-note-e2e.json`
- Route sweep report: `test-results/human-e2e/2026-07-08/text-pressure-120-split-short-390-current/report.md`

## Frequency

Always under the 320 x 390 / 120% text-pressure audit before the split-short density pass.

## Scope

- Affected route/screen: `/community/note/[id]` stale-note fallback.
- Affected account or fixture: Local missing-note fixture.
- External service involved: None.
- Destructive action involved: No.

## Suspected Cause

The missing-note fallback used the normal compact centered layout at split-short height, leaving nonessential illustration space in the first viewport.

## Minimal Fix Recommendation

Add a split-short mode that removes the decorative thumbnail, tightens copy spacing and type, and keeps `Back to Skin Notes` at a 48 px+ target.

## Verification Flow After Fix

1. Re-run the 320 x 390 / 120% text-pressure route audit.
2. Confirm `/community/note/missing-note-e2e` has zero clipped controls, blocked center hit-tests, sub-44 targets, text overflow, and horizontal overflow.

## Post-Fix Evidence

- `test-results/human-e2e/2026-07-08/text-pressure-120-split-short-390-current/report.md` records `Status: pass` and `Failed routes: 0 / 49`.
- `test-results/human-e2e/2026-07-08/text-pressure-120-split-short-390-current/community-note-missing-note-e2e.json` records `issueCount: 0`.

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, and hardware safe-area behavior remain device QA.
