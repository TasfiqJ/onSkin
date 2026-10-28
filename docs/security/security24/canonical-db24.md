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
| linux/amd64 config/image ID | `8613ba8eab946dff6674a2db6aab75b80aa101da39035fe20f62b0c7591ab35d` |
| linux/arm64 manifest, 9388 bytes | `4e4ce13a16fa33bae61c878d11ec002584b3a55114ccdcab79bc1dda3fe5e767` |
| linux/arm64 config/image ID | `a5a0c2b809d5415edff7c010d9facf29063cb138f88ed3a66efdf24b83e79a96` |

The index binds both manifests; each manifest binds its config and all compressed
layers. The fixed config ID additionally binds the expected native image after
Docker's content-addressed pull. The helper never trusts a mirror tag as proof.

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
