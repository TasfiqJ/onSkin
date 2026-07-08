# E2E Bug Report: ProGate 130% text-pressure header overlap

Severity: Medium
Surface: Expo web
Environment: Headless Chrome, Expo web, 320 x 430 viewport, 130% text pressure
Feature: Shared contextual ProGate paywalls
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start the Expo web-compatible text-pressure route audit at 320 x 430.
2. Set text pressure to 130%.
3. Inspect shared contextual ProGate routes, including `/routine/plan`, `/routine/ramp`, `/routine/reorder`, `/routine/adaptation`, `/cycle/phased-intro`, `/cycle/recovery`, and `/cycle/why-tonight`.

## Expected Result

Terms, Privacy, Restore, Maybe later, annual price, store-unavailable reason, and Start free trial remain readable, complete, and center-hit-testable. Price copy does not overflow on an ultra-short 320 px phone viewport.

## Actual Result

The 320 x 430 / 130% route audit failed 7 of 49 routes. In the shared contextual ProGate compact header, `Restore` was center-hit blocked by `Maybe later`. The annual-price card also allowed the `$4.16/mo` monthly equivalent to overflow on the narrow ultra-short layout.

## Evidence

- Pre-fix route audit: `test-results/human-e2e/2026-07-08/text-pressure-130-short-phone-430-audit-current/`
- Post-fix route audit: `test-results/human-e2e/2026-07-08/text-pressure-130-short-phone-430-postfix/`
- Terminal transcript: `npm run e2e:text-pressure`

## Frequency

- Always in the affected 320 x 430 / 130% route audit before the ProGate ultra-short header fix.

## Scope

- Affected route/screen: Shared contextual ProGate routes for routine, cycle, and progress-locked surfaces.
- Affected account or fixture: Local Expo web fixtures used by `scripts/e2e/text-pressure-route-audit.mjs`.
- External service involved: None.
- Destructive action involved: No.

## Suspected Cause

At 130% text pressure, the single-row compact ProGate header did not leave enough width for Terms, Privacy, Restore, and Maybe later. The monthly equivalent label also competed with the annual price inside the ultra-short annual-price row.

## Minimal Fix Recommendation

On ultra-short contextual ProGate paywalls, stack the compact compliance row above the dismiss action and reserve a taller header band. Hide the lower-priority monthly equivalent label below 460 px so the annual price and primary action remain dominant and readable.

## Verification Flow After Fix

1. Run the focused subscription contract test.
2. Run mobile typecheck and lint.
3. Re-run the full 49-route text-pressure audit at 320 x 430 / 130%.

## Post-Fix Evidence

- Screenshot/report set: `test-results/human-e2e/2026-07-08/text-pressure-130-short-phone-430-postfix/`
- UI report: `test-results/human-e2e/2026-07-08/text-pressure-130-short-phone-430-postfix/report.md`
- Terminal transcript:
  - `npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts`
  - `npm --workspace apps/mobile run typecheck`
  - `npm --workspace apps/mobile run lint`
  - `npm run e2e:text-pressure`

The final audit passed 49 / 49 routes with zero clipped visible controls, zero sub-44 px visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs.

## Remaining Risk

- Untested branches: Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard behavior, and hardware safe-area rendering.
- Missing fixtures: Live RevenueCat purchase/restore state, App Store, Google Play, and native device safe-area fixtures.
- Follow-up needed: Repeat the cramped-screen paywall routes on physical iOS and Android devices once native device QA is running.
