# Independent Brain audit — M1-03 / OVERNIGHT-01

**Decision:** PARTIAL_ACCEPTANCE_CONTINUATION_REQUIRED. Reviewed `8babdad11791496ad6e8c45154b3b173bdddd36e` (tree `cf2ff58cc140956d8c3cda4a11c703733ebe6544`) from `7305ff24c78d2f9d883e26a7ba2a8e6169902fd8`. Main `bbc28dc3d1f945191a81be56945b8bda7bb6ef73` unchanged. PR #9 draft/unmerged. No Security source GO, database replay, M2 issuance or main promotion.

## Method, attribution and scope

- Fresh authenticated GitHub PR/branch, commit comparison and original CI job/step/log inspection; seven new commits inspected. Confirmed actual stage head and 22 changed non-evidence paths (native mappings, derived artifacts, governance and isolated diagnostic tooling). All 97 migration files, protected DB06/DB08/R2B controls and original Security workflow unchanged in this interval.
- Independently ran fresh-clone Windows `npm ci`, forced app tests (6,043 mobile + 24 console = **6,067 pass**), typecheck/lint, source-only native strict audit, 29-workflow/historical SBOM tests, **62 governance methods with two genuine Windows-specific skips**, 3 candidate diagnostic methods, clean-clone strict M1-03 report validator and strict source-worklist check. All these commands exited zero; native audit retains `archive_required`.
- Independently reran Linux diagnostic unit methods (**3 passed**) and original secret-scan contract suite **three times, 10 pass each** in a fresh Linux clone. This does **not** erase the new actual GitHub CI failure. A first Linux run of the separate original 70-test suite lacked the exact installed dependency closure and failed (23 failures, two errors); after the required fresh `npm ci`, the correct prepared Linux environment ran **70 passed, 0 failures**. Preparatory failure is preserved, not called a pass.
- Independently reproduced two candidate integrity bypasses using disposable local fixtures: editing `__pycache__/example.cpython-312.pyc` leaves `candidate.installed_tree` unchanged, and changing an exported `source.py` after snapshot leaves `source_scan.validate_inventory` accepting its Git path/blob manifest. The tool also lacks a post-engine file rehash; these are real diagnostic-integrity defects, not evidence of actual exploitation.
- Codex reports two independent fresh 66-wheel Python3.12 candidate installations, a deterministic Semgrep1.181.0 `METADATA`/`RECORD` derivative for MCP1.30.0 with certifi2026.10.19, and actual compatible local core/sandbox runs. These installation/scan outcomes are **source-reported** until independently replayed in full; unit tests and code were inspected. The derivative is not upstream and is never admitted.

## Engineering acceptance

| Area | Decision | Evidence |
|---|---|---|
| A: native mapping/derived audit | **ACCEPTED_SCOPED** | Three lock hash changes match current Vite lock; native versions/integrities/source pins unchanged; regenerated two outputs; independent strict native audit passes; no archive claim. |
| A: historical SBOM fixture | **ACCEPTED_SCOPED** | Immutable pre-Vite lock snapshot used test-only; independent 29/29 workflow tests pass; production SBOM/expired reviews unchanged. |
| A: late evidence publication | **ACCEPTED_SCOPED** | Twelve exact original safe logs committed as later publication; original omission not backdated; Codex clean-clone proof binds 829 former and 106 new artifacts; **Brain independently ran the strict issued M1-03 report on a fresh isolated clone and it passed** with the full committed source, no ignored artifact restoration. This is evidence integrity, not approval of every reported execution. |
| B: isolated candidate tool | **PARTIAL_DIAGNOSTIC_ONLY** | 3 Linux diagnostic unit methods independent; two bypasses reproduced; no accepted tool/cert/security provenance or workflow adoption. |
| C: current SAST/secret/dependency triage | **PARTIAL_BLOCKED** | Measured source snapshot: 18,782 paths; 12,176 scanner-covered, 6,580 unsupported/binary/nonregular, 26 SQL tests failed/blocked. Three SAST findings unreviewed; OWASP timeout and TypeScript PartialParsing. Prior 5,439 secret records remain UNKNOWN; npm68/OSV5 and six graph path gaps retained. These measurements apply to measured `3c063dfe47d887e7aa3e27d05da41658b69a59dc`, not automatically delivery head. |
| D: DB custody | **CUSTODY_TRACED_ONLY** | Source DB06 unconditional replay guard unchanged; DB08 linked parity absent; R2B `supabase_admin` default-ACL issuer/receipt unknown. No hosted replay authority. |

## Exact-head GitHub CI and regression

- **Quality 39545262835:** completed SUCCESS. Repository, PG15/PG17 rehearsals, credential-free canonical DB job 119041893746 and both Expo source exports passed. This is a new exact delivery observation, not permanent registry reliability and not DB06 authorization.
- **iOS source contract 39545262853:** SUCCESS, source-only; no signed archive or native device evidence.
- **Security 39545262842:** completed FAILURE. Original secret-scan job 119041893805 failed in `test_safe_archive_and_byte_substitution_refuse_before_execution`: 9 tests passed, one `TemporaryDirectory` cleanup error `OSError: [Errno 39] Directory not empty: '.git'`. Later scan steps skipped; source acceptance did not pass. Independent 3x local 10/10 does not erase CI red. Static tool collector still refuses `SOURCE_INVENTORY_DRIFT`; code/npm/OSV/expired reviews and G97 expiry remain protected refusals.

## Required next work

1. Fix the original secret-scan **test fixture lifecycle** causally with deterministic process/temporary-directory cleanup and adverse proof. Do not suppress failures, mask a scanner or change an active workflow merely to pass.
2. Harden candidate installed-tree verification against compiled Python/startup artifacts and post-export source tampering, with proof that each scan's report binds immutable bytes and that tampering refuses.
3. Analyze and, where legitimately possible without changing rules/policy/app, restore 26 SQL target coverage, actual timeout and PartialParsing source diagnostics. Preserve noncoverage when unfixable.
4. Produce exact-head, redacted, independently checkable finding partitions; never republish raw secret evidence or admit any credential. Preserve all actual findings and unknowns.
5. Keep G97 expired, DB06/DB08/R2B unavailable, Security findings/owners unapproved; no `main` promotion, M2, paid vendors or release.

## Evidence limits and custody

Independent GitHub CI and isolated source checks are not expert/legal/native/clinical or commercial evidence. Secret findings are not adjudicated. The candidate engine's unofficial derivative and source-level tests do not establish independent validated scanner trust. The original SourcePack identity/27 modules/47 roadmap tasks are retained. The last accepted ordinary app runtime head remains M1-02 at `2de9ef75a1a1d539b0520ca22160abd6171c9c3b`; overnight native/tooling is a scoped diagnostic checkpoint only.

Updated: 2026-10-21T11:10:53+00:00. No execution, spending, live-hosted mutation, or Git push performed by Brain.
