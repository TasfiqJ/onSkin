# M1-03 private diagnostics

SECURITY-HARDEN-01 adds Linux inotify witnesses and a bubblewrap capsule. Every
existing Python cache, launcher, venv link, installation/acquisition file, system
interpreter import path and ELF dependency is measured. An external manifest
SHA-256 is required by `source_scan.py --tool-manifest-sha256 DIGEST`; retain the
prepare seal outside the candidate. `-I -B` prevents inherited imports and new
bytecode writes; existing caches are measured, never assumed disabled by `-B`.

Each rule-metadata parse and actual scan copies the validated source, venv,
helpers, system imports and libraries into a private mount-namespace tmpfs.
Copied bytes are verified, then a nested namespace mounts the image readonly,
drops capabilities and exposes only measured runtime files, private tmp and
proc/dev. The native CLI's trust file is projected from the pinned certifi bundle.
The original sandbox seccomp policy and a separate network namespace both apply.
Git object/byte/inode checks and inotify run before and after each execution;
change-and-restore, rename, queue overflow, added files, links and hardlinks refuse.
Timeouts kill and join the complete process group. The trusted kernel, verifier
and independently retained manifest digest remain explicit trust inputs.

`test_integrity.py` exercises real kernel denial, original-core vulnerable/benign
scans, cache/link/FIFO tampering, host mutation during execution and final rehash.
Set `ONSKIN_TEST_CANDIDATE` to a freshly verified private install to run every
method. Missing Linux capabilities or candidate inputs remain explicit failures
or documented skips. `prepare --wheel-cache DIR` reuses only exact hash-verified
public wheels and still installs/resolves/checks the complete graph afresh.

The historical SECURITY-HARDEN-01 `sandbox.py` preimage digest was malformed.
SOURCE-CLOSURE-01 supplies the independently reviewed 64-character digest;
no new sandbox change has been justified. The sealed capsule remains private.

`hydrate_history.py` verifies every immutable historical witness against real
commit/blob bytes and exports a private Git pack for isolated Linux import.
Missing reachable objects can be read from an explicitly selected authorized
local Git repository, rehashed and imported without changing any source ref.
SC03 enumerates that authentic source before witness verification, including
missing commit/tree descendants. Offline verification retains
`GIT_NO_LAZY_FETCH=1`; blob SHA1/SHA256, endpoint types, full reachability and a
fresh independent pack import must agree. `test_cloud_history_custody.py` uses
the real issued history and deliberately incomplete/corrupt private pools.
`history_custody.py` gives synthetic governance tests their own copied Git object
pool and exact historical documents; successor issuances cannot contaminate
an older interval. Missing objects always fail instead of becoming substitutes.

Every output is **NON_ADMITTING / UNREVIEWED**. Admission is always NONE. No runtime,
package script, workflow, source acceptance policy or frozen scanner consumes this
namespace. Original tools, rule hashes, exception dates and expiry remain unchanged.

Use Linux x86_64 / Python 3.12. `candidate.py prepare /root/onskin-overnight01-NAME`
requires a new private directory, downloads only exact official PyPI wheels and
retains upstream originals. The sole Semgrep derivative changes its exact MCP
requirement and RECORD. Installation uses the complete hash-pinned graph with
dependency resolution enabled; `pip check` and the installed tree are independently
checked. `candidate.py verify DIR` verifies integrity, never acceptance.

`adverse_install.py DIR` exercises actual dependency/launcher/wheel drift and restores
every private byte. `fixtures.py DIR NEW_WORK` invokes the unchanged upstream core
on synthetic vulnerable/benign code. Run `compatibility.py` with the candidate Python
through `sandbox.py HOME COMMAND...` for in-memory MCP lifecycle, certificate trust
and actual socket/listener refusal. Scans use a clean environment and inherited Linux
seccomp denial of IPv4/IPv6 sockets, connect, bind and listen. No source upload,
telemetry, credentials or found-credential validation is authorized.

`source_scan.py --candidate DIR --repo REPO --commit FULL_SHA --work NEW_WORK
--rules EXACT_RULE_DIRECTORY --pins ISSUED_CANDIDATE_TOOL_INPUTS.json
--tool-manifest-sha256 DIGEST` materializes
committed UTF-8 Git blobs only. Every tracked path retains its object and content
identity; nonregular/binary inputs remain explicit. All four exact bundles execute
independently with finite timeouts. Coverage, errors, findings and raw exits remain
separate. Raw outputs stay private; publish only inspected redacted derivatives.
Language applicability does not imply a rule actually executed; parsed rule IDs,
profiled rule IDs, skipped rules and unscanned targets remain available for review.

`reconcile.py --repo REPO --proof ORIGINAL_PROOF --sarif ORIGINAL_SARIF --output SAFE_JSON`
retains every original current/history finding with exact source/blob/range when
recoverable. Redaction can prevent proof; those records stay UNKNOWN. Public-input
hash proposals require exact committed input reproduction and the scanner's redacted
match, not entropy or appearance. No new disposition extends accepted history.

`node dependencies.mjs REPO FULL_SHA NPM_JSON OSV_JSON OUTPUT_JSON` binds every
available advisory to actual lock paths, dependency chains and dev/runtime exposure.
Mitigation tests do not renew an expired exception. Retain raw exits and primary
advisory snapshot identities separately. Candidate package exposure is distinct from
the application's npm graph.

Run deterministic/adversarial unit checks with `python -B -m unittest discover -s
scripts/security_readiness/m103 -p test_diagnostics.py -v`. These synthetic checks
prove tooling behavior only. Actual execution receipts and unresolved work live at
`docs/brain/checkpoints/M1-03/OVERNIGHT-01/`.
