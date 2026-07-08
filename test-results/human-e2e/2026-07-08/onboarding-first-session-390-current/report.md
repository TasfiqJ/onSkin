# Onboarding Goals 320x390 Footer Clearance

Surface: Expo web through Codex in-app browser
Viewport: 320 x 390
Date: 2026-07-08
Result: Pass after fix

## Bug

The pre-fix goals screen rendered the Sensitivity and Barrier repair cards visibly under the fixed Continue footer. Their centers were blocked by the footer at 320 x 390.

Evidence:

- `03-after-age.json`
- `03-after-age.png`

## Fix Verified

The post-fix split-short goals layout keeps all six goal cards fully above Continue. The formerly blocked Sensitivity card was tapped, selected, and the Continue action advanced to `/onboarding/consent`.

Post-fix evidence:

- `11-postfix-goals-320x390.json`
- `11-postfix-goals-320x390.png`
- `12-postfix-sensitivity-selected-320x390.json`
- `12-postfix-sensitivity-selected-320x390.png`
- `13-postfix-after-goals-continue-320x390.json`
- `13-postfix-after-goals-continue-320x390.png`

## Remaining Risk

Native iOS/Android safe-area, Dynamic Type, and physical-device checks remain release QA.
