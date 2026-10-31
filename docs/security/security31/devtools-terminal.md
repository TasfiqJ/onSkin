# Campaign31 — executor terminal output repair

2026-10-31, America/Toronto. Engineering repair; qualified acceptance remains
closed. The user explicitly requested execution and development integration into
main after the independent PR34 review. That instruction supersedes the prior
local-only delivery restriction; it supplies no Security or release acceptance.

## Exact source and change

Parent PR34 HEAD 74aeb1ffbe0379bfc8b5ceaf38ea401b8d62e2c9, tree
53168ac9fd6e2b6a1792465243b949bff6cdc5e2, verified live open/draft/unmerged before
writes. First child 58813b86 commits only the immutable M1X-31 scope plan. Exactly
the six planned paths are changed. PR33/34 source branches are not amended.

CLI57.0.32 remains pinned by the unchanged lock, registry URL and SHA512 SRI:
sha512-3p1qL/pvWblGNwDE1bt2wh/NUiGpSer61s5GKKFfpEpBkZTYnqve0pdK1UvEFzJGT6PW9vX2RofQQ2LP6MgvDQ==.
The authenticated registry archive SHA256 remains
9a73b4030fe119f8098e5a09ff50cdd146a73dea02663ac4c28b824b8f6cf841.
After normal installation, seven inspected CLI modules remain archive-identical.
The executor equals exactly the authenticated archive plus two early guards:
`if (finished) return` in stdout and stderr data handlers, before toString/append.

Executor preimage SHA256:
f4ee6307896aee35bcac074f7305bfd56fa593c7501ad547f3b5169af1f31236.
Executor repaired SHA256:
89dc50f0e8fdfe229c73eb529db6fb93f6b336c0af10433713d3249e6182dbf3.
The CLI package.json identity remains
62186cebf9699c0f2bd8ddccdcf863c5e8aba6a2f177696200112edc88b52f67.

The mandatory postinstall appends the new exact-source patch/check after every
existing hook. The patcher reuses the existing bounded public-file reader and
strict lock inventory. It validates all declared CLI targets before mutation,
stages replacements, rechecks source, verifies postimages and rolls back applied
targets on failure. Unknown source/package/lock identities refuse. No package,
lock, workflow, historical patcher/manifest, Campaign30 test or policy is changed.

## Independent before/after evidence

Actual runtime: Windows x64, Node22.21.0, npm11.20.0. Installation and checks use
allowlisted OS/process variables and CI/telemetry flags, with zero provider
credential environment variables passed. No dotenv/provider configuration is
loaded. One normal `npm ci --no-audit --no-fund` ran every mandatory hook and
installed 1,033 packages (exit0). No ignored hooks or scanner invocation.

Before installation applied the repair, the new installed-terminal assertion
failed 0/1, exit1, against the actual installed authenticated preimage. After
each synthetic error/timeout/close, one late stdout and one late stderr event
produced record/callback deltas [2,2], where the desired invariant was [0,0].

The final eight-test suite passes 8/8, exit0, zero skips/cancellations:

1. Authenticated baseline retains [2,2] deltas for error/timeout/close. After the
   repair this baseline is reconstructed in memory only by removing the two
   exact handler-specific guards and requiring the original preimage hash before
   compilation. The real installed Results/schema dependencies remain intact.
2. The installed repaired executor produces [0,0] deltas for all three endings.
   Repeated terminal events leave results/callbacks stable. A synthetic throwing
   toString proves terminal data is ignored before conversion. Ordinary valid
   text/image/audio, malformed-text fallback, empty output, stderr/error levels,
   nonzero exit, synchronous spawn error, four argument/command refusals and
   entrypoint confinement remain functional.
3. Patch controls prove unapplied check refusal, application, idempotence, check
   success, unknown-source/package/SRI/hardlink refusals and two declared CLI
   copies. An unknown second copy refuses before the first copy is modified.
4. A real bounded synthetic Node fixture closes normally with code7. Observed
   ordering: stdout, close, settled. stdout/stderr and exit diagnostics survive.
5. A real bounded synthetic Node fixture times out. Observed ordering: stdout,
   kill-request, settled, close; code null, signal SIGKILL. The harness awaits
   close, and verifies stable results/callbacks through that close.

   Both real fixtures use the existing spawnFunc injection to launch fixed Node
   code with heap/stack limits; the executor receives genuine ChildProcess streams
   and events. This is not execution of an installed third-party plugin.
6. Unknown probe mode refuses with exit1 and a fixed public reason.
7. Controller timeout kills and awaits its owned child.
8. Controller output overflow retains at most 65,536 bytes, kills and awaits
   its owned child; the fault fixture emits 65,537 bytes intentionally.

The first full suite passed 6/8, exit1: its baseline-reconstruction helper used
an ambiguous guard marker also present in original terminal handlers. The helper
was corrected to identify each data handler exactly, then the full suite passed.
The repaired installed invariant and both real-child cases passed in that first
suite already. This test-helper failure is retained, not hidden as a clean run.

