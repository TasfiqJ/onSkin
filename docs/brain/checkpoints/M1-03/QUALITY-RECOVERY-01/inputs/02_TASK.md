# Exact task — Quality recovery without false green or changed protected gates

**Iteration:** `M1-03 / QUALITY-RECOVERY-01`  
**Authorization:** `M103-QUALITY-RECOVERY01-SOURCE-EDIT-01`  
**Exact base:** `6c9c280669ccce07cab0b57f7b2118ec7bbd3a35`; tree `43ab1a4a7597c8572850b98fdc420080ec834b07`  
**Only branch:** `stage/m1-retained-safety` (PR #9 draft/unmerged)  
**No authority to merge `main`.**

## A. Repair the genuine first Quality source failure

The final-head original GitHub Quality run fails Expo's official compatibility enforcement **before** doctor, typecheck, lint, and test jobs can execute. Determine the minimally safe, currently resolvable SDK57 patch-aligned versions of `expo` and `expo-network`, using authoritative installed Expo compatibility check and exact lockfile dependency graph. At the audited code head the mobile manifest declares `expo ~57.0.30`, `expo-network ~57.0.2`; final CI specifically expects `expo ~57.0.31`, `expo-network ~57.0.3`. The correct version changes may be those patch releases or newer revisions *only if* Expo's actual SDK57 compatibility checker validates them and they stay in the reviewed architecture. No Expo major upgrade, framework refactor or unsupported pin substitution. Do not change source app implementation or third-party security tooling. Use reviewed npm, regenerate lockfile deterministically, do not hand-edit transitive lock entries.

Prove `npm ci` from scratch, official Expo dependency compatibility check/Expo Doctor as applicable, forced root test/typecheck/lint, native tooling source contract, governed Phase 4 source worklist and exact source-bound M1 checks. If a pinned package cannot be acquired legitimately, STOP as accurately blocked: no side-loading, copied lock metadata, broad overrides, cached-result-only green or disabling CI. Do not request founder choices.

## B. Preserve exact governance and authority boundaries

Since the active SC03 profile binds a previous fixed interval, append one **disjoint** `QUALITY-RECOVERY-01` exact-source governance interval under `scripts/brain/m103_profile.py` with immutable files, SHA256/Git preimages, no implicit union of SC01/SC03 previous allowed edits, and additive negative tests under `scripts/brain/test_m103_quality_recovery01_profile.py`. Keep older profile tests and fixed historical validation intact; prohibit source drift, main branch, extra authorizations/accepted tasks, changed Security expiry/source GO, and fake evidence. New active source authority may name only this issued authorization, with `protected_source_go=false`, `main_promotion_authorized=false`, `incremental_spend_usd=0`, `active_writers=1`; accepted tasks **only** M0-01, M0-02, M1-01, M1-02. Maintain 47 roadmap task identities/dependencies, 27 module identities and existing 51 ADR records intact.

Author only existing files precisely listed in `SOURCE_EDIT_AUTHORIZATION.json`, derived worklist outputs only from canonical generator, and narrowly scoped new review/checkpoint/governance paths. If actual required edits exceed this finite list, **do not edit** those files; record an exact blocker and safe limited delivery. Do not weaken any tests to make green, and no edit to frozen Quality/Security workflows, security exceptions or original scanner libraries.

## C. Final exact-head GitHub evidence (bounded)

After pushing the measured implementation SHA and then all safe final receipts, inspect *actual* Quality, Security and iOS GitHub workflows for their **new** commit(s). If final Quality remains red **solely** because canonical immutable ECR image pulls are rate/quota blocked, report that as original infrastructure custody rather than falsely labeling Quality PASS. If Expo compatibility still fails or another source defect is shown, own the feasible part within this exact allowance and run no more than two distinct meaningful, bounded repair cycles; avoid speculative loops. If original Security still red, preserve exact reason/finding status; no waiver/policy changes.

Record exact versions of `expo`, `expo-network`, relevant transitive pins, original source/lock hashes, evidence scripts, npm `ci` output, commands, raw exits and measured/final Git identities. Use strict report, worklist and immutable checkpoint; preserve any failed runs. Do not download/upload raw secret logs, credential values or patient data.

## D. Next stage and evidence only

Write `docs/brain/checkpoints/M1-03/QUALITY-RECOVERY-01/README.md`, `RESULTS.md`, `BLOCKERS.md`, `completion-report.json`, bounded `evidence/**` with sanitized hash-bound receipts/logs, and root `ONSKIN_BRAIN_HANDOFF.txt`. Install this issued context byte-exact under `.../QUALITY-RECOVERY-01/inputs` and read-only independent Brain decision under `docs/brain/reviews/M1-03/SC03-REVIEW01/` without changing older reviews. First inspect whether the existing strict report profile can model this new interval without weakening historical evidence; if a new report validation is required it must be exactly scoped and adversarially tested. Commit and normally push safe work on the existing stage; stop for independent Brain review, no automatic M2 work.
