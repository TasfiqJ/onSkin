# M1-03 Review 02

## Decision: partial acceptance; CONT-02 required

Reviewed delivery: `7305ff24c78d2f9d883e26a7ba2a8e6169902fd8`. Tree: `8857cbcaa26c28b434235a53521636af77cb6b36`. Branch: `stage/m1-retained-safety`. PR #9 remains draft and unmerged; main remains `bbc28dc3d1f945191a81be56945b8bda7bb6ef73`. The previous issued source-edit interval is `c14a3105640034a9d7a47d34533f9bd40faa4cc4..7305ff24c78d2f9d883e26a7ba2a8e6169902fd8`: 13 commits.

Accept the observer-test settlement, mixed-severity classifier and original secret-job coverage/runtime binding only for their independently examined source and test scopes. Accept the exact Vite 8.1.6 minimal dependency closure for demonstrated compatibility, not complete native-source coherence. Initial CORE05 and previous narrow retained-client acceptance remain unchanged.

**The pushed report is not accepted as complete evidence. Whole M1-03 is not accepted. M2 and main promotion are not issued.** The remaining repairs are native lock mappings and generated metadata, a historical SBOM test input, and twelve uncommitted evidence logs plus publication enforcement.

## Independent checks on the delivery

Brain created separate full Windows and native Linux clones at the exact delivery, each with a fresh independent dependency installation. Shared node_modules were not changed. Windows used Node 22.21.0 and Python 3.9; the existing Linux environment used Node 24.19.0, Python 3.12.3 and npm 11.20.0. These are separately identified environments, not a single combined execution.

| Check | Actual result |
|---|---|
| Forced root tests | 6,067 passed: 6,043 mobile and 24 console; no cached test tasks |
| Forced type checking and lint | Both passed; three tasks each, no cached tasks |
| Console build | Passed |
| Selected retained source contracts | 164 passed, no failures or skips |
| Advisory classifier tests | 8 passed |
| Governance tests | 60 discovered: 58 passed, two genuine Windows symlink-privilege skips |
| Original Linux acceptance contracts | 70 passed |
| New secret-scan synthetic contracts | 10 passed |
| Active workflow/SBOM contracts | 27 passed, one failed |
| Strict native mapping audit | Failed with three MAPPING_LOCK_DRIFT refusals |
| Strict report from clean clone | **Failed: twelve declared artifacts absent from Git** |
| Strict derived worklist | Passed |

`EXECUTION_EVIDENCE.json` records commands, results and output hashes. Full raw logs remain at `C:/Users/jasim/Documents/ChatGPT/BrainReviews/M103-Review02-20261021T022540Z`; this small context includes condensed receipts, not those complete logs. Two review-harness errors remain recorded: WSL could not resolve the Windows linked-worktree pointer, and one initial candidate command used an absent Node path. Both were corrected without product changes. Neither failed attempt is counted as a passing test.

## R2-F1: native lock mapping coherence

The 19 changed lock entries are the console workspace, Vite, Rolldown, its 15 platform packages and oxc types. The mapped Google Sign-In, expo-image, React Native and Hermes entries are unchanged. All ten installed native source-pin hashes matched in the independent Linux installation.

The three mapping objects still bind the old whole-lock SHA-256 `474da1e26f630472bd1144df727fd0c21f0dddbc3d76d10d95b0f3b6a8778223` instead of the current `7a98ddc5ba1ac26e0fa0682b0681de4502c2e5dd85630cdbc691e535f07be77c`. In a disposable review clone, changing only those three digests removed the mapping errors but correctly exposed deterministic generated-JSON drift. Running the unchanged generator then produced passing strict checks. The JSON changes are limited to `/inputs/mapping/sha256`, `/inputs/packageLock/bytes` and `/inputs/packageLock/sha256`; the Markdown input fingerprints change correspondingly. Restoring one stale digest still failed the intended guard.

All three expected postimage hashes are in `NATIVE_AND_FIXTURE_BINDINGS.json`. These results support a binding repair, not a native build, archive/privacy admission or App Store approval. The private candidate is not already delivered at H.

## R2-F2: historical SBOM test input

The retained historical SBOM/audit fixture is immutable, but its positive test reads the now-updated current package lock. Brain reproduced the resulting 27/28 active test outcome. A historical-lock candidate passed; a better self-contained gzip fixture then passed 29 tests with no Git executable in PATH, including rejection of the old packet paired with the current lock. Missing and corrupt fixture controls both failed as intended.

