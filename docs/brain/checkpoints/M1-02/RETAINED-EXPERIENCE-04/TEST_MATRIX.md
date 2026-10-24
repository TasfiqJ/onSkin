# Actual validation

Commands run from the receipt's exact cwd with installed Node 22.21.0 and npm
11.20.0. Python version and worktree inventory are in `preflight.json`. Mobile
Vitest remains 4.1.11 on this branch; read-only PR10 was not imported. Receipts
record argv, UTC, source head/tree where available, actual exit, duration, dirty
state and the SHA-256 of the complete raw log. Early receipts precede the added
start-snapshot fields; their actual precommit source state is retained.

| Receipt stem | Command/result | Exit |
| --- | --- | --- |
| independent-original-hooks | New two-file overlay on exact anchor: 11 fail, 1 pass. | 1 expected |
| independent-original-today | Actual Today component, added AM/PM cases: 2 fail; other 72 filtered. | 1 expected |
| independent-original-profile | Actual profile hook, 3 added cases fail; other 15 filtered. | 1 expected |
| independent-original-ramp | Actual usePlan/useRamp query, added offline refresh fails; other 15 filtered. | 1 expected |
| today-recovery-green | 86 pass across actual Today suite and two new hook files. | 0 |
| profile-green / ramp-green | Entire touched original suites: 18 / 16 pass. | 0 / 0 |
| final-all-retained | `npm --workspace apps/mobile run test -- src/features/{shelf,today,routine,scheduler,streak,notifications,photos,onboarding}` (expanded argv in receipt): 2,047 pass, 170 files. | 0 |
| complete-clean-root-tests | `npm test -- --force`: 6,095 mobile + 24 console = 6,119; 479 files; zero cached tasks. Exact source `6e8084484`, clean before/after. | 0 |
| complete-clean-typecheck | `npm run typecheck -- --force`: 3 tasks, zero cached. | 0 |
| complete-clean-lint | `npm run lint -- --force`: 3 tasks, zero cached. Mobile ESLint; console uses TypeScript; types workspace reports no lint configured. | 0 |
| final-generated-after-ramp | Unchanged `node scripts/phase4/build-source-worklist.mjs --strict` in clean source-complete checkout. Exact two generated outputs copied. | 0 |
| final-worklist-positive / altered / restored | Original `--strict --check`, independent complete checkout: current pass, one referenced Shelf input altered and both outputs refused, exact restore pass. | 0 / 1 / 0 |
| ui-web375-ramp-complete | Actual synthetic Expo web 375x667, complete changed flows. | 0 |
| ui-web390-complete | Actual synthetic Expo web 390x844, complete changed flows. | 0 |
| ui-cross-owner390 | Actual synthetic A-to-B, cleanup failure/retry, B usability/reload and return-to-A refusal. | 0 |

All exploratory failures remain under `receipts/`, including the first red
probe, original-source failures, lint warnings, source-contract mismatch,
concurrent evidence status mismatch, missing nested dependency resolution and
the paid-denied/paused-source/locator browser attempts. Filtered tests are not
counted as passes. The original failed static assertion was preserved and the
source corrected to its existing contract. No original negative test was removed,
skipped, weakened or converted to a synthetic green.

The independent checkout shares immutable Git objects and reuses installed
dependency paths; it has its own complete source, index and working tree. It is
not a claim of a fresh npm install. Its actual commands/clean states and the
corrected nested dependency mapping are explicit. Final evidence files were
written outside that checkout, so root tests observed stable clean status.

