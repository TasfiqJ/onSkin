# onSkin V2 — Autonomous Release09 Source-Packet Supersession + Fail-Closed CI Repair

**NEW independent Brain authorization:** `BRAIN-RELEASE09-SOURCE-PACKET-CI-CANDIDATE-01`.

You are the autonomous Codex implementation engineer. The founder only uploads ONE ZIP and pastes this exact prompt. Decide the detailed implementation, bounded repairs, tests, commits, and safe Git actions yourself within the finite permissions below. The independent ChatGPT Brain is the sole later source-acceptance auditor and ordinary main-promotion decision-maker. No self-approval, merge, feature/clinical admission, real provider action, payment, public release, or incremental spend (USD 0).

## 0 — Authenticate the ZIP without trusting it

The founder attached ONE `Release09` context ZIP. Safely extract it to a NEW task-owned directory, rejecting absolute paths, `..` traversal, zip-slip, symlinks, nonregular/special entries, duplicate entries, Unicode/case-insensitive filename collisions and suspicious extracted paths. Do not extract over any existing worktree. From its extracted root run EXACTLY:

```bash
python -B verify_packet.py --expected-manifest-sha256 __EXTERNAL_MANIFEST_SHA256__
```

The SHA-256 anchor comes from this pasted prompt, OUTSIDE the ZIP, not from its own manifest. Require `VERIFIED` including the exact prompt derivation before trusting or using the contents. If it fails, stop `CONTEXT_INVALID`; no older ZIP substitution. Read `00_READ_FIRST.md` through `06_AUTHORITY_AND_HARD_GATES.md`. Packet integrity is only handoff integrity: it never proves source, CI, legal, medical, device, database, Security, J01, or release readiness.

## 1 — Immutable live Git preflight and separate one-writer branch

Repo: `TasfiqJ/onSkin`. This task starts from **immutable Release08 final head** `d08347f0011672cd309d835628c094b5e9f4725d`, tree `0998881bc543840395dca375769ea1b7c9a8d4c7`, from OPEN/DRAFT/UNMERGED PR #12 (`stage/full-app-j01-release-contract08`), itself stacked on PR #11. Brain accepts Release08 governance CONTENT as a SCOPED PLANNING BASELINE, but source-packet integration is **FIX_REQUIRED**. The new product release consumer cutover remains `NOT_DONE` and NOT_ACCEPTED. The new contract is NOT a release feature flag.

At task start, re-fetch and verify LIVE exact refs/trees/ancestry, then re-check before final delivery:

- PR #12 / `stage/full-app-j01-release-contract08`: `d08347f0011672cd309d835628c094b5e9f4725d` (never write, amend, rebase or merge).
- PR #11 / `stage/m1-retained-resilience`: `50f25abeafaa6127e105e2a9d825e6d15dc1dcdb`, tree `f623b5bbd220fd6d9d10f967400081489a5dd7e0` (read-only).
- `main`: `d9912f4c8b30358593569c5b9b4e84773c6f463e`, tree `389c2a09b62e78a225a2b41c8a1965a1b0e1ab80` (read-only).
- Security PR #10 / `stage/m1-gate-recovery`: `cd2bd51997f283c0b446bf2124f427f482550fa8`, tree `4c2617588111aeb976913e5c73a5c7b998bc672e` (read-only).
- Release08 measured source `f0f743e5d8db586a1f9d98e417adb36416ede9fa`, tree `54d5645866d25681cae42a2a7a2869e12362edfa` (read-only historic proof).

Read live root/nested `AGENTS.md` and `CLAUDE.md`. Check one-writer ownership, clean checkout, stage/current branches, disk and host limits. If pinned refs diverge, conflict, or checkout is dirty/unsafe, **STOP with `REF_MISMATCH_REVIEW_REQUIRED`** before writes; no reset/rebase/force-push/stash-overwrite. Once clean/pinned, create **NEW branch** `stage/full-app-j01-source-packet-ci09` from exact Release08 final head, using existing safe checkout if disk prohibits another full clone. Push ONLY that new branch, create a new DRAFT stacked PR targeting `stage/full-app-j01-release-contract08` (not main or PR11), auto-merge OFF. Never mutate older PR branches. If PR creation unavailable, leave pushed branch and report. No concurrent writer on your new branch.

## 2 — Exact verified defect, no dishonest workaround

Campaign08 has a genuine newly introduced Quality failure. The five **authorized additive** public-product notices in `docs/MASTER_PLAN.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/FEATURE_INDEX.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md` differ from the immutable imported `04_repo_docs/docs/...` packet mirrors. Unchanged `scripts/docs/source-packet-audit.mjs` treats any byte difference as an error, so `npm run docs:source-packet-audit:check` exits 1. `docs/generated/source-packet-audit.json` and `.md` are also stale. Independently reproduced at Release08 final HEAD. Quality run `40132485372` fails its "Check source packet" step, and canonical DB separately fails `H01_SQL_PROBE_FAILED`/registry `Data limit exceeded`; Security run `40132485378` fails its original gates. iOS source-only `40132485379` passed, but Expo exports were SKIPPED due the Quality dependency. Do not conflate the failures.

