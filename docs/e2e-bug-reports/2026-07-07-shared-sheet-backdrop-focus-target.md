# E2E Bug Report: Shared sheet backdrops exposed tiny focus targets

Severity: Medium
Surface: Expo web phone-width proxy for iOS and Android
Environment: Expo web at `http://127.0.0.1:8123`, 320 x 568 viewport
Feature: Shared bottom sheets
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/shelf/no-match` at 320 x 568.
2. Inspect the shared sheet dialog, visible controls, and hidden backdrop strip.
3. Repeat with compact `/cycle/disruption`.

## Expected Result

Sheets that set `backdropAccessible={false}` should expose a visible route exit or choice, not a tiny unlabeled backdrop. Hidden backdrop strips should not be focusable or announced. Native bottom safe-area padding should not override compact web sheet density when the web inset is zero.

## Actual Result

The small-phone browser audit found the hidden top backdrop strip still rendered with `tabIndex=0`, creating an unlabeled 12 px focus target on `/shelf/no-match` and a 46 px focus target on `/cycle/disruption`. Source review also showed that always applying `paddingBottom` through the style prop would override compact sheet `pb-6` / `pb-8` web density even when there was no bottom safe-area inset.

## Evidence

- Current app-surface evidence folder: `test-results/human-e2e/2026-07-07/shared-sheet-safe-area-current/`
- Focused route contracts: `npm --workspace apps/mobile run test -- src/features/navigation/sheetRouteContracts.test.ts src/features/subscription/paywallMobileContracts.test.ts src/features/subscription/proGatedRoutes.test.ts src/features/shelf/shelfRoutes.test.ts`

## Frequency

- Always on shared `Sheet` routes with `backdropAccessible={false}` before the fix.

## Scope

- Affected route/screen: shared `Sheet` surfaces, including Shelf, cycle, routine, and upsell sheets.
- Affected account or fixture: any user entering those sheet routes.
- External service involved: No.
- Destructive action involved: No.

## Suspected Cause

React Native web kept the `Pressable` backdrop focusable because it still had an `onPress`, even when `accessible={false}` and `focusable={false}` were set. The safe-area hardening also needed to avoid style-prop padding on zero-inset web surfaces so route-level compact padding utilities remained effective.

## Minimal Fix Recommendation

Set non-accessible backdrop strips to `aria-hidden`, `tabIndex=-1`, `accessibilityElementsHidden`, and `importantForAccessibility="no"`, while retaining the pointer backdrop dismiss behavior. Apply bottom safe-area padding only when `useSafeAreaInsets().bottom` is greater than zero.

## Verification Flow After Fix

1. Open `/shelf/no-match` at 320 x 568.
2. Confirm exactly one modal dialog, a 48 px Close action, zero horizontal overflow, no sub-44 exposed controls, and the hidden backdrop has `aria-hidden=true` plus `tabIndex=-1`.
3. Tap Close and confirm the route returns to `/shelf`.
4. Open `/cycle/disruption` at 320 x 568.
5. Confirm exactly one modal dialog, all four disruption choices, zero horizontal overflow, no sub-44 exposed controls, hidden backdrop `aria-hidden=true` plus `tabIndex=-1`, and compact web bottom padding remains 24 px.

## Post-Fix Evidence

- Screenshots:
  - `test-results/human-e2e/2026-07-07/shared-sheet-safe-area-current/01-shelf-no-match-sheet-320x568.png`
  - `test-results/human-e2e/2026-07-07/shared-sheet-safe-area-current/02-shelf-after-close-320x568.png`
  - `test-results/human-e2e/2026-07-07/shared-sheet-safe-area-current/03-cycle-disruption-compact-sheet-320x568.png`
- UI snapshots:
  - `test-results/human-e2e/2026-07-07/shared-sheet-safe-area-current/01-shelf-no-match-sheet-320x568.json`
  - `test-results/human-e2e/2026-07-07/shared-sheet-safe-area-current/02-shelf-after-close-320x568.json`
  - `test-results/human-e2e/2026-07-07/shared-sheet-safe-area-current/03-cycle-disruption-compact-sheet-320x568.json`
- Summary: `test-results/human-e2e/2026-07-07/shared-sheet-safe-area-current/summary.json`
- Logs: `test-results/human-e2e/2026-07-07/shared-sheet-safe-area-current/browser-warn-error-logs.json`

## Remaining Risk

- Untested branches: native iOS/Android safe-area rendering, VoiceOver/TalkBack traversal, and gesture-navigation touch behavior.
- Missing fixtures: physical device or simulator screen-reader automation.
- Follow-up needed: Tas must include shared bottom sheets in native device QA before public launch.
