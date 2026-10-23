# Results: PARTIAL_DIAGNOSTIC

No live technical source change qualified. The tested implementation remains `0ecfa2a646ce9b30e717f6995097515f884cfdaf`, tree `b6b5ec635dd12e327a34904ebbd1e1252715bcd4`. Actual stage vulnerability reduction is zero. Evidence-only milestones are d53202d84b029b6ef783d2aeb24a5772b4846b9c and 32d23e4d787b75fa81b1e8d414efa1e1930f0265 (tree e5612a5dfb2dd989a10b023ccc50acc532928197). Final pushed SHA/tree and final-head CI are read externally after the final evidence commit; this document does not invent a future self-hash.

| Exact-source local check | Actual exit | Seconds |
| --- | ---: | ---: |
| initial npm-ci | 0 | 36.16 |
| initial security70 | 1 | 159.1 |
| initial secret12 | 0 | 3.82 |
| initial expiry8 | 0 | 0.12 |
| initial governance103 | 124 | 600.02 |
| initial mobile-expo | 0 | 0.37 |
| initial ios-source-check | 0 | 1.17 |
| initial worklist-check | 0 | 0.22 |
| initial strict-original-report | 1 | 0.17 |
| initial strict-gf01-report | 2 | 0.07 |
| initial npm-audit | 1 | 2.52 |
| after npm ci security70 | 0 | 172.85 |
| after npm ci strict-gf01-report | 1 | 0.12 |

The complete original 70 Security contracts pass after fresh authenticated npm ci (1,032 packages). Before installation, the suite had 23 failing subcases/two errors because YAML was unavailable to workflow_contract.mjs; that failure is retained. Secret12 and expiry8 pass. Strict iOS source privacy, Expo SDK compatibility and canonical original worklist checks pass. Original historical report refusal and correct M1-03 GF01 `Wrong GF01 branch` refusal remain real exits 1. The wrong-profile invocation's exit 2 remains an invocation error, not an admission test.

Ordinary governance exits 124 at its 600-second bound with 80 cases started and no final suite result. It is INCOMPLETE, never a 103-case pass. Full forced 6,067 root tests/typecheck/lint with zero cache are NOT_RUN in this diagnostic-only wave. No live source-edit eligibility is claimed from incomplete validation.

Candidate engineering: all 66 old wheels and 13 changed/new family wheels authenticated, full old original/assembled trees reproduced, official wheel unchanged, exact four-line custom installed METADATA patch retained, genuine dependency-aware old/new solver checks and pip checks PASS. Actual old/new Semgrep startup/core, actual Semgrep MCP lifespan/session/tool, stateful HTTP lifecycle, actual Semgrep OTel configuration/propagation/thread context/local OTLP exporter PASS. Three original rule bundles produce the same two synthetic findings with a clean negative fixture and no errors/skips/fixpoints. Full four-rule proof is BLOCKED by unrecovered OWASP bytes. Unknown wheel/version/metadata/double patch, missing dependency, incompatible dependency/extra and extra scanner code refuse; restored trees match.

Inventory: 20,576 paths; 8,654 extra, 90 changed, zero missing; 61 classifier refusals. Full hash-bound per-path reviewer matrix, all 26 SQL target identities and all 189 historical failed-target/368 fixpoint references remain open. No current source SAST coverage is asserted.

Original exact-tree provider Gitleaks is 1,126 current/4,361 history, exits 2. Every current location binds to the exact source blob. No raw credential value or issuer disposition is exported. Original provider npm audit has six high propagated findings; fresh installed audit and same-SDK disposable candidate have 7 high, including the newly authenticated Zod advisory. The candidate's lock delta is 0; node-forge remains 1.4.0 and Zod 3.25.76. No supported remediation is applied to stage.

Issued-source CI: Quality 40020077445 SUCCESS, including canonical ECR-backed credential-free Supabase verification; iOS 40020077467 SUCCESS source-only; Security 40020077385 FAILURE in all four original source-facing jobs, hosted DB job skipped. Earlier ECR Data limit exceeded remains intermittent historical infrastructure failure. Milestone2 CI is separately PENDING in evidence/milestone2-ci.json. Final delivery-head statuses must not inherit either observation.

All 51 completed command receipts, 13 nonzero receipt exits and six additional orchestration failure observations are indexed in evidence/execution-index.json. Expected adverse refusals and synthetic findings remain nonzero; no failure is rewritten as a green original provider gate. Earlier harness failures are explained in SEMGREP_BRIDGE_PROOF.md and BLOCKERS.md.

Original Security remains RED; proposal/exception expiry and all owner/source/rule/target controls are unchanged. No main/PR decision, acceptance, hosted replay, native/device/archive signoff, M2, deployment, signing/TestFlight or release. Spend $0. Independent Brain review required.