**Correct repair principle:** The original `04_repo_docs` packet and untouched portions of all mirrored docs must still be byte-authenticated. Distinguish EXACTLY the five already-authorized Release08 additive notices from a mutated body, deleted/duplicated notice, unexpected extra heading, wrong authority, unauthorized file, missing original packet, or stale projection. Implement an explicit, versioned, fail-closed **source-packet supersession** of those five postimages, **without** broad ignore rules, global hash updates, disabling strict mode, replacing original packet files or weakening existing Safety/Security/DB validators.

The five original base/postimage Git blob anchors are in the independently audited packet `03_REPRODUCTION_AND_SOURCE_IDENTITIES.md`. Derive actual notice boundaries from the genuine immutable Git objects and compare complete remaining bytes. Never make an unreviewed content diff equivalent merely by updating a checksum in documentation. Authorized scope is additive planning copy only, not a general rewrite of source docs. If the original script assumed exact mirror identity and other scripts consume its JSON, preserve field meanings and introduce explicit `authorizedSupersession` status/metadata as needed rather than making `identical=true` when bytes differ.

## 3 — Substantial, autonomous multi-workstream implementation

**A. Exact original-packet and supersession proof.** Independently reproduce the failure, inspect `scripts/docs/source-packet-audit.mjs`, generator output, root scripts, `quality.yml` and downstream generated-audit readers. Design a small versioned authority manifest binding immutable original packet hashes and the five measured Release08 doc postimages (full SHA-256/Git blob, original body plus exact permitted insert). Reject any other difference. Implement strict/current generation behavior so `npm run docs:source-packet-audit:check` passes on this authorized scope and still fails on every unauthorized change. Keep source packet count/inventory/checks and existing warnings meaningful. Refresh only the two generated outputs through the real producer, with deterministic normalized comparison; do not hand-author a green status.

**B. Strong real negative controls.** Add standalone standard Node fixture tests using temp directories or other source-preserving approach (no new dependencies) for authentic current -> tampered exit1 -> restored exit0. Include at least: remove notice; duplicate notice; change claim/authority; insert body text outside notice; drop original packet doc; mutate original packet bytes; introduce an unauthorized sixth mirror diff; add unexpected top-level packet markdown; corrupt JSON/Markdown output; introduce a forged whitelist/supersession row; altered notice byte order/encoding; missing malformed manifest; traversal or symlink/reparse where applicable. Retain existing original strict behaviors and crosswalk status semantics. Any platform-dependent test must state exactly what was executable and NOT_RUN; do not invent a complete 0/1/0 fresh checkout.

**C. Bring the new full-app/J01 validator into guarded CI (candidate stage only).** Add an **additive** fail-closed check step to the existing `Repository quality gates` job in `.github/workflows/quality.yml`, using its existing environment and no new action dependencies. The step must execute the real Release08 full-app/J01 semantic validator (plus a bounded, tested regression set if appropriate), fail nonzero on scope/clinical/J01/legacy-tamper defects and never emit `GO`. Do not alter job dependencies, existing source-packet step, existing scanner/DB jobs, credential availability, fail-fast rules or exports. Optionally add root `package.json` SCRIPTS only to expose explicit CI commands; no dependency/lock/hooks/engine/version modification. Make `scripts/release/full-app-j01/check.py` safely aware of the **exact narrow Release09 additional paths** and new source proof, preserving ALL Release08 semantic checks and 151 existing negative fixtures. Be aware: the old Release08 checkpoint verifier was bound to its own exact old HEAD and should remain historically IMMUTABLE; do not falsely claim it passes at a later changed branch. Keep any new validator/versioned proof as a new Release09 checkpoint.

**D. Truthful consumer integration and inherited failure separation.** Check whether `scripts/docs/readiness-status-audit.mjs` or `scripts/launch/governed-publication-coverage.mjs` require compatible output semantics. If an unavoidable additional edit needs a path outside the exact whitelist below, STOP THAT PORTION, write a finite UNAPPLIED blocker with exact failing argv and paths, and continue permitted work; do not expand authority yourself. Ensure old `launch:contract:verify`, phase4 original strict worklist and old source-packet code paths are not bypassed. Preserve original source contract 111-pass/2-fail and original Security failure classification honestly: inherited separate findings are not permission to weaken tests, assert a full Quality PASS, renew an expired proposal or accept M1-03. Keep full legacy release/runtime consumer migration `NOT_DONE` and proposed contract versioned, not production switched.

**E. Source/evidence delivery and independent-review packet.** Use meaningful coherent implementation commits then a separate EVIDENCE-ONLY checkpoint tail. At EVERY intermediate commit verify changed path/mode allowlist, protected witness identities and absence constraints. Capture exact source HEAD/tree, SHA-256, raw commands/cwd/exits/uncached status, source-packet original/current/tampered/restored, 151 preserved Release08 negative fixtures (or explicitly bounded if host limits), root tests/lint/typecheck when safe, unchanged launch/worklist checks, CI for exact pushed head including statuses and SKIPPED jobs, Git refs/PR state and disk qualification. Supply the verifier with independent externally pasted digest and self-verifying file inventory. Report `SUBMITTED_REVIEW_REQUIRED` or precise `PARTIAL_BLOCKED`, not a self-accepted source/release. Spend USD0. Preserve old accepted M1 client checkpoints/PRs.

