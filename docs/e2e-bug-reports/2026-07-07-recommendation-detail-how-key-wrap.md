# E2E Bug Report: Recommendation Detail Evidence Key Wraps

Severity: Medium
Surface: Expo web phone viewport
Environment: `npm --workspace apps/mobile run web -- --port 8108`, 320 x 568 browser viewport
Feature: Personalized recommendation detail
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/recommendations/gap%3Amineral_spf` directly at a 320 x 568 phone viewport.
2. Inspect the `HOW WE DECIDED` explanation table.
3. Look at the left-hand evidence key.

## Expected Result

The recommendation detail should read like a polished trust surface. Short keys such as `profile`, `the gap`, `evidence`, `fit`, and `caveat` should stay legible on one line while values wrap in the right column.

## Actual Result

The `evidence` key wrapped as `evidenc` plus a trailing `e`, making the core explanation table look broken on compact phones.

## Evidence

- Pre-fix screenshot: `test-results/human-e2e/2026-07-07/recommendations-direct-entry/09-detail-spf-direct-320.png`
- Pre-fix route snapshot: `test-results/human-e2e/2026-07-07/recommendations-direct-entry/09-detail-spf-direct-320.json`
- Direct-entry route sweep: `test-results/human-e2e/2026-07-07/recommendations-direct-entry/01-hub-direct-320.png`, `02-preferences-direct-320.png`, `03-stale-detail-direct-320.png`

## Frequency

- Always for the checked recommendation detail at 320 px width.

## Scope

- Affected route/screen: `/recommendations/[id]` detail `HOW WE DECIDED` rows.
- Affected account or fixture: local Expo web recommendation fixture with `gap:mineral_spf`.
- External service involved: none.
- Destructive action involved: no.

## Suspected Cause

The left key column used a fixed 64 px width inside a flex row but was still allowed to shrink and wrap. On compact width, React Native web split the monospace `evidence` label.

## Minimal Fix Recommendation

Make the key column non-shrinking, give it enough width for the longest shipped key, and keep keys to one line while the explanation value continues to wrap.

## Verification Flow After Fix

1. Reload `/recommendations/gap%3Amineral_spf` at 320 x 568.
2. Confirm every `HOW WE DECIDED` key remains one-line.
3. Scroll to the action row.
4. Confirm `Add to shelf` and `Not for me` are each exposed as one button with no small targets or horizontal overflow.

## Post-Fix Evidence

- Screenshot before scroll: `test-results/human-e2e/2026-07-07/recommendations-direct-entry/10-detail-spf-fixed-320.png`
- Snapshot before scroll: `test-results/human-e2e/2026-07-07/recommendations-direct-entry/10-detail-spf-fixed-320.json`
- Screenshot of actions: `test-results/human-e2e/2026-07-07/recommendations-direct-entry/11-detail-spf-fixed-actions-320.png`
- Snapshot of actions: `test-results/human-e2e/2026-07-07/recommendations-direct-entry/11-detail-spf-fixed-actions-320.json`
- Contract test: `npm --workspace apps/mobile run test -- src/features/recommendations/recommendationRoutes.test.ts`

## Remaining Risk

- Untested branches: native iOS and Android Dynamic Type.
- Missing fixtures: no production catalog-backed specific-product detail in this pass.
- Follow-up needed: run the same detail card with large accessibility text on native devices before store submission.
