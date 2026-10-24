# Limited permission to repair the worklist Quality drift

First restore **non-admitting** generated worklist coherence after the real authored source change. Allowed exceptional output modifications:

- `docs/phase-4/generated/source-worklist.json`
- `docs/phase-4/generated/source-worklist.md`

Generate these only with the **unchanged original** `scripts/phase4/build-source-worklist.mjs`. Understand/verify `--strict --check` and the normal generator CLI. Run with all authoritative input paths present; if working from sparse checkout, safely materialize missing read-only Git input paths without changing their bytes or source status. Hash and diff both output files; do not edit their payload by hand or rewrite the generator/policy/tests to waive a failure. Preserve blocked launch items and all existing source hashes and source identities. Record the exact measured source commit/tree and regenerated working inputs. Run clean positive `npm run phase4:source-worklist:check`, plus an adverse test on a **disposable copy** showing referenced input tampering causes check refusal; do not alter protected files for the negative test. Do not claim source acceptance.

This finite permission DOES NOT extend to any other `docs/phase-4/**` path, catalog legal approvals, signed authorization, `scripts/phase4/**` code, `docs/brain/state/**`, `.github/**`, G97 manifests or any Security workflow. An additional quality failure must be classified, not bypassed.
