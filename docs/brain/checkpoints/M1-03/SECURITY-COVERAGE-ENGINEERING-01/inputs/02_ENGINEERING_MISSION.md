# Goal: substantial verified current-source inventory and SAST coverage recovery candidate

You own implementation approach and safe troubleshooting. Execute workstreams in whichever order produces the most genuine progress; up to THREE bounded meaningful hypotheses per blocker, but do not endlessly repeat scans or leave an empty checkpoint. Do not ask founder to choose versions or classification. Use genuine proof, not waiver.

## A — Implement a reusable source-bound inventory review engine

Create clean, well-documented new code/tests **only under** `scripts/security_readiness/m103/source_inventory_review/**`. Reuse original read-only logic from `scripts/security_readiness/m103/source_scan.py` and `scripts/phase9/security_acceptance/contract.py` where possible rather than cloning weaker Security policy. The engine must derive every regular Git blob from a fixed exact commit/tree, distinguish tracked, ignored and nonignored untracked paths, compare to frozen reviewed inventory, report added/changed/missing/unchanged with blob+SHA256+byte identities, and produce deterministic, bounded fully partitioned target/reason rows (`required`,`auxiliary`,`excluded`,`REFUSED`) with explicit no-claim flags. Fail closed on traversal, symlink/unsafe Git mode, corruption, duplicate paths, noncanonical order, truncated gzip, excessive inflation, oversize, missing SQL, omitted target, changed file hash, added evidence tail, false original Security acceptance, invalid rule pin. Never hide checkpoint blobs from denominators.

If source/policy handling of actual extra gzip or >4MB files requires a new rationale not justified by original controls, mark `REFUSED` and retain the counted obligation; do not invent an exclusion. Preserve all original 26 SQL exact targets, previous 189 historical failures and 368 fixpoint events as obligations distinct from fresh SAST results. Negative cases must prove missing/changed evidence and restoration cannot silently pass. Bind candidate outputs to measured code source SHA/tree and separately account for evidence-tail additions after implementation.

## B — Produce an actual reviewable, fully enumerated candidate

At the current exact implementation source, generate sharded machine-readable candidate inventory and target reconciliation: one and only one row per relevant path, old reviewed hash vs current Git hash (no raw contents), original classifier, proposed disposition and evidence/approval state. Produce proof of denominator closure and refusal lists plus optional *candidate-only* patch for original source-manifest/scan-target/contract and exact derived proposal hash fields **inside the checkpoint only**. Do NOT apply those patches to live original protected source or conceal any canonical policy self-reference/cycle. If the frozen policy is mathematically unmaintainable under append-only evidence tails, demonstrate the exact cycle with a deterministic failing test and one narrowly scoped proposed technical solution that preserves historical chain-of-custody and fails closed. No blanket exclusion of historical checkpoints, no silent `source-only GO`.

## C — Recover actual OWASP provenance if genuinely possible

Perform at most two independently meaningful retrieval/verification approaches for the missing four-rule OWASP bundle, verifying exact required SHA256 `5878942efc5da41d2124bbf32a627db594cc63c29c524737c36e54ba677270d1` against actual bytes and trusted issuer; do not claim official registry `c552bf8a...` is equivalent, do not substitute a new rule, and do not run unpinned live source scanners. If unrecoverable, return a *single precise legitimate OWASP custodian packet* requesting the exact hash-bound bytes/issuer, and continue the other workstreams.

## D — Safe Security and CI evidence

Read original exact-head Security outcomes, secret findings, advisory classes and ECR Quality jobs without raw secret values or credentials. Keep Gitleaks current/history finding counts explicitly unreviewed; do not delete, test, or print any found secret string. Do not upgrade npm/OSV/policy/exception packages or modify G97 in this task. Run canonical tests against authentic source and report nonzero real Security/Quality/scan exits as nonzero. Source-only iOS passing cannot grant device/release.

## E — Delivery

Commit the tested new independent reconciliation utility, meaningful adversarial tests and SHA256-bound checkpoint outputs. Only allow legitimate canonical generated Phase4 worklist edits if the new script source causes worklist drift; regenerate with original generator from measured clean source. No existing source/security edit other than factual root handoff. Provide `README.md`, `RESULTS.md`, `BLOCKERS.md`, `INVENTORY_PROOF.md`, `OWASP_CUSTODY.md`, `NEXT_EXACT_SOURCE_SCOPE.md`, `completion-report.json`, `SHA256SUMS.json`, test/adverse receipts and input context. Normal stage push only; no PR10 merge/ready or main mutations. STOP for independent Brain review.
