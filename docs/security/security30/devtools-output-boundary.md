# Expo DevTools output boundary — finite diagnostic

2026-10-31, America/Toronto. **DIAGNOSTIC_ONLY / NO_GO**.

The installed Results consumer formats all real validation issues for the finite
invalid arrays tested. This extends Campaign24's direct-schema observation to the
consumer, but does not prove a new resource-exhaustion vulnerability. Separately,
the real executor's constructor-injected event emitter demonstrates output-array
mutation and output callbacks after error/timeout settlement. That is a useful
consumer lifecycle finding; actual OS-stream exploitability remains untested.
No mitigation was applied. Passing observation tests do not mean safety is repaired.

## Source custody and reproducibility

PR33 was verified live open/draft/unmerged before writes, at HEAD
`71dde4eed92edd20ff0e9611da42086d6e0f2b89`, tree
`f9e5f995d37a7dc058b07271e6b98f79cf698951`. Live branch verification was repeated
after the probes without drift. Branch `stage/devtools-output-boundary30` starts
there. First child `4b0a72b71f38a3f9b3662e2bd83a4935b31411d1` contains only the
immutable scope plan, Git blob `21363129baee49a05c4fa7b11333b9bc535fc671`.
Final delivered HEAD/tree are recorded externally after this report's commit to
avoid self-reference. Exactly the five authorized paths are permitted.

Read root AGENTS.md/CLAUDE.md, docs/brain/AGENTS.md and README.md, the prepared
ENGINEERING_REVIEW.md/NEXT_CODEX_TASK.md, Campaign24 advisories/blockers and all
three requested probe/test/graph files. Current explicit user scope controls;
historical source validators, handoff instructions and acceptance intervals were
not rebound to this diagnostic. The managed-worktree API refused the source root
because this project's allowed roots exclude Desktop/onSkin. A separate full clone
under task outputs was used; existing worktrees and read-only sources/ were untouched.

Windows x64: Node **22.21.0**, npm **11.20.0**, V8 **12.4.254.21-node.33**.
One successful `npm ci --no-audit --no-fund`, with lifecycle hooks enabled, installed
1,033 packages and executed the unchanged mandatory postinstall. Its subsequent
`node scripts/postinstall.mjs --check` passed. No scanners were run by these commands.
An initial npm invocation refused configuration before installation because one
empty config file was assigned to both user and global roles (exit 1). Separate
empty files corrected that controller error; no hooks were bypassed. Installation
also emitted an optional-package EPERM cleanup warning and an ESLint deprecation
warning; neither is hidden or treated as evidence of a clean scanner result.

Installation and tests received an allowlisted environment containing OS/process
paths, CI/telemetry flags and empty npm configuration paths; **zero provider
credential environment variables were passed**. Root/workspace lifecycle scripts
and lock entries marking dependency install scripts were inspected before install.
No dotenv loading, service calls or private Security evidence access was performed.
Archives, authentication/controller scripts and transcripts remain outside Git.

Lock SHA256: `1485297ffa6cc20367a5f2fda35bc33e12dc11ef422c813f5f28a4e339cb3b95`.
The cached official registry archive was independently reauthenticated against the
current lock (not a floating tag):
`https://registry.npmjs.org/@expo/cli/-/cli-57.0.32.tgz`, 1,304,270 bytes,
SHA256 `9a73b4030fe119f8098e5a09ff50cdd146a73dea02663ac4c28b824b8f6cf841`,
SRI `sha512-3p1qL/pvWblGNwDE1bt2wh/NUiGpSer61s5GKKFfpEpBkZTYnqve0pdK1UvEFzJGT6PW9vX2RofQQ2LP6MgvDQ==`.
Only the eight named regular archive members were read, without extracting or
executing archive code. All eight installed modules after mandatory hooks equal
their authenticated archive members byte-for-byte. This equality is scoped to
these modules, not the whole patched dependency installation.

Paths below are under `@expo/cli/build/src/start/server/`; SHA256 applies to both
archive and installed bytes:

