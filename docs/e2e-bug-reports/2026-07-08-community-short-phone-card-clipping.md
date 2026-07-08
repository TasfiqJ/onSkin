# E2E Bug Report: Community short-phone card clipping

Severity: Medium
Surface: Expo web
Environment: 320 x 480 phone viewport, local Expo web
Feature: Skin Notes community trust layer
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start the mobile app on Expo web.
2. Open `/community` at a 320 x 480 phone viewport.
3. Inspect the visible Skin Note cards in the first viewport.

## Expected Result

Visible Skin Note cards should be fully readable and tappable. Back and Ask should remain 44 pt or larger, the route should have no horizontal overflow, and the expert-led library should not resemble a social feed.

## Actual Result

The third Skin Note card was visible but clipped below the viewport. The pre-fix geometry snapshot recorded `Is "natural" always gentler for sensitive skin?` as a clipped visible control with about 75 px of its 102 px height visible.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/current-main-short-phone-480-sweep/community.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/current-main-short-phone-480-sweep/community.json`

## Frequency

- Always on the tested 320 x 480 Skin Notes hub state.

## Scope

- Affected route/screen: `/community`
- Affected account or fixture: Local default Skin Notes fixture
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The existing compact Skin Notes density targeted shorter 568 px phones but still left the 320 x 480 viewport with too much heading, section-label, card-padding, and copy-leading height to show the third visible note card cleanly.

## Minimal Fix Recommendation

Add a sub-520 px Skin Notes hub density that trims heading, section, card, title, evidence-pill, and summary spacing while preserving readable copy and 44 pt or larger navigation controls.

## Verification Flow After Fix

1. Reopen `/community` at 320 x 480.
2. Confirm Back and Ask remain visible 44 pt or larger.
3. Confirm visible Skin Note cards are not clipped.
4. Confirm tapping a visible Skin Note opens the note detail.
5. Confirm horizontal overflow is zero and no JavaScript dialog appears.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/community-short-phone-480-card-fit/community.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/community-short-phone-480-card-fit/community.json`
- Report: `test-results/human-e2e/2026-07-08/community-short-phone-480-card-fit/report.md`

## Remaining Risk

- Untested branches: Native iOS/Android safe-area, Dynamic Type, and screen-reader pass.
- Missing fixtures: Durable native visual regression for the Skin Notes hub.
- Follow-up needed: Promote this shortest-phone hub case into the eventual native compact-phone E2E suite.
