# E2E Bug Report: Ask fit answer exposed a bare evidence grade

- Severity: Medium
- Surface: Expo web
- Environment: Development fixture, 390 x 844 viewport
- Pre-fix source state: transient exploratory working tree
- Post-fix source commit:
  `c78208ef1da9dd4b3c5f385d421541f8741dba3c`
- Feature: Ask product-fit answer
- Date: 2026-07-26
- Tester: Codex in-app browser

## Reproduction Steps

1. Open `/ask` with the local anonymous-owner fixture and a saved shelf.
2. Choose `Is this product a fit for me?`.
3. Read the answer's citation row.

## Expected Result

The deterministic answer does not display an evidence grade unless it can bind
that grade to an exact source, reviewed claim, and applicable scope.

## Actual Result

The answer displayed `Evidence: established` without an exact citation or
independent review contract.

## Evidence

- Pre-fix observation: transient browser DOM inspection; no durable DOM artifact
  was retained.
- Post-fix screenshot:
  `test-results/human-e2e/2026-07-26/core02-conflict-admission-current/16-committed-ask-fit-neutral-source-status-390x844.jpg`
- Post-fix tests: `apps/mobile/src/features/ask/answer.test.ts`

## Frequency

Always

## Scope

- Affected route/screen: `/ask`
- Affected account or fixture: local anonymous-owner fixture with a generated
  recommendation
- External service involved: none
- Destructive action involved: no

## Suspected Cause

`fitAnswer` converted a recommendation taxonomy value into a user-facing
evidence claim without carrying the source and review evidence needed to
substantiate that presentation.

## Minimal Fix Recommendation

Keep the citation absent until an exact, independently reviewed citation
contract exists. Preserve the internal evidence label for ranking and governed
review work, but do not render it as substantiation.

## Verification Flow After Fix

1. Reload `/ask`.
2. Choose `Is this product a fit for me?`.
3. Confirm the deterministic fit answer remains visible.
4. Confirm no bare evidence grade or citation row is displayed.

## Post-Fix Evidence

- Screenshot:
  `test-results/human-e2e/2026-07-26/core02-conflict-admission-current/16-committed-ask-fit-neutral-source-status-390x844.jpg`
- Browser diagnostics:
  `test-results/human-e2e/2026-07-26/core02-conflict-admission-current/browser-console-committed.json`
- Automated verification reported during the run: 320 mobile test files / 3,863
  tests pass. A raw terminal transcript is not retained in this packet.

## Remaining Risk

- Expo web does not establish native iPhone layout, VoiceOver, archive, or App
  Review behavior.
- Recommendation claims and source presentation remain subject to the separate
  professional and legal review worklists.
