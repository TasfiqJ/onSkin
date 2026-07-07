# E2E Bug Report: Ask active-frequency question misroutes to product fit

Severity: High
Surface: Expo web
Environment: Expo web on localhost:19131, 320 x 568 compact phone viewport
Feature: Ask RoutineKind deterministic advisor
Date: 2026-07-07
Tester: Codex human-simulated E2E

## Reproduction Steps

1. Start the mobile app on Expo web.
2. Open `/ask` at 320 x 568.
3. Tap `Is there a conflict on my shelf?`.
4. Type `Should I use retinol every night?`.
5. Tap Send.

## Expected Result

The advisor should not answer an active-frequency question as a product recommendation. It should refuse or escalate safely, preserve the fixed composer/disclosure layout, and avoid fit-engine shopping copy.

## Actual Result

Before the fix, the typed retinol-frequency question routed to product-fit copy and recommended a mineral SPF/vitamin-C style fit answer instead of handling the frequency-style active-use question safely.

## Evidence

- Screenshot before fix: `test-results/human-e2e/2026-07-07/ask-first-prompt-compact-current/ask-typed-question-after-320.png`
- UI snapshot before fix: `test-results/human-e2e/2026-07-07/ask-first-prompt-compact-current/ask-typed-question-after-320.json`
- Screenshot after fix: `test-results/human-e2e/2026-07-07/ask-first-prompt-compact-current/ask-typed-question-after-320-fixed.png`
- UI snapshot after fix: `test-results/human-e2e/2026-07-07/ask-first-prompt-compact-current/ask-typed-question-after-320-fixed.json`
- Summary: `test-results/human-e2e/2026-07-07/ask-first-prompt-compact-current/summary.json`
- Browser warnings: `test-results/human-e2e/2026-07-07/ask-first-prompt-compact-current/browser-warnings-19131.json`

## Frequency

- Always on the tested route before the fix.

## Scope

- Affected route/screen: `/ask`
- Affected account or fixture: local empty-shelf Expo web state with available recommendation context
- External service involved: none
- Destructive action involved: no

## Suspected Cause

The product-fit regex included generic `should i use` phrasing. Because the medical/dosing bucket did not recognize active-frequency wording such as `every night`, the router classified `Should I use retinol every night?` as product fit and answered from the recommendation engine.

## Minimal Fix Recommendation

Treat active-frequency wording for retinol, acids, exfoliants, and benzoyl peroxide as the existing medical/escalation bucket, and remove generic `should i use` from the product-fit regex so broad use questions do not become shopping recommendations.

## Verification Flow After Fix

1. Reopen `/ask` at 320 x 568.
2. Tap `Is there a conflict on my shelf?`.
3. Type `Should I use retinol every night?` and tap Send.
4. Confirm the answer escalates safely, no fit-engine/SPF/vitamin-C recommendation copy appears, horizontal overflow is zero, and visible controls remain at least 44 px.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/ask-first-prompt-compact-current/ask-typed-question-after-320-fixed.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/ask-first-prompt-compact-current/ask-typed-question-after-320-fixed.json`
- Focused test command: `npm --workspace apps/mobile run test -- src/features/ask/intent.test.ts src/features/ask/answer.test.ts src/features/ask/routeContract.test.ts`

## Remaining Risk

- Untested branches: native iOS/Android keyboard behavior and screen-reader traversal.
- Missing fixtures: none for this local deterministic route.
- Follow-up needed: native-device QA for Ask typed input and focus behavior.