## 4 — Finite NEW path authority for RELEASE09 only

May EDIT exactly these existing paths if necessary, and nothing else existing:

- `scripts/docs/source-packet-audit.mjs` — precise fail-closed supersession logic, retaining all original packet checks.
- `docs/generated/source-packet-audit.json` and `docs/generated/source-packet-audit.md` — only regenerate with the changed real producer.
- `.github/workflows/quality.yml` — ONLY an additive check inside the original `checks` job; no updates to dependencies, job permissions, base triggers, pins, fail policy, or other steps.
- `scripts/release/full-app-j01/check.py` and `scripts/release/full-app-j01/test_contract.py` — only necessary exact versioned 09 source scope + further adversarial guards; MUST retain 08 65/38/47/51/G97/DB/J01 invariants and the original 151 negative cases.
- Root `package.json` — SCRIPTS entries only, strictly additive; preserve existing scripts and all other bytes/semantics.
- `ONSKIN_BRAIN_HANDOFF.txt` — factual latest handoff pointer, no source acceptance statement.

May CREATE only the following independent new files/folders:

- `docs/release/full-app-j01/source-packet-supersession09.v1.json` and `docs/release/full-app-j01/consumer-scope09.md` (do not edit the existing release08 contract, matrix, precedence, roadmap, 47/51 history, schema or other source truth).
- `scripts/docs/source-packet-supersession09.test.mjs` (standalone focused negative test with no outside writes except disposable scratch).
- `scripts/release/full-app-j01/source_consumer09.test.py` (optional new focused source-bound unit test).
- `docs/brain/contracts/RELEASE-09/**` and `docs/brain/task-specs/RELEASE-09/**` only for attributable new candidate/review records.
- `docs/brain/checkpoints/RELEASE-09/SOURCE-PACKET-CONSUMER/**` only for compact SOURCE+EVIDENCE checkpoint, raw logs, SHA/modes and verifier.

**ALL OTHERS read-only**, including `04_repo_docs/**`, the five already-authenticated top-level `docs/{MASTER_PLAN,PRODUCT_REQUIREMENTS,FEATURE_INDEX,ROADMAP,DECISIONS}.md`, original RELEASE-08 checkpoint/evidence/historical snapshots, `docs/brain/state/**`, `docs/brain/current.json`, `docs/v2/mirrors/**`, any old 47/51 source, original `.github` files OTHER than the single `quality.yml`, `apps/**`, `supabase/**`, databases, RLS, all `scripts/phase2/**`, `scripts/phase4/**`, `scripts/phase9/**`, original Security/OSV/rules/pins/secret inventories/claims, licensing/clinical/provider/payment/native code, package-lock/dependencies and release metadata. No shortcuts, broad formatting, deletion, temp cleanup of unknown files, no project history rewrite. If correct work requires other paths, stop the affected subtask and report a block, while completing independent authorized streams.

**Critical collision constraint:** The original Release08 source verifier was an exact snapshot for the Release08 final HEAD. Do not edit it. The new RELEASE09 validator/checkpoint must independently bind the chain from Release08 to Release09 with the explicit new whitelist, so no pass is borrowed from old evidence. Keep prior Review08 agreement: CONTENT planning baseline only; all source/CI/release authority remains subject to the Brain's later acceptance.

## 5 — Release limits and final report

FIRST PUBLIC iPHONE PRODUCT REQUIREMENT remains the **complete real non-Korean app** (19 F required: F01–F17/F19–F20; 12 consumer C01–C12; six P01–P06) **plus exactly ONE Korean analysis: J01 Visible Pores** if and only if independent real G1/G2/G3/G5 validation and qualified review pass. F18 automated Trend and all J02–J27 (especially J05) defer; F09 private photo timeline/manual comparison remains required, pore trend adds G4 separately. J01 intake remains unauthenticated/missing in registry; no inferred physical pore size, count, score, improvement, accuracy, diagnosis or synthetic reports. No provider, moderation, billing, owner, rights, consent, safety or native feature gets labeled operational by this scope. G97 `FAIL/NO_GO`, canonical DB `H01_SQL_PROBE_FAILED`, M1-03 `BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED`, M2 `NOT_AUTHORIZED`, all clinical/legal/native/Apple/paid/launch gates unchanged.

Your final report to the founder must give (1) exact branch/stacked PR and pinned identities, (2) changed source paths and their content hashes, (3) authentic/rejected/restored test outcomes and inherited failures separately, (4) exact current head CI including Quality, Security, iOS and skipped export, (5) outstanding `NOT_DONE` full release contract consumer migration, (6) proof no protected changes, (7) honest host-space and independent-checkout status, (8) no main merge and no release GO. No technical choices are delegated to the founder.

Conclude exactly: **Codex is done.**
