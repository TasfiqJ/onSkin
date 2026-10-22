# SOURCE-CLOSURE-03 / Cloud implementation contract

**Target:** finish genuine M1-03 source-only diagnostics and historical fixture closure entirely on Codex Cloud + existing GitHub CI, or provide a finite independent evidence packet for only the remaining protected owner/capability gates. Do not claim M1-03, G97 or release approval.

### 0. Exact read-only intake

Verify external manifest SHA256, compare exact existing source file Git blobs AND SHA256 against `04_SOURCE_EDIT_AUTHORIZATION.json`, stage `aa598d0c93fcc416ba02cbda9333953430bb2ede` tree `6dd2010073d913ca400c201f6d58ed1212fa97d4` and PR #9/main. Preserve all earlier SC01 and SC02 context/receipts/reviews byte-identical. Confirm no second active writer before editing. If unexpected drift, STOP and do not adopt current head.

### 1. Historical Git custody repair, then regression proofs

Fix verified sequencing defect in `scripts/security_readiness/m103/hydrate_history.py`: optional acquisition of real required missing objects from an *authorized exact Git object source* must occur before verifying witnesses, without accepting synthetic, wrong-type, wrong-OID, wrong-SHA256, untrusted or incomplete objects. First acquire necessary real historical Git reachability via connected authenticated GitHub `fetch`/unshallow when available; **separate network fetch/bootstrap from sealed offline checks**. Then keep `GIT_NO_LAZY_FETCH=1` for exact verification and trust-boundary tests. Prove original real source object IDs, commit/tree identity, no refs modified, private pack export/import into separate isolated object pool, no alternate to mutable live source, and negative missing/untrusted object refusal. Never fabricate old Git blobs.

New authority binds actual historical overnight test SHA256 `9aee4fe96c474edbc58fb3e63d48912b5eb6bc7718da51cdb4cf31f36fc3c46e`. Repair that historical fixture only if a new adversarial test demonstrates need. Preserve prior positive/negative semantics, original old source-interval tests, all symlink platform distinctions, no test removal or blanket skipping. `history_custody.py` may be tightened only with equivalence demonstrated by real endpoint fixtures.

### 2. Clean cloud execution

In a fresh isolated Linux workspace with complete Git history run full existing governance (historical **65** + SC01 **3** + new SC03 tests; SC02 had no new profile), count real skipped/error/fail/abort. Run independently original supported Linux Security **70** on exact head/history. Run forced root tests, typecheck, lint after pinned `npm ci` as feasible; count actual commands/exit/results. Compare original GitHub CI as **a separate independent provider**; don't borrow its 70/70 as cloud test evidence. Do not clean earlier evidence or mask any failed tests.

### 3. Standalone sealed candidate and new four-bundle SAST diagnostics

In isolated cloud Linux, verify official Semgrep original core, MCP1.30.0 METADATA/RECORD-only derivative, certifi2026.10.19 and **all 66** fully pinned wheels byte/RECORD integrity. Run at least **nine** genuine positive/adversarial isolation, network, install, capsule, and source-integrity tests. Require demonstrated no-network runtime via the project's existing sealed capsule. Then run a genuinely **NEW** four pinned rule-bundle scan against final measured committed Git source tree. Produce per-path/rule/language SCANNED vs UNSUPPORTED vs FAILED partitions, raw exits, parser warnings and source hashes. Investigate at most two distinct candidate-only hypotheses per class for 26 SQL parsing failures, TS AgeReverificationRights PartialParsing, and fixpoint warnings; no target exclusion, rule changes, blind timeouts, or false green.

Prior 4 SAST candidate findings, historical 5,439 provider secret records and 68 npm/5 OSV observations are historical only; record current original provider artifacts by exact SHA/receipt and leave all findings **UNKNOWN/UNREVIEWED** pending legitimate issuer. Never publish raw secrets or validate found credentials. If cloud runtime cannot enforce isolation, mark BLOCKED_CLOUD_CAPABILITY; do not substitute an open-network scan as sealed.

### 4. Original CI, owner boundaries, and evidence

Refresh original exact-stage-head and PR #9 checkout GitHub Quality/Security/iOS run, jobs and decisive step logs. Quality `aa598d0c` was failed (Expo patch compatibility; canonical Docker ECR pull again `toomanyrequests: Data limit exceeded`; PG15/17 passed; source exports skipped). Security was failed (original 70 security contract tests and 12 secret fixture tests did pass in previous checkout; original frozen source inventory and findings/advisories/expiry still refuse). iOS was success **source-contract only**. Record any further change as newly observed, never project old state forward. No change to packages, lock, frozen original Security inventory/rules/owner/exception/expiry/workflows, SQL/Edge/types, DB06/08/R2B, provider data or original CI configuration. Construct one precise qualified Security/DB custodian evidence request if truly the last gate.

### 5. Strict bounded delivery

Publish new checkpoint `docs/brain/checkpoints/M1-03/SOURCE-CLOSURE-03/` with intact exact input manifest, read-only baseline, content-addressed test receipts, finding/coverage matrix, blocker classification, `completion-report.json`, and final source-only authorization marker; copy Brain-provided immutable decision to new separate review path. Maintain historical issuance/validator interval semantics. Distinguish source implementation SHA/tree, final measured SHA/tree, evidence-only tail, final pushed stage SHA/tree, original PR merge checkout SHA/tree, raw exits/skip/error totals and candidate vs original findings. For every claimed committed safe artifact, record verified hash. Preserve accepted M0/M1-02 state, 47 roadmap tasks, 27 module identities, 51 ADR records and zero new spend.

Only normal commits/pushes to `stage/m1-retained-safety` are authorized, after verifying unchanged expected origin and no competing writer. Never force/rebase/merge `main`, alter PR #9 draft state, start M2/J05 or self-accept. If GitHub cloud task cannot push normally with its connected account, leave commits in the task and return `BLOCKED_PUSH_PERMISSION` with exact branch/commit and no alternate main PR. At HIGH context/compaction, preserve safe work, publish if authorized and stop for Brain review.