Windows invocation count: 17/32 (one initial red child, eight children in the
first matrix, eight in the corrected matrix). Real OS fixtures are counted as
owned probe children directly; no probe spawns an untracked grandchild. Each
child uses 128 MiB V8 heap, 512 KiB stack, <=4,500 ms controller deadline,
<=64 KiB captured output, <=64 KiB input and <=512 members. The timeout fixture's
executor deadline is 1,000 ms. Real children emitted only 67/51 captured bytes.
The 65,537-byte containment fault intentionally exceeds the capture threshold
by one byte; retained output remains bounded. No exhaustion test was attempted.

Linux NOT_RUN: the registered Ubuntu-22.04 WSL disk cannot attach,
HCS/ERROR_PATH_NOT_FOUND. No OS repair, installation or Linux result is claimed.

## Commands and broader integration checks

Commands ran from repository root, through an external clean controller:

| Command | Actual outcome |
| --- | --- |
| `node --check scripts/security31/patch-devtools-terminal.mjs` | exit0 |
| `node --check scripts/security31/devtools-terminal.test.mjs` | exit0 |
| `node --max-old-space-size=128 --stack-size=512 --test --test-name-pattern='installed terminal invariant' scripts/security31/devtools-terminal.test.mjs` before repair | exit1, 0/1 |
| `npm ci --no-audit --no-fund` | exit0, all hooks, 28.313s |
| `node --max-old-space-size=128 --stack-size=512 --test scripts/security31/devtools-terminal.test.mjs` first matrix | exit1, 6/8 |
| Same full-suite command after helper correction | exit0, 8/8, 2.453s |
| `node scripts/postinstall.mjs --check` | exit0, 1.078s |
| `npm run typecheck` | exit0, 3/3 tasks, 36.328s |
| `npm run lint` | exit0, 3/3 tasks, 80.906s; types package has no configured lint |
| `npm run test` | exit0, 2/2 tasks, 63.719s; mobile 499 files/6,478 tests pass |

Logs, branch/PR inventory and final commit/tree/publication identities are
outside tracked source under the task output directory. No large ZIP is needed.
Final hosted results must be reported from actual run metadata after publication,
never inferred from these local checks or from queued/running jobs.

## Development integration and limits

Live main initially d9912f4c8b30358593569c5b9b4e84773c6f463e. PR34 is 228 commits
and 3,670 changed paths ahead, in a linear stack covering PR11-34. User explicitly
requested bringing development work to main. Source-only integration does not
mean qualified owner approval, public release, deployment or an accepted scanner.
The existing main-push workflows run automatically; their policies remain intact.

Two older app branches, c08a2-progress-lock-authority and
progress-authority-render-warning, have no unique patch commits against this
stack and their simulated merges produce exactly the current tree. Their code
does not need to be reapplied. PR10 stage/m1-gate-recovery is divergent: simulation
conflicts in the handoff and generated Phase4/native privacy evidence, and it
contains changes to older Security acceptance/source-review material. Do not
blindly merge or overwrite current controls to close that PR. Artifact/evidence/
review delivery branches are retained as deliveries rather than app source.

The current historical Campaign29 event/inventory checker deliberately admits
its own interval, not this successor or a main push. Its refusal is not repaired
by changing pins, approvals or manifests. The audited PR34 hosted Quality and
Security failures remain historical facts. Its canonical DB attempt failed a
Studio host-port bind; PG15/17 supporting rehearsals passed. No DB rerun occurs
in this task, and no fresh DB technical success is claimed.

The real-child cases establish ordinary close and timeout termination ordering
on this Windows execution. They did not observe late OS data after settlement,
reproduce a real OS error event followed by output, or prove remote exploitability.
Post-close data in event-emitter tests is a synthetic robustness control, not
an asserted OS sequence. Only the supported data-handler invariant is repaired.

The repair leaves streaming listeners attached to drain data. It does not bound
pre-terminal JSON parsing, validation issues, output accumulation or synchronous
work, and does not prove the executor itself awaits process close. The V8 string
backstop remains unchanged and was not exercised. Proposed byte/member/message
caps remain unapplied pending compatibility review. This is local development
tooling; no additional shipping React Native or network principal is established.

G97 FAIL/NO_GO; DB06/DB08/R2B NOT_ACCEPTED; M1-03
BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED; M2 NOT_AUTHORIZED. Native physical iPhone,
VoiceOver, J01 G1/G2/G3/G5 and longitudinal G4, clinical/legal/licensing,
provider/paid, Apple and public release remain closed. F09 and current product
exclusions remain protected. No protected Security evidence was opened; no
scanner/provider/production/manual workflow action or paid resource was run
locally. Automatic hosted checks and source integration are recorded separately.
