# Exact source permission — `M103-SECURITY-HARDEN01-SOURCE-EDIT-01`

The machine-readable allowlist is `REVIEW_STATE/SOURCE_EDIT_AUTHORIZATION.json`. Every existing preimage SHA-256 was obtained from the exact pushed `8babdad11791496ad6e8c45154b3b173bdddd36e` Git source; confirm exact preimage and ancestry before editing. Changes outside the listed paths/`scripts/security_readiness/m103` (new .py/.mjs/.md only) and narrow new review/checkpoint paths are not authorized. Do not reinterpret the earlier interval's source authorization, create new branch, or reset main.

`test_secret_scan.py` may change only test fixture execution/teardown and regressions. Active Security helper `secret_scan.py`, the original workflow, G97 proposal/collector/requirements/history/rules and all exceptions/expiry stay untouched. Candidate modules may change for exact byte integrity, source execution coverage, redacted diagnostics and tests only; they have no admission consumer.

No app, SQL, Edge, DB type, Phase2, native SDK, dependency lock, toolchain, hosted service, schema or release artifacts. No emergency override based on CI failure. Unexpected necessary change is an inert exact proposal and does not block another ready workstream.
