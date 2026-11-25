# Reproduce Engineering39

Use the clean `stage/m1-native-runtime47` checkout at `6a5688d42cd40cddf7216b35f819769c9560ff05`, tree `d98859e15c3dc36245eaba8b99ef1f4cda5ecbc4`. The starting point is Engineering38 at `6d4ce5ce2ed8db22a779dfa55c60f6480cbb3e0a`, tree `f430348f90ddd5162cbf42b24a7a22042ed48230`. PR48 ancestry begins at `d292743c99c1fb98f5714789f4fd60fb1e7d5a5d`. The original source, old evidence and all prior commits are preserved.

The bundled scripts expect this evidence directory beside `c16-candidate`. Use the installed npm dependencies and Node 22.21.0 or an approved compatible Node 22 build exposing `node:sqlite`, `registerHooks` and experimental TS transformation. The protected native and database tools require their own original pinned environments. Use a fresh evidence directory for each run. Run each command under the authority indicated below. Preserve all stdout, stderr, exits, tool versions and before/after commit/tree.

## Reproduce today’s executable local candidate

From `c16-candidate` in PowerShell:

```powershell
git status --porcelain=v1 --branch
git rev-parse HEAD 'HEAD^{tree}'
git merge-base --is-ancestor d292743c99c1fb98f5714789f4fd60fb1e7d5a5d HEAD
node --test scripts/e2e/owner-custody-sqlite.test.mjs
npm.cmd --workspace apps/mobile test -- --maxWorkers=2 routineDecisionRecovery32
npm.cmd --workspace apps/professional-web test -- --maxWorkers=2 ownerRoutineCustody encryptedCustody previsitRecords encryptedWorkspaceRepository
```

`validate_candidate.py` holds the exact uncached root, lint, typecheck, three builds, adversarial, Edge, DB source and protected check commands used for this archive. Copy the helpers into a new sibling evidence directory before rerunning. `run.py` removes credential-like environment variables, suppresses dotenv/telemetry/network package provisioning for Expo/npm, preserves the executable command and checks stable working source and index. The preflight guards a clean authorized base and sufficient disk. `source_proof.py` produces fresh hash manifests, complete raw first-parent ancestry and both disposable-index direction checks. `verify_ancestry.py source-proof/COMMIT_ANCESTRY_WITNESS.json` is usable offline against the archive contents alone.

The continuation adds a second SQLite file as the independent witness. Use `node --test scripts/e2e/owner-custody-sqlite.test.mjs` to run the positive and uncertain-outcome cases. The driver stores the prepared successor before committing custody. At restart, the witness can confirm only the authenticated prepared successor. An observed prior head with a pending successor remains ambiguous and both records are retained. A production custodian must define authoritative abort/commit attestation before any operator can reconcile that state. Monitor the final native commit and exact witness receipt separately. Restoring the data file while keeping the witness proves refusal in this synthetic fixture. Deployment needs separately controlled credentials, restore domains, custody and media guarantees. Checkpoint scope in this fixture is the archive head, and protection for erasure progress or external workspaces requires their own bound evidence.

The persistence fixture uses disposable SQLite, `BEGIN IMMEDIATE`, full synchronous commit and real AES-GCM envelopes. It kills workers after validation but before `COMMIT` and after `COMMIT` but before an acknowledgement. The test verifies exact outcomes under process death. It does not simulate physical media loss, a hostile administrator, external freshness authority or key storage on a production device.

## Qualification ready to execute on an eligible runner

### Browser

Use an approved connected Chromium runner with working app HTTP and browser control. The ordinary Vite worker started on Sleepy, but the browser could not establish HTTP. The source/API integration is reproducible independently of the browser. Once the transport is eligible, run the existing browser harness alongside the exact API integration.

```powershell
$env:ONSKIN_E2E_EVIDENCE = '.tmp/engineering39/browser-next'
node scripts/e2e/professional-previsit.mjs 375 667
node scripts/e2e/professional-previsit.mjs 390 844
node scripts/e2e/professional-previsit.mjs 430 932
Remove-Item Env:ONSKIN_E2E_EVIDENCE
```

