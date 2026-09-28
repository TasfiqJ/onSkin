# E2E Bug Report: Ask short-phone prompts overlap composer

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser, `npm --workspace apps/mobile run web -- --port 8182 --host localhost`, 320 x 480 viewport
Feature: Ask Layerwell deterministic advisor
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with app lock disabled and local E2E fixtures.
2. Open `/ask` at a 320 x 480 phone viewport with an empty shelf.
3. Inspect the suggested prompt buttons and fixed composer hit targets.

## Expected Result

Suggested prompts, the text input, Send, and the disclosure footer remain visible and hit-testable. No prompt button should sit underneath or be intercepted by the fixed composer.

## Actual Result

The second and third empty-state prompt buttons were rendered in the fixed composer zone. Center hit-tests for `What should I do tonight?` and `Is this product a fit for me?` landed on the input/footer instead of the prompt buttons.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/ask-short-phone-480-composer-clearance/01-before-overlap.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/ask-short-phone-480-composer-clearance/01-before-overlap.json`

## Frequency

- Always on the tested 320 x 480 viewport.

## Scope

- Affected route/screen: `/ask`
- Affected account or fixture: Empty local shelf state
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The 320 x 480 viewport leaves less vertical space than the existing `compactPhone` contract covered. The empty state still rendered the pills row plus all three 48 px prompt buttons above a fixed composer, so lower prompt centers were physically covered by the input/footer layer. After tapping the first prompt, the first answer/report stack also used normal compact spacing and placed the report control in the composer zone.

## Minimal Fix Recommendation

Add a stricter shortest-phone layout for heights below 520 px. Hide the decorative pill row, show only the two highest-value initial prompt buttons, tighten intro/eyebrow spacing, and use denser user-bubble/answer/report spacing only on those shortest phones.

## Verification Flow After Fix

1. Reopen `/ask` at 320 x 480.
2. Verify visible prompts, input, Send, and disclosure have owned center hit-tests, zero horizontal overflow, and no visible sub-44 px controls.
3. Tap `Is there a conflict on my shelf?`.
4. Verify the first user message, empty-shelf answer, report control, composer, and disclosure remain hit-testable with zero horizontal overflow.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/ask-short-phone-480-composer-clearance/02-after-clearance.png`
- Screenshot: `test-results/human-e2e/2026-07-08/ask-short-phone-480-composer-clearance/03-after-first-prompt.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/ask-short-phone-480-composer-clearance/02-after-clearance.json`
- UI snapshot: `test-results/human-e2e/2026-07-08/ask-short-phone-480-composer-clearance/03-after-first-prompt.json`
- Logs: `test-results/human-e2e/2026-07-08/ask-short-phone-480-composer-clearance/browser-warn-error-logs.json`

## Remaining Risk

- Native iOS/Android Dynamic Type, keyboard, and home-indicator safe-area behavior still need device QA.
