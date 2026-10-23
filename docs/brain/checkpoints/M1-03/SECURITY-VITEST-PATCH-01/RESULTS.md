# Fresh measurements

Implementation and clean measured source: `39390947063092ff67ac503cd0b86992eb65b941` / tree `0c4a1ceb61fa3d145f348a410284a78a82b144fd`. Node 24.19.0, reviewed npm 11.20.0, Python 3.12.3, Linux. Fresh ci installed 1,032 packages with the original postinstall, against the identical final lock before its source commit. All subsequent mandatory source tests ran at the clean measured commit; no source changed during those tests. All full command, cwd, UTC start/end, durations, transcript hashes and raw exits are preserved under `evidence/`.

| Check | Exit | Actual result | Details |
| --- | ---: | --- | --- |
| reviewed-npm-version | 0 | PASS | Original command and unmodified raw exit/transcript preserved. No coverage percentage is claimed. |
| runtime | 0 | PASS | Original command and unmodified raw exit/transcript preserved. No coverage percentage is claimed. |
| npm-selected | 0 | PASS | Original command and unmodified raw exit/transcript preserved. No coverage percentage is claimed. |
| installed-context-verification | 0 | PASS | Original command and unmodified raw exit/transcript preserved. No coverage percentage is claimed. |
| lock-regeneration | 0 | PASS | Original command and unmodified raw exit/transcript preserved. No coverage percentage is claimed. |
| fresh-npm-audit | 1 | FAIL | Real public lock-only audit remains exit 1: 67 high propagated findings; zero moderate. Both target advisories and tinyrainbow are absent. No audit fix or exception. |
| fresh-npm-ci | 0 | PASS | Authentic npm 11.20.0 fresh ci; 1032 packages added; original postinstall executed. Same final lock SHA. Existing allowScripts warnings preserved. |
| ios-privacy-source-regenerate | 0 | PASS | Original command and unmodified raw exit/transcript preserved. No coverage percentage is claimed. |
| ios-privacy-source-check | 0 | PASS | Original command and unmodified raw exit/transcript preserved. No coverage percentage is claimed. |
| root-test-force | 0 | PASS | 6067 tests: 6043 mobile + 24 console, 2 successful tasks, 0 cached. |
| typecheck-force | 0 | PASS | 3/3 tasks successful; 0 cached. |
| lint-force | 0 | PASS | 3/3 tasks successful; 0 cached. |
| original-security-70 | 0 | PASS | 70 original tests; zero skips; original test_contract.py SHA256 unchanged. |
| original-secret-12 | 0 | PASS | 12 original secret-scan fixtures; zero skips. |
| ordinary-governance-103 | 0 | PASS | 103 discovered; 101 passed; two original Windows-only junction tests skipped on Linux. |
| expo-mobile-check | 0 | PASS | Original command and unmodified raw exit/transcript preserved. No coverage percentage is claimed. |
| postinstall-check | 0 | PASS | Original command and unmodified raw exit/transcript preserved. No coverage percentage is claimed. |
| widget-extension-check | 0 | PASS | Original command and unmodified raw exit/transcript preserved. No coverage percentage is claimed. |
| widget-extension-tests | 0 | PASS | Original command and unmodified raw exit/transcript preserved. No coverage percentage is claimed. |
| ios-privacy-source-final-check | 0 | PASS | Original command and unmodified raw exit/transcript preserved. No coverage percentage is claimed. |
| ios-privacy-source-tests | 0 | PASS | Original command and unmodified raw exit/transcript preserved. No coverage percentage is claimed. |
| ios-archive-privacy-fixtures | 0 | PASS | Original command and unmodified raw exit/transcript preserved. No coverage percentage is claimed. |
| frozen-gf01-refusal | 1 | BLOCKED | Preserved frozen prior profile. Its failure is not source acceptance. |
| phase4-worklist-regenerate | 0 | PASS | Original command and unmodified raw exit/transcript preserved. No coverage percentage is claimed. |
| phase4-worklist-check | 0 | PASS | Original command and unmodified raw exit/transcript preserved. No coverage percentage is claimed. |
| checkpoint-adverse-14 | 0 | PASS | 14 checkpoint test methods: one true positive and 13 adverse methods; npm provenance exercises three subcases. Temporary intermediate commits use private object/index directories and do not update any repository ref. |

No instrumentation-derived code-coverage percentage is claimed. Suite coverage is the unchanged original 70 contracts, 12 secret fixtures, 103 governance cases, 6,067 frontend tests, original native-source/privacy fixtures and 14 checkpoint methods; see raw test counts and skip reasons. The legacy GF01 refusal is retained as BLOCKED, never acceptance.

The original strict Phase4 producer ran from the clean measured source; its two outputs alone were regenerated and its strict check passed. The iOS mapping condition independently preserved four exact lock entries and ten installed source hashes before replacing three whole-lock bindings. Both original privacy outputs came from the unchanged canonical producer, with source_candidate/archiveRequired unchanged.

Source-head provider observation is in `evidence/source-ci-observation.json` and the strict report. Any in-progress run/job remains PENDING. Final delivery-head checks must be queried after its push and are reported externally by actual final SHA. Source successes/failures are never copied onto the delivery head.

Preparation errors and npm allowScripts warnings are preserved in `evidence/infrastructure-notes.json`; no failed source test was hidden or weakened.
