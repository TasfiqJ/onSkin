# E2E Bug Report: 320 x 390 / 150% split-short text-pressure clearance

Severity: Medium
Surface: Expo web
Environment: Headless Chrome, Expo web, 320 x 390 viewport, 150% text pressure
Feature: Recommendations preferences, settings notifications, Shelf manual add, Shelf scan/no-match fallback, Ask, Community, floating tab bar labels/web warning
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start the Expo web text-pressure route audit at 320 x 390.
2. Let the audit scale visible route text to 150%.
3. Inspect visible controls for clipping, sub-44 px visible targets, blocked center hit-tests, text overflow, horizontal overflow, and disallowed browser warnings.

## Expected Result

Visible controls remain fully readable, hit-testable, and at least 44 px tall where applicable. Lower-priority controls may sit below the first viewport on a split-short phone, but no partial controls should peek into view.

## Actual Result

The 320 x 390 / 150% audit exposed split-short failures that were not present in the 320 x 568 or 320 x 430 passes:

- `/recommendations/preferences` let the `Non-comedogenic` and `Sustainable` value chips peek into the bottom of the first viewport as partial targets.
- `/settings/notifications` initially let the `Progress-photo nudge` switch peek into the first viewport.
- `/shelf/manual` let the optional Ingredients textarea sit under the fixed Continue footer.
- `/shelf/scan` forced `Scan ingredient label` onto one line in the compact fallback row, causing text overflow.
- Follow-up polish shortened Shelf no-match and Ask visible copy, aligned Shelf skeleton filter labels with loaded compact labels, pushed later Community sections below the narrow first viewport, and shortened the narrow Progress tab label while preserving full accessibility labels.
- The preferences route also surfaced a React Native Web pointer-events deprecation warning inherited from rendered UI chrome.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/text-pressure-150-split-short-390-postfix-4/`
- Logs: `test-results/human-e2e/2026-07-08/text-pressure-150-split-short-390-postfix-4/expo-web.log`
- UI snapshot: `test-results/human-e2e/2026-07-08/text-pressure-150-split-short-390-postfix-4/summary.json`
- Terminal transcript: `npm run e2e:text-pressure`

## Frequency

- Always in the affected 320 x 390 / 150% route audit before the split-short fixes.

## Scope

- Affected route/screen: `/recommendations/preferences`, `/settings/notifications`, `/shelf/manual`, `/shelf/scan`, `/shelf/no-match`, `/ask`, `/community`, and rendered floating tab/switch decoration on web.
- Affected account or fixture: Local Expo web fixtures used by `scripts/e2e/text-pressure-route-audit.mjs`.
- External service involved: None.
- Destructive action involved: No.

## Suspected Cause

The 150% text scale and 390 px height crossed a tighter threshold than the existing compact and ultra-short density bands. Several routes still tried to keep lower-priority controls in the first viewport, and one compact Shelf fallback label remained too long for the available row width.

## Minimal Fix Recommendation

- Split Recommendation Preferences value filters into first-viewport and below-fold groups on split-short phones.
- Move the lower-priority notification toggle into a separate below-fold card on split-short phones.
- Add split-short clearance before the optional manual-add Ingredients field.
- Use shorter compact Shelf scan fallback rows while preserving the full accessibility label.
- Use shorter compact Shelf no-match, Ask, and narrow tab visible labels while preserving full accessibility labels.
- Push later Community sections below the narrow first viewport so note cards never peek as partial targets.
- Remove web-rendered decoration pointer-events usage where bubbling keeps controls tappable without a browser warning.

## Verification Flow After Fix

1. Run focused route/source contracts for Shelf, Settings, Recommendations, Tab Bar, and ToggleSwitch.
2. Re-run the 320 x 390 / 150% text-pressure route audit.
3. Verify the audit reports zero failed routes and no disallowed browser logs.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/text-pressure-150-split-short-390-postfix-11/`
- Logs: `test-results/human-e2e/2026-07-08/text-pressure-150-split-short-390-postfix-11/expo-web.log`
- UI snapshot: `test-results/human-e2e/2026-07-08/text-pressure-150-split-short-390-postfix-11/summary.json`
- Terminal transcript:
  - `npm --workspace apps/mobile run test -- src/features/shelf/shelfRoutes.test.ts src/features/settings/settingsRoutes.test.ts src/features/recommendations/recommendationRoutes.test.ts src/features/navigation/tabBar.test.ts src/components/ui/ToggleSwitch.test.ts`
  - `npm run e2e:text-pressure`

The final 49-route audit passed with zero clipped visible controls, zero sub-44 visible controls, zero blocked center hit-tests, zero text overflow, zero horizontal overflow, and zero disallowed browser logs.

## Remaining Risk

- Untested branches: Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard behavior, camera preview overlays, notification OS prompts, and physical safe-area rendering.
- Missing fixtures: Native camera permission states, live product catalog/network conditions, live notification permission prompts, and device-specific font rendering.
- Follow-up needed: Run the same cramped-screen flows on iOS and Android devices or simulators once the native E2E harness is available.
