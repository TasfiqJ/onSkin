# M0-01 investigation evidence

Status: BLOCKED, REVIEW_REQUIRED. No Brain acceptance or runtime repair claimed.
Session: 2026-10-19 America/Toronto (2026-10-20 UTC). Current GitHub stage ref supplies the final handoff commit/tree; post-push structured report supplies exact final SHA values without self-reference.

## Authority and repository identity

The founder's current request controls branch delivery. The replacement `onSkin_Codex_M0-01_STAGE_BRANCH_Context.zip` is the sole M0-01 context; earlier ZIPs were not read. Archive SHA256: `d3760d4e061187600111b1df00897bbcf8ffa6fe11f67ec2cb42da61caa3d15b`. All 17 manifest-listed files independently matched their byte counts and SHA256 values. Read the stage override first, then TASK, executive authority, baseline, acceptance, protocol, handoff and completion schema/template. Archived implementation prompts are evidence, not authorization for their older broad tasks.

Commands in the founder checkout: `git status --short --branch`, `git remote -v`, `git fetch origin`, `git rev-parse HEAD HEAD^{tree} origin/main origin/main^{tree}`, `git branch -avv`, `git worktree list --porcelain`, `git ls-remote --heads origin main stage/m0-baseline` (successful). GitHub REST independently confirms current main and CI.

| Identity | Exact value |
|---|---|
| Observed fetched main / original stage base | `bbc28dc3d1f945191a81be56945b8bda7bb6ef73` |
| Main/base tree | `a7e406303c0c865a2563a0d6f1ab1db80e3bb653` |
| Founder original HEAD (different branch) | `1c3e48e60fedef3f0213105054890ee0a0b87c8a` |
| Founder original HEAD tree | `378543751a5de42f6af7fa7fb861ab319373c3be` |
| Active authorized branch | `stage/m0-baseline` |
| Stage availability at start | Absent locally and remotely; created from fresh `origin/main` |
| Pin comparison | `git merge-base --is-ancestor` exit0; diff empty, no intervening commits |
| Initial stage/main ancestry | `git rev-list --left-right --count origin/main...HEAD`: `0 0` |

Created an independent worktree with `git worktree add -b stage/m0-baseline <task-worktree> origin/main`. No stash/reset/checkout of dirty founder files. Root AGENTS.md/CLAUDE.md read; the only nested AGENTS is under untouched `04_repo_docs`. Read current Phase2 status/runbook/readiness, DB08 source readiness, review/testing instructions and launch/execution contracts. Current source has 97 migrations through `20261010000081`; older prose claiming 91/94 is stale. Current active task state remains 25 items: 8 in_progress, 7 not_started, 10 external_pending, 0 complete. No planning migration installed.

Founder dirty-state fingerprints (captured before task changes outside stage, then independently rechecked unchanged): porcelain SHA256 `273d611a5d409060cf752fec9286049d697bde81115c88cadcab44900e569e23`, unstaged binary diff SHA256 `7ef3b3c0c1385e071aaaa7b66fa82dc83e37f23d4dccf8406bac5cce82496638`, staged diff empty. Contents were neither copied nor published; untracked private contents were not read. Original founder HEAD is an ancestor of fetched main (`merge-base --is-ancestor` exit0); `rev-list --left-right --count origin/main...<founder-head>` is `672 0`, merge-base is the exact founder HEAD above. It was not used as the stage base.

## Authenticated failure observation

