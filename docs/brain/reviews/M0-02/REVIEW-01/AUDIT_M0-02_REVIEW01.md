# M0-02 independent review 01

**Decision: FIX_REQUIRED. No main promotion.**

Review time: 2026-10-20T05:05:13+00:00. Reviewer: onSkin Brain. M0-02 remains incomplete; M0-01 stays accepted only for its diagnostic/regression checkpoint. Four defects in the new governance tooling must be fixed before that tooling can be relied on. The existing ECR/Security blockers are separate and remain open.

## Exact source and scope

Repository: TasfiqJ/onSkin. Stage: `stage/m0-baseline`. Submitted head `da9fa04759164b402ee3b2abd1c80e14261614fb`, tree `e18f73771b5f440613a7e7cd339889949a8ae72a`. Original M0-02 base `b9a6b093f392ced340c156f2e7dcaefc72ed58e1`; current main `bbc28dc3d1f945191a81be56945b8bda7bb6ef73`, tree `a7e406303c0c865a2563a0d6f1ab1db80e3bb653`. Three M0-02 commits were inspected: `8fd48286e0ad65e7797588d7cd88edde27fe4a5f`, `c0bd7c27b9cddfe7b771d6756c4f5fa887a84a2c`, and `da9fa04759164b402ee3b2abd1c80e14261614fb`. The original M0-01 commits remain ancestors. The measured implementation is `c0bd7c27b9cddfe7b771d6756c4f5fa887a84a2c` / `d60d4a591653b141964680f153a8d82937d2984f`; the later delivery commit is not silently relabeled as that earlier measurement.

Independent Git inspection finds 132 changed paths for M0-02 and 134 for the full M0 stage. All are in the authorized new governance/planning namespaces, root handoff/progress, plus the original M0-01 retry test in the cumulative stage comparison. There are no M0-02 changes to apps, packages, SQL/migrations, DB types, existing workflows, phase2/phase9/protected launch scripts or package/lock files. The relevant protected diff exits 0. Main, original task base and measured implementation are confirmed ancestors of the delivered head. Stage worktree is clean before/after review; draft PR #8 remains unmerged. Brain made no repository-source changes or pushes.

All 48 committed immutable input files match the actual uploaded M0-02 context ZIP. Independently calculated inventory digest: `8e9b05bb0ed86aa9c873a5d24f2ec64621af9d6b3e9d62c7027dee7f85dab220`. The uploaded ZIP is SHA256 `080676b8dc78fe4c4a427f6f2be89043441a7e7b8a6a0fe45bff84fc70282590`. The new code's manifest anchor matches the actual issued manifest `fd04a4fe643949b994ab01697cf48fb2894da805951f7389c76aa770b0972957`. Data preservation, authority installation, mirror namespace repair and the detailed honest handoff are useful work; they do not excuse the defects below.

## Independently reproduced positive controls

At delivered head on the authorized Windows host, Python 3.9.13:

- `python -B -m unittest discover -s scripts/brain -p test_*.py -v`: exit 0; 28 considered, 27 passed, 1 skipped. The skipped symbolic-link case is WinError 1314; real junction/hard-link cases passed.
- `python -B scripts/brain/brain.py validate`, `mirrors --check`, and `report docs/brain/checkpoints/M0-02/completion-report.json`: each exit 0.
- Two separate outside-root `pack --task M0-02` executions both exited 0 and produced identical 49-entry ZIPs: 860,347 input bytes, 876,597 archive bytes, SHA256 `b73353d64eb93a28dafd8d319c06055440e4e0363243c12ae016b5f6291f5547`.

Those are positive-input checks. The independently constructed invalid-input cases also returned success, which is why the overall decision is FIX_REQUIRED. No counts from unrelated/cached/device/provider suites are added to these totals.

## F1 — Unsupported execution evidence can be accepted

Location: `scripts/brain/brain.py:311-342`, especially 338-341. A disposable copy receives an appended observation with `status=PASS`, `evidence_class=INDEPENDENTLY_REPRODUCED`, `axis=source`, `exit_code=0` and `admission=NONE`, but no command, artifact/hash or source identity. The **full validate CLI exits 0**. Replacing exit 0 with JSON `false` still exits 0. The artifact branch is optional and equality accepts the wrong numeric type.

Repair must require appropriately shaped, typed and bound execution evidence; unsupported PASS claims and boolean/string exits must reject. Observations of metadata and actual test execution remain distinct. No offline validator can authenticate real-world work merely because an author writes the reproduction label.

## F2 — CI and source metadata are not sufficiently bound

Location: `scripts/brain/brain.py:384-417` and completion report v2 schema. A synthetic report with an `in_progress` CI run marked `success`, `head_commit` of forty zeroes and a nonexistent `artifact` is accepted by the **full report CLI (exit 0)**. A separate case using nonexistent all-zero `observed_main` commit/tree and `original_stage_base` also exits 0. Executed local test trees are checked, but those other declared identities/CI relationships are not.

