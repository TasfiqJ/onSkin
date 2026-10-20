# M0-01 independent Brain review — diagnostic acceptance, baseline blocked

Recorded: 2026-10-20T04:11:45+00:00. Repository: `TasfiqJ/onSkin`. All times below are UTC.

## Decision and exact scope
**ACCEPTED — M0-01 diagnostic/regression checkpoint only.** The underlying M0 Quality/Security baseline is **BLOCKED**. No merge, main promotion, protected source GO, replay, release, device signoff or claim admission follows from this decision.

The original M0-01 task explicitly allows the report to close diagnosis while leaving baseline repair blocked, and allows a no-change diagnosis when a safe correction is not justified. The inspected branch does not pretend to implement a runtime fix. Its one added regression test preserves existing fail-closed behavior. M0-02 is independently ready because it installs only planning/state/tooling, without runtime or database changes. This is ADR-023, not a waiver of ADR-002.

## Exact identities and complete change review
| Identity | Value |
|---|---|
| Unchanged main / initial stage base | `bbc28dc3d1f945191a81be56945b8bda7bb6ef73` |
| Main tree | `a7e406303c0c865a2563a0d6f1ab1db80e3bb653` |
| First stage commit | `dc6c42dfcf796cbddb94b510d30ecf277fa13112` |
| Accepted diagnostic checkpoint | `b9a6b093f392ced340c156f2e7dcaefc72ed58e1` |
| Stage tree | `ed42b889912e3fb383cfbafe413e7a66dd558221` |
| Branch | `stage/m0-baseline` |
| Draft PR | #8; open, unmerged |
| GitHub PR CI checkout | `9c0bf2b3f928f96c80d620abc6da50bba0fca239` |

The GitHub temporary merge object has exactly the same tree as the final stage checkpoint; both parents were independently inspected. It is not a merge into main. GitHub metadata and authorized-worktree Git reads confirmed the normal two-commit ancestry and unchanged main. The stage was clean before and after the independent test.

The complete cumulative diff is four files, 250 additions and no deletions: `ONSKIN_BRAIN_HANDOFF.txt`, `PROGRESS.md`, `docs/brain/checkpoints/M0-01/REVIEW_EVIDENCE.md`, and `scripts/phase2/canonical-postgres-pull-retry.test.mjs`. Both commits and all four file diffs were inspected, along with the actual imported retry implementation and relevant protected-source checks. The test adds one case; there is no runtime correction.

The original retry helper only retries the specifically bounded transient `Rate exceeded` / `429 Too Many Requests` responses. The new test verifies that the exact `Data limit exceeded` diagnostic fails once, preserves the original error and never waits or invokes retry reporting. No broader retry, image substitution, credential path or fallback was added.

## Independently rerun checks
At clean `b9a6b093f392ced340c156f2e7dcaefc72ed58e1`, the Brain ran `node --test scripts/phase2/canonical-postgres-pull-retry.test.mjs` using the existing pinned Node 20.20.2 Windows x64 executable. Result: **6 passed, 0 failed, 0 skipped; exit 0**.

`git diff --check bbc28dc3d1f945191a81be56945b8bda7bb6ef73 b9a6b093f392ced340c156f2e7dcaefc72ed58e1` passed with exit 0. An exact diff across the database directory, generated types, package/lock files, workflows, reset/retry producers, staging evidence library and Security acceptance directory returned exit 0. Together with the four-file full diff, this confirms those protected/runtime bytes were not edited.

This is not an independent rerun of the full app/database/scanner suites. Those claims remain separately classified below.

## Final Quality results, not borrowed from the first stage commit
Run **39366256422**, associated with the final stage head and checking out the exact equivalent PR tree, completed **failure**. Database job **118443688177** failed; repository quality, PostgreSQL 15 and 17 deletion rehearsals, and both Android/iOS exports succeeded.

Original final-head database logs were read independently. After **171 source-contract tests passed**, `npm run phase2:db-local-verify` exited 1 during canonical Postgres image preparation. At `2026-10-20T03:50:17.4904138Z` it reported:

```text
H01_SQL_PROBE_FAILED: exit-nonzero. Error response from daemon: toomanyrequests: Data limit exceeded
```

The stack identifies `runHistoryDocker`, `runWithCanonicalPostgresPullRetry` and `prepareCanonicalPostgresImage`, before local database startup/SQL verification. The optional generated-types artifact upload explicitly found no files. Its successful upload-step status is not generated-type evidence.

