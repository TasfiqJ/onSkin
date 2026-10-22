# Exact engineering task — fix historical fixture custody without weakening tests

## A. Scope-bound fixture repair

Review the actual ordinary Linux full discovery error at QR03 and identify the exact historical stage snapshot that each predecessor test models. In `scripts/brain/test_m103_quality_recovery02_profile.py`, alter **only fixture construction within `setUp`** so it pulls `QR02_ACTIVE`, `.gitattributes` and governance `scripts/brain/m103_profile.py` from the *correct immutable QR02 delivery endpoint* instead of copying newer `brain.ROOT` bytes. This endpoint is `3dcaf50633024ec652fe7b14a5c9072eac92642e` (tree `fd98eedb0cef6644d8e1538047aacbe44f10d837`). All source bytes must come from authentic `git show` of that commit; verify their Git blob and SHA256 and fail closed for missing objects. Existing exact input/review file bytes stay immutable.

In `scripts/brain/test_m103_quality_recovery03_profile.py`, apply the same future-safe historical-input pinning for its QR03 predecessor fixture at `dbcfce9770850d4655221bd3d4c3b5799553aed2` (tree `93d9a5789c1ce443cf0bcd86696fff044ff2fd64`). Avoid global mutation of `brain.ROOT`, shell/environment shims or swapping real-current inputs for fabricated copies. Preserve its QR03 original assertions/negative cases.

Only `setUp`/its narrowly needed helper lines may change in those *two original test modules*. Preserve **all original test method names, test bodies, assertions, expected rejection codes, skips and negative coverage**; prove AST/method equality excluding fixture construction and prove original negative cases really still execute. If exact historical bytes cannot be acquired or p.* validator constraints demand broader changes, STOP BLOCKED. Do not update or modify old Brain reviews, authorizations or checkpoint source.

## B. New source-only exact governance and evidence

Add a disjoint `GOVERNANCE-FIXTURE-01` successor in `scripts/brain/m103_profile.py`; do not union previous source allowlists or bypass QR01/QR02/QR03 fixed historical refusals. Its independent active authority under `docs/brain/m103-governance-fixture01-active.json` must retain accepted tasks M0-01/M0-02/M1-01/M1-02, source-GO=false, main-promotion=false, hosted-replay=false, spend0, one writer. Add `scripts/brain/test_m103_governance_fixture01_profile.py` with at least six substantive tests/adverse cases including tampered historical source, later QR03 marker contamination, wrong branch/head, out-of-scope intermediate/reverted commit, expired proposal/false-GO/extra task, immutable issuance and report tampering. No test may be removed or artificially skipped.

Expected ordinary full discovery: baseline 93 tests, two genuine Windows-junction-only skips, plus >=6 new tests. The regular `python3.12 -B -m unittest discover -s scripts/brain -p 'test_*.py' -v` **must** finish with zero failures/errors on the exact current checkout; the special frozen-endpoint harness is diagnostic only, not acceptance. Existing original Security contract70 may remain RED for genuine unrelated `WORKFLOW_SBOM_UNRELATED_FAILURE_OR_DRIFT`; never alter frozen Security tests or fixtures to make it green.

## C. Evidence and delivery

Run full original ordinary suite, the targeted QR02 and QR03 modules, forced root tests 6,067/typecheck/lint with zero cache, original secret12, strict source worklist and M1-03 profile/report. Ensure no unexpected change to app dependency lock, widget/native, privacy mapping, original G97, DB/SQL/workflows/clinical or source-review permissions. Record actual command argv/cwd, exact source SHA/tree, raw exits, failures/skips, committed regular Git blob SHA256s, and final original GitHub Quality/Security/iOS jobs. Keep all failures as factual evidence; no false green when original owner gates remain red. Incremental spend $0.

Delivery must be an immutable `docs/brain/checkpoints/M1-03/GOVERNANCE-FIXTURE-01/` checkpoint, installed exact input/review context and handoff, one safe normal push to existing stage only, independent Brain stop. Do not merge, rebase, force push, start M2 or create new architecture tasks.