| Module | SHA256 |
| --- | --- |
| DevToolsPlugin.schema.js | `4da5edad8daa6eda49fecc646934d372008952004b2c19abc03e27bcffc904a5` |
| DevToolsPluginCliExtensionResults.js | `ab531966e34f5009d65fab4a00204cc999580d21b921f58ef58e00c568801c02` |
| DevToolsPluginCliExtensionExecutor.js | `f4ee6307896aee35bcac074f7305bfd56fa593c7501ad547f3b5169af1f31236` |
| MCPDevToolsPluginCLIExtensions.js | `447aa8641a2b3d444897ee5225c90c175bacc8b6f9ce5e9b71af1b26352d8d60` |
| DevToolsPlugin.js | `1b2e1cae47b78c9095d1c6f8aa2eb04b3f29b8712e62bc4a9665965241777e90` |
| DevToolsPluginManager.js | `75f77bd74a5a85010f3cfd5bb5517cb0c5f44484e8b1b88341ba2b80de2e2f78` |
| createMCPDevToolsExtensionSchema.js | `9feffc368c805c3188bb1a4dd88617a3986cd71a4f3358821a1ab6da8e44b10d` |
| MCP.js | `d7c17fa651db86df5eea8127775792fb63efd95972764ee7101466fa06352def` |

CLI-context module resolution selects installed Zod **3.25.76** at `zod/index.cjs`
(SHA256 `69025493407e0f37f24e01e363452d75ae43a89aac18eb24806706b5b534b459`),
`zod/v3/index.cjs` (`d58a1fea61e0f0bccdb2f4fd3b7b098adcfddb44f036302c4d2c4e173540a292`),
and mandatory-hook-installed `zod/v3/types.cjs`
(`8e6dcd3f87c58450793d7fe0bb4977df41341b0970577381b1bf3cc204aa9a22`).
The installed CLI package.json SHA256 is
`62186cebf9699c0f2bd8ddccdcf863c5e8aba6a2f177696200112edc88b52f67`;
Zod package.json is `70eedbe34fd52385a4ae2f3e5759b19682189f0118ea73a6e7c32c677f61668e`.

## Eight-module source trace and reachability limits

1. `DevToolsPluginManager.js:53-73` requests devtools autolinking resolutions for
   the local project, resolves descriptors and constructs DevToolsPlugin instances.
   This descriptor origin is local installed plugin discovery, not an app API.
   Autolinking implementations beyond this interface were not traced or invoked.
2. `DevToolsPlugin.js:23-40` schema-validates descriptors and confines webpage/server
   entry paths to packageRoot; `:108-116` lazily creates the CLI executor. Its
   documented request/WebSocket helpers concern development-server plugin routes
   under `/_expo/plugins`; none was loaded through an instance or opened in testing.
3. `DevToolsPlugin.schema.js:63-82` defines text/audio/image records and an output
   array without a collection upper bound. A declared lock edge is not reachability.
4. `DevToolsPluginCliExtensionExecutor.js:44-72` validates command existence,
   argument cardinality, own keys and declared primitive types, then spawns Node
   using process.execPath and the package-confined entrypoint (`:117-126`).
   The constructor's existing spawnFunc and timeoutMs parameters are genuine test
   seams. No plugin executable was created, resolved for execution or spawned.
5. Its `:83-90` stdout/stderr handlers turn child output chunks into strings and
   immediately call Results.append; stderr uses error level. Input to parsing is
   therefore plugin stdout/stderr, distinct from user command parameters.
   `:92-113` installs a default 10,000 ms timeout and handles close/error.
6. `DevToolsPluginCliExtensionResults.js:28-46` checks cumulative **input UTF-16
   code units**, increments that total, then synchronously parses/validates and
   accumulates results. `:58-81` parses each chunk separately; malformed JSON
   falls back to nonempty plain-text lines, while schema-invalid JSON joins all
   real issue messages into one error record. Formatting/output records are not
   separately charged to the input-length counter. This is not a whole-stream
   JSON framing guarantee; fragmented-stream behavior was not expanded into a
   separate investigation.
7. `MCPDevToolsPluginCLIExtensions.js:17-54` queries those plugins, filters
   commands explicitly declaring `mcp`, creates a descriptor restricted to those
   commands, and registers a tool callback. That callback destructures validated
   command parameters, obtains the development server's inspector origin and calls
   the executor. It validates returned records again, joins issues on failure,
   and maps text/resource links (`:54-79`). No MCP callback was invoked in tests.
   `createMCPDevToolsExtensionSchema.js:16-68` constructs a strict command enum
   with declared typed optional parameters; executor validation supplies the
   per-command cardinality/required-own-key checks. An exported registration
   function does not prove it is enabled in a running project.
