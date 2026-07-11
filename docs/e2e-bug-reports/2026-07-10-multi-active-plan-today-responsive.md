# E2E Bug Report: Multi-Active Today Schedule Became Unreadable On Phones

Severity: High
Surface: Expo web
Environment: Codex in-app browser, Expo development build, 360 x 640 and 390 x 844
Feature: Canonical multi-active Plan and Today projection
Date: 2026-07-10
Tester: Codex

## Reproduction Steps

1. Build an explicit-clear profile and add two retinoids, AHA, BHA, benzoyl peroxide, hydroquinone, copper peptide, and routine basics.
2. Open Plan, tap `Start today`, and inspect Today PM at 360 x 640 and 390 x 844.
3. Open Today AM at 390 x 844 after the undefined-cadence notice is visible.

## Expected Result

Plan shows every canonical cycle product. Today shows a readable week-ahead strip, exactly tonight's active, and no control overlapping the floating tab bar.

## Actual Result

The first pass compressed all 17 cycle slots into the 360 px strip. Limiting it to seven revealed that one-line Exfoliate/Retinoid labels still ellipsized at 390 px. The new undefined-cadence notice also shifted the optional AM Tonight teaser into the floating-tab hit zone at 390 x 844.

## Evidence

- Screenshot: Pre-fix `today-pm-360x640.png`, `today-pm-390x844.png`, and `today-am-390x844.png` in `test-results/human-e2e/2026-07-10/multi-active-plan-today-current/`.
- UI snapshot: Matching `*-visible.txt` and `*-geometry.json` files in the same folder.
- Logs: `browser-warn-error-summary.json` reports zero browser errors.

## Frequency

- Always with the 17-night fixture at the tested viewports.

## Scope

- Affected route/screen: `/today?routine=AM` and `/today?routine=PM`.
- Affected account or fixture: Shelves producing long multi-active cycles and at least one undefined-cadence notice.
- External service involved: No.
- Destructive action involved: No.

## Suspected Cause

Today rendered the entire cycle rather than its existing seven-night projection, used one-line labels outside the shortest-phone band, and did not account for the additional notice height when deciding whether to render a secondary teaser.

## Minimal Fix Recommendation

Render `cycleData.weekAhead`, use two-line compact cycle labels below 430 px, and hide the secondary teaser on notice-bearing viewports below the first height where it clears the floating tab bar.

## Verification Flow After Fix

1. Reload Today PM at 360 x 640 and 390 x 844 and verify exactly seven readable strip labels.
2. Assert PM checkboxes contain stable basics plus exactly one canonical active.
3. Reload Today AM at 390 x 844 and verify no visible control intersects the tab zone.

## Post-Fix Evidence

- Screenshot: `today-pm-360x640-postfix.png`, `today-pm-390x844-postfix.png`, and `today-am-390x844-postfix.png`.
- UI snapshot: Matching post-fix text and geometry files.
- Terminal transcript: Updated Today route contract passed; full launch verification is recorded with the closing commit.

## Remaining Risk

- Untested branches: Native iOS/Android Dynamic Type, VoiceOver, and TalkBack.
- Missing fixtures: No 200% text-only in-app-browser fixture mutation was available for this persisted state.
- Follow-up needed: Physical supported-device QA and named cadence review.
