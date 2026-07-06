# E2E Bug Report: Today SPF Prompt Overlaps Floating Tab Bar

Severity: Medium
Surface: Expo web
Environment: Expo web at 320 x 568 phone viewport, July 6, 2026
Feature: Today routine completion / recommendation SPF gap prompt
Date: 2026-07-06
Tester: Codex

## Reproduction Steps

1. Start Expo web for the mobile app.
2. Open `http://localhost:8085/today` at a 320 x 568 viewport.
3. Inspect the Today screen with a missing-SPF recommendation.

## Expected Result

The SPF gap prompt remains advisory and actionable, with `See why` and dismiss controls visible above the floating tab bar.

## Actual Result

The compact Today routine rows allowed the SPF prompt action row to render underneath the floating tab bar. The `See why` and `Not now` controls were partially off-screen or visually occluded on first render.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/today-spf-compact-banner/before-320.png`
- UI snapshot: `See why` and `Not now` bottoms measured at `603.7`, while the tab bar started at `494.9`.

## Frequency

- Always on the tested 320 x 568 returning-user Today fixture.

## Scope

- Affected route/screen: `/today`
- Affected account or fixture: Local returning-user fixture with missing SPF recommendation
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The short-phone Today layout compacted surrounding surfaces but left routine step instructions wrapping to full-height rows and reused the full SPF prompt card with a bottom action row.

## Minimal Fix Recommendation

Keep routine step instructions to one line in compact Today mode and render the compact SPF gap prompt as a short inline banner with 48 px `See why` and dismiss targets.

## Verification Flow After Fix

1. Reload `http://localhost:8085/today` at 320 x 568.
2. Confirm the compact SPF prompt renders as a short banner.
3. Measure `See why`, dismiss, and tab bar geometry.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/today-spf-compact-banner/after-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/today-spf-compact-banner/see-why-detail-320.png`
- UI snapshot: `See why` bottom `420.8`, dismiss bottom `415.7`, tab bar top `494.9`, horizontal overflow `0`, mojibake `false`.
- Interaction: `See why` opened `/recommendations/routine_completion:mineral_spf`; browser back returned to `/today`.

## Remaining Risk

- Untested branches: Native iOS and Android physical-device rendering.
- Missing fixtures: Standard reset command for returning-user Today fixture.
- Follow-up needed: Promote the Today SPF prompt small-phone branch to durable E2E when the native harness is selected.
