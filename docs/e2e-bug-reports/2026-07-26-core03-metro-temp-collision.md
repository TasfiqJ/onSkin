# E2E Bug Report: Metro indexed the database verification scratch tree

- Severity: Medium
- Surface: Expo web development start
- Environment: CORE-03 local E2E while the final database replay was running
- Feature: local app verification infrastructure
- Date: 2026-07-26
- Tester: Codex

## Reproduction Steps

1. Let the database verifier create an isolated repository copy under `.tmp`.
2. Start Expo web from `apps/mobile`.
3. Inspect Metro startup output.

## Expected Result

Metro watches application and workspace source without treating disposable
verification copies as packages.

## Actual Result

Metro reported a Haste package-name collision because the root `package.json`
and `.tmp/cat08-local-verify-v2/package.json` both named the package
`routinekind`.

## Evidence

- Terminal observation during the run; a raw transcript was not retained.
- Post-fix app evidence:
  `test-results/human-e2e/2026-07-26/core03-routine-cadence-review-gate-current/`

## Frequency

Always while a full repository scratch copy exists under `.tmp`.

## Scope

- Affected surface: local Metro/Expo startup
- External service involved: none
- Destructive action involved: no

## Suspected Cause

The monorepo Metro watch root included the repository's ignored `.tmp`
verification boundary without a resolver exclusion.

## Minimal Fix Recommendation

Preserve the monorepo watch root and add a resolver block only for the resolved
repo-local `.tmp` subtree.

## Verification Flow After Fix

1. Leave the database scratch copy in place.
2. Start Expo web again.
3. Confirm Metro reaches the web server without the package-name collision.
4. Complete the intended route pass.

## Post-Fix Evidence

- `apps/mobile/metro.config.js`
- The CORE-03 Expo-web server started on port 8091 and served the full route
  matrix.

## Remaining Risk

- Native Metro/EAS builds were not executed on Windows.
- Other copied repositories outside `.tmp` remain governed by the existing
  monorepo watch policy.
