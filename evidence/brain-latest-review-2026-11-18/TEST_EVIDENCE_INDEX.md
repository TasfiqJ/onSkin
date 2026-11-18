# Actual validation evidence

Current source efd3af803a2a71bd2fdd644ecfd500c619fb996c / tree83670a073910a840c69368f1760d5cb59d021054, clean before/after every fresh command. [Combined machine-readable receipts](CURRENT_RUN_RECEIPTS.json) and individual logs/JSON below record actual commands, UTC start/end, exit, identity and original log SHA256. All commands use installed local tooling. Turbo cache=local:w permits writes but no reads; successful root runs report0cached. No hosted CI/native/provider/paid operation.

| Current run | Exit | UTC start | Seconds | Receipt | Log |
| --- | ---: | --- | ---: | --- | --- |
| current-consumer-build | 0 | 2026-11-18T15:18:12.918188+00:00 | 60.578 | [JSON](current/current-consumer-build.json) | [Log](current/current-consumer-build.log) |
| current-focused-privacy | 0 | 2026-11-18T15:18:07.317961+00:00 | 4.187 | [JSON](current/current-focused-privacy.json) | [Log](current/current-focused-privacy.log) |
| current-lint-valid | 0 | 2026-11-18T15:20:30.947710+00:00 | 77.281 | [JSON](current/current-lint-valid.json) | [Log](current/current-lint-valid.log) |
| current-lint | 1 | 2026-11-18T15:18:06.525912+00:00 | 0.593 | [JSON](current/current-lint.json) | [Log](current/current-lint.log) |
| current-manual-browser | 0 | 2026-11-18T15:24:45.192458+00:00 | 142.593 | [JSON](current/current-manual-browser.json) | [Log](current/current-manual-browser.log) |
| current-optional-browser-adapted | 0 | 2026-11-18T15:34:08.392745+00:00 | 234.437 | [JSON](current/current-optional-browser-adapted.json) | [Log](current/current-optional-browser-adapted.log) |
| current-optional-browser | 1 | 2026-11-18T15:27:07.984301+00:00 | 99.125 | [JSON](current/current-optional-browser.json) | [Log](current/current-optional-browser.log) |
| current-professional-build | 0 | 2026-11-18T15:18:11.717490+00:00 | 0.969 | [JSON](current/current-professional-build.json) | [Log](current/current-professional-build.log) |
| current-professional-owner-375 | 0 | 2026-11-18T15:31:47.818927+00:00 | 38.328 | [JSON](current/current-professional-owner-375.json) | [Log](current/current-professional-owner-375.log) |
| current-professional-owner-430 | 0 | 2026-11-18T15:32:30.491324+00:00 | 38.438 | [JSON](current/current-professional-owner-430.json) | [Log](current/current-professional-owner-430.log) |
| current-professional-queue-375 | 0 | 2026-11-18T15:31:43.542874+00:00 | 4.078 | [JSON](current/current-professional-queue-375.json) | [Log](current/current-professional-queue-375.log) |
| current-professional-queue-430 | 0 | 2026-11-18T15:32:26.356642+00:00 | 3.922 | [JSON](current/current-professional-queue-430.json) | [Log](current/current-professional-queue-430.log) |
| current-recovery-browser | 0 | 2026-11-18T15:28:47.325520+00:00 | 176.0 | [JSON](current/current-recovery-browser.json) | [Log](current/current-recovery-browser.log) |
| current-root-tests-valid | 0 | 2026-11-18T15:19:12.525567+00:00 | 51.125 | [JSON](current/current-root-tests-valid.json) | [Log (part 1; all parts below)](current/current-root-tests-valid.log.parts/part-001.txt) |
| current-root-tests | 1 | 2026-11-18T15:18:04.250965+00:00 | 1.25 | [JSON](current/current-root-tests.json) | [Log](current/current-root-tests.log) |
| current-typecheck-valid | 0 | 2026-11-18T15:20:03.858989+00:00 | 26.86 | [JSON](current/current-typecheck-valid.json) | [Log](current/current-typecheck-valid.log) |
| current-typecheck | 1 | 2026-11-18T15:18:05.736986+00:00 | 0.579 | [JSON](current/current-typecheck.json) | [Log](current/current-typecheck.log) |

## Results and coverage

- **Complete uncached root:**8652tests/579files PASS; mobile7977/554, professional651/18, catalog operator24/7;3successful tasks/0cached. Exact current clean HEAD, not just equivalent precommit files.
- **Focused security/storage/owner/recovery:**490tests/13files PASS: privateKV, privateKVContentKey, privateKVReadOnly25, webRuntimeAdmission, bottleDrafts, manualIntakeDrafts, optionalChangeDrafts, optionalChangeDraftProof23, photoDeleteR3.integration, encryptedStorage, localDeviceExport, selectiveCleanup and localRecoveryDrafts25. Ordinary local synthetic regression, no protected Security acceptance.
- **Root typecheck and configured lint:**PASS4tasks/0cached each. Mobile ESLint, web tsc and existing types no-lint placeholder; no claim of additional lint coverage.
- **Consumer Expo web build and professional Vite build:**PASS at exact current source. Generated web assets are not republished as source evidence; commands and full logs retained. No dependency installation.
- **Consumer manual intake:**actual Edge375×667,390×844,430×932 PASS; encrypted saved drafts, restart/source review, exact explicit confirmation and secondary-tab refusal. Full DOM/network/summary files under current/manual-browser.
- **Consumer six-row recovery:**actual Edge375×667,390×844,430×932 PASS; generic statuses, no private overview disclosure, no inspection adapter writes, explicit existing inventory routes, return/retry and keyboard targets. Files under current/recovery-browser.
- **Consumer optional history/draft recovery:**original unmodified E21 driver FAIL at375 before substantive history/draft cases; it used heading visibility to infer expanded history. E27 intentionally renders that heading collapsed, so it never pressed the opener and timed out waiting for “Nothing recorded”. Captured FAILURE.json confirms collapsed entry, no overflow. External evidence-only driver changes only import/repository relocation and expanded-history detection to the existing Find recorded changes control. Every original substantive assertion remains. Its complete375/390/430journeys PASS, including notes/corrections/retractions, original text, explicit review/refresh, exact targets, no duplicate IDs and canonical readback/retirement. Both runs, adaptation diff, exact original/external driver hashes and all receipts are retained. No application/test-source changes. Files under current/optional-browser and current/optional-browser-adapted plus reproduction/OPTIONAL_BROWSER_ADAPTATION.*.
- **Professional queue and owner journeys:**actual Vite/Edge375×667 and430×932 PASS. Real default API503 is tested; positive results are intercepted synthetic HTTP fixtures, never genuine backend identity, patients, grants or provider acceptance. Scope includes unknown-save identical retry, stale callback retirement and exact plan/version handling. Professional drivers do not retain an exhaustive whole-browser network trace, so no whole-device zero-egress claim.

