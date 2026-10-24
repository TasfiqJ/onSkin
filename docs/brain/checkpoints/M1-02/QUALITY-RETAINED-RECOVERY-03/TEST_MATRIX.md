# Commands and observed exits

Raw command arrays, working directory, UTC start, elapsed time and real exits
are in `receipts/*.log.json`; raw combined output is in each corresponding log.
All commands use existing installed dependencies on Windows, Node 22.21.0,
npm 11.20.0, Python 3.9.13 and observed Vitest 4.1.11. No install or lock edit.
`source-scope.json` binds the measured source and working bytes. Clean-source
commands ran after 4d8ef8a02 was committed and before checkpoint creation.

| Receipt | Command | Exit | Observed result |
| --- | --- | --- | --- |
| worklist-sparse-before | npm run phase4:source-worklist:check | 1 | Missing sparse inputs plus stale outputs; separate from full CI cause |
| worklist-complete-before | same, complete clean checkout | 1 | Only the two stale outputs |
| worklist-generate | npm run phase4:source-worklist:strict | 0 | Authentic original producer; two outputs |
| worklist-clean-positive | npm run phase4:source-worklist:check | 0 | Clean complete source at 219af21c4 |
| worklist-disposable-positive | same, independent source-complete clone | 0 | All referenced inputs authentic/present |
| worklist-disposable-negative | same, one referenced input altered in disposable clone | 1 | Both outputs refused as stale |
| retained03-red | two new test paths against original production | 1 | Initial 7 checks: 4 failures, 3 passes; receipt printer also hit Windows encoding error after preserving raw output/exit |
| retained03-green-first | same initial tests after repair | 0 | 7/7 |
| final-overlay-original-source | final identical two-test overlay on original production | 1 | 8 failures, 3 passes of 11; source setup loaded correctly |
| focused-final | npm --workspace apps/mobile run test -- src/features/notifications/preferenceReadRace.retained03.test.ts src/features/photos/offlineDiary.retained03.test.ts | 0 | 11/11 |
| retained-families | npm --workspace apps/mobile run test -- src/features/shelf src/features/today src/features/routine src/features/scheduler src/features/streak src/features/photos src/features/notifications src/features/onboarding | 0 | 2,029/2,029 in 168 files |
| lint-forced | npm run lint -- --force | 1 | Four globals-during-render errors in new test probes; corrected using effects |
| lint-forced-final | same | 0 | Three tasks, zero cached |
| worklist-before-final-refresh | npm run phase4:source-worklist:check | 1 | Truthful refusal after USER_FLOW_TREE changed |
| worklist-final-generate | npm run phase4:source-worklist:strict | 0 | Clean 3bcc21fe8 inputs, original producer |
| clean-source-worklist-check | npm run phase4:source-worklist:check | 0 | Complete clean measured source 4d8ef8a02 |
| clean-source-root-tests | npm test -- --force | 0 | 6,101/6,101; two tasks, zero cached |
| clean-source-typecheck | npm run typecheck -- --force | 0 | Three tasks, zero cached |
| clean-source-lint | npm run lint -- --force | 0 | Three tasks, zero cached |
| ui-web375-final | additive wrapper + unchanged onboarding driver --daily-loop | 0 | Actual 375x667 synthetic web flow |
| ui-web390-final | same | 0 | Actual 390x844 synthetic web flow |
| ui-cross-owner390 | additive wrapper + unchanged driver --cross-owner | 0 | Actual A-to-B 390x844, zero observed leaks |

The final overlay rerun includes the lint-clean effect-based test probes.
Earlier `final-tests-original-source` and `root-tests-forced` receipts remain
historical intermediate runs; they are not relabelled as clean final-source runs.
Raw diagnostics, React test-renderer deprecation, Expo web/native-unavailable
warnings and failed wrapper attempts are retained. First UI bootstrap used an
invalid Windows ESM URL; the next wrapper wrote its binding too early and hit
the original empty-directory refusal. A later 375 run reached the saved state
but its keyboard driver lacked browser focus/text and timed out. The corrected
driver asserts focus, dispatches complete Enter input and passes. None of these
driver failures is counted as a product regression or green execution.

Git source diff check, source/working-byte comparison, evidence manifest and
committed-blob verification are separate receipts. Complete raw-log whitespace
may refuse and is not normalized to manufacture a clean result. No tests or
gates were disabled. No native, paid/provider, canonical DB or Security success
is inferred from these tests.

Full staged evidence whitespace check: actual exit 2, recorded in raw-all-staged-whitespace. Existing M1-02 -text attributes preserve raw Windows CRLF observations and logs. Authored source/code/narrative checks are separate; no original bytes or Git attributes were changed to suppress this observation.

An initial evidence-text whitespace check also returned 2 because it included the exact executed CRLF browser fragment. The fragment remains an unchanged execution snapshot bound by driver hashes. Authored product source, checkpoint narrative/verifier/wrapper and handoff are checked separately from raw execution snapshots; their exact command path list is recorded.

The repetitive full-staged whitespace output is bounded to its first/final 20 exact lines with an explicit omission marker. whitespace-retention.json records the original 14,208,255-byte output digest and external retained path; actual exit remains 2. All test/error receipts remain complete.