The defensible classification is an external registry availability/quota/reproducibility blocker, not an observed SQL migration defect. Exact quota ownership, accounting period and runner-network cause remain unknown. No arbitrary retry, alternative image, credential injection or green-badge workaround is authorized.

## Final Security: more than source-inventory drift
Run **39366256806** completed **failure**. Code gates and secret scanning succeeded; static analysis/OSV and automated source-only acceptance failed. Live Supabase evidence was skipped.

The original final static-job log, **118443689708**, was independently read. Seventy contract tests passed, but actual collection failed at `contract.py` line 66 with `SOURCE_INVENTORY_DRIFT`. The frozen inventory cannot accept the newly added handoff/evidence paths; edited existing source bytes also need exact review. No new file exemption or inventory/policy update was performed.

The same final log also independently reports:

```text
braces: review is expired or dates are invalid
node-forge: review is expired or dates are invalid
unreviewed OSV advisory: mcp@1.29.0:GHSA-84m7-p3x7-pcfv
```

These are **observed CI refusals**, not a completed vulnerability applicability or remediation review. They are separately retained in BLK-09. Rebinding the inventory alone would not establish Security acceptance. Some continued steps appear successful in API step conclusions although original outcomes and exits were failures; final enforcement and original outputs control.

The final acceptance job still showed the public reviewed source pin `bbc28dc3d1f945191a81be56945b8bda7bb6ef73` and proposal SHA256 `359ad8e7c0efb400c179a0a20cd26932c950ef05a3261db7f9502490f3371685`. Its decision-artifact upload identity was observed, not independently downloaded/rehashed. The final static log itself independently proves the inventory rejection.

The current proposal's `2026-10-21T00:00:00Z` expiry remains unchanged. Prior main Security success was source-only and cannot be transferred to the stage tree. **This diagnostic acceptance is NOT the G97 BRAIN source GO needed for any owner pin/custody operation.** No dates, hashes, protected counts, scanner interpretations or acceptance modes may be changed by inference.

## Local evidence: useful, but a different claim
The Brain accessed the supplied structured report and original local database log through the authorized desktop. The original log's SHA256 was independently reproduced as:

`7a971cefb2f1ed09c7340817b00af044ec0b8f9d9036bc9e38a8c046e66cc17e`

Its inspected markers support the reported two local resets, 97-entry history through migration `20261010000081`, retained rehearsals/pgTAP, lint, zero drift and 7,381-line type parity, ending in full local verification PASS. The reported full-run exit is 0. The run began before the final documentation commit, with the same runtime/database bytes; it must not be relabeled a fresh independent final-head replay.

The broader local test totals, typecheck/lint and cleanup claims remain Codex-reported except where their original markers were inspected. Root npm was pinned to 11.20.0; some local Turbo workspace commands used bundled npm 10.8.2. This is disclosed, not equivalent to the Linux CI environment. The Brain did **not** repeat the full database/app/scanner execution. Local success therefore does not close the final failing CI job.

Final iOS launch-contract run **39366256375** passed its source check. It is not physical-device, signing or TestFlight evidence.

## Review limitations and safety
The complete branch diff and relevant adjacent code were reviewed, not the entire application or Security subsystem. No physical-device, qualified-review, provider, clinical, commercial or release evidence was independently generated. No repository writes, push, merge, spending, registry login, hosted database mutation or protected replay was performed by the Brain.

A container network fetch failed DNS and a desktop `gh` command was unavailable. Neither is recorded as a successful test; exact data were subsequently acquired through the working connected GitHub tools. In particular, a stale shell LASTEXITCODE after the missing command was disregarded.

## Next task and preserved blockers
Issue **M0-02 — Install unified planning authority and durable state**, in a **fresh Codex chat on the existing `stage/m0-baseline`**. Install the approved state and canonical planning namespace, preserve 376 granular items plus 20 families/12 surfaces, 202 legacy dispositions, 25 active gate identities and 38 feature crosswalk rows, and implement tested deterministic validators/task packaging. Do not enable runtime features or upgrade evidence gates.

BLK-01/02/03/08/09 remain open. M0-02 may prepare one evidence-bound future baseline-remediation decision packet but may not execute that protected work. No founder spending/authentication action is needed for this independent task. The next implementation task after M0-02 is not automatically authorized. Main remains read-only and PR #8 remains unmerged.

Machine evidence and source locations are in `REVIEW_OBSERVATIONS.json`. Canonical source authority is in the supplied SourcePack; the historical direct-main workflow is superseded only by the founder's stage-branch protocol.