8. `MCP.js:42-83` separately makes tunnel creation conditional on
   EXPO_UNSTABLE_MCP_SERVER and resolvable expo-mcp/@expo/mcp-tunnel packages,
   normalizes the configured endpoint and loads those external modules. Its
   addMcpCapabilities comes from **expo-mcp**, not automatically from the similarly
   named CLI extension module. No unsupported edge between those exports is
   inferred. Tunnel endpoint/authentication behavior beyond these eight modules,
   actual registration startup, listener binding, remote access and shipping-app
   bundling were NOT_RUN/unproved. No server, tunnel, socket or app was started.

Installed plugins already supply executable Node code; these observations do not
establish an additional untrusted network principal, shipping React Native path,
remote denial of service, OOM or malicious-plugin exploit. The demonstrated path
is local development tooling; optional tooling network integrations require their
own explicit enablement and further review, not a conclusion from the name MCP.

### Existing guards and their ordering

The native string threshold here is **536,870,888 characters**. Exceeding it causes
one truncation error, marks Results truncated and ignores later appends. The
executor then kills the plugin on detecting truncation. There is no documented
constructor/public interface to lower that threshold. Native-threshold exercise
is **NOT_RUN**; no private-field edits, patched constants, massive strings or fake
truncation observations were used.

The input guard is before JSON.parse; validation and issue joining occur before
the output callback returns. The same-event-loop timeout cannot interrupt that
synchronous work. The deterministic ordering test proves only ordering; the
controller's OS-process deadline is a separate containment mechanism. The
native string bound is real, but is not a practical low resource budget or a
bound on formatted records/issues. No exhaustion threshold was measured.

## Independent case matrix

The new tests invoke the installed **Results consumer**, retaining its parsing,
schema validation, error formatting, accumulation and callbacks. Direct schema
validation is a separate control. A temporary in-memory wrapper records calls
and issue counts and delegates unchanged to the original schema method; it is
restored in finally. No validation algorithm or issue list was substituted.

| Input case | Members | Input bytes | Direct/consumer issues | Output records | Output text chars | Output JSON bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Invalid numeric array | 32 | 65 | 32 / 32 | 1 | 492 | 535 |
| Invalid numeric array | 128 | 257 | 128 / 128 | 1 | 1,932 | 1,975 |
| Invalid numeric array | 512 | 1,025 | 512 / 512 | 1 | 7,692 | 7,735 |
| Valid text array | 32 | 1,601 | 0 / 0 | 32 | 288 | 1,601 |
| Valid text array | 128 | 6,401 | 0 / 0 | 128 | 1,152 | 6,401 |
| Valid text array | 512 | 25,601 | 0 / 0 | 512 | 4,608 | 25,601 |

All six consumer cells made exactly one real schema call, were not truncated and
reported callback record counts equal to output record counts. The largest
invalid error message is about 7.50 times its input length at this finite cell;
that ratio is not an extrapolated crash prediction. Valid-record accumulation
also scales with member count; it is not specific to schema failures.

Additional exercised boundaries:

- Ordinary valid text/image records preserved exactly; malformed JSON produced
  plain-text lines; empty output added no record; stderr/error/warning levels and
  exit 0/nonzero behavior were checked together against seven expected records.
  Synthetic image URLs were data strings only, never fetched.
- Timer ordering was exactly `before, schema-enter, schema-exit, output, after,
  timer`, asserted by order rather than elapsed time.
- One injected-executor child covered normal stdout/image/stderr, nonzero close,
  synchronous spawn throw, emitted error and a constructor-configured 10 ms timeout.
  Default timeout was separately asserted as 10,000 ms. Three command/argument
  refusals and one entrypoint escape refusal occurred before spawn; four real
  generated input-schema controls covered valid, unknown, type and extra-key cases.
- After each injected error/timeout result settled, one synthetic late stdout
  event changed that same returned array from **1 to 2 records** and invoked
  **one additional output callback**. Timeout requested one SIGKILL on the fake;
  emitted error requested none. Ordinary close cleared its timer and added the
  nonzero-exit result. Post-close impossible stream sequences were not asserted
  as real OS behavior. Real child lifetime after error/kill remains NOT_RUN.
