# Shelf Empty Compact Evidence

Date: 2026-07-08

Surface: Expo web in the Codex in-app browser, `http://localhost:8171/shelf?e2e=shelf-empty-compact-current`

Viewport: requested 320 x 568, runtime reported 320 x 569.

Scenario: Open the Shelf tab on a fresh Expo web port with no active or archived shelf items.

Result:

- Empty Shelf first viewport shows `Shelf`, `empty for now`, the bottle illustration, `Let's build your cabinet.`, the helper copy, `Scan a barcode`, `Add by hand`, and the floating tab bar.
- Document horizontal overflow is `0`; document/body scroll width stays at 320 px.
- Visible controls meet the 44 px target: `Scan a barcode` is 256 x 56, `Add by hand` is 256 x 50, and each tab item is 76 x 54.
- Add actions and tab bar are within the viewport; the bottom tab bar does not cover either empty-state action.
- No JavaScript dialog is present.
- Current-origin warn/error logs are empty. The log artifact retains stale warnings from previous localhost ports separately for traceability.

Artifacts:

- `shelf-empty-compact-320x568.png`
- `geometry.json`
- `browser-logs.json`
