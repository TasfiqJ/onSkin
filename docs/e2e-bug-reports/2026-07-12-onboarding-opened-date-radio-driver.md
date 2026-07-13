# E2E Bug Report: First-session product loop stalls after semantic intake changes

Severity: High
Surface: Expo web
Environment: Headless Chrome, 390 x 844, local Expo development build at `fc5d512f7`
Feature: First-run onboarding activation path
Date: 2026-07-12
Tester: Codex

## Reproduction Steps

1. Run `npm run e2e:onboarding-first-session` at 390 x 844.
2. Complete onboarding through the first product name, category, and opened date.
3. Return to add the next product.

## Expected Result

The driver selects `Just opened it`, the saved draft clears before the next
product, and the journey completes through routine and check-off.

## Actual Result

The app renders `Just opened it` as a semantic radio control whose computed web
text combines the title and subtitle. The E2E driver omitted radios and expected
an exact title, so the first run stopped there. After that selector was repaired,
the driver selected an off-screen stale input retained by the navigation stack
instead of the visible product input. After visible-input selection was repaired,
the third-product Continue action returned to Goals because the route-local
`OnboardingProvider` had unmounted each time intake entered `/shelf/opened`.

## Evidence

- Screenshots: `test-results/human-e2e/2026-07-12/backlog-current-smoke/onboarding-first-session-390x844/`
- Logs: `test-results/human-e2e/2026-07-12/backlog-current-smoke/onboarding-first-session-390x844/expo-web.log`
- Terminal transcript: failed `npm run e2e:onboarding-first-session` output

## Frequency

- Always

## Scope

- Affected route/screen: `/shelf/opened?origin=onboarding`
- Affected account or fixture: dev-only local reset fixture
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The freshness-provenance update correctly changed opened-date choices to
`accessibilityRole="radio"`, but the control did not expose its concise title as
an explicit accessibility label and the first-session driver's interaction,
scroll, and geometry selectors omitted `[role="radio"]`. The driver's fill helper
also did not exclude hidden navigation-stack inputs. Finally,
`OnboardingProvider` lived in `onboarding/_layout.tsx`, so the required detour to
the root-level Shelf opened-date route destroyed goals and quiz answers.

## Minimal Fix Recommendation

Give each radio an explicit title label plus descriptive hint, include semantic
radio controls in all first-session driver selectors, restrict text input fills
to visible controls, key the product form to each completed product ID, and keep
the onboarding state provider above the temporary Shelf route while still inside
the account/session boundary gate. Add source-contract regression tests for all
four invariants.

## Verification Flow After Fix

1. Run the focused onboarding route-contract test.
2. Re-run the exact 390 x 844 first-session flow.
3. Confirm three products are saved and the routine plan plus AM/PM check-offs complete.

## Post-Fix Evidence

- Screenshot sequence: `test-results/human-e2e/2026-07-12/backlog-current-smoke/onboarding-first-session-390x844/`.
- Run report: `test-results/human-e2e/2026-07-12/backlog-current-smoke/onboarding-first-session-390x844/report.md`.
- Machine-readable summary: `test-results/human-e2e/2026-07-12/backlog-current-smoke/onboarding-first-session-390x844/summary.json`.
- Result: Pass on 2026-07-13 at 390 x 844. Three products persisted, the derived `Timing handled` insight rendered, Explore first reached the routine plan, and AM plus PM check-offs each reached `1 of 1`, with zero horizontal overflow across the recorded checkpoints and no disallowed browser warnings/errors.

## Remaining Risk

- Native iPhone opened-date radio traversal, keyboard behavior, VoiceOver, and
  Dynamic Type still require simulator/physical-device QA. Android is not part
  of the current release contract.
