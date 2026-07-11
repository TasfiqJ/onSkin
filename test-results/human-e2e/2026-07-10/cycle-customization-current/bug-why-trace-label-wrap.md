# E2E Bug Report: Custom Provenance Tag Wrapped

Severity: Low
Surface: Expo web
Environment: 390 x 844
Feature: Why Tonight Custom reconciliation
Date: 2026-07-10
Tester: Codex

## Reproduction Steps

1. Save two authored Glycolic occurrences in an 8-night cycle with a 1/week applied cap.
2. Open Why Tonight for the cadence-reconciled second occurrence.

## Expected Result

The `CUSTOM` trace tag remains on one line beside the explanation.

## Actual Result

The fixed 56 px trace column wrapped `CUSTOM` after its fifth character.

## Evidence

- Before: `why-tonight-cadence-cap-before-tag-fix-390x844.png`
- Frequency: Always at the tested width
- Affected route: `/cycle/why-tonight`
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The trace tag column was too narrow for six mono characters under web font metrics.

## Minimal Fix Recommendation

Use a stable 68 px trace-label column.

## Verification Flow After Fix

1. Reopen the same cadence-reconciled night at 390 x 844.
2. Inspect the tag and explanation for wrapping or overlap.

## Post-Fix Evidence

- Screenshot: `why-tonight-cadence-cap-390x844.png`
- Result: `CUSTOM` remains on one line with no overlap.

## Remaining Risk

- Native Dynamic Type and screen-reader layouts remain release-device QA.
