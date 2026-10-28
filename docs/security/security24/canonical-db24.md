# Campaign24 canonical database image recovery

Authority: `BRAIN-M1X-SECURITY-DEPENDENCY-DB24-CANDIDATE-01`.
This is bootstrap engineering evidence, never DB06/DB08/R2B acceptance.

The live public canonical job [122884230343](https://github.com/TasfiqJ/onSkin/actions/runs/40707716778/job/122884230343)
passed its 171 JavaScript contract tests and DB05 source contract, then failed
before stack startup. Its contained Docker pull reported
`H01_SQL_PROBE_FAILED: exit-nonzero` and registry `Data limit exceeded`.
No canonical SQL execution or successful reset follows from that failure.

## Exact scope recorded before edits

Pinned baseline: PR27 `5976394fd39f41550bde8107b9cc27c758b7ce14`,
tree `63a896fad61d85a51b0d1e9a23020ba02d169c9e`.

| Existing selected path | Baseline bytes | Baseline SHA256 |
| --- | ---: | --- |
| `scripts/phase2/local-supabase-reset.mjs` | 55248 | `4a5a58b3547c82e8a61fe17ba20ac970b26aa9d2721e713be583bebd90a6a920` |
| `.github/workflows/quality.yml` | 13714 | `51a295770e798707507048bc56cf10765b308b18ed9ce9922c05bf699b660c49` |

New paths are `scripts/phase2/canonical-postgres-mirror24.mjs` (immutable image
proof and bounded acquisition through the existing contained Docker runner),
`scripts/phase2/canonical-postgres-mirror24.test.mjs` (adversarial bootstrap
controls), and this document (scope, provenance, limitations).
The workflow addition runs the new controls in the canonical job; every original
workflow line remains in order. All original phase2 tests remain unchanged.

## Identical image evidence and trust

On 2026-10-28, independent anonymous HTTPS Registry V2 reads retrieved the
1,609-byte OCI index and both native manifests from **all three official
Supabase repositories**, and compared actual bytes:

- `https://public.ecr.aws/v2/supabase/postgres/manifests/15.8.1.085`
- `https://ghcr.io/v2/supabase/postgres/manifests/15.8.1.085`
- `https://registry-1.docker.io/v2/supabase/postgres/manifests/15.8.1.085`

The index and each native manifest were byte-identical across the three
registries. Raw metadata and request receipts are retained outside the source
checkout for the return packet. No registry account, login, private credential
or production service was used. An earlier optional config-blob fetch returned
HTTP429; this did not alter the independent index/native-manifest comparison.

| Object | Exact SHA256 |
| --- | --- |
| OCI index | `af083ef64d0408c8f098ee6f5c364a59b26f36fbc0f3a334a62c5c1d57362e9b` |
| linux/amd64 manifest, 9392 bytes | `caae3d066f437332d593011e3e7ecf78ab005ce9b89378efd53f97f0410563ad` |
| linux/amd64 config / classic image ID | `8613ba8eab946dff6674a2db6aab75b80aa101da39035fe20f62b0c7591ab35d` |
| linux/arm64 manifest, 9388 bytes | `4e4ce13a16fa33bae61c878d11ec002584b3a55114ccdcab79bc1dda3fe5e767` |
| linux/arm64 config / classic image ID | `a5a0c2b809d5415edff7c010d9facf29063cb138f88ed3a66efdf24b83e79a96` |

The index binds both manifests; each manifest binds its config and all compressed
layers. The fixed config ID additionally binds the expected native image after
Docker's content-addressed pull. The helper never trusts a mirror tag as proof.

Docker's modern containerd store instead reports the target OCI index as the
unqualified image ID. The official
[Docker storage documentation](https://docs.docker.com/engine/storage/containerd/)
states containerd is the fresh-install default from Engine29 onward. Independently
fetched Moby source at immutable commit
[`9f07d9222f4277b9a46bda82b3db99186ee595ef`](https://github.com/moby/moby/tree/9f07d9222f4277b9a46bda82b3db99186ee595ef/daemon/containerd)
binds both `GetImage` and unqualified `ImageInspect` to that target ID and obtains
the selected native RootFS metadata from its OCI config. Source snapshots/hashes
are in the external receipt. The original SQL/container ID assertion remains
unchanged; the same index ID binds that store's actual container.

An index ID alone is still refused. The current proof additionally requires its
exact OCI descriptor media type, 1,609-byte size and digest, native Linux platform,
and all 48 ordered RootFS diffIDs. These arrays were derived from independently
downloaded native config bytes verified against the exact config hashes above.
SHA256 of compact JSON encoding of the complete ordered diffID array is
`563d7006e8b568b4c86e8896996b8007783083f9e57fe59a8d8f7b65b3a1d511`
for amd64 and
`6c70db9419343a875884a064d92f87d194fc9881ac292e293f1ac60b56b70f99`
for arm64. Both actual public config objects and their request receipts are
retained. Classic config-ID proof remains unchanged. Modern ECR success gets an
additional read-only image inspection, and both mirror inspections require this
native proof before or after any retag. No daemon configuration is changed.

The pinned upstream CLI source already supports registry fallback and checks
candidate image caches before pulling. Its public
[`apps/cli-go/internal/utils/docker.go` at v2.117.0](https://github.com/supabase/cli/blob/v2.117.0/apps/cli-go/internal/utils/docker.go)
was fetched with SHA256
`1098992c1f32868c347219cb75382132ae0659c1c58c589a30a7c6c49efd790e`.
Seeding the first canonical cache entry keeps the original CLI container name
and run-owned SQL assertions intact rather than admitting a differently built
PostgreSQL image. No CLI/framework/version upgrade is needed.

## Behavior and refusal

The existing ECR preparation function remains byte-identical. A separate current
dispatcher calls it first, then requires the fixed index and native config ID.
A moved upstream tag fails before a database starts. Only the exact contained
ECR data-quota or exhausted rate-quota diagnostic enables recovery; timeouts,
cancellation, authentication, network failures, malformed output and unconfirmed
containment still stop the run.

Recovery pulls `ghcr.io/supabase/postgres@sha256:af083ef64d0408c8f098ee6f5c364a59b26f36fbc0f3a334a62c5c1d57362e9b`
for the native platform through the original bounded Docker executable. It
requires one matching pull digest and the exact image ID, OS, architecture and
official RepoDigest. Only then does it seed the canonical ECR name from that
immutable image ID and inspect the canonical name again. Refusal diagnostics are
fixed strings. Cancellation is checked before, between and after acquisition
commands. No caller can provide another registry, version, digest or approval.

An actual intermediate hosted run exposed a separate transient GHCR rate limit
after pinned layers began downloading. Recovery now retries only its exact
structured contained registry-rate diagnostic with the existing fixed
3/10/30-second backoffs, at most four pulls per official mirror. It never accepts
an unbounded server-supplied delay. If GHCR remains rate-limited after those
attempts, it may pull the independently byte-proved official Docker Hub image
at the **same index digest**, requiring the same native config ID and canonical
readback. Authentication, network, timeout, cancellation, malformed/different
digest and image-inspection failures never enable that transition. Both mirrors
remaining quota-limited preserves the last actual failure and stops before SQL.
The rate classifier also validates every preceding diagnostic line against
bounded pinned-reference/Docker-progress forms. Mixed authentication, network,
arbitrary or foreign-reference lines cannot become a retryable rate failure.
Its hardened classifier was executed against the actual 63-line captured GHCR
failure and accepted that response, while mixed-prefix adversarial controls fail.

All migration bytes, SQL/RLS assertions, full history checks, credential scrub,
reset-twice sequence, drift/type parity and run-owned cleanup remain unchanged.
The same original final container ID/config-image checks bind every SQL probe.
PG15/PG17 rehearsals remain supporting evidence only.
Public image commands receive a new empty run-owned `DOCKER_CONFIG` and no
inherited `DOCKER_AUTH_CONFIG`, so a desktop registry login is never consulted.
The config is removed with the same disposable sandbox; no user Docker settings
or credential store is opened or modified.

## Execution and limitations

The new bootstrap controls execute both platforms in deterministic contained-runner
fixtures, cover the real source dispatch and mandatory Quality wiring, and test
wrong digests/config/platform/registry, malformed and duplicate responses,
swapped retags, stale canonical names, command failure, cancellation, inherited
prototype names and disclosure-shaped diagnostics. Fixtures are unit execution,
not Docker-layer execution or a canonical database pass.

Local Node/npm installation completed with npm11.20.0 and mandatory postinstall.
An initial pre-install source test attempt had 136 passes and one missing
TypeScript input failure; that attempt is retained separately. Original baseline
controls and current controls are rerun after installation with actual receipts.
The authentic baseline three-file control run passed 153/153 after installation.
At the current implementation, `node --test scripts/phase2/canonical-postgres-mirror24.test.mjs`
exited0 with 30/30 controls and no skips; `npm run phase2:db-local-contract`
exited0 with all original 171/171 controls, no skips, and DB05 contract PASS.
`npm run postinstall:check` and syntax checks for both bootstrap modules exited0.
The new controls use unchanged tests and real execution, while their Docker
responses are explicitly fixtures. These results do not imply actual SQL ran.

The subsequent quota-recovery extension has 40/40 executed controls, including
the observed GHCR response, exact retry counts/delays, both native platforms and Docker Hub
RepoDigest spellings, foreign/changed secondary images, finite exhaustion and
real backoff cancellation. The original 30-control execution remains separately
qualified as the initial implementation, rather than silently replaced.

Intermediate Quality run `40754008916`, canonical job `123047918649`, was
superseded by a new source push after installation and the new bootstrap controls
passed; its original contract step was cancelled and reset step skipped.
Intermediate Quality run `40754189070`, canonical job `123048722059`, passed
installation, all new bootstrap controls and the original local database
contract. Its real reset command failed before startup: ECR quota recovery
activated, the fixed GHCR digest began downloading, then GHCR returned
`retry-after: 1.042664ms, allowed: 44000/minute` with a contained exit1.
This actual failure motivated the bounded retry and second identical official
mirror extension. It was not a reset/SQL pass or an acceptance result. The job
used the workflow's default PR checkout; exact tree binding belongs in the final
integration report. Subsequent actual canonical results remain separate.

Runtime head `255f51d1fe83b06b0ff2e1f224154ff266381328`, Quality
`40756252549`, canonical job `123055844556`, passed the 40 bootstrap controls
and all original database contracts. ECR acquisition succeeded, but Docker
returned the pinned OCI index as `Image.Id`; the initial config-ID-only proof
correctly refused with `H01_CANONICAL_POSTGRES24` before stack startup. This
actual refusal motivated the separately constrained native RootFS proof above.
Both PG15 and PG17 rehearsal jobs succeeded in that run, which does not replace
the failed canonical job. The expanded 63-control suite executes valid and forged
descriptor/RootFS/config/index combinations, both native platforms, ECR readback
replacement/cancellation and refusal of quota fallback after native inspection.
No failed execution is relabelled as canonical success.

This Windows host initially had no Docker Linux engine pipe. Its existing Ubuntu
WSL registration could not attach its missing `ext4.vhdx`; no distro was recreated
and no user data was removed. Existing Docker Desktop was started hidden without
account/provider/configuration changes. Real local and hosted outcomes must be
read from their actual command/job receipts, including environmental failures.
The actual baseline `node scripts/phase2/local-supabase-reset.mjs --verify`
reached its ECR pull but exceeded the external runner's 180-second limit while
the daemon was unresponsive. No database stack had started. The outer runner
terminated Node and left one pull process; that exact task-owned Docker command
was identified and terminated, along with the separate hung task-owned
`docker version` probe, and both process IDs were verified absent. This attempt
has no canonical command exit/result and no SQL success. Source/workflow working
bytes were restored exactly after the baseline fixture.

Classification pending an actual full canonical execution:
`IMPLEMENTED_NOT_EXECUTED` for end-to-end recovery; proven unit controls and
public image metadata do not qualify SQL or database acceptance. All original
release/custody gates remain closed and source requires independent Brain review.

## Superseding runtime execution result, 2026-10-28

The earlier pending-execution statements above are historical implementation snapshots. Actual runtime6488b220f6b4da6487f0048eb5e1db8da3e777a2 now has canonical technical FIXED_AND_PROVED evidence: Quality40758426039/job123063483970 succeeded. Its actual mergecheckout33a5941cfdae39d7c206d14d96b383f112edbfe8 is independently verified tree-equal to runtime63c88990a91ac87c2e3b644de5ff8357ddf113e8. Real ECRquota fallback, twoGHCRrate retries and identical nativeimage proof executed. Fiveforward cutovers, bothfull97-migration resets, SQL/RLS, lint, emptydrift, CAT08concurrency, generatedtypes7381lines/paritySHA2562b475803f0ea143681de2912637e61b1cf26e271043a84a1692e7d1d6b87a795 and awaitedcleanup passed. The20structural sourcefiles/fivefocused selectedfiles are the source-scope denominator; aggregate runtime assertioncount is not emitted. PG15andPG17each passed15isolatedrehearsals. These do not grant database acceptance.

ActualDockerHubsecondary pulling remains NOT_RUN because GHCRrecovered; its source/metadata/unit controls passed. The returnedcanonicalreceipt contains only sanitizedphase/count/outcomes. Automaticapprovalreview refused oversizedfullPGloghashing; those hashes and currentcanonicalfull-log hashing are NOT_RUN without rerouting. DB06/DB08/R2B remain NOT_ACCEPTED, G97FAIL/NO_GO. Final-head CI and independent Brain review follow the source freeze.
