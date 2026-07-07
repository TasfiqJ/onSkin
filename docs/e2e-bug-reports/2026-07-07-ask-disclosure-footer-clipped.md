# E2E Bug Report: Ask disclosure footer clipped on compact phone

Severity: Medium
Surface: Expo web
Environment: Expo web at `http://127.0.0.1:8096`, browser viewport 320 x 568
Feature: Ask RoutineKind deterministic advisor
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/ask` on a 320 x 568 phone viewport.
2. Send or select a suggested Ask prompt so the composer and disclosure footer are visible at the bottom of the active chat screen.
3. Inspect the AI/privacy disclosure under the composer.

## Expected Result

The disclosure footer remains fully visible, legible, and above the bottom edge while the composer stays usable.

## Actual Result

The disclosure footer was clipped at the bottom edge on the compact phone screenshot, making the trust/privacy copy look partially hidden.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/current-compact-ux-sweep/ask-320x568.png`

## Frequency

- Always on the captured 320 x 568 active Ask state.

## Scope

- Affected route/screen: `/ask`
- Affected account or fixture: Local Expo web state with deterministic Ask enabled.
- External service involved: None.
- Destructive action involved: None.

## Suspected Cause

The Ask composer wrapper only reserved `pb-1` below the disclosure footer. On a short phone viewport, the disclosure wrapped to two lines and landed too close to the bottom edge.

## Minimal Fix Recommendation

Reserve compact-phone bottom spacing under the composer, add a little more scroll end padding, and use the normal muted text color for the disclosure.

## Verification Flow After Fix

1. Open `/ask` at 320 x 568.
2. Confirm the empty Ask state shows the composer and full disclosure footer.
3. Tap `Is there a conflict on my shelf?`.
4. Confirm the active Ask state still shows the full disclosure footer, with no horizontal overflow or bottom-clipped elements.
5. Tap Back and confirm direct-entry recovery returns to `/today`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/ask-disclosure-footer-clearance/ask-footer-after-320x568.png`
- UI snapshot/state: `test-results/human-e2e/2026-07-07/ask-disclosure-footer-clearance/ask-footer-after-320x568-state.json`
- Screenshot: `test-results/human-e2e/2026-07-07/ask-disclosure-footer-clearance/ask-footer-after-prompt-320x568.png`
- UI snapshot/state: `test-results/human-e2e/2026-07-07/ask-disclosure-footer-clearance/ask-footer-after-prompt-320x568-state.json`
- Logs: `test-results/human-e2e/2026-07-07/ask-disclosure-footer-clearance/ask-footer-browser-logs.json`
- UI snapshot/state: `test-results/human-e2e/2026-07-07/ask-disclosure-footer-clearance/ask-footer-after-back-state.json`

## Remaining Risk

- Native iOS and Android visual QA remains required for final device approval.
