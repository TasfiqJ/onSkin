# E2E Bug Report: Ask disclosure footer compact clearance

Severity: Low
Surface: Expo web
Environment: 320 x 568 phone viewport, Expo web
Feature: Ask Layerwell deterministic advisor
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start Expo web.
2. Open `/ask` at a 320 x 568 phone viewport.
3. Inspect the composer disclosure footer under the input bar.

## Expected Result

The AI/privacy disclosure footer remains fully legible with a comfortable bottom buffer on compact phones.

## Actual Result

The footer was visible but cramped against the bottom edge. Expo web geometry also showed the intended small mono class rendering at the default body font size, making the two-line footer feel heavier and tighter than the design intended.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/direct-route-audit/ask.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/ask-disclosure-footer-clearance/ask-footer-after-320x568-state.json`

## Frequency

- Always on the audited compact Expo web viewport.

## Scope

- Affected route/screen: `/ask`
- Affected account or fixture: local empty-shelf/default fixture
- External service involved: none
- Destructive action involved: no

## Suspected Cause

The footer reserved only the prior compact bottom padding and relied on a Tailwind arbitrary text-size class that did not win over the shared body text variant in the Expo web render.

## Minimal Fix Recommendation

Set the footer font size explicitly in the rendered style and increase the compact-phone bottom buffer without changing Ask copy or behavior.

## Verification Flow After Fix

1. Re-run `/ask` at 320 x 568.
2. Confirm the footer text remains fully visible with more than the previous 16 px bottom clearance.
3. Tap a suggested prompt and confirm the answer state keeps the footer visible.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/ask-disclosure-footer-polish/ask-home-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-07/ask-disclosure-footer-polish/ask-after-prompt-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/ask-disclosure-footer-polish/ask-home-320x568-state.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/ask-disclosure-footer-polish/ask-after-prompt-320x568-state.json`
- Console logs: `test-results/human-e2e/2026-07-07/ask-disclosure-footer-polish/browser-console-current-19012-errors.json`
- Console logs: `test-results/human-e2e/2026-07-07/ask-disclosure-footer-polish/browser-console-current-19012-warnings.json`

## Remaining Risk

- Untested branches: native iOS and Android visual rendering still need simulator/device QA.
- Missing fixtures: no populated-shelf Ask branch in this slice.
- Follow-up needed: consider a broader text-variant audit if more Expo web screens show arbitrary text-size overrides losing to default variants.
