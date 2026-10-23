# Measured technical results

Measured source is `efc75bf119904f983e40380067f682d111da52dd` / tree `85568597205ccb6ee5a94fe16db063f78abbc70f`. The fresh no-hardlink Linux test checkout was clean, all 20,032 tracked paths were inventoried, and all 25 witnesses were rechecked against that source (the target matching its exact authorized postimage). Runtime: Node 22.21.0 and Python 3.12.3. Every command, working directory, timestamp, duration and actual exit is recorded in its `evidence/*.json` receipt, with its full technical transcript in the corresponding `.log`.

| Measurement | Actual exit | Result |
| --- | ---: | --- |
| External context anchor and immutable input copy | 0 | VERIFIED; all 13 manifest members |
| All stage preimages before mutation | 0 | 25/25 byte, size, Git blob and SHA256 matches |
| Original targeted test before editing | 1 | Required RED: `WORKFLOW_SBOM_UNRELATED_FAILURE_OR_DRIFT` |
| Exact patch and target postimage | 0 | Exact SHA-bound committed patch; exact 49,880-byte postimage |
| Original contract discovery | 0 | 70/70 PASS, no skips |
| Original secret fixtures | 0 | 12/12 PASS, no skips |
| Six original positive/adverse cases | 0 | 6/6 PASS |
| Additional disposable negatives | 0 | 2/2 PASS |
| Fresh `npm ci` | 0 | 1,037 packages added, 1,041 audited; reported 27 vulnerabilities, no audit fix |
| Forced repository tests | 0 | 6,067 PASS: 6,043 mobile and 24 console; zero cached tasks |
| Forced typecheck | 0 | 3/3 tasks PASS; zero cached tasks |
| Forced lint | 0 | 3/3 tasks PASS; zero cached tasks |
| Strict canonical Phase 4 worklist check | 0 | Current and PASS; no regeneration |
| Ordinary governance discovery | 0 | 103 discovered: 101 PASS, only two legitimate Windows junction skips |
| Frozen prior GF01 profile | 1 | BLOCKED: `Wrong GF01 branch`; profile preserved |

The six original selected methods cover the technical-only positive; SBOM blocker/count/package/provenance/signoff/age tampering; non-1 SBOM/audit exits; unknown npm/OSV findings; component and dependency-edge omissions; and exact policy/scope/expiry restrictions. The two new tests alter only disposable fixture outputs: malformed or unknown current package paths, and an unknown primary advisory in the separate SBOM audit. Each new negative is bracketed by unchanged positive validation. No synthetic result is stored as a scanner receipt or approval.

The exact expected producer exit 1 is asserted by the authorized fixture on every invocation. All 70 original test bodies and the complete module outside `ContractTests.workflow_fixture` are unchanged, independently checked against the issued Git object. Protected policy/source/scanner/workflow witnesses remain unchanged.

Historical real Security run `39833311172` remains FAILED and stale for replay. Fresh source-commit-associated PR Security run `39890269391` has independently failed its code, static and secret enforcement jobs. Both unreviewed advisory identifiers and expired-review refusals remain in its code-job log. Only sanitized identifiers/booleans and job/step metadata are retained. Fresh Quality run `39890269416` reproduced the canonical `Data limit exceeded` failure; successful PG15/17 rehearsals do not establish canonical parity. Full run and final delivery-head status must be read from the timestamped CI receipts; PENDING is never promoted to PASS.

Preparatory quoting, incompatible Turbo flag and Windows transcript-printing errors are preserved in `evidence/infrastructure-notes.json`. The corrected actual repository test exited 0; its already captured raw log and exit receipt remain unchanged. These infrastructure attempts are not source test failures, retries that conceal a failed test, or substitutes for an original validation result.

Security admission CLOSED; protected source GO false; database, clinical, commercial, M2, device and release axes are not admitted. Final status is bounded by independent Brain review.
