# E2E Bug Report: Recommendations hub and preferences clip on 320 x 430 phones

Severity: Medium
Surface: Expo web
Environment: Expo web on localhost, 320 x 430 viewport
Feature: Personalized recommendations
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web and set the viewport to 320 x 430.
2. Open `/recommendations`.
3. Open `/recommendations/preferences`.
4. Inspect the visible recommendation cards and preference chips.

## Expected Result

Visible recommendation cards and preference chips are fully readable, at least 44 px tall/wide, and center hit-testable. Lower preference sections should either be fully visible or fully below the viewport until the user deliberately scrolls.

## Actual Result

The current-main 320 x 430 route sweep found the second `/recommendations` card partially clipped below the viewport and the `/recommendations/preferences` `Sustainable` chip peeking below the viewport with only about 36 px visible.

## Evidence

- Pre-fix sweep: `test-results/human-e2e/2026-07-08/current-main-short-phone-430-postfix-sweep/failures.json`
- Pre-fix route snapshots: `test-results/human-e2e/2026-07-08/current-main-short-phone-430-postfix-sweep/recommendations.json`, `test-results/human-e2e/2026-07-08/current-main-short-phone-430-postfix-sweep/recommendations-preferences.json`
- Post-fix screenshot/JSON packet: `test-results/human-e2e/2026-07-08/recommendations-ultrashort-430-current/`

## Frequency

Always in the tested 320 x 430 recommendation hub and preferences states.

## Scope

- Affected routes/screens: `/recommendations`, `/recommendations/preferences`
- Affected account or fixture: Local default recommendation fixture
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The sub-520 px recommendation density cleared 320 x 480 but still left too much vertical card and preference-chip content for 320 x 430. The preferences chip floor also relied only on class-generated min-height, which can render fractionally under 44 px or fail to update in the active web stylesheet when new arbitrary classes are introduced during a hot run.

## Minimal Fix Recommendation

Add sub-460 px density to the recommendation hub/card layout. For preferences, keep value and budget chips at a real 48 px inline min-height and push texture chips below the first viewport so they are reached by scroll instead of clipping.

## Verification Flow After Fix

1. Open `/recommendations` at 320 x 430.
2. Verify Back, Preferences, and visible recommendation cards are fully visible and center hit-testable.
3. Open `/recommendations/preferences` at 320 x 430.
4. Verify value/budget chips are 44 px or larger and texture chips do not peek as clipped targets.
5. Tap `Sustainable` and verify it becomes selected.

## Post-Fix Evidence

- Screenshot/JSON packet: `test-results/human-e2e/2026-07-08/recommendations-ultrashort-430-current/`
- Result: zero clipped controls, zero sub-44 controls, zero blocked center hit-tests, zero unexpected warn/error logs, and successful `Sustainable` chip selection.

## Remaining Risk

- Untested branches: Native iOS/Android safe-area, Dynamic Type, and screen-reader traversal at this height.
- Follow-up needed: Promote `/recommendations` and `/recommendations/preferences` 320 x 430 cases into the durable compact-phone E2E harness.