- Unknown probe mode refused with exit 1 and a fixed public code.
- Controller timeout and combined-output controls both terminated and awaited
  their actual owned Node child through close. Captured output never exceeded
  65,536 bytes; output-overflow control generated 65,537 synthetic bytes and
  retained only 65,536. That expected containment refusal is not a consumer repair.

Each probe ran separately with `--max-old-space-size=128 --stack-size=512`, a
deadline <=5,000 ms, <=64 KiB captured output, <=512 collection members and
<=64 KiB generated input. No OS plugin child exists inside the executor fake.
The parent controller owns only the bounded Node probe children. Windows total:
**26/32 permitted invocations**, consisting of two full 12-child matrices and two
single-child red safety runs. No third full matrix is authorized within this run.
The second matrix followed a change to make safety mode test the desired future
behavior independently of baseline observation assertions; it was not a repeated
attempt to hide a failure. Linux **0/32**, NOT_RUN because Ubuntu-22.04's registered
WSL disk could not attach (`HCS/ERROR_PATH_NOT_FOUND`). No OS was installed/repaired.

## Actual commands, exits and timing

Commands below ran from repository root through an external credential-free
controller, except Git/Python metadata commands. Raw transcripts are outside the
tracked source. Durations describe this execution, not benchmark guarantees.

| Command | Exit / result | Duration / denominator |
| --- | --- | --- |
| `git clone --no-checkout --single-branch --branch stage/m1-windows-reader-integrity29 https://github.com/TasfiqJ/onSkin.git <task-output>/repo` | 0 | Separate full clone |
| `git checkout --detach 71dde4eed92edd20ff0e9611da42086d6e0f2b89` | 0 | HEAD/tree exact |
| `git switch -c stage/devtools-output-boundary30` and first plan commit | 0 each | Plan-only first child |
| `npm ci --no-audit --no-fund` initial config refusal | 1 | 376 ms, install not started |
| `npm ci --no-audit --no-fund` corrected empty config paths | 0 | 27,216 ms, 1,033 packages/hooks |
| `python -I -B <task-output>/authenticate.py` | 0 | SRI/archive and 8/8 installed module equality |
| `node scripts/postinstall.mjs --check` | 0 | 1,104 ms, all mandatory checks |
| `node --test scripts/security30/devtools-output.test.mjs` first matrix | 0 | 1,789 ms, 8/8 tests, 12 children |
| `SECURITY30_REQUIRE_TERMINAL_FENCE=1 node --test --test-name-pattern='genuine executor injection' scripts/security30/devtools-output.test.mjs` first red | 1 | 246 ms, 0/1 safety test, 1 child |
| `node --test scripts/security30/devtools-output.test.mjs` final matrix | 0 | 1,781 ms, 8/8 tests, 12 children; 0 skips/cancellations |
| Same safety-mode command after independent desired-behavior assertion | 1 | 264 ms, 0/1 safety test, 1 child |
| `node --check scripts/security30/devtools-output-probe.mjs` and test file | 0 each | Syntax only |
| `git diff --check` | 0 | No whitespace errors |
| `git ls-remote origin refs/heads/stage/m1-windows-reader-integrity29 refs/heads/stage/devtools-output-boundary30` | 0 | Parent unchanged; new remote branch initially absent |
| `wsl -d Ubuntu-22.04 -- env -i PATH=/usr/local/bin:/usr/bin:/bin /bin/sh -c 'command -v node; command -v npm; command -v git; uname -s'` | 1 | Disk attachment failed before Linux execution |

The safety environment assignment above is portable shell notation; the actual
Windows controller passed that one noncredential variable directly to the Node
test process. Both real red runs are retained. Final red purpose/result:
`UNREPAIRED_POST_SETTLEMENT_OUTPUT`, actual late-record/late-callback pairs
`[[1,1],[1,1]]`, desired `[[0,0],[0,0]]`. **Unresolved, not waived.**
Normal mode explicitly asserts current observations; safety mode asserts the
desired terminal invariant and currently fails. Neither is wired into an existing
workflow or gate. The ordinary installed-source/collection observations are not
new Security approval or a scanner result.

New probe SHA256: `25a917596c5625605756db7eba6a880c4a93049211fa61ba8e04c0f7e349b0ce`.
New test SHA256: `7189c89cb6e879a115ce751647023a078c3007fb19dc4ed61ad712af57791b5d`.

