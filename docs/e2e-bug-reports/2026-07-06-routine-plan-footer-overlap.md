# E2E Bug Report: Routine plan footer overlaps evening card on compact phones

Severity: Medium
Surface: Expo web
Environment: Expo web at 320x568 phone viewport
Feature: Routine plan first-value screen
Date: July 6, 2026
Tester: Codex

## Reproduction Steps

1. Start the mobile app on Expo web.
2. Set the browser viewport to 320x568.
3. Open `/onboarding/paywall`.
4. Tap `Explore first. 7 days of Pro`.
5. Inspect `/routine/plan` before tapping `Start today`.

## Expected Result

The generated plan content remains readable and scrollable above the fixed `Start today` CTA. The evening skin-cycling rows should not be partially covered by the footer.

## Actual Result

The fixed `Start today` CTA visually sat over the lower evening card content on the first compact viewport, partially hiding the recovery row and making the screen feel clipped.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/routine-plan-profile-label-rerun/routine-plan-example-after-explore-320.png`
- Video: N/A
- Trace: N/A
- Logs: `test-results/human-e2e/2026-07-06/routine-plan-profile-label-rerun/browser-warn-error-logs.json`
- UI snapshot: `test-results/human-e2e/2026-07-06/routine-plan-profile-label-rerun/routine-plan-example-after-explore-320.json`
- Terminal transcript: N/A

## Frequency

- Always on the tested 320x568 no-card routine-plan path before the fix.

## Scope

- Affected route/screen: `/routine/plan`
- Affected account or fixture: local development reverse-trial/example-routine state
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The routine plan route used a fixed footer but gave the scroll content only a small bottom padding. On Expo web, the scroll content could visually bleed behind the footer instead of clipping cleanly above it.

## Minimal Fix Recommendation

Clip the scroll region inside a flex wrapper, add enough bottom content clearance for the fixed CTA, and give the footer an opaque paper background.

## Verification Flow After Fix

1. Reload `/routine/plan` at 320x568.
2. Confirm the footer no longer overlays the evening card.
3. Scroll to the bottom and confirm the recovery row, gap note, and `Start today` CTA remain reachable.
4. Tap `Start today` and confirm Today opens.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/routine-plan-footer-overlap/routine-plan-fixed-final-first-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/routine-plan-footer-overlap/routine-plan-fixed-final-scrolled-bottom-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/routine-plan-footer-overlap/today-after-start-fixed-final-320.png`
- Video: N/A
- Trace: N/A
- Logs: `test-results/human-e2e/2026-07-06/routine-plan-footer-overlap/browser-warn-error-logs-final.json`
- UI snapshot: `test-results/human-e2e/2026-07-06/routine-plan-footer-overlap/summary-final.json`
- Terminal transcript: `npm --workspace apps/mobile run test -- src/features/subscription/proGatedRoutes.test.ts src/features/routine/usePlan.test.ts src/features/scheduler/profile.test.ts`, `npm --workspace apps/mobile run typecheck`, and `npm --workspace apps/mobile run lint` passed.

Post-fix result: Pass on Expo web at a 320x568 viewport. The first viewport ends on a complete evening skin-cycling card with the recovery row visible above the CTA. After a deliberate scroll, the SPF gap note is fully readable, and `Start today` routes to Today.

## Remaining Risk

- Untested branches: native iOS and Android rendering with larger Dynamic Type.
- Missing fixtures: saved real-profile fixture for the non-example label branch.
- Follow-up needed: include this route in a native short-phone release-device pass.
