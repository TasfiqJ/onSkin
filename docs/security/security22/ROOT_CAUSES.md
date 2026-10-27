# Campaign22 baseline public-source and CI evidence

Qualification: PUBLIC_SOURCE_AND_SANITIZED_CI_METADATA_ONLY. No raw Security findings, logs, artifacts, credentials, private workspace or private remediation commit was opened. No scanner was executed by this worker. These observations grant no acceptance.

## Live baseline

PR25 remains open, draft and unmerged at commit `2cffa9e92be101af4e3b371f1815ec9f458d8da4`, tree `9380dd155ee2c7879de7ef79eb27d0028b950d13`, with PR24 base `3c8cb787f3770df09f0ae4507bca9ac49fb5a079`. Maintainer modification is false and auto-merge is null. Exact-head run identities, all twelve job/step summaries and complete job-page denominator checks are in baseline-ci-source.json.

## Supported root-cause map

| Original job | Actual exact-head result | Public evidence supports | Public evidence does not establish |
| --- | --- | --- | --- |
| Code security gates / 122006622883 | FAILURE | Enforcement step failed. Workflow security.yml:144 requires raw dependency SBOM outcome failure; workflow_contract.mjs binds the exact historical expired-policy refusal with audit/SBOM exit 1. | REST SBOM step conclusion success does not prove its raw outcome or exit. It does not establish which enforcement command failed. |
| Secret scanning / 122006622513 | FAILURE | Final proof enforcement failed. Public secret_scan.py validates source/ref/tool/exit/output and report consistency, then typed current-source disposition. | Successful wrapper conclusions do not establish clean findings or complete valid proof. Exact private refusal/finding disposition is unknown. |
| Static analysis and OSV / 122006622783 | FAILURE | Stage verified technical receipt and final enforcement failed. Independently rerun original public source contract refused SOURCE_INVENTORY_DRIFT at the pinned checkout. Separate policy validation refuses PROPOSAL_EXPIRED_OR_CHANGED. | Metadata does not identify the exact remote exception or raw scanner results. This worker does not attribute a private finding or tool failure to this job. |
| Automated single-owner source-only Security acceptance / 122008069700 | FAILURE | Require complete original and exact-source technical evidence failed. All three original prerequisite jobs failed. Public workflow_admission.py requires original outcomes, source bindings, raw artifacts and fresh technical receipt. | A decision descriptor published by an always-running upload step is not admission success. |
| Live Supabase adversarial evidence / 122006623764 | SKIPPED | No executed live-custody proof is available from this job. | Skipping is neither a clean scan nor qualified custody acceptance. |

The read-only source-contract execution at the pinned full checkout was:

`python -B scripts/phase9/security_acceptance/contract.py source --root .`

Actual exit: 1. Output: `{"status":"REJECTED","code":"SOURCE_INVENTORY_DRIFT","rawScannerPass":false,"acceptanceGranted":false}`.

The immutable historical manifest contains 11,920 rows plus two contract documents, giving 11,922 expected paths. The current pinned checkout has 23,424 tracked paths: 11,502 additional paths and zero missing historical paths. The public contract requires exact inventory equality, so it deliberately refuses this current source. Its separate inactive-proposal clock window ends exclusively at 2026-10-21T00:00:00Z, yielding PROPOSAL_EXPIRED_OR_CHANGED on the current date. Do not refresh its manifest, dates, policy or admission.

## SBOM lead: outcome versus conclusion

The original SBOM step uses continue-on-error:true. GitHub documents that a failing step under this setting can have outcome failure and conclusion success. The REST job metadata reports conclusion, while the workflow compares steps.dependency_sbom.outcome. Consequently the observed success conclusion and the required failure outcome are compatible; changing the comparison would weaken a deliberate historical contract without proving a defect.

Primary semantics: [GitHub Actions steps context](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#steps-context).

An additive current-source technical path must bind actual exits, complete current inventories and scanner coverage independently. It must preserve the original historical refusal and all custody requirements.

## Other baseline CI

Quality 40448882137 attempt 1 remains FAILURE: repository quality gates, PostgreSQL15/17 rehearsals, and both unsigned Expo export jobs succeeded; canonical credential-free Supabase reset/database job 122006623080 failed its reset/test/lint/drift step. The registry quota diagnosis is authenticated packet evidence; this worker did not read raw DB logs or rerun the database.

iOS launch contract 40448882136 attempt 1 and job 122006622461 succeeded. These are original-head CI observations, not Campaign22 final-head checks.

G97 FAIL/NO_GO; database and M1-03 custody remain NOT_ACCEPTED; source acceptance SUBMITTED_REVIEW_REQUIRED. No public release or merge authority is granted.
