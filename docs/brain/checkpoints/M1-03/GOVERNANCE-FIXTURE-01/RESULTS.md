# Results

Measured source `1dc58a5c5e49c3ffeada603f7e6f6038fc12803d` / tree `b0a80f55a472fc28f02a5e993912314a17726f6c`.

| Command receipt | Actual exit | Observed counts |
|---|---:|---|
| full-governance | 0 | {'passed': 101, 'failed': 0, 'skipped': 2} |
| targeted-qr02 | 0 | {'passed': 8, 'failed': 0, 'skipped': 0} |
| targeted-qr03 | 0 | {'passed': 8, 'failed': 0, 'skipped': 0} |
| fixture-ast-proof | 0 | command passed; no test count asserted |
| fresh-npm-ci | 0 | command passed; no test count asserted |
| forced-root-tests | 0 | {'passed': 6067, 'failed': 0, 'skipped': 0} |
| forced-typecheck | 0 | command passed; no test count asserted |
| forced-lint | 0 | command passed; no test count asserted |
| original-secret12 | 0 | {'passed': 12, 'failed': 0, 'skipped': 0} |
| source-worklist-check | 0 | command passed; no test count asserted |
| original-security70 | 1 | {'passed': 62, 'failed': 8, 'skipped': 0} |
| strict-profile | 0 | command passed; no test count asserted |

The original ordinary baseline ran 93 tests with three failure events, one error, and two genuine Windows-only skips (exit1). That red baseline and the successful replacement are both retained. All baseline test IDs remain present; exactly ten new IDs were added. Negative tests still reject false GO, wrong branch/head/base, altered issuance/review/preimages, protected-source drift, tampered report artifacts, later QR03 contamination and unauthorized intermediate/reverted commits. The two original modules' 16 test ASTs and exact bodies are unchanged.

Fresh npm ci added 1,032 packages. Forced root tests pass 6,067/6,067; typecheck/lint pass; each forced command reports zero cached tasks. Original secret12 passes. Original Security70 is accounted independently and retains its actual exit/errors, including any genuine WORKFLOW_SBOM_UNRELATED_FAILURE_OR_DRIFT. No Security source, rule, fixture or acceptance record was edited.

The clean canonical Phase4 strict worklist check passed with no generated-file changes. Source code ends at the measured commit; subsequent changes are evidence and handoff only. The strict completion report and SHA256 manifest are checked against committed regular Git blobs after the evidence commit. Exact final-head GitHub Quality, Security and iOS jobs are captured after normal stage push in the accompanying return receipt; no pending run is called PASS and no historical run is relabeled as final-head.

Context health LOW, sufficient, no observed compaction. Stop for independent Brain review. No whole-M1-03 acceptance or protected admission.
