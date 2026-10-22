# M0-02 implementation evidence — submitted, not accepted

Codex-authored evidence, 2026-10-20 UTC. Independent Brain review is required. M0-01 remains accepted only for diagnosis/regression/checkpoint; no baseline, source GO, runtime, integration, research, commercial or public-release gate is upgraded.

## Exact source and custody

Repository `TasfiqJ/onSkin`, existing `stage/m0-baseline`, draft PR [#8](https://github.com/TasfiqJ/onSkin/pull/8). Founder checkout `C:/Users/jasim/Desktop/onSkin` remains on its dirty `ai-integration-v1`; all implementation used the pre-existing separate stage checkout at `C:/Users/jasim/Documents/Codex/2026-10-19/c-users-jasim-desktop-onskin-x20-6/work/onSkin-stage`. Root AGENTS/CLAUDE, applicable active strategy/launch contracts and package canonical inputs were inspected. The unrelated `04_repo_docs/AGENTS.md` subtree was not edited. No second writer/subagent was used.

| Identity | Commit | Tree |
| --- | --- | --- |
| Fetched main / original stage base | `bbc28dc3d1f945191a81be56945b8bda7bb6ef73` | `a7e406303c0c865a2563a0d6f1ab1db80e3bb653` |
| Reviewed M0-02 task base / accepted diagnostic | `b9a6b093f392ced340c156f2e7dcaefc72ed58e1` | `ed42b889912e3fb383cfbafe413e7a66dd558221` |
| Initial implementation | `8fd48286e0ad65e7797588d7cd88edde27fe4a5f` | `f7772abe39325075b8a9231b0c98bbbd79c9c769` |
| Corrected, measured implementation | `c0bd7c27b9cddfe7b771d6756c4f5fa887a84a2c` | `d60d4a591653b141964680f153a8d82937d2984f` |

Both implementation commits were pushed normally to the existing stage, preserving its ancestry. Main is read-only. Report/evidence/handoff commits follow the measured implementation; obtain the final delivery SHA/tree from the actual pushed ref, not an embedded prediction. The structured report distinguishes these identities and gives each measured command its own snapshot.

## Installed subsystem and identity preservation

- `docs/v2/README.md` routes to the adopted executive/core/clinical/acceptance/finance contracts, current Brain authority and stage override. `ADOPTION.md` records precedence and migration limits. Historical direct-main prompts remain inert, immutable evidence.
- `docs/v2/source-inputs/` preserves all 48 supplied package files byte-for-byte. The issued task manifest verifies 47 content inputs totaling 850,875 bytes; the separate source manifest verifies 29 source inputs. M0-02 intake ZIP: 153,957 bytes, SHA256 `080676b8dc78fe4c4a427f6f2be89043441a7e7b8a6a0fe45bff84fc70282590`. The original excluded SourcePack archive was not reread; its supplied provenance remains attributed. A separate Git-blob check verified all 48 committed input blobs against the issued hashes.
- `docs/brain/state/` is the exact approved snapshot, including 24 ADRs, acceptance ledger, nine open blockers, roadmap, observations and stage protocol. The original Codex M0-01 evidence is unchanged; the Brain audit/observations are separately named and attributed. `current.json` contains only Codex observations/submission. M0-02 is not accepted and no M1 is issued.
- `docs/v2/mirrors/compatibility.json` retains 376 granular items, 20 families and 12 surfaces (408 records), separately from 202 legacy dispositions, 25 active gates and 38 V1/V2 rows. Every supplied row and every observed original row is retained, including statuses, parents, unknown fields and evidence references. The original inventory's collection metadata is retained in source reconciliation. Supplied/observed row deltas are empty at installation; the PROGRESS file's freshness hash differs and is explicitly recorded.
- All 47 roadmap IDs/dependencies/priority predecessors and all 27 module IDs/order/dependencies are preserved. JSON/CSV mirrors are checked together. J05 engineering P3, single-scan M5-01, longitudinal M5-02, internal M2-04 and external usability M3-04 stay distinct. No research is requested; missing parents/publication remain unavailable/closed. Exact per-row task mappings absent from the supplied plan are explicitly unresolved; candidate phases do not invent exact authority.
- `scripts/brain/brain.py` provides standalone validation, mirror generation/checking, report v2 validation, read-only ready selection, bounded context building and ZIP verification. It uses Python standard library only. No package/workflow/toolchain changes were made. Commands and trust limits are documented in `docs/brain/README.md` and `contracts/README.md`.

## Measured acceptance checks

Working directory for local commands is the stage checkout above. Windows x64; Python **3.9.13** and bundled **3.12.14**. Existing JS source checks use the already available official Node **20.20.2** executable and root npm **11.20.0**. Paths, full command lines, exact source identities, exits and outputs are in the hashed logs/index under `evidence/` and in the structured report.

At clean corrected commit `c0bd7c27b`, both Python versions ran:

```text
python -B -m unittest discover -s scripts/brain -p "test_*.py" -v
python -B scripts/brain/brain.py validate
python -B scripts/brain/brain.py mirrors --check
python -B scripts/brain/brain.py pack --task M0-02 --output <new external ZIP>
python -B scripts/brain/brain.py verify-pack --task M0-02 --output <existing external ZIP>
```

Each governance run: **28 tests considered, 27 passed, 1 skipped, exit 0**. The skip is actual Windows symlink-creation privilege unavailability (WinError 1314), not a symlink PASS. Real Windows junction input/output rejection and hard-link rejection passed. No Linux filesystem run is claimed for the new suite. Hash/identity checks, dependency cycles, order, complete original fields, closed axes/admissions, false PASS, report schema/Git/artifact bindings, code allowlists, traversal/drive/UNC/ADS/alias paths, private/binary/archive/credential rejection, file/byte bounds, overwrite avoidance, CRC corruption and trailing-byte rejection are exercised.

The positive future-task fixture is explicitly synthetic and temporary. Production packaging admits only the already issued M0-02 manifest; no future approval was fabricated. Explicit CLI refusals for `M1-01`, `../M0-02`, and output inside the source root each returned **exit 1**, with no output created. These are successful negative assertions, recorded as raw nonzero command outcomes rather than green command exits.

Both Python runtimes produced identical deterministic output: **49 archive entries**, **860,347 input bytes**, **876,597 ZIP bytes**, SHA256 **`b73353d64eb93a28dafd8d319c06055440e4e0363243c12ae016b5f6291f5547`**. Fixed sorted stored entries, metadata, all content hashes and CRC were verified, then compared across runtimes. These audit ZIPs remain outside the repository; the reproducible commands, manifests and hashes are committed. The different original uploaded ZIP hash is expected: it used different ZIP metadata/compression. Neither artifact grants source or clinical admission.

The corrected release-inventory regression command passed at the measured snapshot:

```text
node --test --test-name-pattern="central downstream inventory" scripts/launch/governed-evidence-chain.test.mjs
```

Result: 1 selected test passed, 12 deliberately filtered tests skipped, exit 0. An earlier complete 64-test governed-chain invocation also passed after the namespace correction, but crossed the pre-commit boundary and is not presented as a separate clean-snapshot certification. Linux CI subsequently passed the complete governed release-provenance step at corrected source.

## Existing checks, failures and limitations

At the initial implementation snapshot, unchanged source checks passed: canonical ECR regression 6/6, advisory-exception contracts 7/7, workflow contracts 27/27, source-packet strict/check, and execution-baseline validation (25 active items, 20 families, 12 surfaces). These older measured identities are retained, not relabeled as the corrected snapshot.

Root typecheck/lint/test commands exited 0 using existing caches: typecheck 3/3 cached, lint 3/3 cached, test 2/2 cached. The replayed mobile/console totals are historical cache output, not freshly executed app tests. Turbo child logs include bundled npm 10.8.2 behavior; this is not exact Linux workflow reproduction. No app/runtime change justified forcing a full mobile rerun.

An extra unchanged Security Python suite was first attempted under default Python 3.9: exit 1 at import because the existing protected code uses Python 3.12 f-string syntax. A separate bundled-3.12 Windows diagnostic ran 70 tests and returned **21 failures, 8 errors**, including Linux absolute `current-source` fixture paths invalid on Windows and unavailable symlink creation. It started at the initial commit and crossed the planning-only edit window. Its startup SHA headers are not clean final-worktree bindings; the raw failure log and binding note are retained and are **not acceptance evidence or PASS**. No Security code was changed to accommodate it. The final new governance tests were independently rerun on the clean corrected snapshot under both interpreters.

The first development governance run had one test-cleanup error, fixed before the initial implementation commit. The first pushed CI also exposed a real integration error: placing planning views under `docs/v2/generated/` collided with the existing exact release-evidence inventory (63/64 passed, one failure). The smallest in-scope correction moved those tracked planning views to `docs/v2/mirrors/`, with identical data bytes and own deterministic checks. No existing inventory/validator/workflow was changed. Security still sees the full added source and remains subject to its frozen inventory.

Default `git diff --check` returned 2 solely because the two immutable supplied CSV files use CRLF. Their source bytes/hashes were preserved. The explicit `git -c core.whitespace=cr-at-eol diff --check` passed; no historical input was trimmed and no Security exemption was added.

The later evidence-only staged tail preserves exact cached npm transcripts, including their formatting/trailing spaces. Its full staged whitespace check also returns 2 on `initial-typecheck.log`, `initial-lint.log` and `initial-test.log`; the authored tail check excluding the evidence directory returns 0. This is a disclosed transcript-format limitation, not a suppressed scanner finding. All 47 report artifact hashes were compared against the actual staged Git blobs, and ignored `*.log` files were explicitly force-added only inside this allowlisted checkpoint so they are available on GitHub. No ignore/scanner policy was added or altered to hide them.

## CI and protected blockers

The original M0-01 final runs were independently reread: Quality39366256422 failed ECR acquisition before SQL; Security39366256806 failed inventory and separately reported OSV date/advisory refusals; iOS39366256375 was source-only success. `initial-ci.json` includes actual jobs and sanitized original excerpts.

Initial M0-02 head `8fd48286e`: iOS39370287730 success; Security39370287706 failure; Quality39370287716 ultimately cancelled by normal superseding push, after repository-quality job118456382439 had failed the namespace collision. A cancelled workflow is not an overall failure/pass claim; the actual failed job is retained.

Corrected head `c0bd7c27b`: completed **Quality39370706322 FAILURE**, **Security39370706309 FAILURE**, **iOS39370706312 SUCCESS (source only)**. Quality database job118457832604 failed after 171 source tests passed, with the same `Data limit exceeded` at **2026-10-20T04:40:55.3144847Z**, before database startup/SQL. The generated-types upload explicitly found no files. Repository-quality job118457832335 passed, including corrected governed provenance and typecheck/lint/tests; PostgreSQL 15/17 isolated rehearsals and both exports passed. Security static job118457706494 ran 70 contract tests successfully on Linux, then rejected `SOURCE_INVENTORY_DRIFT` and separately refused braces/node-forge review dates and `mcp@1.29.0:GHSA-84m7-p3x7-pcfv`. Code and secret jobs passed; live Supabase was skipped; automated source-only acceptance job118458941530 failed. Green continued step conclusions are not scanner passes. `evidence/closing-ci.json` supersedes the earlier pending observation in `measured-ci.json`. Original static-log excerpts are retained. CI temporary merge `dabb6c280e0c89f841337f97f14704ed957fd48d` was fetched and its tree independently matched `d60d4a591653b141964680f153a8d82937d2984f`, with exactly main/stage parents; this is not a main merge. Final report-only delivery commits trigger separate CI and cannot borrow these outcomes.

Current baseline remains blocked. The proposal expiry is still **2026-10-21T00:00:00Z**; observed UTC during this session is October 20 before expiry. No mechanical renewal, owner pin, manifest, scanner policy or exception changed. [The single proposal-only remediation packet](BASELINE_REMEDIATION_PROPOSAL.md) separates ECR acquisition, source inventory/custody, expiry and OSV refusals with exact paths and prerequisites. No reliable new free acquisition route has been demonstrated, so no paid/authenticated route is recommended and no founder action is requested for M0-02.

## Diff, delivery and stop condition

Both the M0-02 delta from `b9a6b093f` and full cumulative stage diff from current main were checked. Changed paths are only new planning/Brain/tooling namespaces, root handoff and the minimal progress pointer; the cumulative diff additionally contains the preserved M0-01 regression test. Exact protected/runtime/package/workflow comparisons returned exit 0. No app, SQL/migration/type, DB06/DB08/R2B producer/approval, Security custody/exception, provider, signing, deployment, public switch, J05 implementation or spend was changed.

Rollback is a normal separately reviewed stage commit correcting/removing the additive control plane while preserving required sanitized handoff/audit history; no runtime/data rollback is involved. No reset, force push, main merge or PR promotion is authorized. Safe evidence/report/root TXT are committed and normally pushed even while CI remains red. Context health is a medium estimate, no compaction, zero accepted tasks in this instance. Stop for Brain review; no follow-up task, research request or owner action is automatically issued.
