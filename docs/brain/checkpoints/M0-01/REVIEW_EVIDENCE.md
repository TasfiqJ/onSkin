# M0-01 investigation evidence

Status: PARTIAL, REVIEW_REQUIRED. No Brain acceptance or runtime repair claimed.
Session: 2026-10-19 America/Toronto (2026-10-20 UTC). This interim record will be updated after running commands and stage CI.

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

Founder dirty-state fingerprints (captured before task changes outside stage): porcelain SHA256 `273d611a5d409060cf752fec9286049d697bde81115c88cadcab44900e569e23`, unstaged binary diff SHA256 `7ef3b3c0c1385e071aaaa7b66fa82dc83e37f23d4dccf8406bac5cce82496638`, staged diff empty. Contents were neither copied nor published.

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

An initial `npm ci` accidentally used the system npm10.9.4 (exit0) and is NONCANONICAL installation evidence. Corrected this by repeating `npm ci` with explicitly resolved npm11.20.0 (exit0). It installed1031 packages, applied existing postinstall patches, and left the lockfile unchanged; npm reported68 high advisories and2 unapproved dependency install scripts. No audit fix or install-script policy change was made. These observations do not replace governed Security evidence.

| Command (task worktree unless stated) | Environment | Result |
|---|---|---|
| `node --test scripts/phase2/canonical-postgres-pull-retry.test.mjs` | Node20.20.2 | exit0,6 passed; exact data-limit diagnostic is a FIXTURE regression, not an actual ECR error reproduction |
| `docker pull --platform linux/amd64 public.ecr.aws/supabase/postgres:15.8.1.085` | Docker29.2.1/local default auth configuration | exit0; cold local cache, actual canonical image download succeeded |
| `docker image inspect public.ecr.aws/supabase/postgres:15.8.1.085` | same local engine | exit0; ID and RepoDigest `sha256:af083ef64d0408c8f098ee6f5c364a59b26f36fbc0f3a334a62c5c1d57362e9b`, linux/amd64 |
| `npm run phase2:db-local-contract` | Node20.20.2/npm11.20.0 | RUNNING at interim checkpoint; no PASS claimed |
| `npm run phase2:db-local-verify` | same pins, CI=true, EXPO_NO_TELEMETRY=1, fresh empty Docker auth config | RUNNING at interim checkpoint; real canonical preparation succeeded, stack start began; no PASS claimed |
| `git diff --check` | stage | exit0 |

The local verifier uses its existing credential scrub, random project/port sandbox, local engine binding and process containment. It does not link/deploy hosted Supabase or replace generated types in --verify mode. Local preparation passed with an empty Docker auth config, independently showing current anonymous canonical-image availability on this host; it does not reproduce the earlier CI quota failure. Whole-command result remains pending.

## Protected boundary and CI state

DB06 `assertPinnedMigrationRunnerCompatibility()` still rejects every valid trial with `DB06_CURRENT_CHAIN_REPLAY_REQUIRED` before link/mutation. Reviewed migration aggregate remains `5ee03b2032781512fe2ab893e46a3f28daf68ea55ba7b800393265256898c3d6`;97 entries/latest20261010000081. DB08 generated types retain historical hash `2c14252f882294d2ca42832405fb0fe157f855a85a9d3fc5d47999457be9b1d3`; no current parity presumed. No literal R2B authority was discovered by tracked-source search; absence is not authorization. No R2B custody, acceptance issuance or hosted replay attempted.

[Security39330376548](https://github.com/TasfiqJ/onSkin/actions/runs/39330376548), attempt2, current main: success via automated single-owner SOURCE_ONLY acceptance. Proposal at `scripts/phase9/security_acceptance/proposal.json`: notBefore2026-10-18T00:00:00Z; notAfter2026-10-21T00:00:00Z; databaseReplayAuthority/integrationAuthority/releaseAuthority all false. Live adversarial job skipped. Findings and exception scope persist; no zero-findings, replay, release or ongoing exact-stage acceptance claim. Ordinary test edits may invalidate exact-source acceptance and that must remain visible; no manifest rebinding or expiry extension.

[iOS39330376531](https://github.com/TasfiqJ/onSkin/actions/runs/39330376531): source contract success, not a signed build/device result. Other main Quality jobs (repository quality, PG15/17 rehearsals, iOS/Android exports) succeeded; those are main evidence, not stage reruns.

Stage CI is NOT_RUN at interim checkpoint; only main pushes trigger automatic Quality, but a nonmerging draft PR can run current workflows safely. No workflow altered.

No V2 schema/J05, commercial admission, personal/restricted data, photos, provider account, SKU, spend, live migration, release or clinical claim change. Checkpoint and test are ordinary source only. M0-02/dependent schema work remain blocked pending baseline review.

## Pending next operations

Finish current commands and record exact exit/new failure layer; run relevant source/custody and broader checks. Fetch/reconcile before each non-forced push to stage only. If warranted create one nonmerging draft PR for Linux CI; never merge. Update root handoff and this record at session end regardless of result, and produce post-push exact-SHA structured report using the supplied schema. Branch GitHub ref supplies self-commit identity.
