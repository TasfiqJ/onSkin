# E2E Bug Report: Floating Tab Bar Label Legibility

Severity: Medium
Surface: Expo web phone viewport
Environment: Expo web at `http://localhost:8093`, 320x568 and 390x844 viewport checks
Feature: Bottom tab navigation
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start Expo web with `npm --workspace apps/mobile run web -- --port 8093`.
2. Open `/today` at a 320x568 phone viewport.
3. Inspect the floating bottom tab bar and active Today tab.

## Expected Result

Today, Progress, Shelf, and You labels remain readable, centered, and visually aligned inside the floating tab bar on phone widths.

## Actual Result

The active tab used a heavy black full-item pill with white text. On the checked Expo web surface, the bottom-left development control could visually compete with the active Today treatment, making the selected tab text feel fragile and less readable than the rest of the app chrome.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/navigation/01-today-tabbar-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/navigation/01-today-tabbar-320x568-metrics.json`
- Terminal transcript: Expo web session on port `8093`

## Frequency

- Always on the checked active-tab state

## Scope

- Affected route/screen: `(tabs)` bottom navigation, observed on `/today`
- Affected account or fixture: Local Expo web fixture state
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The active state depended on a full black selected pill and white selected text. That made the label more sensitive to bottom-left visual overlap and heavier than the intended raised-paper app chrome.

## Minimal Fix Recommendation

Keep the floating raised capsule but move the selected state to a lighter treatment: dark selected icon/text, a subtle greige active surface, stable one-line labels, and 52+ px tab targets.

## Verification Flow After Fix

1. Reopen `/today` at 320x568 and inspect tab-bar label geometry.
2. Switch Today, Progress, Shelf, and You at 390x844 using the actual tab controls.
3. Confirm the selected tab updates and all labels remain visible.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/navigation/02-today-tabbar-fixed-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-07/navigation/390-today-selected.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/navigation/02-today-tabbar-fixed-320x568-metrics.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/navigation/390-tab-switching-results.json`

## Remaining Risk

- Untested branches: Native iOS and Android device Dynamic Type and OS-level keyboard behavior remain pending device QA.
- Missing fixtures: No native simulator/device was available in this Windows workspace.
- Follow-up needed: Run the same branch on physical iOS and Android builds before launch signoff.