No frozen packet, production validator, current lock, expired policy or raw scanner exit was changed. CONT-02 must use the exact self-contained fixture, not a runtime `git show` dependency or a production fallback to old lock data. Git is used only to derive the pinned fixture during implementation. Eleven additional candidate source/provenance/documentation checks exited zero; store inspection retained its real release warnings.

## R2-F3: unpublished evidence and a missing publication check

All 829 artifact hashes matched files in the active local worktree, and all 39 issued child inputs matched the independently anchored manifest. Separately inspecting the Git tree proved that **only 817 of the 829 report artifacts were committed**. Twelve ignored `.log` files remained local: six Expo server logs, one console server log and five first-delivery CI logs. Their exact 485,093 bytes and expected hashes are listed in `PUBLICATION_RECOVERY_INPUTS.json`.

The fresh exact-H clone fails the strict report at the first missing Expo log. In an adverse control, Brain temporarily restored the twelve exact matching files into the private clone without staging or committing anything. The existing report checker passed. Brain then removed those copies and confirmed the clean clone and active worktree remained unchanged. Thus local byte validation and a clean `git status` do not establish evidence publication.

Authorize only late recovery of the twelve listed safe, unchanged files. A new receipt must distinguish original execution, omission from H, and the later publication commit. Preserve the original report and issuance bytes. Do not claim recovery retroactively makes the original delivery complete.

A CONT-02-specific guard must require each declared artifact to exist as a matching regular committed Git blob at the delivery head. Matching ignored or untracked local files must fail. Verify the actual pushed report from a fresh clone without local file overlays. Basic sensitive-token pattern inspection found no matches, but is not a full secret or qualified review; reinspect exact files before publication and never publish real credentials to preserve a hash.

## Actual CI and secret coverage

At the finite observation in `CI_OBSERVATIONS.json`, the Quality repository job failed at native mapping. Later type checking, lint, root tests and exports were skipped in CI. The independent local passes above are not those skipped CI executions. The credential-free canonical database job remained in progress; PostgreSQL 15/17 deletion rehearsals succeeded. The iOS launch contract succeeded on its source-only axis. Security failed. No earlier c14 result is borrowed for this delivery.

Brain downloaded the four final Security artifacts directly, matched their provider ZIP digests, and inspected all twenty original code/static/secret files plus the decision. Actual PR checkout is `211f56ec1e80275a3b4e95b9c6161af372ddefc3`, with main and H as parents and the same tree T. The proof records thirteen refs, 2,572 reachable commits, 2,569 native patch commits and 18,673 current committed files. Independent Git blob enumeration reproduced the exact current-snapshot digest `816c036bf7c188ef0dfe2bb7eb5080b4b9800a7f774eb88b3fcccb8ccff69a4f`.

The original job actually used the pinned Gitleaks 8.24.3 and TruffleHog 3.99.3 bytes. The earlier 30-commit truncation and floating-runtime defects are repaired. Actual Gitleaks history/current findings are 4,329/1,110, with raw exits 2/2 and redacted values. TruffleHog's verified-only history/current executions returned zero with empty finding streams. Findings alone do not prove leaked live credentials, and are not automatically accepted fixtures. The frozen G97 3.99.2 closure was not rewritten to borrow the 3.99.3 result.

The exact npm CI report contains 68 high-severity aggregate package records with braces/node-forge primary roots; no Vite primary advisory remains in this particular report. Raw npm/OSV exit 1 and expired/unreviewed refusals remain. Complete current SAST is not established. The final decision is **REJECTED / PROPOSAL_EXPIRED_OR_CHANGED**, with acceptanceGranted=false and rawScannerPass=false. Original expiry `2026-10-21T00:00:00Z` stays unchanged. No new policy window, pin update, exception, scanner derivative or waiver is issued.

## Custody, limits and next authority

Each of the thirteen continuation commits was checked for unauthorized transient paths; none was found. All eleven issued existing-file preimages matched. All 97 migration bytes remain unchanged. The fourteen worklist meanings, 414 reference identities and current fingerprints remain intact. The measured report snapshot differs from final delivery only in checkpoint evidence/documents and the root handoff, not implementation. The unpublished-log defect qualifies these local checks rather than erasing them.

This review did not independently replay new browser flows, physical devices, real providers, hosted databases or clinical/qualified review. Brain did not modify or push the active branch or main. DB06/DB08/R2B require their separate actual authorities. ADR-038 corrections remain due in M2-01/M2-02, and retained undo remains unavailable, not PASS.

The only new authority is `M103-CONT02-SOURCE-EDIT-01`, based at H/T. It permits the three coherence/publication repairs, exact administrative transition and regressions. Any additional source need is an inert proposal while other ready work continues. No M2, main or release authorization follows even if the local repairs pass.
