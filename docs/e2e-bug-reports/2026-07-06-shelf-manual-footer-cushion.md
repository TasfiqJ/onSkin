# E2E Bug Report: Shelf manual add CTA flush to phone edge

Severity: Low
Surface: Expo web
Environment: Expo web at 320 x 568 phone viewport, localhost:8093
Feature: Shelf manual product intake
Date: 2026-07-06
Tester: Codex

## Reproduction Steps

1. Open `/shelf/manual` at a 320 x 568 phone viewport.
2. Observe the first viewport before scrolling.

## Expected Result

The fixed `Continue` CTA should be fully visible with bottom breathing room, and the PAO note above it should not look clipped.

## Actual Result

The CTA rendered flush with the viewport bottom, which made the rounded bottom edge read as clipped on the smallest phone viewport.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/final-cross-phone-sweep/manual-add-start-320x568.png`
- Geometry: `test-results/human-e2e/2026-07-06/final-cross-phone-sweep/manual-add-start-controls.json`

## Frequency

- Always on the tested 320 x 568 Expo web viewport.

## Scope

- Affected route/screen: `/shelf/manual`
- Affected account or fixture: local placeholder app state
- External service involved: none
- Destructive action involved: no

## Suspected Cause

The route rendered the bottom CTA directly as the final child of the safe-area screen. On web, the bottom safe-area inset is zero, so there was no visual cushion beneath the button.

## Minimal Fix Recommendation

Wrap the CTA in a small padded footer and tighten only the manual form's vertical spacing enough to keep the PAO note and CTA clean on 320 px phones.

## Verification Flow After Fix

1. Open `/shelf/manual` at 320 x 568.
2. Open the category picker.
3. Scroll to `Something else`.
4. Select it, fill Product name and Brand, and continue to `/shelf/opened`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/final-cross-phone-sweep/manual-add-compact-fixed-320x568.png`
- Picker screenshot: `test-results/human-e2e/2026-07-06/final-cross-phone-sweep/manual-category-picker-bottom-320x568.png`
- Completed form screenshot: `test-results/human-e2e/2026-07-06/final-cross-phone-sweep/manual-add-filled-other-320x568.png`
- Opened step screenshot: `test-results/human-e2e/2026-07-06/final-cross-phone-sweep/manual-add-opened-step-320x568.png`

## Remaining Risk

- Native iOS and Android hardware still need final device QA for keyboard animation and real safe-area insets.
