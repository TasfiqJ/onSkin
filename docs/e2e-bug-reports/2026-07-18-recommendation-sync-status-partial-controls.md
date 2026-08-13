# E2E Bug Report: Recommendation sync status exposes partial budget controls

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser, actual Expo web development build, requested 390 x 844 viewport (observed 390 x 845)
Feature: Recommendation preference convergence status
Date: 2026-07-18
Tester: Codex

## Reproduction Steps

1. Open `/recommendations/preferences` with the syncing outbox fixture.
2. Inspect the bottom edge of the first viewport without scrolling.

## Expected Result

Every visible interactive control is either fully presented or wholly below the fold.

## Actual Result

The top 3.18 px of the 48 px `Drugstore`, `Mid-range`, and `Premium` budget controls appeared at the viewport bottom (`top=841.82`, `bottom=889.82`).

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-18/recommendation-outbox-status-current/syncing-390x844.png`
- UI measurement: `test-results/human-e2e/2026-07-18/recommendation-outbox-status-current/metrics.json`

## Frequency

- Always

## Scope

- Affected route/screen: `/recommendations/preferences`
- Affected account or fixture: syncing recommendation outbox fixture
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The newly inserted sync-status leaf increased the route's first-viewport content height without adding clearance before the existing budget section.

## Minimal Fix Recommendation

Reserve additional bottom margin only when the status leaf is rendered, keeping the next control group wholly below the fold.

## Verification Flow After Fix

1. Reopen the syncing fixture at 390 x 844.
2. Measure all visible controls and horizontal overflow.
3. Confirm the budget controls are wholly below the fold until the user scrolls.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-18/recommendation-outbox-status-current/syncing-postfix-390x844.png`
- UI measurement: zero partial controls, zero sub-44 controls, zero blocked center hit tests, and zero horizontal overflow.
- Logs: no application errors or JavaScript dialogs.

## Remaining Risk

- Untested branches: native iOS layout and text-pressure variants for the new status leaf
- Missing fixtures: signed-native outbox transitions
- Follow-up needed: retain the normal supported-device native accessibility/layout pass