## Failures retained rather than relabeled

Initial current-root-tests/current-typecheck/current-lint commands combined Turbo --force with --cache; argument validation exited1 before any task. Their full logs/receipts remain. Corrected valid commands ran uncached and passed; no source edit. Original optional browser failure remains as described above, not a product repair claim. The adapted run is separately named and uses the same exact application source.

## Historical source scope and RED/GREEN

All selected E20–E27R text records, including intermediate errors, logs, scripts, manifests, NOT_RUN receipts and reports, are retained under historical/engineering20 through engineering27R. Original inventory and original manifest verification are linked in the main index. Historical receipts describe historical source/dirty state; they are not promoted to current clean-HEAD execution.

| Campaign | Real historical evidence | Scope/caveat |
| --- | --- | --- |
| E20 | Final8407root tests; type/lint/web builds; bottle/professional375/430 | Final4dce checkpoint; detailed per-command receipts define tested candidate and source hashes |
| E21 | Final8527root/576files; type/lint/build; manual/optional375/390/430 | Precommit source hashes and all intermediate failures retained; first tooling/background-download attempt failed, later guarded offline drivers used |
| E22 | Protected v5 regression100PASS/1FAIL | Proposed hardening rejected; docs-only checkpoint, preserved root green is not candidate success |
| E23 | Proof-domain RED/GREEN and full/focused regressions | Exact canonical envelope vs event predecessor proof; legacy refusals retained |
| E24 | Static key-loader migration blocker | No product candidate/test/browser; NOT_RUN remains NOT_RUN |
| E25 | Initial179/1 storage,17/26 fixture, type and6formula setup failures; final8639root + browserr4 | No-write and admitted-write tests; six status rows; browser r1–r3 failures retained |
| E26 | Original23formula tests3times +8639root/type/lint | Test setup readiness only; no product or browser change |
| E27 | Initial47/1 new mounted fixture; then48pass; root7932mobilePASS/45FAIL | Two router mocks missing useFocusEffect; candidate retained dirty, type/lint NOT_RUN |
| E27R | Focused107/48/60;8652root/type/lint PASS | Ran on0998 with known four dirty files; hashes/blob equivalence authenticate later efd3 commit. New relay executions supply literal current clean HEAD |

## NOT_RUN and acceptance limits

No new native/macOS/simulator/physical-device check, protected hosted Security/DB acceptance, real backend/provider/payment lifecycle, scientific/clinical/J01 qualification, full VoiceOver/dynamic-type/device accessibility or production operations drill. Reasons: outside evidence-only/zero-cost scope, absent authentic custody/device/service prerequisites, or prohibited hosted/native operation. Complete ledgers: NATIVE_AND_EXTERNAL_QUALIFICATION.md and frozen-reference/NATIVE_EXECUTION_LEDGER47.md. Security/candidate29/G97/SDK/scanner findings remain unwaived; see SECURITY_PRIVACY_REVIEW.md. All38/all18 UNACCEPTED and releaseNO_GO.

Binary screenshots are omitted from this UTF-8 publication; exact original sizes/hashes and omission status remain in CURRENT_ORIGINAL_INVENTORY/HISTORICAL_ORIGINAL_INVENTORY. Actual captured text DOM/state/network evidence remains. Some historical drivers publish only pass summaries/screenshots, so no fabricated DOM or network log is added. Sanitized derived receipts may contain hashes of original unsanitized logs; MANIFEST gives both original and published hashes for independent comparison. No silent truncation.


## Complete ordered parts for large current logs

Concatenate raw part bytes with no added newlines; hashes and original/published sizes are in MANIFEST. No log is truncated.

### current/current-root-tests-valid.log

- [current/current-root-tests-valid.log.parts/part-001.txt](current/current-root-tests-valid.log.parts/part-001.txt) — order1, 245708 bytes, SHA256 `cf17f26c2872eea612631784da86b18223e3f90464768f2dd84b162eb4640741`.
- [current/current-root-tests-valid.log.parts/part-002.txt](current/current-root-tests-valid.log.parts/part-002.txt) — order2, 245757 bytes, SHA256 `25916a21e4d486aa1dcf2b4d825751d361e35969781f51525fe92fdea2692f59`.
- [current/current-root-tests-valid.log.parts/part-003.txt](current/current-root-tests-valid.log.parts/part-003.txt) — order3, 194088 bytes, SHA256 `8cfe99229957a0b9f77095ed9ddd90138d60a6e95cc88da9866897510e4b2298`.