The existing browser harness launches its own server and exercises its existing synthetic responses. Use a new evidence folder per repeat. The Engineering39 mobile-to-API integration is a separate executable source test. To qualify this new flow end to end, supply the same synthetic authority and reference selection to a local browser fixture, then begin with the unconfigured default surface and observe the professional unavailable path. A valid synthetic grant should then allow review of an exact apply, clear, recorded use, retraction and bottle observation with independently limited fields. For each of 375×667, 390×844 and 430×932, load a selected receipt, tab through selection to Review, cancel once, reopen, confirm the clear text and export exact selected facts. Negative controls cover stale source, swapped receipt, unrelated fields, no role/grant, withheld production configuration, process reload and withdrawal during final response. Preserve keyboard focus, overflow, video or snapshots, network result and first failure. `BROWSER_MATRIX.json` carries the prior consumer/operator flows and the new cases.

### Canonical local database

Approved operating-system access must expose Docker Desktop's Linux engine or the approved equivalent canonical Docker runner. The same test environment must have the project’s pinned Supabase CLI and image. Check before executing reset. A read-only WSL inventory request on this host returned `Wsl/E_ACCESSDENIED` and is retained in `final-wsl-inventory.log`. Do not link a hosted project or replace the image.

```powershell
docker version --format '{{json .Server}}'
docker info --format '{{.OSType}}'
npm.cmd run phase2:db-local-verify
npm.cmd run phase2:db-types:check
```

Verify Supabase CLI 2.117.0 and the exact canonical `public.ecr.aws/supabase/postgres:15.8.1.085` identity. The original runner handles isolated reset, pgTAP, race checks, schema diff, lint and cleanup. Record the project/loopback identity and schema evidence. Seed an operator page of limit 1 with two records within the same millisecond (`.123100Z` and `.123900Z`) using inverse UUID ordering. Page through both and confirm exact once delivery. Repeat with identical microseconds to exercise the UUID tiebreak. The original DB custodian controls qualification. No project, account, schema or remote deployment action is authorized here.

### Frozen catalog operator Edge

Run after the official JSR package can be materialized from an approved existing cache or public registry access. Keep `supabase/functions/deno.lock` frozen, with the pinned Supabase package 2.110.0 and postgres 3.4.7.

```powershell
deno.cmd check --no-config --lock=supabase/functions/deno.lock --frozen=true supabase/functions/catalog-operator/index.ts
npm.cmd run phase4:catalog-operator-edge:test
```

For an offline compile-only check with the fully provisioned cache, use `deno.cmd test --cached-only --no-run --no-config --lock=supabase/functions/deno.lock --frozen=true supabase/functions/catalog-operator/index.ts`. `--cached-only` is not an option for the installed `deno check`. `inherited-edge-entrypoint-supported.log` records the supported invocation against identical Edge source. `final-edge-entrypoint-offline.log` confirms that the frozen JSR manifest is absent from the local cache. Standard local Edge contract results are separately recorded.

### Protected source, native and physical device

```powershell
node scripts/launch/check-contract.mjs --scope full-app-j01-v2
python -B scripts/phase9/security_acceptance/contract.py source
node --test scripts/release/full-app-j01/native_generated47.test.mjs
```

The R33 release refusal is a source-witness mismatch. G97 refuses before admitting scans because the assessed source inventory differs. Use the exact independent decision and original rule custody described in `docs/release/full-app-j01/owner-packets.md`. The native source checker independently observes the old selective-cleanup descriptor (7,179 bytes versus current 7,939), frozen lock, and original bounded first-parent lineage. Some tests depend on that identity and two symlink cases require a compatible runner. Retain both historical and current outcomes. No historical expiry, protected criterion, manifest or frozen hash should change to conceal the mismatch. Authorize signed device only after the original custodian issues a separate eligible attempt. Keep all reserved attempts 79–86 unused here.

