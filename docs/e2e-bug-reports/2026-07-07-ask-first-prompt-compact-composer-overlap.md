# E2E Bug Report: Ask first prompt follow-up peeks under compact composer

Severity: Medium
Surface: Expo web phone-width proxy for iOS and Android
Environment: Expo web, 320x568 viewport, local development server on port 19114
Feature: Ask RoutineKind deterministic advisor
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/ask` at 320x568 with cloud Ask disabled and an empty local shelf.
2. Tap `Is there a conflict on my shelf?` using a real coordinate tap on the visible prompt.
3. Inspect the first answer state around the fixed composer.

## Expected Result

The first answer state should feel intentionally composed on a short phone: the user question, deterministic badge, empty-shelf answer, report control, fixed composer, and disclosure footer remain readable, and no follow-up prompt appears partially hidden underneath the composer.

## Actual Result

The answer content was readable, but the post-answer `What should I do tonight?` follow-up prompt started above the fixed composer and continued underneath it, making the screen look clipped and creating an ambiguous partial tap target.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/ask-first-prompt-real-tap/02-after-real-tap-320.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/ask-first-prompt-real-tap/02-after-real-tap-audit.json`

## Frequency

- Always on the tested 320x568 empty-shelf Ask first-prompt path before the fix.

## Scope

- Affected route/screen: `/ask`
- Affected account or fixture: empty local shelf, cloud Ask disabled
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The compact post-answer state kept one follow-up suggested prompt below the answer while the fixed composer occupied the bottom of the short phone viewport. The row was still rendered even though there was not enough compact-height clearance to show it fully above the composer.

## Minimal Fix Recommendation

On compact phones, use the fixed composer as the follow-up path after an answer and hide the post-answer suggested prompt row. Keep follow-up suggested prompts on non-compact screens where there is enough vertical clearance.

## Verification Flow After Fix

1. Run `npm --workspace apps/mobile run test -- src/features/ask/routeContract.test.ts`.
2. Open `/ask` at 320x568.
3. Tap `Is there a conflict on my shelf?` using a real coordinate tap.
4. Confirm the first answer state has no horizontal overflow, no sub-44 px visible controls, no clipped controls, no partial follow-up prompt under the composer, and no browser errors.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/ask-first-prompt-short-phone-fix/02-first-prompt-answer-320.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/ask-first-prompt-short-phone-fix/02-first-prompt-answer-audit.json`
- Browser logs: `test-results/human-e2e/2026-07-07/ask-first-prompt-short-phone-fix/browser-logs.json`
- Terminal transcript: focused Ask route contract passed with 11 tests.

## Remaining Risk

- Untested branches: native iOS and Android keyboard behavior, Dynamic Type, and seeded-shelf proactive lead state.
- Missing fixtures: no native simulator/device fixture was used in this Expo web pass.
- Follow-up needed: native Ask pass before launch acceptance.
