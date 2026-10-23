# Diagnostic results

Status **PARTIAL_DIAGNOSTIC**. Measured source `4f6a2d2c84a06ba9b794967fb76a5f9b6fc994fe` / tree `791580347993487bd3920727ee7b0e31668eed4e`. No protected source edit. Delivery is an evidence-only normal descendant on existing `stage/m1-gate-recovery`; its actual SHA/tree and post-push CI are returned externally after push, avoiding a fabricated self-hash.

| Check | Raw exit / disposition | Evidence |
| --- | --- | --- |
| External R1 context verification | 0 / VERIFIED | exact command in README; preserved inputs |
| Exact checkout / all 20 Git and working preimages / fingerprint / live refs and draft PR | PASS | evidence/preflight.json, preflight-rows.json |
| Original inventory predicate | 1 / EXPECTED FAIL-CLOSED | evidence/inventory-reproducer.json |
| Frozen coverage partition schema and denominator | PASS structural check only | SCAN_COVERAGE_MATRIX.json; no current SAST coverage |
| Five current app Git source samples | PASS exact byte witnesses | evidence/current-source-samples.json |
| Four original provider ZIP identities | PASS digest and member-hash verification | evidence/provider-artifact-identities.json |
| Original 70 provider contracts | PASS observed in exact-tree static log | evidence/provider-log-excerpts.json |
| First local original 70 attempt | 1 / missing locked YAML; 23 failed subtests, 2 errors | evidence/fresh-tests.json, local-test-dispositions.json |
| Fresh local original 70 after exact locked YAML installation | 0 / 70 passed | evidence/fresh-contract-retry.json |
| Fresh original secret contracts | 0 / 12 passed | evidence/fresh-tests.json |
| Fresh original exception/expiry contracts | 0 / 8 passed | evidence/fresh-tests.json |
| Optional standalone pinned SAST bootstrap | 1 / BLOCKED, Python pip missing | evidence/sast-attempt.json |
| Original rule-family availability | OWASP hash drift; other three match | evidence/rule-acquisition.json |
| Current SAST findings / scanned denominator | NO_EVIDENCE / null | No scanner ran, no percentage claimed |
| Original Gitleaks current/history | 2 / 1,120 current; 2 / 4,349 history | SAFE_SECRET_DISCREPANCIES.json |
| Original TruffleHog 3.99.3 current/history | 0 / verified zero, complete terminal events | same sanitized proof; no global secret acceptance |
| Original npm high audit / SBOM audit / SBOM | 1 / 1 / 1; 67 propagated high records, two roots | evidence/advisory-identities.json |
| Original OSV / npm exception / OSV exception | 1 / 1 / 1; findings and expiry remain | same sanitized identities |
| Original automated admission | REJECTED / PROPOSAL_EXPIRED_OR_CHANGED | original decision artifact, summarized |
| Original Security / Quality / iOS | FAILURE / SUCCESS / SUCCESS SOURCE_ONLY | evidence/provider-observations.json |

Provider run metadata has head SHA equal to the issued stage, event pull_request. Artifact source SHA is the actual PR merge commit `21dada6c761a56eaac1f1f2e8562fad6903bf50f`; live GitHub Git-data read confirms tree `791580347993487bd3920727ee7b0e31668eed4e`, with parents fixed main and issued stage. That is exact source-tree equivalence, not identical commit identity. Quality canonical job `120231715918` succeeded, including reset-twice/tests/lint/drift; no local image pull or hosted replay was attempted.

TECHNICALLY_TESTED: the issued observed source tree has genuine provider Quality/canonical DB and source-only iOS success; Security is genuinely red. Local original negative/expiry checks are recorded separately, including the initial missing-dependency failure. PRIOR_AUTHORIZATION: this R1 read-only grant is externally verified; alternate earlier SBOM/Vitest source issuance provenance remains UNVERIFIED, despite technically substantiated changes. CURRENTLY_ADMITTED: original Security and whole M1-03 remain false; only previously accepted M0-01/M0-02/M1-01/M1-02 remain accepted.

Preparation failures are retained: Windows long-path configuration in the disposable clone initially made status appear modified; clone-local longpaths=true and autocrlf=false restored a clean byte-identical checkout without editing source. The first inventory helper used ordinary Windows paths and failed to open a long filename; it was corrected to reuse the original `contract.physical()` helper and then completed. A temporary provider download URL expired (HTTP 403) and was refreshed through the connected read-only artifact tool, yielding the same digest. The first sanitizer incorrectly required the Match context to be exactly the redaction marker; the original contract redacts Secret only. The corrected reducer verifies Secret=REDACTED and withholds all Match/context fields regardless. None of these failed attempts is a scanner result or an admitted zero.

Context health: R1 packet independently verified, complete exact inputs retained, obsolete packet not mixed, sole repository checkout respected, no competing writer observed, no credentials/account/paid service used. Optional scanner provenance/coverage remains explicitly blocked. All admission flags remain false; incremental spend $0. STOP for independent Brain review. Founder relay: **Codex is done**.
