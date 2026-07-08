# E2E Bug Report: 320 x 430 text-pressure route clearance

Severity: Medium
Surface: Expo web
Environment: Headless Chrome, Expo web, 320 x 430 viewport, 120% text pressure
Feature: Compact phone route layout, floating tab bar clearance, fixed composer clearance, contextual paywalls
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start the Expo web-compatible text-pressure route audit at 320 x 430.
2. Let the audit scale visible route text to 120%.
3. Inspect contextual ProGate paywalls, settings direct-entry routes, Ask, and Shelf recovery routes for clipped controls, blocked center hit-tests, sub-44 px visible controls, and horizontal overflow.

## Expected Result

Visible controls remain complete, readable, 44 px or taller where applicable, and clear of the floating tab bar or fixed composer. Lower-priority content can move below the first viewport on ultra-short phones, but partially visible controls must not peek into blocked zones.

## Actual Result

The 320 x 430 / 120% pass exposed ultra-short density gaps:

- Shared contextual ProGate routes could show too much body and secondary CTA content, pushing store-unavailable copy and lower paywall actions into the floating-tab area.
- `/settings/notifications` let the next notification switch peek below the first viewport.
- `/settings/privacy` direct entry kept secondary hint copy on rows that were already crowded by 120% text pressure.
- `/ask` let the empty-state prompt stack collide with the fixed composer area.
- `/shelf/no-match` kept three subtitle-heavy recovery rows in the first viewport, clipping the lower recovery action.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/text-pressure-120-short-phone-430-final-audit/`
- Logs: `test-results/human-e2e/2026-07-08/text-pressure-120-short-phone-430-final-audit/expo-web.log`
- Terminal transcript: `npm run e2e:text-pressure`

## Frequency

- Always in the affected 320 x 430 / 120% route audit before the compact-density fixes.

## Scope

- Affected route/screen: Shared contextual ProGate routes, `/settings/notifications`, `/settings/privacy`, `/ask`, `/shelf/no-match`.
- Affected account or fixture: Local Expo web fixtures used by `scripts/e2e/text-pressure-route-audit.mjs`.
- External service involved: None.
- Destructive action involved: No.

## Suspected Cause

Several compact-phone layouts only had density bands for normal compact phones or split-short phones. At 430 px height with 120% text pressure, those thresholds left enough text and secondary copy in the first viewport for controls to clip or collide with fixed chrome.

## Minimal Fix Recommendation

Add a shared sub-460 px density band where each affected route prioritizes core actions and complete touch targets:

- Shorten contextual ProGate store-unavailable reason copy and hide the lower-priority `Explore first` CTA below 460 px.
- Keep settings notification rows compact and push the promotional section far enough below the first viewport.
- Hide secondary privacy hints on ultra-short direct-entry privacy screens.
- Use the shortest Ask prompt order and hide nonessential intro copy below 460 px.
- Hide Shelf no-match row subtitles below 460 px.

## Verification Flow After Fix

1. Run the focused route contract tests for subscription, settings, Ask, and Shelf.
2. Run mobile typecheck and lint.
3. Re-run the full 49-route text-pressure audit at 320 x 430 / 120%.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/text-pressure-120-short-phone-430-final-audit/`
- Logs: `test-results/human-e2e/2026-07-08/text-pressure-120-short-phone-430-final-audit/expo-web.log`
- UI snapshot: `test-results/human-e2e/2026-07-08/text-pressure-120-short-phone-430-final-audit/summary.json`
- Terminal transcript:
  - `npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts src/features/settings/settingsRoutes.test.ts src/features/ask/routeContract.test.ts src/features/shelf/shelfRoutes.test.ts`
  - `npm --workspace apps/mobile run typecheck`
  - `npm --workspace apps/mobile run lint`
  - `npm run e2e:text-pressure`

The final audit passed 49 / 49 routes with zero clipped visible controls, zero sub-44 px visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs.

## Remaining Risk

- Untested branches: Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard behavior, and hardware safe-area rendering.
- Missing fixtures: Live Supabase, RevenueCat, App Store, Google Play, camera, notifications, and native share-sheet fixtures.
- Follow-up needed: Run the same cramped-screen flows on native iOS and Android once a durable native E2E harness is selected.