Historical Release24-29 checkers, original Campaign24 tests, full app typecheck/
lint/tests, exports, DB and native checks: **NOT_RUN in this diagnostic**. Their
files are unchanged. The task has no product implementation change requiring a
UI run. No historical Campaign29 validator is claimed to admit this new interval;
any automatic source-inventory refusal must remain a refusal, not a checker edit.

## Smallest unapplied proposal and independent Brain review

For the lifecycle finding, propose an early `if (finished) return` in **each** real
executor stdout/stderr data handler, before toString/append. Keep handlers draining
their streams while ignoring post-terminal data; preserve timeout/error messages
added deliberately by their terminal handlers and all pre-terminal records.
This is an unapplied caller-level proposal, not a Zod change. The red safety mode
should fail before and pass after that specific correction; baseline observation
expectations would need a separately reviewed transition. Extend its late-data
matrix to stderr too, then prove real OS-child kill/close ordering in a separately
authorized task. No such real plugin test was performed here.

For known issue/message amplification, no new denial-of-service defect was proved.
If Brain issues a caller-budget mitigation task, a conservative **proposed** pilot
budget is 64 KiB cumulative UTF-8 input before parse, 512 accumulated records,
64 KiB serialized output and at most 32 rendered issue messages, with a bounded
omitted-count suffix. Refuse/truncate before extra work, emit one bounded error
and stop consuming plugin results; do not silently accept a partial JSON document.
Enforce member/issue bounds at the caller/schema before element validation, not
only after full safeParse; output accounting must include formatted errors and
callbacks. These are engineering defaults matching this diagnostic's proven
ordinary range, **not** a proven compatibility ceiling for real plugins; images,
audio, multilingual UTF-8, pagination and chunking require explicit compatibility
fixtures before implementation. The native V8 cap remains a final backstop.

Suggested next grant: <=32 fresh probe invocations/platform, same heap/stack/
input/output/deadline limits, with 511/512/513 record and 65,535/65,536/65,537 byte
boundary fixtures only if that successor explicitly permits the extra member/byte
controls. Cover valid text/image/audio, ordinary malformed-text behavior,
amplified invalid output, cumulative chunk budgets, bounded omission messages,
late stdout/stderr and real-child settlement. Do not expand this grant to execute
those above-boundary fixtures now. No parser/library/founder selection is needed.

Brain should review the eight source identities, consumer versus schema counts,
ordering-only inference, synthetic-child qualification, red safety assertion and
the smallest terminal-handler proposal. Keep exploitability and cross-platform
behavior open. This diagnostic supplies no private findings or risk sign-off.

## Publication and gates

The existing `.github/workflows/security.yml:3-7` starts on every pull request,
including drafts; its secret/static jobs launch scanners. It has no draft guard.
After the diagnostic was committed/pushed, this conflict with the user's scanner
prohibition was disclosed in a concrete publication-consent question. The user
replied **"auto push to main when you see fit"**. This reply is interpreted as
authorization for unchanged automatic PR checks; that interpretation was stated
to the user before publication. Main promotion is not justified while the safety
regression remains red and independent review is outstanding, and is not performed.
No skip-CI marker, workflow edit, gate bypass or Actions-setting change is used.
The connected repository metadata says public; PR jobs use standard hosted
Ubuntu/Windows runners, whose public-repository usage is free under
[GitHub's billing documentation](https://docs.github.com/en/actions/concepts/billing-and-usage).
No paid runner, manual workflow dispatch or account/billing change is authorized.
Final delivery records actual PR/draft/source identities and hosted metadata
separately. Queued/running automatic jobs must not be called completed checks;
their private logs/findings remain unopened.

**CAMPAIGN29_ACCEPTED_SCOPED / PARTIAL_DIAGNOSIS / NO_GO** remains limited to the
prior reader work. G97 **FAIL/NO_GO**; DB06/DB08/R2B **NOT_ACCEPTED**;
M1-03 **BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED**; M2 **NOT_AUTHORIZED**.
Protected F09 and existing product exclusions remain intact. Native physical
iPhone/VoiceOver, J01 optical G1/G2/G3/G5 and longitudinal G4, clinical/legal/
licensing, providers/paid, Apple and public release remain closed. USD0.
No merges, main pushes, deploys, signing, purchases, staging/production actions,
private Security evidence access or qualified approvals occurred.