- [Quality run39330376557](https://github.com/TasfiqJ/onSkin/actions/runs/39330376557), attempt3, main SHA above, conclusion failure. Current REST run updated at `2026-10-19T22:05:11Z`.
- [Job118333051806](https://github.com/TasfiqJ/onSkin/actions/runs/39330376557/job/118333051806), Credential-free Supabase reset and database tests, started22:04:01Z, completed22:05:10Z. Authenticated GitHub connector fetched full decoded job log; REST independently confirmed job/attempt IDs and conclusions.
- Runner: Ubuntu24.04 image `20261012.334.1`, actions runner2.337.0. Node20.20.2 x64; workflow selects Node20, installs reviewed npm11.20.0 and uses lockfile Supabase2.117.0.
- `npm ci` succeeded. `npm run phase2:db-local-contract` succeeded: 170 tests passed, 0 failed; DB-05 local Supabase contract PASS. These are source checks only.
- Failed step7: Reset twice, test, lint, and prove zero drift. `npm run phase2:db-local-verify` invokes `node scripts/phase2/local-supabase-reset.mjs --verify`.

Minimal log excerpt (source/job identity above; omitted content is not asserted identical to an archived raw-log file):

```text
2026-10-19T22:05:07.4299645Z > node scripts/phase2/local-supabase-reset.mjs --verify
2026-10-19T22:05:08.9178006Z Error: H01_SQL_PROBE_FAILED: exit-nonzero. Error response from daemon: toomanyrequests: Data limit exceeded
2026-10-19T22:05:08.9180495Z at async runWithCanonicalPostgresPullRetry (.../local-supabase-reset-retry.mjs:11:14)
2026-10-19T22:05:08.9181564Z at async prepareCanonicalPostgresImage (.../local-supabase-reset.mjs:544:18)
2026-10-19T22:05:08.9186763Z containment: 'posix-process-group-empty'
2026-10-19T22:05:08.9187271Z diagnostic: 'Error response from daemon: toomanyrequests: Data limit exceeded'
2026-10-19T22:05:08.9188092Z Node.js v20.20.2
2026-10-19T22:05:08.9328899Z Process completed with exit code 1.
```

The runner calls `prepareCanonicalPostgresImage()` before `start`. It issues only `docker pull --platform linux/amd64 public.ecr.aws/supabase/postgres:15.8.1.085`, then validates pulled digest, image ID, platform and ECR RepoDigest before stack startup. `H01_SQL_PROBE_FAILED` is a generic wrapper also used for this pull; its name does not prove any SQL ran. The source scrubs registry overrides/secrets and retains non-database CLI fallback. Never retag a different registry image to satisfy H01.

Classification: OBSERVED external registry/image acquisition failure before SQL, not a proven schema, Node or Ubuntu regression. Existing retries cover `Rate exceeded`/`429 Too Many Requests` only after confirmed process containment, with bounded3/10/30 second delays. The observed data-limit text is already nonretryable. Exact runner auth, shared-IP quota accounting and upstream account state remain UNKNOWN; no account or IP telemetry was obtained. No independently reproduced provider root cause or fixed CI claim.

## Legitimate availability and reproducibility options

Primary documentation reviewed:

- [AWS ECR Public quotas](https://docs.aws.amazon.com/AmazonECR/latest/public/public-service-quotas.html): anonymous data allowance is separate from per-second request quotas.
- [AWS ECR pricing](https://aws.amazon.com/ecr/pricing/): anonymous data allowance is limited by source IP; authenticated allowance and excess transfer billing have separate conditions. Authentication is not an unlimited zero-cost authorization.
- [AWS ECR Public authentication](https://docs.aws.amazon.com/AmazonECR/latest/public/public-registry-auth.html): a principal-backed token uses `ecr-public get-login-password` in us-east-1, with bounded token lifetime.

Reasoned options, none silently activated:

1. Existing bounded backoff remains appropriate for request-rate throttling. A monthly data ceiling is not demonstrated recoverable in43 seconds; do not broaden the matcher as a presumed repair.
2. A controlled fresh CI execution can determine availability on its current runner, without changing the canonical image or admitting any protected work. A success would be a new observation, not proof the historical quota cause was fixed.
3. Principal-backed ECR Public authentication could address shared anonymous accounting, but requires an actual approved existing identity/permissions and spend boundaries. No AWS account/role/secret/OIDC configuration was created or assumed available. Docker Hub authentication is irrelevant to this canonical ECR operation.
4. Canonical-image caching may reduce layer downloads; the present verifier still requires a real canonical pull response plus exact digest/ID/platform binding, so restoring a cache alone cannot guarantee success when even registry resolution is refused. No trust-on-cache shortcut, fabricated pull stdout or foreign retagging is acceptable. No image archive uploaded.
5. A mirror, paid runner or private pull-through service changes provenance or costs and needs separate authority; not implemented. No runner/CLI downgrade, moving to main, schema/type edits or custody changes are justified by this evidence.

## Local reproduction and checks

Host: Windows PowerShell, Docker Desktop4.63.0/Engine29.2.1, Linux amd64 engine. Installed Node22.21.0 was not used as a claim of pinned reproduction. Downloaded official Node20.20.2 win-x64 ZIP; checked against official SHASUMS256. Archive SHA256 `dc3700fdd57a63eedb8fd7e3c7baaa32e6a740a1b904167ff4204bc68ed8bf77`. Process-local PATH uses this Node and existing npm11.20.0; no machine-wide tooling changed.

Lockfile SHA256 `474da1e26f630472bd1144df727fd0c21f0dddbc3d76d10d95b0f3b6a8778223`; actual installed Windows Supabase executable SHA256 `442c83f7d455edc0462e94e22d60c9f7f05783fc83d39a0f49dadc78a914a1dd`. Supabase2.117.0 and TypeScript6.0.3 match the lock. The local broad Turbo tasks resolved Node20's bundled npm10.8.2 internally despite the explicitly selected root npm11.20.0; this limitation is disclosed, not called exact Linux reproduction. The independent Linux stage CI used workflow pins and passed corresponding type/lint/test commands with the same test counts.

An initial `npm ci` accidentally used the system npm10.9.4 (exit0) and is NONCANONICAL installation evidence. Corrected this by repeating `npm ci` with explicitly resolved npm11.20.0 (exit0). It installed1031 packages, applied existing postinstall patches, and left the lockfile unchanged; npm reported68 high advisories and2 unapproved dependency install scripts. No audit fix or install-script policy change was made. These observations do not replace governed Security evidence.

| Command (task worktree unless stated) | Environment | Result |
|---|---|---|
| `node --test scripts/phase2/canonical-postgres-pull-retry.test.mjs` | Node20.20.2 | exit0,6 passed; exact data-limit diagnostic is a FIXTURE regression, not an actual ECR error reproduction |
| `docker pull --platform linux/amd64 public.ecr.aws/supabase/postgres:15.8.1.085` | Docker29.2.1/local default auth configuration | exit0; cold local cache, actual canonical image download succeeded |
| `docker image inspect public.ecr.aws/supabase/postgres:15.8.1.085` | same local engine | exit0; ID and RepoDigest `sha256:af083ef64d0408c8f098ee6f5c364a59b26f36fbc0f3a334a62c5c1d57362e9b`, linux/amd64 |
| `npm run phase2:db-local-contract` | Node20.20.2/npm11.20.0 | exit0,171 passed/0 failed; DB-05 local Supabase contract PASS, source only |
| `npm run phase2:db-local-verify` | same pins, CI=true, EXPO_NO_TELEMETRY=1, fresh empty Docker auth config | exit0, complete local diagnostic PASS; all phases and awaited cleanup, details below; not a CI availability repair |
| `node --test scripts/phase2/canonical-postgres-pull-retry.test.mjs scripts/phase2/local-supabase-reset-retry.test.mjs scripts/phase2/schema-diff-evidence.test.mjs scripts/phase2/staging-deployment-evidence.test.mjs` | Node20.20.2 | exit0,60 passed/0 failed; includes immutable source/custody, no override/false replay authority and no remote call before refusal |
| `npm run typecheck` | local broad environment above | exit0,3/3 successful tasks,0 cache hits |
| `npm run lint` | local broad environment above | exit0,3/3 successful tasks,0 cache hits |
| `npm test` | local broad environment above | exit0, mobile457 files/5952 tests and console7 files/24 tests;2/2 tasks,0 cache hits |
| `git diff --check` | stage | exit0 |

The local verifier uses its existing credential scrub, random project/port sandbox, local engine binding and process containment. It does not link/deploy hosted Supabase or replace generated types in --verify mode. Local preparation passed with an empty Docker auth config, independently showing current anonymous canonical-image availability on this host; it does not reproduce the earlier CI quota failure. The COMPLETE command exited0. All existing 0067->0068->0069->0070->0071->0072 forward rehearsals, both clean97-migration resets, exact unfiltered SQL/CLI history and binding, focused CORE05 and full structural pgTAP commands, error-level public-schema lint, empty migration-shadow drift, CAT08 two-connection revocation rehearsal, generation/parity and awaited teardown passed. The extensive catalog phase was allowed to finish under its original60-minute bound; no fixture/count/timeout/assertion was reduced. Read-only identity-bound local activity samples showed active computation progressing through synthetic campaigns; no hosted database was queried.

Final bounded log excerpt:

```text
[db05-local] run structural pgTAP tests: PASS
[db05-local] lint migrated public schema: PASS
[db05-local] compare local schema to migration shadow: PASS
[db05-local] migration/schema drift: PASS (empty)
[db05-local] run CAT-08 two-connection revocation rehearsal: PASS
[db05-local] temporary types: PASS (7381 lines, sha256 2b475803f0ea143681de2912637e61b1cf26e271043a84a1692e7d1d6b87a795)
[db08-types] repository parity: PASS (7381 lines, sha256 2b475803f0ea143681de2912637e61b1cf26e271043a84a1692e7d1d6b87a795, already-current)
[db05-local] full local verification: PASS
db_local_verify_exit=0
```

The wrapper does not print successful pgTAP assertion bodies/counts, so no invented assertion total is assigned to those phases. After exit, `docker ps -a --filter label=com.supabase.cli.project=layerwell_db05_d8ff355cf11009e5` found no run-owned containers; the exact run-owned temporary sandbox no longer existed. No manual broad Docker cleanup was performed; downloaded image cache remains. `git diff origin/main --exit-code -- supabase packages/types/src/database.types.ts package.json package-lock.json .github/workflows scripts/phase2/local-supabase-reset.mjs scripts/phase2/local-supabase-reset-retry.mjs scripts/phase2/staging-deployment-evidence-lib.mjs scripts/phase9/security_acceptance` exited0: protected/runtime/lock/workflow bytes unchanged.

This establishes one actual complete local current-chain replay/type-parity diagnostic on the pinned toolchain. It neither repairs the independently reproduced Linux CI availability failure nor changes DB06/R2B custody, hosted DB08 proof, source-only Security acceptance, work-item status or release authority. Prior prose saying the types still equal the historical71-migration artifact is stale; local readback confirmed the existing7381-line source artifact without writing it.

Local regression/contract/verifier commands began on fetched base `bbc28dc3d1f945191a81be56945b8bda7bb6ef73` with the ordinary regression edit uncommitted. The database/runtime/lock blobs were unchanged; the verifier copied those exact protected sources to its own sandbox. The first checkpoint was committed during that long run; broad local checks then ran against unchanged runtime/test bytes, with later edits confined to records. Do not label these local worktree executions clean final-head proof. The independent Linux PR run supplies immutable commit/tree evidence for the ordinary test plus unchanged runtime, and the final record-only commit is explicitly distinct.

## Protected boundary and CI state

DB06 `assertPinnedMigrationRunnerCompatibility()` still rejects every valid trial with `DB06_CURRENT_CHAIN_REPLAY_REQUIRED` before link/mutation. Reviewed migration aggregate remains `5ee03b2032781512fe2ab893e46a3f28daf68ea55ba7b800393265256898c3d6`;97 entries/latest20261010000081. Fresh byte inspection CORRECTS this record's interim assumption from older DB08 prose: current generated types are 7,381 canonical lines, SHA256 `2b475803f0ea143681de2912637e61b1cf26e271043a84a1692e7d1d6b87a795`, already changed by ancestor `b83b7852fbd2daf3e92894d9784d0d8f652e0bd4` (2026-09-26), not the older 71-migration artifact `2c14252f882294d2ca42832405fb0fe157f855a85a9d3fc5d47999457be9b1d3`. This session did not alter either artifact or infer current replay/parity from its existence. No literal R2B authority was discovered by tracked-source search; absence is not authorization. No R2B custody, acceptance issuance or hosted replay attempted.

[Security39330376548](https://github.com/TasfiqJ/onSkin/actions/runs/39330376548), attempt2, current main: success via automated single-owner SOURCE_ONLY acceptance. Proposal at `scripts/phase9/security_acceptance/proposal.json`: notBefore2026-10-18T00:00:00Z; notAfter2026-10-21T00:00:00Z; databaseReplayAuthority/integrationAuthority/releaseAuthority all false. Live adversarial job skipped. Findings and exception scope persist; no zero-findings, replay, release or ongoing exact-stage acceptance claim. Ordinary test edits may invalidate exact-source acceptance and that must remain visible; no manifest rebinding or expiry extension.

[iOS39330376531](https://github.com/TasfiqJ/onSkin/actions/runs/39330376531): source contract success, not a signed build/device result. Other main Quality jobs (repository quality, PG15/17 rehearsals, iOS/Android exports) succeeded; those are main evidence, not stage reruns.

### Independent stage CI reproduction

Initial stage commit `dc6c42dfcf796cbddb94b510d30ecf277fa13112`, tree `406c7a77dabdb06d0e19edc2d5557ea2620c4a83`, was normally pushed after fetching/rechecking unchanged main and absent remote stage. Created [draft PR8](https://github.com/TasfiqJ/onSkin/pull/8), without merging, to run existing pull_request workflows. GitHub's synthetic PR test commit is `d73facb3af12709dd7aa516307cbd33efe280b39`, with parents `[bbc28dc3d1f945191a81be56945b8bda7bb6ef73, dc6c42dfcf796cbddb94b510d30ecf277fa13112]`; REST confirms its tree is exactly the stage tree above. This is a temporary GitHub test ref, not a merge into either persistent branch.

[Stage Quality39363061096](https://github.com/TasfiqJ/onSkin/actions/runs/39363061096), attempt1, conclusion FAILURE:

- DB job118433459142 independently re-executed the pinned commands on Linux: `npm run phase2:db-local-contract` exit0 (171 tests/0 fail), then `npm run phase2:db-local-verify` exit1.
- Authenticated new log at `2026-10-20T03:13:44.8375239Z`: `Error: H01_SQL_PROBE_FAILED: exit-nonzero. Error response from daemon: toomanyrequests: Data limit exceeded`; stack again points to canonical preparation, before start/SQL. Node20.20.2, same observed Docker binary SHA256 `6435ff9214bf8e0931078fb0980809728cac0a54a526d4f28a26d3e48132b58d`. This is REPRODUCED CI BEHAVIOR, not a repaired or independently proven quota/account root cause. No image digest was returned/admitted in this failed CI pull.
- Repository quality job118433458874 SUCCESS: typecheck/lint/tests and remaining configured source gates. Its log confirms all3 typecheck tasks, all3 lint tasks and both test workspaces passed, no cache hits; mobile457 files/5,952 tests and console7 files/24 tests. This is independently executed source CI on the stage-equivalent tree.
- PostgreSQL17/15 isolated rehearsal jobs118433459133/118433459471 SUCCESS. These do not substitute for the full Supabase gate.
- Android/iOS export jobs118435085783/118435085861 SUCCESS. No device, signing or release admission follows.

[Stage iOS39363061034](https://github.com/TasfiqJ/onSkin/actions/runs/39363061034), attempt1: SUCCESS, source only.

[Stage Security39363061132](https://github.com/TasfiqJ/onSkin/actions/runs/39363061132), attempt1: FAILURE. Code job118433458393 and secret scanning118433458690 succeeded. Static enforcement job118433458700 failed after the inner scanner path rejected `contract.Rejected: SOURCE_INVENTORY_DRIFT`; continue-on-error step summaries alone must not be read as scanner passes. Automatic acceptance job118434755528 failed. Downloaded decision artifact12238014740,249 bytes, independently verified archive SHA256 `b7df12903ad3d06dd8e044bd45e797388753f84ac3c8de0b58dcb48eee6f8f7c` against GitHub metadata:

```json
{"status":"REJECTED","code":"SOURCE_INVENTORY_DRIFT","acceptanceGranted":false,"rawScannerPass":false}
```

This rejection is retained, not repaired by changing the source manifest, scanner, expected reviewed commit, proposal hash, issuer or expiry. Added handoff/evidence paths and changed ordinary test bytes are outside the currently frozen accepted source inventory. Live adversarial job118433459711 was SKIPPED. Do not transfer main's source-only Security conclusion to stage or call these missing scanner/acceptance results PASS. No workflow altered.

No V2 schema/J05, commercial admission, personal/restricted data, photos, provider account, SKU, spend, live migration, release or clinical claim change. Checkpoint and test are ordinary source only. M0-02/dependent schema work remain blocked pending baseline review.

## Decision, blockers, rollback and next bounded task

DECIDED: no ordinary runtime repair is justified by the current CI evidence. Source already rejects the observed exhaustion safely; adding retries would not prove recovery of a data allowance, and using a different registry/image, simulated pull receipt, permissive cache or unapproved identity would weaken evidence or introduce unapproved costs. The ordinary test protects that existing behavior. `PROGRESS.md` records this slice as repository instructions require; no task, acceptance, date, schema, migration count/hash, type artifact or product status was promoted.

The first push is confirmed at `dc6c42dfcf796cbddb94b510d30ecf277fa13112`. The session's final normal commit contains only updated records and progress; source tests above ran on the same runtime/test bytes. Fetch/reconcile before final push. Any CI triggered by the final documentation checkpoint is a separate run; consult its exact head and do not carry earlier conclusions over as an unobserved final-head PASS. No shared history, main or existing founder change is rewritten.

Next action packet for Brain: inspect the entire cumulative stage diff, handoff, exact main/stage refs, PR8 and verified rejected Security artifact. Before a next bounded repair task, determine an actual authorized zero-spend canonical ECR acquisition strategy, with verified existing identity/permissions and transfer limits if authentication is chosen. Do not create a paid account or assume authentication is cost-free without boundaries. Keep canonical tag/digest/platform/container/SQL provenance checks intact and rerun the unchanged Linux DB gate after any approved remediation. Review of the frozen source-only acceptance inventory/commit/policy is a separate protected decision, not an automatic rebind or date renewal. Keep dependent V2 schema/stage progression blocked.

Existing external_pending items remain H01 Apple identity/membership; H02 exact brand clearance; H03 qualified privacy/legal/clinical/chemistry/IP review; H04 provider accounts/configuration; H05 physical iPhone/build/StoreKit/notification/camera evidence; H06 territory/pricing/spend/support decisions; H07 distribution/public-release permission; H08 real beta recruitment; V01 Apple/platform outcomes; V02 production-provider approvals. All25 source task statuses and original evidence lineage remain unchanged. No source test closes those gates.

Rollback is a normal reviewed stage commit reverting the regression if required, while preserving/updating the mandatory handoff and audit history. No runtime deployment/data change needs rollback; no main merge, force/reset or protected rollback is authorized. All task scratch tools/logs/artifact builder remain outside the repository; Docker image cache remains for reproduction, and run-owned containers/sandbox cleanup was independently confirmed. No unsafe task source is held back. Context pressure medium estimate, no compaction, one stage writer,0 accepted tasks; a fresh bounded follow-up after Brain review is recommended.