For signed-device acceptance, bind the account, authorized build hash, native dependency resolution, signing identity, iOS/device/lens and supported screen configurations. Exercise offline/relaunch, current-owner separation, camera and capture refusal, deletion/temporary residue, local reminder and widget delivery, accessibility and real store lifecycle in the approved environment. Return raw matrices and real Apple/custodian decisions. No claim may be inferred from a simulator, local fixture, file hash or a source unit test alone.

## Checkpoint recovery decision table

Here `C` is the independent witness's last confirmed head and `S` is the exact prepared successor. The fixture stores only these digests in the witness file.

| Witness | Authenticated custody head | Expected decision | Qualification evidence |
|---|---|---|---|
| `C`, empty pending | `C` | Admit the ordinary current-authority check | Exact digest agreement in both reads and a current valid grant |
| `C`, pending `S` | `S` | Confirm `S` with compare-and-set before returning exact original evidence | Kill after custody commit, restart, verify the retained operation receipt and witness advance |
| `C`, pending `S` | `C` | Refuse reads and mutations until the original custodian can attest the terminal outcome | Kill before commit, restart, verify stable evidence and refused append and reopen |
| `C`, empty pending | Earlier head or no head | Refuse stale backup, including an active snapshot from before tombstone | Restore an older synthetic snapshot while retaining the separate witness and preserve the refusal and bytes |
| Missing, malformed or unavailable witness | Any head | Refuse receipt-backed professional results | Denied final review or export when independent freshness is unavailable |

Exercise the existing source and export tests before an external authority is considered. The restart tests protect the custody head. The professional API tests verify that the supplied checkpoint authority is still current at response publication. Combine both on an approved independently controlled test deployment before requesting any live admission or retirement.

## Migration, recovery and rollback decisions remaining

Production routine history separation remains a local implementation task. The proposed ordering preserves the existing persistence caps, keeps the installed app working, and reflects the process-death evidence from this checkpoint.

1. Freeze an exact read-only copy of the existing owner/epoch history and hash the exact source. Parse through the existing codec. Retain legacy keys, original bytes, original digest and replay until the new representation is proven and independently approved for retirement.
2. Stage immutable routine versions and use/retraction segments behind a new versioned manifest. Index exact owner, epoch, immutable ID, sequence and prior hash. Keep unresolved commands resident separately. Authenticate every original and bound each page. Expose readable, unavailable and unsupported states distinctly.
3. Bind migration and restore to a custody-controlled monotonic checkpoint separate from the store being restored. Reserve an operation for the exact predecessor, digest, scope and successor. Commit encrypted records and the operation receipt together. Have the independent authority authorize publication of the exact successor only after durable readback. Refuse access on unresolved split-state. Reconcile an uncertain commit by querying the same operation and comparing exact store receipt to the reservation before confirming or retiring it.
4. Apply newest tombstones and the independent checkpoint before restore. Remove returned authentic ciphertext using an authorized bounded recheck, preserve the original completion receipt and rerun a fresh pass when later reappearance is discovered. Distinguish local authenticated removal from media, key, provider and backup destruction.
5. Test old-to-new-to-old read-only recovery, repeated migration, a stale/missing page, crash at every boundary, unknown external authorization, same-owner regrant, wrong-grant restore, deliberate reappearance, and export equality for retained facts. Require complete exact hashes, receipts and refusal results before activation.
6. Before publication, rollback by keeping the old reader and archived originals while refusing mixed manifests. After publication, fence access and recover from the latest independently authorized checkpoint. Never restore an older mutable snapshot, discard the only original, reset the active branch, or roll back tombstones. Retest and obtain the original custodian’s approval.

## Continuation

Use `RELEASE_READINESS.md` to work the independent tracks. Next implementation is canonical routine history segmentation and exact original use/retraction source, followed by the operator’s read-only receipt path across API and canonical SQL. Preserve the exact final checkpoint for independent Brain review. Continue authorized Engineering39 implementation on the same append-only branch. Attach the archived hashes and retain unsuccessful validation. Do not start the next externally numbered campaign under this authorization.