Repair must bind every CI row to a declared hash-checked observation artifact and cross-check the recorded source/run/state/conclusion. An unfinished run cannot have a completed-success result. Verify each declared Git tuple and applicable original-base/task-base/measured-head ancestry, while distinguishing historical observations from a newly fetched main. Preserve explicit unavailable evidence; do not invent Git objects or raw provider results to satisfy checks. Offline consistency does not replace this Brain's independent provider read.

## F3 — A spec can repoint its own approval

Location: `scripts/brain/brain.py:420-440;456-481;578-582`. In a disposable fixture the original immutable inputs, hardcoded issued-manifest anchor and current M0-02 state were preserved. Only the mutable M0-02 task spec was repointed to a new, internally consistent, author-created manifest and harmless synthetic text. `issued_by=onSkin Brain` was only a fixture string, not an actual issuance. The **full pack CLI exited 0**, producing a three-entry unapproved context ZIP.

Observed unapproved pack SHA256 `50ae7a1d40bd8e8ebe6871966438951ac3e09e4d5bd649cf4ce8284bf6618095`; bogus manifest SHA256 `415b6a7056abb242fc886c5a11d9c38db2783ffac55272fd76c5187ed228ebec`. No such file/spec was committed or actually approved.

The submitted implementation checks that a spec agrees with the manifest it names, not that the named manifest is the reviewed issuance for that task. Repair must bind issuance identity independently of caller-controlled pointers/hashes. Changing spec plus approval plus payload cannot redefine the accepted allowlist. This is an integrity boundary for input files at fixed reviewed code—not a demand for new signing infrastructure or an impossible defense against someone replacing the verifier itself.

## F4 — Mirror rejection occurs after an outside-root file is created

Location: `scripts/brain/brain.py:295-308`. The `exists()` precheck permits a dangling output-file symlink. `target.touch()` follows it, creating an empty outside-root file before `safe_file` rejects the link. A rejected operation has therefore already crossed the write boundary.

The Brain reproduced this on a real Linux symbolic link under Python 3.13.5 using the five exact source-function slices (`require`, `relative_name`, `safe_file`, `no_link_parents`, `mirrors`). Their individual source hashes were independently compared with the submitted Git blob and match. Upstream input verification and mirror-data production were inert stubs to isolate the write guard. Before: outside file absent. After: empty outside file exists, followed by `Link/reparse point forbidden`. This is a focused function-level reproduction, **not a full Linux CLI/repository run**. See `mirror-symlink-result.json` and the matched source slice.

Reject invalid target/ancestor links and hard links before creation or writes. Add positive and negative containment tests, including dangling links, and prove an invalid target produces no outside-root/link-target side effects. Preserve real platform skips; do not call the unavailable Windows symlink test a pass.

## Current CI and external limits

At the exact delivered stage SHA, final workflow statuses are Quality **failure** (`39371600842`), Security **failure** (`39371600769`), iOS launch contract **success, source only** (`39371600772`). Final Quality DB job `118460482876` passed its 171 source tests then failed `npm run phase2:db-local-verify` with `H01_SQL_PROBE_FAILED` / `toomanyrequests: Data limit exceeded` at `2026-10-20T04:50:33.2932477Z`, before stack startup/SQL. This final raw log was independently read. The final source-proposal bytes retain `SINGLE_OWNER_AUTOMATED_SOURCE_ONLY` and expiration **2026-10-21T00:00:00Z**, with replay/integration/release authority false.

Final Security job summaries independently show static analysis and automated acceptance failure, code and secret jobs success, and the live job skipped. The earlier independently observed inventory/OSV refusal reasons and Codex's measured-snapshot evidence remain attributed; absent a fresh final static-log read they are not relabeled as a newly audited final raw artifact. Changing the inventory would not itself establish clean scanner results or new custody. All Security counts/hashes/dates/owner pins and DB06/DB08/R2B remain untouched.

The direct local-container Git clone failed DNS; the connected GitHub reads and authorized Windows Git/source/test access succeeded. One initial PowerShell native-stderr wrapper aborted; the complete suite was then run through a Python subprocess wrapper with actual captured exit codes. The aborted attempt is not a pass. Full app/database/device/research/qualified review/provider runs were not independently repeated in this review.

## Decision and next assignment

M0-02 **FIX_REQUIRED**, repair iteration **FIX-01**, on existing `stage/m0-baseline` from `da9fa04759164b402ee3b2abd1c80e14261614fb`. Continue the same M0-02 Codex chat (medium context, no compaction, same subsystem, first repair iteration). Preserve useful implementation and historical inputs. Repair F1-F4 and adjacent cases inside this governance subsystem, rerun positive/negative evidence, and resubmit with tracked TXT and detailed GitHub evidence.

**Main promotion remains NOT AUTHORIZED.** The Brain—not Codex or the carrier—decides when an exact reviewed change can enter main, after applicable gates. This task neither creates public-release permission nor waives founder-only spending/protected/clinical authorities. No M1/J05, new research request, registry identity, paid service or protected remediation is issued.
