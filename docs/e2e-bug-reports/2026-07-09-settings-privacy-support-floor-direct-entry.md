# E2E Bug Report: Settings privacy support-floor direct-entry clipping

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser, Expo web on `http://localhost:8255`, 390 x 844 and 320 x 480 viewports
Feature: Settings privacy direct entry
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Start Expo web and open `/settings/privacy`.
2. Set the viewport to 390 x 844.
3. Inspect visible controls around the floating tab bar.
4. Repeat at the 320 x 480 launch support-floor viewport.

## Expected Result

The direct privacy entry resolves to `/you?section=privacy`; the first visible privacy controls are complete, readable, 44 px or taller, center-hit-testable, and clear of the floating tab bar. Lower-priority policy/data-rights rows either appear completely after scroll or remain fully below the first viewport.

## Actual Result

At 390 x 844, the first policy row was positioned just below the visible screen but still extended into the floating tab-bar zone and failed the geometry audit as clipped and center-blocked. At 320 x 480, the direct-entry scroll overshot the privacy card, clipping the `Marketing emails` switch above the viewport.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/routine-analytics-layout-current/03-settings-privacy-390x844.jpg`
- Screenshot: `test-results/human-e2e/2026-07-09/routine-analytics-layout-current/04-settings-privacy-320x480-floor.jpg`
- UI snapshot: `test-results/human-e2e/2026-07-09/routine-analytics-layout-current/03-settings-privacy-390x844.json`
- UI snapshot: `test-results/human-e2e/2026-07-09/routine-analytics-layout-current/04-settings-privacy-320x480-floor.json`

## Frequency

Always in the tested direct-entry states before the fix.

## Scope

- Affected route/screen: `/settings/privacy`, redirected to `/you?section=privacy`
- Affected account or fixture: local placeholder/backend-unavailable state
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The direct-entry scroll nudge and below-card policy spacer were tuned for earlier compact viewports. After the support-floor policy made 320 x 480 the launch-blocking floor, the narrow-short nudge was too large for that floor, while the policy spacer was still too small for the 390 x 844 first viewport with the floating tab bar present.

## Minimal Fix Recommendation

Reduce the narrow-short direct-entry scroll nudge for the 320 x 480 floor and increase the compact direct-entry policy spacer so policy rows start fully below the first viewport.

## Verification Flow After Fix

1. Re-open `/settings/privacy` at 390 x 844.
2. Re-open `/settings/privacy` at 320 x 480.
3. Run the focused route sweep for Today, Settings Privacy, Recommendation Preferences, Shelf scan/no-match, and Routine Plan across supported-floor and modern-phone viewports.

## Post-Fix Evidence

- Screenshot/UI snapshot: `test-results/human-e2e/2026-07-09/routine-analytics-layout-current/09-settings-privacy-390x844-rerun.jpg`
- Screenshot/UI snapshot: `test-results/human-e2e/2026-07-09/routine-analytics-layout-current/10-settings-privacy-320x480-floor-rerun.jpg`
- Final focused summary: `test-results/human-e2e/2026-07-09/routine-analytics-layout-current/support-floor-summary-final.json`

## Remaining Risk

- Untested branches: native iOS/Android Dynamic Type, VoiceOver/TalkBack traversal, keyboard state, and hardware safe-area combinations.
- Missing fixtures: physical supported iOS 17+ and Android 10+ devices.
- Follow-up needed: keep Phase 5 native device QA as the final proof for platform-specific rendering.
